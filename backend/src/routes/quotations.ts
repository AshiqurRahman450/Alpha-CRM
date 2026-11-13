import { Router, Request, Response, NextFunction } from 'express';
import { Quotation, Customer, Project, User, Reminder } from '../models';
import { whatsAppWebBot, watiService } from '../services/whatsapp';
import { generateOrSaveQuotationPdf } from '../services/quotation/quotationPdfGenerator';
import { getNextProjectId, getNextCustomerId } from '../utils/idGenerators';
import * as XLSX from 'xlsx';
import jwt from 'jsonwebtoken';
import { config } from '../config';

export const quotationRouter = Router();

// Optional authentication middleware: if token present, sets req.user
async function optionalAuth(req: any, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    const queryToken = req.query?.token as string | undefined;
    let token: string | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (queryToken) {
      token = queryToken;
    }

    if (token) {
      const decoded = jwt.verify(token, config.jwtSecret) as any;
      if (decoded && decoded.id) {
        const user = await User.findById(decoded.id);
        if (user && user.isActive) {
          req.user = user;
        }
      }
    }
  } catch (err) {
    // Ignore invalid tokens for optional auth
  }
  next();
}

quotationRouter.use(optionalAuth);

/**
 * Extracts baseOfferNo and stage from any offer number format
 * e.g. "AE/QTN/AE-261026-131-2" -> base: "AE/QTN/AE-261026-131", stage: 2
 */
export function extractBaseOfferNo(rawOfferNo: string): { baseOfferNo: string; stage: 1 | 2 | 3 | 4 } {
  if (!rawOfferNo) return { baseOfferNo: 'AE/QTN/AE-000000-000', stage: 1 };
  const trimmed = rawOfferNo.trim();
  const match = trimmed.match(/^(.*?)(?:-([1234]))?$/);
  if (match) {
    const base = match[1];
    const s = match[2] ? parseInt(match[2], 10) : 1;
    const stage = (s === 2 ? 2 : s === 3 ? 3 : s === 4 ? 4 : 1) as 1 | 2 | 3 | 4;
    return { baseOfferNo: base, stage };
  }
  return { baseOfferNo: trimmed, stage: 1 };
}

export function formatStageOfferNo(baseOfferNo: string, stage: 1 | 2 | 3 | 4): string {
  const cleanBase = baseOfferNo.replace(/-[1234]$/, '').trim();
  return `${cleanBase}-${stage}`;
}

/**
 * Resolves BDM user details from logged in user or quotation representative fields
 */
async function resolveBdmData(
  req: any,
  bodyData: any,
  inputBdmId?: any,
  inputBdmName?: string,
  inputBdmEmail?: string,
  inputBdmPhone?: string,
  inputRole?: string
) {
  let bdmId: any = inputBdmId;
  let bdmName = inputBdmName;
  let bdmEmail = inputBdmEmail;
  let bdmPhone = inputBdmPhone;
  let createdByRole = inputRole || 'BDM';
  let createdById = req.user?._id;
  let createdByName = req.user?.name;

  if (req.user) {
    if (req.user.role === 'BDM') {
      bdmId = req.user._id;
      bdmName = req.user.name;
      bdmEmail = req.user.email;
      bdmPhone = req.user.phone || bdmPhone;
      createdByRole = 'BDM';
    } else {
      createdByRole = req.user.role;
    }
  }

  if (!bdmName && bodyData?.representativeName) {
    bdmName = bodyData.representativeName;
    if (!bdmPhone && bodyData.representativePhone) bdmPhone = bodyData.representativePhone;
    if (!bdmEmail && bodyData.representativeEmail) bdmEmail = bodyData.representativeEmail;
  }

  if (!bdmId && bdmName) {
    const matchedBdm = await User.findOne({
      $or: [
        { name: new RegExp(`^${bdmName.trim()}$`, 'i'), role: 'BDM' },
        ...(bdmEmail ? [{ email: bdmEmail.toLowerCase() }] : []),
      ],
    });
    if (matchedBdm) {
      bdmId = matchedBdm._id;
      if (!bdmEmail) bdmEmail = matchedBdm.email;
      if (!bdmPhone) bdmPhone = matchedBdm.phone;
    }
  }

  return { bdmId, bdmName, bdmEmail, bdmPhone, createdByRole, createdById, createdByName };
}

/**
 * GET /api/quotations/bdm-stage-wise
 * Returns all customer quotations grouped per customer / baseOfferNo with stage-wise breakdown (Stage 1, 2, 3),
 * KPIs, and filters for BDM view.
 */
quotationRouter.get('/bdm-stage-wise', async (req: any, res: Response) => {
  try {
    const { search, bdmId, bdmName, stage, status, all } = req.query;

    const query: any = {};

    // Role-based scoping: if user is logged in as BDM and not explicitly viewing all
    if (req.user && req.user.role === 'BDM' && !all) {
      query.$or = [
        { bdmId: req.user._id },
        { bdmName: new RegExp(`^${req.user.name}$`, 'i') },
        { 'data.representativeName': new RegExp(`^${req.user.name}$`, 'i') },
      ];
    } else if (bdmId) {
      query.bdmId = bdmId;
    } else if (bdmName && bdmName !== 'ALL') {
      query.$or = [
        { bdmName: new RegExp(`^${String(bdmName).trim()}$`, 'i') },
        { 'data.representativeName': new RegExp(`^${String(bdmName).trim()}$`, 'i') },
      ];
    }

    if (stage) {
      query.stage = Number(stage);
    }

    if (status && status !== 'ALL') {
      query.status = status;
    }

    if (search) {
      const s = String(search).trim();
      const searchRegex = new RegExp(s, 'i');
      const searchClause = [
        { customerName: searchRegex },
        { customerPhone: searchRegex },
        { customerCity: searchRegex },
        { baseOfferNo: searchRegex },
        { offerNo: searchRegex },
        { bdmName: searchRegex },
        { 'data.model': searchRegex },
      ];
      if (query.$or) {
        query.$and = [{ $or: query.$or }, { $or: searchClause }];
        delete query.$or;
      } else {
        query.$or = searchClause;
      }
    }

    const quotations = await Quotation.find(query).sort({ updatedAt: -1 });

    // Group quotations by baseOfferNo
    const groupedMap = new Map<string, any>();

    for (const q of quotations) {
      const base = q.baseOfferNo;
      if (!groupedMap.has(base)) {
        groupedMap.set(base, {
          baseOfferNo: base,
          customerName: q.customerName,
          customerPhone: q.customerPhone,
          customerCity: q.customerCity,
          bdmId: q.bdmId,
          bdmName: q.bdmName || q.data?.representativeName || 'Unassigned BDM',
          bdmEmail: q.bdmEmail || q.data?.representativeEmail || '',
          bdmPhone: q.bdmPhone || q.data?.representativePhone || '',
          createdByRole: q.createdByRole || 'BDM',
          highestStage: q.stage,
          latestStatus: q.status,
          elevatorModel: q.data?.model || 'AE 03 Gearless Belt Home series EV',
          noOfStops: q.data?.noOfStops || 'G+2',
          totalTravelHeight: q.data?.totalTravelHeight || '',
          doorAccess: q.data?.doorOpening || q.data?.doorAccess || 'inline',
          createdAt: q.createdAt,
          updatedAt: q.updatedAt,
          stages: {},
          createdCustomerId: q.createdCustomerId,
          createdCustomerCode: q.createdCustomerCode,
          createdProjectId: q.createdProjectId,
          createdProjectCode: q.createdProjectCode,
        });
      }

      const group = groupedMap.get(base);
      if (q.stage > group.highestStage) {
        group.highestStage = q.stage;
        group.latestStatus = q.status;
      }
      if (new Date(q.updatedAt) > new Date(group.updatedAt)) {
        group.updatedAt = q.updatedAt;
      }
      if (q.createdCustomerCode) group.createdCustomerCode = q.createdCustomerCode;
      if (q.createdProjectCode) group.createdProjectCode = q.createdProjectCode;

      const elevatorPrice = Number(q.data?.elevatorPrice || 0);
      const elevatorDiscountPrice = q.data?.elevatorDiscountPrice && Number(q.data.elevatorDiscountPrice) > 0 ? Number(q.data.elevatorDiscountPrice) : undefined;
      const effectiveElevatorPrice = elevatorDiscountPrice !== undefined ? Math.max(0, elevatorPrice - elevatorDiscountPrice) : elevatorPrice;

      const shaftPrice = Number(q.data?.shaftPrice || 0);
      const shaftDiscountPrice = q.data?.shaftDiscountPrice && Number(q.data.shaftDiscountPrice) > 0 ? Number(q.data.shaftDiscountPrice) : undefined;
      const effectiveShaftPrice = shaftDiscountPrice !== undefined ? Math.max(0, shaftPrice - shaftDiscountPrice) : shaftPrice;

      const basicTotal = effectiveElevatorPrice + effectiveShaftPrice;
      const grandTotal = Math.round(basicTotal * 1.18);

      group.stages[`stage${q.stage}`] = {
        _id: q._id,
        stage: q.stage,
        offerNo: q.offerNo,
        status: q.status,
        elevatorPrice,
        elevatorDiscountPrice,
        shaftPrice,
        shaftDiscountPrice,
        grandTotal,
        updatedAt: q.updatedAt,
        sentToWhatsAppAt: q.sentToWhatsAppAt,
        finalizedAt: q.finalizedAt,
        crmApprovedAt: q.crmApprovedAt,
        data: q.data,
      };
    }

    // Convert map to list and calculate metrics & variances
    const customerQuotations: any[] = [];
    let totalPipelineValue = 0;
    let totalStage1 = 0;
    let totalStage2 = 0;
    let totalStage3 = 0;
    let totalStage4 = 0;
    let totalCrmApproved = 0;

    for (const item of groupedMap.values()) {
      const s1 = item.stages.stage1;
      const s2 = item.stages.stage2;
      const s3 = item.stages.stage3;
      const s4 = item.stages.stage4;

      if (s1) totalStage1++;
      if (s2) totalStage2++;
      if (s3) totalStage3++;
      if (s4) totalStage4++;
      if (item.latestStatus === 'CRM_APPROVED' || s4?.status === 'CRM_APPROVED' || s3?.status === 'CRM_APPROVED') totalCrmApproved++;

      const currentAmount = s4?.grandTotal || s3?.grandTotal || s2?.grandTotal || s1?.grandTotal || 0;
      totalPipelineValue += currentAmount;

      const priceDiff = s4 && s1 ? s4.grandTotal - s1.grandTotal : s3 && s1 ? s3.grandTotal - s1.grandTotal : s2 && s1 ? s2.grandTotal - s1.grandTotal : 0;
      item.priceVariance = priceDiff;
      item.currentAmount = currentAmount;

      customerQuotations.push(item);
    }

    // Fetch active BDM users
    const bdmUsers = await User.find({ role: 'BDM', isActive: true }).select('_id name email phone');

    return res.json({
      success: true,
      count: customerQuotations.length,
      metrics: {
        totalBaseQuotations: customerQuotations.length,
        totalStage1,
        totalStage2,
        totalStage3,
        totalStage4,
        totalCrmApproved,
        totalPipelineValue,
      },
      availableBdms: bdmUsers,
      data: customerQuotations,
    });
  } catch (err: any) {
    console.error('[BdmStageWiseQuotations] Error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/quotations/save-stage
 * Saves or updates quotation data for a specific stage (1, 2, or 3)
 */
quotationRouter.post('/save-stage', async (req: any, res: Response) => {
  try {
    const {
      stage = 1,
      baseOfferNo: inputBase,
      offerNo: inputOffer,
      data,
      customerPhone,
      customerName,
      customerCity,
      status,
      bdmId: inputBdmId,
      bdmName: inputBdmName,
      bdmEmail: inputBdmEmail,
      bdmPhone: inputBdmPhone,
      createdByRole: inputRole,
    } = req.body;

    if (!data) {
      return res.status(400).json({ success: false, message: 'Quotation data snapshot is required' });
    }

    const stageNum = (Number(stage) === 2 ? 2 : Number(stage) === 3 ? 3 : 1) as 1 | 2 | 3;
    const rawOffer = inputOffer || data.offerNo || '';
    const { baseOfferNo } = extractBaseOfferNo(inputBase || rawOffer);
    const finalOfferNo = formatStageOfferNo(baseOfferNo, stageNum);

    const bdmData = await resolveBdmData(
      req,
      data,
      inputBdmId,
      inputBdmName,
      inputBdmEmail,
      inputBdmPhone,
      inputRole
    );

    // Sync offerNo and representative inside data snapshot
    const updatedData = {
      ...data,
      offerNo: finalOfferNo,
      representativeName: bdmData.bdmName || data.representativeName || 'Alpha Elevators BDM',
      representativePhone: bdmData.bdmPhone || data.representativePhone || '',
      representativeEmail: bdmData.bdmEmail || data.representativeEmail || '',
    };

    const clientName = customerName || data.clientName || 'Valued Customer';
    const clientCity = customerCity || data.projectCity || '';
    const phone = customerPhone || data.customerPhone || data.representativePhone || '';

    const updateDoc: any = {
      baseOfferNo,
      stage: stageNum,
      offerNo: finalOfferNo,
      customerName: clientName,
      customerPhone: phone,
      customerCity: clientCity,
      data: updatedData,
      status: status || 'DRAFT',
    };

    if (bdmData.bdmId) updateDoc.bdmId = bdmData.bdmId;
    if (bdmData.bdmName) updateDoc.bdmName = bdmData.bdmName;
    if (bdmData.bdmEmail) updateDoc.bdmEmail = bdmData.bdmEmail;
    if (bdmData.bdmPhone) updateDoc.bdmPhone = bdmData.bdmPhone;
    if (bdmData.createdByRole) updateDoc.createdByRole = bdmData.createdByRole;
    if (bdmData.createdById) updateDoc.createdById = bdmData.createdById;
    if (bdmData.createdByName) updateDoc.createdByName = bdmData.createdByName;

    const quotation = await Quotation.findOneAndUpdate(
      { baseOfferNo, stage: stageNum },
      { $set: updateDoc },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.json({
      success: true,
      message: `Stage ${stageNum} saved successfully with Offer No: ${finalOfferNo}`,
      data: quotation,
    });
  } catch (err: any) {
    console.error('[QuotationSaveStage] Error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/quotations/by-offer/:offerNo
 * Find quotation by full offerNo (with suffix) or baseOfferNo and optional ?stage=1|2|3
 */
quotationRouter.get('/by-offer/:offerNo', async (req: Request, res: Response) => {
  try {
    const rawOffer = decodeURIComponent(req.params.offerNo);
    const stageQuery = req.query.stage ? Number(req.query.stage) : undefined;

    const { baseOfferNo, stage: extractedStage } = extractBaseOfferNo(rawOffer);
    const targetStage = stageQuery || extractedStage || 1;

    // 1. Try finding exact offerNo
    let quotation = await Quotation.findOne({
      $or: [{ offerNo: rawOffer }, { offerNo: `${baseOfferNo}-${targetStage}` }],
    });

    // 2. Fallback: match baseOfferNo and highest stage or targetStage
    if (!quotation) {
      quotation = await Quotation.findOne({ baseOfferNo, stage: targetStage });
    }

    if (!quotation) {
      // Return highest existing stage for this baseOfferNo
      quotation = await Quotation.findOne({ baseOfferNo }).sort({ stage: -1 });
    }

    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: `No quotation found matching "${rawOffer}"`,
      });
    }

    return res.json({
      success: true,
      data: quotation,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/quotations/stage-history/:offerNo
 * Returns all stages (1, 2, 3) available for this quotation
 */
quotationRouter.get('/stage-history/:offerNo', async (req: Request, res: Response) => {
  try {
    const rawOffer = decodeURIComponent(req.params.offerNo);
    const { baseOfferNo } = extractBaseOfferNo(rawOffer);

    const stages = await Quotation.find({ baseOfferNo }).sort({ stage: 1 });

    return res.json({
      success: true,
      baseOfferNo,
      count: stages.length,
      data: stages,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/quotations/finalize
 * Finalizes current stage, adds suffix (-1, -2, -3) and marks status = FINALIZED
 */
quotationRouter.post('/finalize', async (req: any, res: Response) => {
  try {
    const { offerNo: inputOffer, stage = 1, data, customerPhone } = req.body;

    const stageNum = (Number(stage) === 2 ? 2 : Number(stage) === 3 ? 3 : 1) as 1 | 2 | 3;
    const rawOffer = inputOffer || data?.offerNo || '';
    const { baseOfferNo } = extractBaseOfferNo(rawOffer);
    const finalOfferNo = formatStageOfferNo(baseOfferNo, stageNum);

    const updatedData = {
      ...(data || {}),
      offerNo: finalOfferNo,
    };

    const clientName = updatedData.clientName || 'Valued Customer';
    const phone = customerPhone || updatedData.customerPhone || '';

    const bdmData = await resolveBdmData(req, updatedData);

    const updateDoc: any = {
      baseOfferNo,
      stage: stageNum,
      offerNo: finalOfferNo,
      customerName: clientName,
      customerPhone: phone,
      data: updatedData,
      status: 'FINALIZED',
      finalizedAt: new Date(),
    };

    if (bdmData.bdmId) updateDoc.bdmId = bdmData.bdmId;
    if (bdmData.bdmName) updateDoc.bdmName = bdmData.bdmName;
    if (bdmData.bdmEmail) updateDoc.bdmEmail = bdmData.bdmEmail;
    if (bdmData.bdmPhone) updateDoc.bdmPhone = bdmData.bdmPhone;
    if (bdmData.createdByRole) updateDoc.createdByRole = bdmData.createdByRole;
    if (bdmData.createdById) updateDoc.createdById = bdmData.createdById;
    if (bdmData.createdByName) updateDoc.createdByName = bdmData.createdByName;

    const quotation = await Quotation.findOneAndUpdate(
      { baseOfferNo, stage: stageNum },
      { $set: updateDoc },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.json({
      success: true,
      message: `Quotation Stage ${stageNum} finalized successfully! Offer No: ${finalOfferNo}`,
      data: quotation,
    });
  } catch (err: any) {
    console.error('[QuotationFinalize] Error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/quotations/whatsapp-send
 * Dispatches or prepares WhatsApp message with Quotation PDF attached directly
 */
quotationRouter.post('/whatsapp-send', async (req: Request, res: Response) => {
  try {
    const { offerNo, stage = 1, customerPhone, messageText, customerName, pdfBase64, data } = req.body;

    if (!customerPhone) {
      return res.status(400).json({ success: false, message: 'Customer WhatsApp phone number is required' });
    }

    const { baseOfferNo } = extractBaseOfferNo(offerNo);
    const stageNum = (Number(stage) === 2 ? 2 : Number(stage) === 3 ? 3 : 1) as 1 | 2 | 3;
    const finalOfferNo = formatStageOfferNo(baseOfferNo, stageNum);

    // Format phone to clean international digits
    const cleanedDigits = customerPhone.replace(/\D/g, '');
    const intlPhone =
      cleanedDigits.startsWith('91') && cleanedDigits.length === 12
        ? cleanedDigits
        : cleanedDigits.length === 10
        ? `91${cleanedDigits}`
        : cleanedDigits;

    // Retrieve active quote data if not passed in request body
    let activeData = data;
    if (!activeData) {
      const existingQuote = await Quotation.findOne({ baseOfferNo, stage: stageNum });
      if (existingQuote && existingQuote.data) {
        activeData = existingQuote.data;
      }
    }

    // 1. Generate or Save the Quotation PDF Attachment!
    const { filePath, relativeUrl, fileName } = await generateOrSaveQuotationPdf({
      data: {
        ...(activeData || {}),
        offerNo: finalOfferNo,
        clientName: customerName || activeData?.clientName || 'Customer',
      },
      stage: stageNum,
      pdfBase64,
    });

    const backendUrl =
      process.env.APP_URL ||
      (config.nodeEnv === 'production' ? 'https://crmapi.alphaelevators.io' : `http://localhost:${config.port || 5000}`);
    const fullPdfUrl = `${backendUrl}${relativeUrl}`;

    const stageLabel = stageNum === 1 ? 'Initial Proposal' : stageNum === 2 ? 'Negotiation Revision' : 'Final Commercial Proposal';
    const clientName = customerName || activeData?.clientName || 'Valued Customer';
    const effectiveElevator = Number((activeData?.elevatorDiscountPrice && Number(activeData.elevatorDiscountPrice) > 0) ? Math.max(0, (activeData.elevatorPrice || 0) - Number(activeData.elevatorDiscountPrice)) : (activeData?.elevatorPrice || 0));
    const effectiveShaft = Number((activeData?.shaftDiscountPrice && Number(activeData.shaftDiscountPrice) > 0) ? Math.max(0, (activeData.shaftPrice || 0) - Number(activeData.shaftDiscountPrice)) : (activeData?.shaftPrice || 0));
    const totalContractVal = Math.round((effectiveElevator + effectiveShaft) * 1.18);

    const caption = `📄 *Alpha Elevators - Official Quotation Proposal (${stageLabel})*

Dear ${clientName},

Please find attached your official quotation proposal document.

• *Offer Number:* ${finalOfferNo}
• *Lifecycle Stage:* Stage ${stageNum} (${stageLabel})
• *Model Selected:* ${activeData?.model || 'Alpha Home Elevator'}
• *Stops & Height:* ${activeData?.noOfStops || 'G+2'} (${activeData?.totalTravelHeight || '7000mm'})
• *Total Contract Value:* INR ${totalContractVal.toLocaleString('en-IN')} (Incl. 18% GST)

Kindly review the attached official PDF. Our technical team is available to assist with civil dimensions and site measurements.

Warm regards,  
*Alpha Elevators Technical Sales Team*`;

    const textToSend = messageText || caption;

    // Update Quotation record in DB with pdfUrl and BDM details
    const bdmData = await resolveBdmData(req, activeData);
    const waUpdateDoc: any = {
      customerPhone: intlPhone,
      status: 'SENT_TO_CUSTOMER',
      sentToWhatsAppAt: new Date(),
      'data.pdfUrl': relativeUrl,
    };
    if (bdmData.bdmId) waUpdateDoc.bdmId = bdmData.bdmId;
    if (bdmData.bdmName) waUpdateDoc.bdmName = bdmData.bdmName;
    if (bdmData.bdmEmail) waUpdateDoc.bdmEmail = bdmData.bdmEmail;
    if (bdmData.bdmPhone) waUpdateDoc.bdmPhone = bdmData.bdmPhone;
    if (bdmData.createdByRole) waUpdateDoc.createdByRole = bdmData.createdByRole;

    await Quotation.findOneAndUpdate(
      { baseOfferNo, stage: stageNum },
      { $set: waUpdateDoc },
      { upsert: false }
    );

    // 2. Dispatch the actual PDF document attachment via WhatsApp Web Bot
    let botSent = false;
    let botMsgId = '';
    const botStatus = whatsAppWebBot.getStatus();

    if (botStatus.isConnected) {
      try {
        console.log(`[QuotationWhatsApp] Attaching and sending PDF document "${fileName}" directly to +${intlPhone}`);
        const docRes = await whatsAppWebBot.sendDirectDocument(
          `+${intlPhone}`,
          filePath,
          fileName,
          caption
        );

        if (docRes.success) {
          botSent = true;
          botMsgId = docRes.messageId || '';
          console.log(`[QuotationWhatsApp] PDF attached & sent successfully to +${intlPhone}! ID: ${botMsgId}`);
        } else {
          console.warn('[QuotationWhatsApp] sendDirectDocument error:', docRes.error);
          // Fallback to text message
          const msgRes = await whatsAppWebBot.sendDirectMessage(`+${intlPhone}`, textToSend);
          if (msgRes.success) {
            botSent = true;
            botMsgId = msgRes.messageId || '';
          }
        }
      } catch (botErr: any) {
        console.warn('[QuotationWhatsApp] Web Bot dispatch error:', botErr.message);
      }
    } else if (config.wati.token) {
      // 3. Dispatch via WATI file session
      try {
        const watiRes = await watiService.sendGroupMedia({
          groupId: `QTN_${finalOfferNo.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
          customerPhone: intlPhone,
          mediaType: 'document',
          mediaUrl: fullPdfUrl,
          filename: fileName,
          caption,
        });
        if (watiRes.success) {
          botSent = true;
          botMsgId = watiRes.messageId || '';
        }
      } catch (watiErr: any) {
        console.warn('[QuotationWhatsApp] WATI dispatch error:', watiErr.message);
      }
    }

    // 4. WhatsApp Direct Click-to-Chat URL (includes direct PDF download link)
    const directWaText = `${caption}\n\n📥 *Download PDF Proposal Document:*\n${fullPdfUrl}`;
    const directWaUrl = `https://api.whatsapp.com/send?phone=${intlPhone}&text=${encodeURIComponent(directWaText)}`;

    return res.json({
      success: true,
      message: botSent
        ? `Quotation PDF document attached and sent directly to +${intlPhone} via WhatsApp!`
        : `Quotation PDF generated and WhatsApp link ready with attached document link for +${intlPhone}`,
      botSent,
      botMsgId,
      phone: intlPhone,
      pdfUrl: relativeUrl,
      fullPdfUrl,
      directWaUrl,
    });
  } catch (err: any) {
    console.error('[QuotationWhatsAppSend] Error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/quotations/request-approval
 * Submits a Stage 3 quotation for CRM Approval (used by BDM role).
 * Does NOT create Customer or Project yet. Sends reminder to CRM and Admin.
 */
quotationRouter.post('/request-approval', async (req: any, res: Response) => {
  try {
    const {
      offerNo: inputOffer,
      quotationId,
      notes,
      bdmId: inputBdmId,
      bdmName: inputBdmName,
      bdmPhone: inputBdmPhone,
    } = req.body;

    let quotation: any = null;
    if (quotationId) {
      quotation = await Quotation.findById(quotationId);
    } else if (inputOffer) {
      const { baseOfferNo } = extractBaseOfferNo(inputOffer);
      quotation = await Quotation.findOne({ baseOfferNo, stage: 4 });
      if (!quotation) {
        quotation = await Quotation.findOne({ baseOfferNo, stage: 3 });
      }
      if (!quotation) {
        quotation = await Quotation.findOne({ baseOfferNo }).sort({ stage: -1 });
      }
    }

    if (!quotation) {
      return res.status(404).json({ success: false, message: 'Quotation not found for approval request' });
    }

    if (quotation.status === 'CRM_APPROVED') {
      return res.json({
        success: true,
        alreadyApproved: true,
        message: `Quotation is already approved by CRM (Project: ${quotation.createdProjectCode || 'Created'})`,
        quotation,
      });
    }

    const qData = quotation.data || {};
    const elevatorPrice = Number(qData.elevatorPrice || 0);
    const effectiveElevatorPrice = Number((qData.elevatorDiscountPrice && Number(qData.elevatorDiscountPrice) > 0) ? Math.max(0, elevatorPrice - Number(qData.elevatorDiscountPrice)) : elevatorPrice);
    const shaftPrice = Number(qData.shaftPrice || 0);
    const effectiveShaftPrice = Number((qData.shaftDiscountPrice && Number(qData.shaftDiscountPrice) > 0) ? Math.max(0, shaftPrice - Number(qData.shaftDiscountPrice)) : shaftPrice);
    const gstRate = Number(qData.gstRate || 18);
    const subtotal = effectiveElevatorPrice + effectiveShaftPrice;
    const orderValue = subtotal + Math.round((subtotal * gstRate) / 100);

    const bdmName = req.user?.name || inputBdmName || quotation.bdmName || quotation.data?.representativeName || 'BDM';
    const bdmRole = req.user?.role || 'BDM';
    const bdmId = req.user ? req.user._id : inputBdmId || quotation.bdmId;
    const bdmPhone = req.user?.phone || inputBdmPhone || quotation.bdmPhone || quotation.data?.representativePhone;
    const bdmEmail = req.user?.email || quotation.bdmEmail;
    const customerName = qData.clientName || quotation.customerName || 'Customer';

    quotation.status = 'APPROVAL_REQUESTED';
    quotation.approvalRequestedAt = new Date();
    quotation.approvalRequestedBy = bdmId;
    quotation.approvalRequestedByName = bdmName;
    quotation.approvalRequestedByRole = bdmRole;
    if (bdmId) quotation.bdmId = bdmId;
    if (bdmName) quotation.bdmName = bdmName;
    if (bdmPhone) quotation.bdmPhone = bdmPhone;
    if (bdmEmail) quotation.bdmEmail = bdmEmail;
    if (notes) quotation.stageNotes = notes;
    await quotation.save();

    // Create Reminder for all active CRM and Admin users
    const notifyUsers = await User.find({ role: { $in: ['CRM', 'ADMIN'] }, isActive: true });
    for (const u of notifyUsers) {
      const existing = await Reminder.findOne({
        userId: u._id,
        $or: [
          { relatedQuotationId: quotation._id },
          { relatedQuotationOfferNo: quotation.offerNo },
        ],
        status: 'PENDING',
      });

      if (!existing) {
        await Reminder.create({
          userId: u._id,
          title: `Quotation Approval Request: ${quotation.offerNo} (${customerName})`,
          notes: `BDM ${bdmName} submitted Stage 3 Quotation for ${customerName} (₹${orderValue.toLocaleString('en-IN')}). Please review and approve to auto-create Customer & Project on CRM.`,
          dueAt: new Date(),
          status: 'PENDING',
          type: 'QUOTATION_APPROVAL',
          relatedQuotationId: quotation._id,
          relatedQuotationOfferNo: quotation.offerNo,
          customerName,
          actionRequired: true,
        });
      }
    }

    return res.json({
      success: true,
      requestSent: true,
      message: `Approval request submitted for Quotation ${quotation.offerNo}! Notifications sent to CRM and Admin on reminders.`,
      quotation,
    });
  } catch (err: any) {
    console.error('[QuotationRequestApproval] Error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/quotations/crm-approve
 * Approves a Stage 3 quotation and automatically creates Customer and Project on CRM!
 * If requested by BDM role, does NOT create immediately; routes to request-approval instead.
 */
quotationRouter.post('/crm-approve', async (req: any, res: Response) => {
  try {
    const { offerNo: inputOffer, quotationId } = req.body;

    let quotation: any = null;
    if (quotationId) {
      quotation = await Quotation.findById(quotationId);
    } else if (inputOffer) {
      const { baseOfferNo } = extractBaseOfferNo(inputOffer);
      quotation = await Quotation.findOne({ baseOfferNo, stage: 4 });
      if (!quotation) {
        quotation = await Quotation.findOne({ baseOfferNo, stage: 3 });
      }
      if (!quotation) {
        // Fallback to highest existing stage
        quotation = await Quotation.findOne({ baseOfferNo }).sort({ stage: -1 });
      }
    }

    if (!quotation) {
      return res.status(404).json({ success: false, message: 'Quotation not found for CRM approval' });
    }

    // If quotation was already CRM approved, return existing customer & project idempotently
    if (quotation.status === 'CRM_APPROVED' && quotation.createdProjectId) {
      const existingProject = await Project.findById(quotation.createdProjectId);
      const existingCustomer = quotation.createdCustomerId
        ? await Customer.findById(quotation.createdCustomerId)
        : null;

      // Ensure any lingering approval reminders are dismissed
      await Reminder.updateMany(
        {
          $or: [
            { relatedQuotationId: quotation._id },
            { relatedQuotationOfferNo: quotation.offerNo },
          ],
          status: 'PENDING',
        },
        { status: 'DISMISSED' }
      );

      if (existingProject) {
        return res.json({
          success: true,
          alreadyApproved: true,
          message: `Quotation ${quotation.offerNo} is already approved! Project ${existingProject.projectId} and Customer ${existingCustomer?.customerId || quotation.createdCustomerCode} are active.`,
          customer: existingCustomer,
          project: existingProject,
          quotation,
        });
      }
    }

    const qData = quotation.data || {};
    const elevatorPrice = Number(qData.elevatorPrice || 0);
    const effectiveElevatorPrice = Number((qData.elevatorDiscountPrice && Number(qData.elevatorDiscountPrice) > 0) ? Math.max(0, elevatorPrice - Number(qData.elevatorDiscountPrice)) : elevatorPrice);
    const shaftPrice = Number(qData.shaftPrice || 0);
    const effectiveShaftPrice = Number((qData.shaftDiscountPrice && Number(qData.shaftDiscountPrice) > 0) ? Math.max(0, shaftPrice - Number(qData.shaftDiscountPrice)) : shaftPrice);
    const gstRate = Number(qData.gstRate || 18);
    const subtotal = effectiveElevatorPrice + effectiveShaftPrice;
    const gstAmount = Math.round((subtotal * gstRate) / 100);
    const orderValue = subtotal + gstAmount;

    const fullName = qData.clientName || quotation.customerName || 'New Client';
    const phone = quotation.customerPhone || qData.customerPhone || qData.representativePhone || '9800000000';
    const city = qData.projectCity || quotation.customerCity || 'Mumbai';
    const siteAddress = (qData.siteAddress || `${city}, Site Location`).trim();

    // If requester is BDM: Do NOT create Customer + Project immediately. Send request to CRM & Admin reminders!
    if (req.user?.role === 'BDM') {
      const bdmName = req.user?.name || quotation.bdmName || 'BDM';

      quotation.status = 'APPROVAL_REQUESTED';
      quotation.approvalRequestedAt = new Date();
      quotation.approvalRequestedBy = req.user._id;
      quotation.approvalRequestedByName = bdmName;
      quotation.approvalRequestedByRole = 'BDM';
      quotation.bdmId = req.user._id;
      quotation.bdmName = bdmName;
      if (req.user.phone) quotation.bdmPhone = req.user.phone;
      if (req.user.email) quotation.bdmEmail = req.user.email;
      await quotation.save();

      const notifyUsers = await User.find({ role: { $in: ['CRM', 'ADMIN'] }, isActive: true });
      for (const u of notifyUsers) {
        const existing = await Reminder.findOne({
          userId: u._id,
          $or: [
            { relatedQuotationId: quotation._id },
            { relatedQuotationOfferNo: quotation.offerNo },
          ],
          status: 'PENDING',
        });

        if (!existing) {
          await Reminder.create({
            userId: u._id,
            title: `Quotation Approval Request: ${quotation.offerNo} (${fullName})`,
            notes: `BDM ${bdmName} submitted Stage 3 Quotation for ${fullName} (₹${orderValue.toLocaleString('en-IN')}). Please review and approve to auto-create Customer & Project on CRM.`,
            dueAt: new Date(),
            status: 'PENDING',
            type: 'QUOTATION_APPROVAL',
            relatedQuotationId: quotation._id,
            relatedQuotationOfferNo: quotation.offerNo,
            customerName: fullName,
            actionRequired: true,
          });
        }
      }

      return res.json({
        success: true,
        requestSent: true,
        message: `Approval request sent to CRM & Admin! The Customer and Project will be created once CRM or Admin reviews and approves on their Reminders.`,
        quotation,
      });
    }

    // Resolve target BDM for this quotation so Customer & Project are assigned to this particular BDM
    let targetBdmId = quotation.bdmId;
    let targetBdmName = quotation.bdmName;
    let targetBdmPhone = quotation.bdmPhone;
    let targetBdmEmail = quotation.bdmEmail;

    if (!targetBdmId && quotation.approvalRequestedBy && quotation.approvalRequestedByRole === 'BDM') {
      targetBdmId = quotation.approvalRequestedBy;
      if (quotation.approvalRequestedByName) targetBdmName = quotation.approvalRequestedByName;
    }

    if (!targetBdmId && quotation.createdById && quotation.createdByRole === 'BDM') {
      targetBdmId = quotation.createdById;
      if (quotation.createdByName) targetBdmName = quotation.createdByName;
    }

    let bdmUser: any = null;
    if (targetBdmId) {
      try {
        bdmUser = await User.findById(targetBdmId);
      } catch (e) {}
    }

    if (!bdmUser) {
      const candidateNames = [
        targetBdmName,
        quotation.approvalRequestedByName,
        quotation.data?.representativeName,
        quotation.createdByName,
      ].filter((n) => typeof n === 'string' && n.trim());

      for (const name of candidateNames) {
        bdmUser = await User.findOne({
          role: 'BDM',
          name: new RegExp(`^${name.trim()}$`, 'i'),
        });
        if (bdmUser) break;
      }
    }

    if (!bdmUser) {
      const candidatePhones = [
        targetBdmPhone,
        quotation.data?.representativePhone,
      ].filter(Boolean);

      for (const phoneStr of candidatePhones) {
        const cleaned = String(phoneStr).replace(/\D/g, '').slice(-10);
        if (cleaned) {
          bdmUser = await User.findOne({
            role: 'BDM',
            phone: new RegExp(cleaned),
          });
          if (bdmUser) break;
        }
      }
    }

    if (bdmUser) {
      targetBdmId = bdmUser._id;
      targetBdmName = bdmUser.name;
      targetBdmPhone = bdmUser.phone || targetBdmPhone;
      targetBdmEmail = bdmUser.email || targetBdmEmail;
    }

    // Persist verified BDM onto quotation
    if (targetBdmId) quotation.bdmId = targetBdmId;
    if (targetBdmName) quotation.bdmName = targetBdmName;
    if (targetBdmPhone) quotation.bdmPhone = targetBdmPhone;
    if (targetBdmEmail) quotation.bdmEmail = targetBdmEmail;

    // 1. Resolve or Create individual Customer for this quotation
    let customer: any = null;
    if (quotation.createdCustomerId) {
      customer = await Customer.findById(quotation.createdCustomerId);
    }

    // Check if quotation references an existing customer code or ID
    const existingCode = qData?.existingCustomerId || quotation.createdCustomerCode;
    if (!customer && existingCode) {
      customer = await Customer.findOne({
        $or: [
          { customerId: String(existingCode).trim().toUpperCase() },
          ...(String(existingCode).match(/^[0-9a-fA-F]{24}$/) ? [{ _id: existingCode }] : []),
        ],
      });
    }

    // Check if customer exists by phone number
    if (!customer && phone) {
      const cleanPhone = phone.replace(/\D/g, '').slice(-10);
      if (cleanPhone && cleanPhone.length >= 10) {
        customer = await Customer.findOne({
          $or: [
            { phoneNumber: new RegExp(cleanPhone) },
            { whatsappNumber: new RegExp(cleanPhone) },
          ],
        });
      }
    }

    if (!customer) {
      const customerId = await getNextCustomerId();
      customer = await Customer.create({
        customerId,
        isOldCustomer: false,
        fullName: fullName.trim(),
        phoneNumber: phone.trim(),
        whatsappNumber: phone.trim(),
        address: siteAddress,
        city: city.trim(),
        state: 'Maharashtra',
        pincode: '400001',
        customerType: 'Residential',
        leadSource: 'Quotation Proposal',
        assignedEmployee: targetBdmName || undefined,
        bdmId: targetBdmId || undefined,
        bdmPhone: targetBdmPhone || undefined,
        notes: `Auto-created upon CRM approval of Quotation ${quotation.offerNo}${targetBdmName ? ` (Assigned BDM: ${targetBdmName})` : ''}`,
      });
    } else {
      let changed = false;
      if (targetBdmId && (!customer.bdmId || String(customer.bdmId) !== String(targetBdmId))) {
        customer.bdmId = targetBdmId;
        changed = true;
      }
      if (targetBdmName && (!customer.assignedEmployee || customer.assignedEmployee === 'Assigned')) {
        customer.assignedEmployee = targetBdmName;
        changed = true;
      }
      if (targetBdmPhone && !customer.bdmPhone) {
        customer.bdmPhone = targetBdmPhone;
        changed = true;
      }
      if (changed) {
        await customer.save();
      }
    }

    // 2. Resolve or Create individual Project linked to this individual customer
    let newProject: any = null;
    if (quotation.createdProjectId) {
      newProject = await Project.findById(quotation.createdProjectId);
    }

    if (!newProject) {
      const advPct = 30;
      const advanceAmount = Math.round((orderValue * advPct) / 100);
      const projectId = await getNextProjectId();
      const approvedDeliveryDays = Number(qData.deliveryDays) || 120;

      newProject = await Project.create({
        projectId,
        customerId: customer._id,
        customerCode: customer.customerId,
        projectName: `${fullName.replace(/^Dear\s*/i, '').trim()} Residence`,
        siteAddress,
        liftModel: qData.model || 'AE 03 Gearless Belt Home series EV',
        liftType: 'Home Lift',
        numberOfFloors: qData.noOfStops || 'G+2',
        shaftModel: qData.shaftType || 'Glass Shaft',
        liftAmount: effectiveElevatorPrice,
        shaftAmount: effectiveShaftPrice,
        orderValue,
        advancePercentage: advPct,
        advanceAmount,
        balanceAmount: orderValue,
        totalPaid: 0,
        paymentStatus: 'PENDING',
        orderDate: new Date(),
        expectedDeliveryDate: new Date(Date.now() + approvedDeliveryDays * 24 * 60 * 60 * 1000),
        projectStatus: 'PAYMENT_RECEIVED',
        assignedEmployee: targetBdmName || undefined,
        bdmId: targetBdmId || undefined,
        bdmPhone: targetBdmPhone || undefined,
        notes: `Generated automatically from approved Stage 3 Quotation ${quotation.offerNo}${targetBdmName ? ` (Assigned BDM: ${targetBdmName})` : ''}. Travel: ${qData.totalTravelHeight || '7000mm'}, Door: ${qData.doorSpecifications || 'SS 304 Grade'}, Power: ${qData.powerSupply || 'Single Phase'}.`,
      });
    }

    // 3. Mark Quotation as CRM_APPROVED
    quotation.status = 'CRM_APPROVED';
    quotation.crmApprovedAt = new Date();
    quotation.crmApprovedBy = req.user ? req.user._id : 'CRM Admin';
    quotation.createdCustomerId = customer._id;
    quotation.createdCustomerCode = customer.customerId;
    quotation.createdProjectId = newProject._id;
    quotation.createdProjectCode = newProject.projectId;
    await quotation.save();

    // 4. Dismiss pending Quotation Approval Reminders for this quotation
    await Reminder.updateMany(
      {
        $or: [
          { relatedQuotationId: quotation._id },
          { relatedQuotationOfferNo: quotation.offerNo },
        ],
        status: 'PENDING',
      },
      { status: 'DISMISSED' }
    );

    // 5. Create initial "Next Work" reminder for CRM for this new project
    const crmUsers = await User.find({ role: { $in: ['CRM', 'ADMIN'] }, isActive: true });
    for (const u of crmUsers) {
      const existingWorkRem = await Reminder.findOne({
        userId: u._id,
        relatedProjectId: newProject._id,
        type: 'PROJECT_NEXT_WORK',
        status: 'PENDING',
      });
      if (!existingWorkRem) {
        await Reminder.create({
          userId: u._id,
          title: `Next Move: Schedule Site Visit (PM) - ${newProject.projectName} (${newProject.projectId})`,
          notes: `Customer: ${customer.fullName}. Project auto-created from Quotation ${quotation.offerNo}. Next work: Coordinate with customer to schedule site visit for shaft measurements.${targetBdmName ? ` (BDM: ${targetBdmName})` : ''}`,
          dueAt: new Date(),
          status: 'PENDING',
          type: 'PROJECT_NEXT_WORK',
          relatedProjectId: newProject._id,
          relatedCustomerId: customer._id,
          customerName: customer.fullName,
          actionRequired: true,
        });
      }
    }

    // 6. Notify the assigned BDM that their quotation was approved and customer + project was assigned to them
    if (targetBdmId) {
      const existingBdmRem = await Reminder.findOne({
        userId: targetBdmId,
        $or: [
          { relatedQuotationId: quotation._id },
          { relatedProjectId: newProject._id },
        ],
        status: 'PENDING',
      });
      if (!existingBdmRem) {
        await Reminder.create({
          userId: targetBdmId,
          title: `🎉 Quotation Approved: ${customer.fullName} (${customer.customerId})`,
          notes: `Your Stage 3 Quotation (${quotation.offerNo}) for ${customer.fullName} has been approved by CRM/Admin! Customer ${customer.customerId} and Project ${newProject.projectId} have been created and added to your portfolio.`,
          dueAt: new Date(),
          status: 'PENDING',
          type: 'GENERAL',
          relatedCustomerId: customer._id,
          relatedProjectId: newProject._id,
          relatedQuotationId: quotation._id,
          actionRequired: false,
        });
      }
    }

    return res.json({
      success: true,
      message: `Quotation Approved by CRM! Customer ${customer.customerId} and Project ${newProject.projectId} created and assigned to BDM ${targetBdmName || 'assigned'} successfully.`,
      customer,
      project: newProject,
      quotation,
    });
  } catch (err: any) {
    console.error('[QuotationCrmApprove] Error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/quotations/export-excel/:offerNo
 * Exports an Excel (.xlsx) file comparing Stage 1, Stage 2, and Stage 3 side-by-side
 */
quotationRouter.get('/export-excel/:offerNo', async (req: Request, res: Response) => {
  try {
    const rawOffer = decodeURIComponent(req.params.offerNo);
    const { baseOfferNo } = extractBaseOfferNo(rawOffer);

    const stages = await Quotation.find({ baseOfferNo }).sort({ stage: 1 });

    if (stages.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No quotation history found for "${rawOffer}"`,
      });
    }

    const s1 = stages.find((s) => s.stage === 1);
    const s2 = stages.find((s) => s.stage === 2);
    const s3 = stages.find((s) => s.stage === 3);
    const s4 = stages.find((s) => s.stage === 4);

    const getStageEffectiveElv = (stg?: any) => {
      if (!stg?.data) return 0;
      return Number((stg.data.elevatorDiscountPrice && Number(stg.data.elevatorDiscountPrice) > 0) ? Math.max(0, (stg.data.elevatorPrice || 0) - Number(stg.data.elevatorDiscountPrice)) : (stg.data.elevatorPrice || 0));
    };
    const getStageEffectiveShaft = (stg?: any) => {
      if (!stg?.data) return 0;
      return Number((stg.data.shaftDiscountPrice && Number(stg.data.shaftDiscountPrice) > 0) ? Math.max(0, (stg.data.shaftPrice || 0) - Number(stg.data.shaftDiscountPrice)) : (stg.data.shaftPrice || 0));
    };

    const s1Total = s1?.data ? Math.round((getStageEffectiveElv(s1) + getStageEffectiveShaft(s1)) * 1.18) : 0;
    const s2Total = s2?.data ? Math.round((getStageEffectiveElv(s2) + getStageEffectiveShaft(s2)) * 1.18) : 0;
    const s3Total = s3?.data ? Math.round((getStageEffectiveElv(s3) + getStageEffectiveShaft(s3)) * 1.18) : 0;
    const s4Total = s4?.data ? Math.round((getStageEffectiveElv(s4) + getStageEffectiveShaft(s4)) * 1.18) : 0;

    const priceDiff = s4Total ? s4Total - s1Total : s3Total ? s3Total - s1Total : s2Total ? s2Total - s1Total : 0;
    const priceDiffText = priceDiff === 0 ? 'No change' : priceDiff > 0 ? `+₹${priceDiff.toLocaleString('en-IN')}` : `-₹${Math.abs(priceDiff).toLocaleString('en-IN')}`;

    const rows = [
      {
        'Parameter / Field': 'Offer Code & Suffix',
        'Stage 1 (Initial: -1)': s1?.offerNo || 'N/A',
        'Stage 2 (Negotiation: -2)': s2?.offerNo || 'N/A',
        'Stage 3 (Negotiation 2: -3)': s3?.offerNo || 'N/A',
        'Stage 4 (Final & CRM: -4)': s4?.offerNo || 'N/A',
        'Stage Comparison & Variance': s4 ? 'Stage 4 Finalized' : s3 ? 'Stage 3 In Negotiation 2' : s2 ? 'Stage 2 In Negotiation' : 'Stage 1 Initial',
      },
      {
        'Parameter / Field': 'Customer Full Name',
        'Stage 1 (Initial: -1)': s1?.data?.clientName || s1?.customerName || '',
        'Stage 2 (Negotiation: -2)': s2?.data?.clientName || s2?.customerName || '',
        'Stage 3 (Negotiation 2: -3)': s3?.data?.clientName || s3?.customerName || '',
        'Stage 4 (Final & CRM: -4)': s4?.data?.clientName || s4?.customerName || '',
        'Stage Comparison & Variance': '',
      },
      {
        'Parameter / Field': 'Project City',
        'Stage 1 (Initial: -1)': s1?.data?.projectCity || '',
        'Stage 2 (Negotiation: -2)': s2?.data?.projectCity || '',
        'Stage 3 (Negotiation 2: -3)': s3?.data?.projectCity || '',
        'Stage 4 (Final & CRM: -4)': s4?.data?.projectCity || '',
        'Stage Comparison & Variance': '',
      },
      {
        'Parameter / Field': 'Customer WhatsApp Contact',
        'Stage 1 (Initial: -1)': s1?.customerPhone || '',
        'Stage 2 (Negotiation: -2)': s2?.customerPhone || '',
        'Stage 3 (Negotiation 2: -3)': s3?.customerPhone || '',
        'Stage 4 (Final & CRM: -4)': s4?.customerPhone || '',
        'Stage Comparison & Variance': '',
      },
      {
        'Parameter / Field': 'Elevator Model',
        'Stage 1 (Initial: -1)': s1?.data?.model || '',
        'Stage 2 (Negotiation: -2)': s2?.data?.model || '',
        'Stage 3 (Negotiation 2: -3)': s3?.data?.model || '',
        'Stage 4 (Final & CRM: -4)': s4?.data?.model || '',
        'Stage Comparison & Variance': s1?.data?.model !== (s4?.data?.model || s3?.data?.model) && (s4 || s3) ? `Changed to ${s4?.data?.model || s3?.data?.model}` : 'Unchanged',
      },
      {
        'Parameter / Field': 'No of Stops',
        'Stage 1 (Initial: -1)': s1?.data?.noOfStops || '',
        'Stage 2 (Negotiation: -2)': s2?.data?.noOfStops || '',
        'Stage 3 (Negotiation 2: -3)': s3?.data?.noOfStops || '',
        'Stage 4 (Final & CRM: -4)': s4?.data?.noOfStops || '',
        'Stage Comparison & Variance': '',
      },
      {
        'Parameter / Field': 'Total Travel Height',
        'Stage 1 (Initial: -1)': s1?.data?.totalTravelHeight || '',
        'Stage 2 (Negotiation: -2)': s2?.data?.totalTravelHeight || '',
        'Stage 3 (Negotiation 2: -3)': s3?.data?.totalTravelHeight || '',
        'Stage 4 (Final & CRM: -4)': s4?.data?.totalTravelHeight || '',
        'Stage Comparison & Variance': '',
      },
      {
        'Parameter / Field': 'No of Openings & Floor Numbering',
        'Stage 1 (Initial: -1)': `${s1?.data?.noOfOpenings || ''} (${s1?.data?.floorNumbering || ''})`,
        'Stage 2 (Negotiation: -2)': `${s2?.data?.noOfOpenings || ''} (${s2?.data?.floorNumbering || ''})`,
        'Stage 3 (Negotiation 2: -3)': `${s3?.data?.noOfOpenings || ''} (${s3?.data?.floorNumbering || ''})`,
        'Stage 4 (Final & CRM: -4)': `${s4?.data?.noOfOpenings || ''} (${s4?.data?.floorNumbering || ''})`,
        'Stage Comparison & Variance': '',
      },
      {
        'Parameter / Field': 'Door Access Type',
        'Stage 1 (Initial: -1)': s1?.data?.doorAccess || 'inline',
        'Stage 2 (Negotiation: -2)': s2?.data?.doorAccess || 'inline',
        'Stage 3 (Negotiation 2: -3)': s3?.data?.doorAccess || 'inline',
        'Stage 4 (Final & CRM: -4)': s4?.data?.doorAccess || 'inline',
        'Stage Comparison & Variance': s1?.data?.doorAccess !== (s4?.data?.doorAccess || s3?.data?.doorAccess) && (s4 || s3) ? `Changed to ${s4?.data?.doorAccess || s3?.data?.doorAccess}` : 'Unchanged',
      },
      {
        'Parameter / Field': 'Door Technical Specifications',
        'Stage 1 (Initial: -1)': s1?.data?.doorSpecifications || '',
        'Stage 2 (Negotiation: -2)': s2?.data?.doorSpecifications || '',
        'Stage 3 (Negotiation 2: -3)': s3?.data?.doorSpecifications || '',
        'Stage 4 (Final & CRM: -4)': s4?.data?.doorSpecifications || '',
        'Stage Comparison & Variance': '',
      },
      {
        'Parameter / Field': 'Cabin Walls & Finishes',
        'Stage 1 (Initial: -1)': s1?.data?.cabinWalls || '',
        'Stage 2 (Negotiation: -2)': s2?.data?.cabinWalls || '',
        'Stage 3 (Negotiation 2: -3)': s3?.data?.cabinWalls || '',
        'Stage 4 (Final & CRM: -4)': s4?.data?.cabinWalls || '',
        'Stage Comparison & Variance': '',
      },
      {
        'Parameter / Field': 'Operating Panels (COP & LOP)',
        'Stage 1 (Initial: -1)': s1?.data?.copAndLop || '',
        'Stage 2 (Negotiation: -2)': s2?.data?.copAndLop || '',
        'Stage 3 (Negotiation 2: -3)': s3?.data?.copAndLop || '',
        'Stage 4 (Final & CRM: -4)': s4?.data?.copAndLop || '',
        'Stage Comparison & Variance': '',
      },
      {
        'Parameter / Field': 'Power Supply',
        'Stage 1 (Initial: -1)': s1?.data?.powerSupply || '',
        'Stage 2 (Negotiation: -2)': s2?.data?.powerSupply || '',
        'Stage 3 (Negotiation 2: -3)': s3?.data?.powerSupply || '',
        'Stage 4 (Final & CRM: -4)': s4?.data?.powerSupply || '',
        'Stage Comparison & Variance': '',
      },
      {
        'Parameter / Field': 'Shaft Structure Specifications',
        'Stage 1 (Initial: -1)': s1?.data?.shaftType || '',
        'Stage 2 (Negotiation: -2)': s2?.data?.shaftType || '',
        'Stage 3 (Negotiation 2: -3)': s3?.data?.shaftType || '',
        'Stage 4 (Final & CRM: -4)': s4?.data?.shaftType || '',
        'Stage Comparison & Variance': '',
      },
      {
        'Parameter / Field': 'Elevator Basic Price (MRP) (₹)',
        'Stage 1 (Initial: -1)': s1?.data?.elevatorPrice || 0,
        'Stage 2 (Negotiation: -2)': s2?.data?.elevatorPrice || 0,
        'Stage 3 (Negotiation 2: -3)': s3?.data?.elevatorPrice || 0,
        'Stage 4 (Final & CRM: -4)': s4?.data?.elevatorPrice || 0,
        'Stage Comparison & Variance': `Net Diff: ₹${((Number(s4?.data?.elevatorPrice || s3?.data?.elevatorPrice || s2?.data?.elevatorPrice || 0) - Number(s1?.data?.elevatorPrice || 0))).toLocaleString('en-IN')}`,
      },
      {
        'Parameter / Field': 'Elevators Discount Price (₹)',
        'Stage 1 (Initial: -1)': s1?.data?.elevatorDiscountPrice || 'N/A',
        'Stage 2 (Negotiation: -2)': s2?.data?.elevatorDiscountPrice || 'N/A',
        'Stage 3 (Negotiation 2: -3)': s3?.data?.elevatorDiscountPrice || 'N/A',
        'Stage 4 (Final & CRM: -4)': s4?.data?.elevatorDiscountPrice || 'N/A',
        'Stage Comparison & Variance': '',
      },
      {
        'Parameter / Field': 'Shaft Basic Price (MRP) (₹)',
        'Stage 1 (Initial: -1)': s1?.data?.shaftPrice || 0,
        'Stage 2 (Negotiation: -2)': s2?.data?.shaftPrice || 0,
        'Stage 3 (Negotiation 2: -3)': s3?.data?.shaftPrice || 0,
        'Stage 4 (Final & CRM: -4)': s4?.data?.shaftPrice || 0,
        'Stage Comparison & Variance': `Net Diff: ₹${((Number(s4?.data?.shaftPrice || s3?.data?.shaftPrice || s2?.data?.shaftPrice || 0) - Number(s1?.data?.shaftPrice || 0))).toLocaleString('en-IN')}`,
      },
      {
        'Parameter / Field': 'Shaft Discount Price (₹)',
        'Stage 1 (Initial: -1)': s1?.data?.shaftDiscountPrice || 'N/A',
        'Stage 2 (Negotiation: -2)': s2?.data?.shaftDiscountPrice || 'N/A',
        'Stage 3 (Negotiation 2: -3)': s3?.data?.shaftDiscountPrice || 'N/A',
        'Stage 4 (Final & CRM: -4)': s4?.data?.shaftDiscountPrice || 'N/A',
        'Stage Comparison & Variance': '',
      },
      {
        'Parameter / Field': 'GST Amount (18%) (₹)',
        'Stage 1 (Initial: -1)': Math.round(((getStageEffectiveElv(s1) + getStageEffectiveShaft(s1)) * 18) / 100),
        'Stage 2 (Negotiation: -2)': Math.round(((getStageEffectiveElv(s2) + getStageEffectiveShaft(s2)) * 18) / 100),
        'Stage 3 (Negotiation 2: -3)': Math.round(((getStageEffectiveElv(s3) + getStageEffectiveShaft(s3)) * 18) / 100),
        'Stage 4 (Final & CRM: -4)': Math.round(((getStageEffectiveElv(s4) + getStageEffectiveShaft(s4)) * 18) / 100),
        'Stage Comparison & Variance': '',
      },
      {
        'Parameter / Field': 'Grand Total Contract Value (₹)',
        'Stage 1 (Initial: -1)': s1Total,
        'Stage 2 (Negotiation: -2)': s2Total,
        'Stage 3 (Negotiation 2: -3)': s3Total,
        'Stage 4 (Final & CRM: -4)': s4Total,
        'Stage Comparison & Variance': `Total Variance: ${priceDiffText}`,
      },
      {
        'Parameter / Field': 'Motor Warranty Term',
        'Stage 1 (Initial: -1)': s1?.data?.motorWarranty || 'Lifetime',
        'Stage 2 (Negotiation: -2)': s2?.data?.motorWarranty || 'Lifetime',
        'Stage 3 (Negotiation 2: -3)': s3?.data?.motorWarranty || 'Lifetime',
        'Stage 4 (Final & CRM: -4)': s4?.data?.motorWarranty || 'Lifetime',
        'Stage Comparison & Variance': '',
      },
      {
        'Parameter / Field': 'Manufacturing Defect Warranty',
        'Stage 1 (Initial: -1)': s1?.data?.manufacturingWarranty || '5 years',
        'Stage 2 (Negotiation: -2)': s2?.data?.manufacturingWarranty || '5 years',
        'Stage 3 (Negotiation 2: -3)': s3?.data?.manufacturingWarranty || '5 years',
        'Stage 4 (Final & CRM: -4)': s4?.data?.manufacturingWarranty || '5 years',
        'Stage Comparison & Variance': '',
      },
      {
        'Parameter / Field': 'Free Maintenance Period',
        'Stage 1 (Initial: -1)': s1?.data?.freeMaintenance || '1 Years',
        'Stage 2 (Negotiation: -2)': s2?.data?.freeMaintenance || '1 Years',
        'Stage 3 (Negotiation 2: -3)': s3?.data?.freeMaintenance || '1 Years',
        'Stage 4 (Final & CRM: -4)': s4?.data?.freeMaintenance || '1 Years',
        'Stage Comparison & Variance': '',
      },
      {
        'Parameter / Field': 'Material Delivery Days',
        'Stage 1 (Initial: -1)': `${s1?.data?.deliveryDays || 120} days`,
        'Stage 2 (Negotiation: -2)': `${s2?.data?.deliveryDays || 120} days`,
        'Stage 3 (Negotiation 2: -3)': `${s3?.data?.deliveryDays || 120} days`,
        'Stage 4 (Final & CRM: -4)': `${s4?.data?.deliveryDays || 120} days`,
        'Stage Comparison & Variance': '',
      },
      {
        'Parameter / Field': 'Quotation Lifecycle Status',
        'Stage 1 (Initial: -1)': s1?.status || 'N/A',
        'Stage 2 (Negotiation: -2)': s2?.status || 'N/A',
        'Stage 3 (Negotiation 2: -3)': s3?.status || 'N/A',
        'Stage 4 (Final & CRM: -4)': s4?.status || 'N/A',
        'Stage Comparison & Variance': (s4?.status === 'CRM_APPROVED' || s3?.status === 'CRM_APPROVED') ? 'Approved & Provisioned on CRM' : s4?.status || s3?.status || '',
      },
      {
        'Parameter / Field': 'Created CRM Customer Code',
        'Stage 1 (Initial: -1)': 'N/A',
        'Stage 2 (Negotiation: -2)': 'N/A',
        'Stage 3 (Negotiation 2: -3)': 'N/A',
        'Stage 4 (Final & CRM: -4)': s4?.createdCustomerCode || s3?.createdCustomerCode || 'Pending Approval',
        'Stage Comparison & Variance': s4?.createdCustomerCode || s3?.createdCustomerCode || '',
      },
      {
        'Parameter / Field': 'Created CRM Project Code',
        'Stage 1 (Initial: -1)': 'N/A',
        'Stage 2 (Negotiation: -2)': 'N/A',
        'Stage 3 (Negotiation 2: -3)': 'N/A',
        'Stage 4 (Final & CRM: -4)': s4?.createdProjectCode || s3?.createdProjectCode || 'Pending Approval',
        'Stage Comparison & Variance': s4?.createdProjectCode || s3?.createdProjectCode || '',
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet['!cols'] = [{ wch: 32 }, { wch: 28 }, { wch: 28 }, { wch: 28 }, { wch: 30 }, { wch: 28 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Stage Comparison');

    const cleanFileBase = baseOfferNo.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${cleanFileBase}_Stage_Comparison.xlsx`;

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(buffer);
  } catch (err: any) {
    console.error('[QuotationExportExcel] Error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

