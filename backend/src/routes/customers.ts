import { Router, Response, Request, NextFunction } from 'express';
import mongoose, { Types } from 'mongoose';
import { Customer, Project, Payment, WhatsAppMessage, ProjectActivity, User, Quotation } from '../models';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { PROJECT_STAGE_NEXT_WORK } from './reminders';
import { getNextCustomerId, getNextOldCustomerId, splitSharedCustomerProjects, resequenceCustomerIds } from '../utils/idGenerators';
import { parseAndImportExcel, generateImportTemplateBuffer } from '../services/import/excelImportService';
import { getCustomerTlFilter, isCustomerAccessibleByTl, isTlUser, getTlRegexForUser, normalizeCanonicalTlName, getSearchRegexForTlName } from '../utils/tlAuth';

async function resolveTlAssignment(rawTl: any): Promise<{ tlName: string | null; tlUserId: any }> {
  const canonicalName = normalizeCanonicalTlName(rawTl);
  if (!canonicalName) {
    return { tlName: null, tlUserId: null };
  }
  const searchRegex = getSearchRegexForTlName(canonicalName);
  let tlUserId: any = null;
  if (searchRegex) {
    const matchedUser = await User.findOne({
      role: { $ne: 'BDM' },
      $or: [{ name: searchRegex }, { email: searchRegex }],
    });
    if (matchedUser) {
      tlUserId = matchedUser._id;
    }
  }
  return { tlName: canonicalName, tlUserId };
}
import { ensureUploadsDir } from './projects';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    try {
      const targetDir = ensureUploadsDir();
      cb(null, targetDir);
    } catch (err: any) {
      cb(err, '');
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const safeName = file.originalname ? path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_') : 'document';
    const ext = path.extname(safeName) || '.pdf';
    cb(null, `${req.params.id}-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

const handleCustomerDocUploadMiddleware = (req: Request, res: Response, next: NextFunction) => {
  upload.single('document')(req, res, (err: any) => {
    if (err) {
      console.error('[CustomerDocUpload] Multer error:', err);
      const isTooLarge = err.code === 'LIMIT_FILE_SIZE';
      return res.status(400).json({
        success: false,
        message: isTooLarge
          ? 'Document file exceeds 50MB limit'
          : err.message || 'File upload failed',
      });
    }
    next();
  });
};
const excelUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

export const customerRouter = Router();

/**
 * GET /api/customers/import-template
 * Downloads sample Excel import template with guidance (Public / Pre-auth for direct download)
 */
customerRouter.get('/import-template', async (_req: Request, res: Response) => {
  try {
    const buffer = generateImportTemplateBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="Alpha_CRM_Import_Template.xlsx"');
    return res.send(buffer);
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

customerRouter.use(authenticate);

/**
 * POST /api/customers/import-excel
 * Imports customers and elevator projects from an uploaded Excel (.xlsx, .xls) spreadsheet
 */
customerRouter.post('/import-excel', excelUpload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ success: false, message: 'Please upload an Excel (.xlsx, .xls) file' });
    }

    const result = await parseAndImportExcel(req.file.buffer, req.user);
    return res.status(200).json({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (err: any) {
    console.error('[import-excel] Error importing spreadsheet:', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to process Excel file' });
  }
});

let lastQuoteBdmSyncAt = 0;
const QUOTE_BDM_SYNC_THROTTLE_MS = 5 * 60 * 1000; // Run at most once every 5 minutes

/**
 * GET /api/customers
 */
customerRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { search, optIn, customerType, bdmId, isOldCustomer, assignedTl } = req.query;
    const query: any = {};

    // Throttled background non-blocking sync for quotes missing bdmId (runs at most once per 5 mins)
    const nowMs = Date.now();
    if (nowMs - lastQuoteBdmSyncAt > QUOTE_BDM_SYNC_THROTTLE_MS) {
      lastQuoteBdmSyncAt = nowMs;
      setImmediate(async () => {
        try {
          const quotesWithBdm = await Quotation.find({
            status: 'CRM_APPROVED',
            createdCustomerId: { $exists: true, $ne: null },
            $or: [{ bdmId: { $exists: true, $ne: null } }, { approvalRequestedBy: { $exists: true, $ne: null } }],
          })
            .select('createdCustomerId createdProjectId bdmId bdmName bdmPhone approvalRequestedBy approvalRequestedByName')
            .lean();

          for (const q of quotesWithBdm) {
            const bId = q.bdmId || q.approvalRequestedBy;
            if (bId && q.createdCustomerId) {
              await Customer.updateOne(
                { _id: q.createdCustomerId, $or: [{ bdmId: null }, { bdmId: { $exists: false } }] },
                {
                  $set: {
                    bdmId: bId,
                    ...(q.bdmName || q.approvalRequestedByName ? { assignedEmployee: q.bdmName || q.approvalRequestedByName } : {}),
                    ...(q.bdmPhone ? { bdmPhone: q.bdmPhone } : {}),
                  },
                }
              );
            }
            if (bId && q.createdProjectId) {
              await Project.updateOne(
                { _id: q.createdProjectId, $or: [{ bdmId: null }, { bdmId: { $exists: false } }] },
                {
                  $set: {
                    bdmId: bId,
                    ...(q.bdmName || q.approvalRequestedByName ? { assignedEmployee: q.bdmName || q.approvalRequestedByName } : {}),
                    ...(q.bdmPhone ? { bdmPhone: q.bdmPhone } : {}),
                  },
                }
              );
            }
          }
        } catch (e) {
          // Non-blocking sync error swallowed
        }
      });
    }

    const andConditions: any[] = [];

    if (req.user?.role === 'BDM') {
      const bdmConditions: any[] = [
        { bdmId: req.user._id },
        { isOldCustomer: true },
        { customerId: { $regex: /^OLD/i } },
        { bdmId: null },
        { bdmId: { $exists: false } },
      ];
      if (req.user.name) {
        bdmConditions.push({ assignedEmployee: new RegExp(`^${req.user.name.trim()}$`, 'i') });
      }
      if (req.user.phone) {
        const cleanPhone = req.user.phone.replace(/\D/g, '').slice(-10);
        if (cleanPhone) {
          bdmConditions.push({ bdmPhone: new RegExp(cleanPhone) });
        }
      }
      andConditions.push({ $or: bdmConditions });
    } else if (bdmId && bdmId !== 'ALL') {
      const bdmMatch = await User.findById(bdmId).catch(() => null);
      if (bdmMatch) {
        andConditions.push({
          $or: [
            { bdmId: bdmMatch._id },
            { assignedEmployee: new RegExp(`^${bdmMatch.name.trim()}$`, 'i') },
          ],
        });
      } else {
        query.bdmId = bdmId;
      }
    }

    // Role-based visibility: Team Leads (Srinivasan, Sundaram, Bala) only see assigned customers
    if (isTlUser(req.user)) {
      const tlRegex = getTlRegexForUser(req.user);
      if (tlRegex) {
        const projectConditions: any[] = [{ assignedTl: tlRegex }];
        if (req.user?._id) {
          projectConditions.push({ assignedTlId: req.user._id });
        }
        const matchingProjects = await Project.find({ $or: projectConditions }).select('customerId').lean();
        const projectCustIds = matchingProjects.map((p) => p.customerId).filter(Boolean);

        const tlConditions: any[] = [
          { assignedTl: tlRegex },
          { _id: { $in: projectCustIds } },
        ];
        if (req.user?._id) {
          tlConditions.push({ assignedTlId: req.user._id });
          if (Types.ObjectId.isValid(req.user._id)) {
            tlConditions.push({ assignedTlId: new Types.ObjectId(req.user._id) });
          }
        }
        andConditions.push({ $or: tlConditions });
      }
    } else if (assignedTl && typeof assignedTl === 'string' && assignedTl !== 'ALL') {
      if (assignedTl === 'unassigned') {
        andConditions.push({
          $or: [
            { assignedTl: null },
            { assignedTl: '' },
            { assignedTl: { $exists: false } },
          ],
        });
      } else {
        const val = assignedTl.trim();
        let targetRegex: RegExp;
        if (/srinivasan|srini/i.test(val)) {
          targetRegex = /srinivasan|srini/i;
        } else if (/sundaram|sundar/i.test(val)) {
          targetRegex = /sundaram|sundar/i;
        } else if (/\bbala\b/i.test(val)) {
          targetRegex = /\bbala\b/i;
        } else {
          const escaped = val.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          targetRegex = new RegExp(escaped, 'i');
        }
        const projMatches = await Project.find({ assignedTl: targetRegex }).select('customerId').lean();
        const pCustIds = projMatches.map((p) => p.customerId).filter(Boolean);
        andConditions.push({
          $or: [
            { assignedTl: targetRegex },
            { _id: { $in: pCustIds } },
          ],
        });
      }
    }

    if (search && typeof search === 'string' && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      andConditions.push({
        $or: [
          { fullName: searchRegex },
          { phoneNumber: searchRegex },
          { whatsappNumber: searchRegex },
          { customerId: searchRegex },
          { city: searchRegex },
        ],
      });
    }

    if (optIn !== undefined && optIn !== '') {
      query.whatsappOptIn = optIn === 'true';
    }

    if (customerType && typeof customerType === 'string') {
      query.customerType = customerType;
    }

    if (String(isOldCustomer) === 'true') {
      andConditions.push({
        $or: [
          { isOldCustomer: true },
          { customerId: { $regex: /^OLD/i } },
        ],
      });
    } else if (String(isOldCustomer) === 'false') {
      andConditions.push({
        isOldCustomer: { $ne: true },
        customerId: { $regex: /^(?!OLD)/i },
      });
    }

    if (andConditions.length > 0) {
      query.$and = andConditions;
    }

    const customers = await Customer.find(query).select('-documents.data').populate('bdmId', 'name email phone').lean();

    // Natural numeric sorting: CUST-001, CUST-002, ..., CUST-025
    customers.sort((a, b) => {
      const numA = parseInt(String(a.customerId || '').replace(/\D/g, '') || '0', 10);
      const numB = parseInt(String(b.customerId || '').replace(/\D/g, '') || '0', 10);
      if (numA !== numB) return numA - numB;
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });

    // Strict post-filtering guarantees 100% mutually exclusive separation
    let strictlyFiltered = customers;
    if (String(isOldCustomer) === 'true') {
      strictlyFiltered = customers.filter((c) => {
        const cid = String(c.customerId || '').trim().toUpperCase();
        return c.isOldCustomer === true || cid.startsWith('OLD');
      });
    } else if (String(isOldCustomer) === 'false') {
      strictlyFiltered = customers.filter((c) => {
        const cid = String(c.customerId || '').trim().toUpperCase();
        return c.isOldCustomer !== true && !cid.startsWith('OLD');
      });
    }

    const custIds = strictlyFiltered.map((c) => c._id);
    const activeProjects = await Project.find({
      customerId: { $in: custIds },
      projectStatus: { $nin: ['COMPLETED', 'CANCELLED'] },
    }).select('customerId projectId projectName projectStatus nextUpdateAt assignedTl assignedTlId').lean();

    const projectMap = new Map();
    activeProjects.forEach((p) => {
      if (!projectMap.has(String(p.customerId))) {
        const nextInfo = PROJECT_STAGE_NEXT_WORK[p.projectStatus];
        projectMap.set(String(p.customerId), {
          ...p,
          assignedTl: normalizeCanonicalTlName(p.assignedTl) || p.assignedTl,
          nextWork: nextInfo?.nextWork || 'Next Stage Due',
          nextWorkDesc: nextInfo?.description || '',
          currentStageLabel: nextInfo?.currentLabel || p.projectStatus,
        });
      }
    });

    let data = strictlyFiltered.map((c) => {
      const cObj: any = c.toObject ? c.toObject() : { ...c };
      const activeProj = projectMap.get(String(c._id)) || null;
      const rawCustTl = (cObj.assignedTl === undefined && activeProj?.assignedTl) ? activeProj.assignedTl : cObj.assignedTl;
      const canonicalTl = normalizeCanonicalTlName(rawCustTl) || rawCustTl || null;
      cObj.assignedTl = canonicalTl;
      if (cObj.assignedTl === undefined && !cObj.assignedTlId && activeProj?.assignedTlId) {
        cObj.assignedTlId = activeProj.assignedTlId;
      }
      cObj.activeProject = activeProj
        ? {
            ...activeProj,
            assignedTl: canonicalTl || activeProj.assignedTl,
          }
        : null;
      return cObj;
    });

    if (isTlUser(req.user)) {
      data = data.filter((c) => isCustomerAccessibleByTl(c, req.user));
    } else if (assignedTl && typeof assignedTl === 'string' && assignedTl !== 'ALL' && assignedTl.trim()) {
      const rawFilter = assignedTl.trim();
      if (rawFilter.toLowerCase() === 'unassigned' || rawFilter.toLowerCase() === 'none') {
        data = data.filter((c) => !c.assignedTl);
      } else {
        const filterRegex = getSearchRegexForTlName(rawFilter);
        if (filterRegex) {
          data = data.filter((c) => {
            const cTl = normalizeCanonicalTlName(c.assignedTl || c.activeProject?.assignedTl);
            return Boolean(cTl && filterRegex.test(cTl));
          });
        }
      }
    }

    return res.json({ success: true, count: data.length, data });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/customers
 */
customerRouter.post('/', authorize('ADMIN', 'CRM', 'MANAGER', 'BDM'), async (req: AuthRequest, res: Response) => {
  try {
    const {
      fullName,
      phoneNumber,
      whatsappNumber,
      email,
      address,
      googleMapsLink,
      doorNo,
      streetName,
      landmark,
      city,
      state,
      pincode,
      customerType,
      leadSource,
      assignedEmployee,
      bdmId,
      bdmPhone,
      assignedTl,
      whatsappOptIn,
      optInSource,
      notes,
    } = req.body;

    const fullAddress = (
      address ||
      googleMapsLink ||
      [doorNo, streetName, landmark].filter(Boolean).join(', ')
    ).trim();

    const resolvedGoogleMapsLink = (
      googleMapsLink ||
      (fullAddress.startsWith('http') || fullAddress.includes('maps') ? fullAddress : undefined)
    )?.trim();

    if (!fullName || !phoneNumber || (!fullAddress && !resolvedGoogleMapsLink)) {
      return res.status(400).json({ success: false, message: 'Full name, phone number, and address or Google Maps link are required' });
    }

    // Determine if old customer: default to false unless explicitly specified as true
    const isOld = req.body.isOldCustomer === true || req.body.isOldCustomer === 'true';

    // Auto-generate unified customerId (CUST-001, CUST-002, etc. continuous sequence for all customers)
    let customerId = req.body.customerId ? String(req.body.customerId).trim().toUpperCase() : '';
    if (!customerId) {
      customerId = await getNextCustomerId();
    }

    let assignedBdmId: any = undefined;
    let assignedEmployeeName = assignedEmployee;

    if (req.user?.role === 'BDM') {
      assignedBdmId = req.user._id;
      assignedEmployeeName = req.user.name;
    } else if (bdmId) {
      if (typeof bdmId === 'string' && bdmId.match(/^[0-9a-fA-F]{24}$/)) {
        assignedBdmId = bdmId;
      } else {
        const bdmUser = await User.findOne({
          role: 'BDM',
          $or: [
            { email: String(bdmId).toLowerCase().trim() },
            { name: new RegExp(`^${String(bdmId).trim()}$`, 'i') },
          ],
        });
        if (bdmUser) {
          assignedBdmId = bdmUser._id;
          if (!assignedEmployeeName) assignedEmployeeName = bdmUser.name;
        }
      }
    }

    // Auto-lookup BDM WhatsApp phone if not explicitly provided
    let finalBdmPhone = bdmPhone ? bdmPhone.trim() : undefined;
    if (assignedBdmId) {
      const bdmUser = await User.findById(assignedBdmId);
      if (bdmUser) {
        if (!finalBdmPhone && bdmUser.phone) {
          finalBdmPhone = bdmUser.phone.trim();
        }
        if (!assignedEmployeeName) {
          assignedEmployeeName = bdmUser.name;
        }
      }
    }

    let finalAssignedTl: string | undefined = undefined;
    let finalAssignedTlId: any = undefined;
    if (assignedTl && assignedTl !== 'UNASSIGNED' && assignedTl !== 'NONE') {
      const resolved = await resolveTlAssignment(assignedTl);
      finalAssignedTl = resolved.tlName || undefined;
      finalAssignedTlId = resolved.tlUserId || undefined;
    }

    const newCustomer = await Customer.create({
      customerId,
      isOldCustomer: isOld,
      fullName: fullName.trim(),
      phoneNumber: phoneNumber.trim(),
      whatsappNumber: (whatsappNumber || phoneNumber).trim(),
      email: email ? email.trim() : undefined,
      doorNo: doorNo ? doorNo.trim() : undefined,
      streetName: streetName ? streetName.trim() : undefined,
      landmark: landmark ? landmark.trim() : undefined,
      address: fullAddress || resolvedGoogleMapsLink || '',
      googleMapsLink: resolvedGoogleMapsLink,
      city: city || 'Mumbai',
      state: state || 'Maharashtra',
      pincode: pincode || '',
      customerType: customerType || 'Residential',
      leadSource: leadSource || 'Direct Inquiry',
      assignedEmployee: assignedEmployee || req.user?.name,
      bdmId: assignedBdmId,
      bdmPhone: finalBdmPhone,
      assignedTl: finalAssignedTl,
      assignedTlId: finalAssignedTlId,
      whatsappOptIn: whatsappOptIn !== undefined ? !!whatsappOptIn : true,
      optInDate: new Date(),
      optInSource: optInSource || 'PROJECT_CONFIRMATION',
      optInPhone: (whatsappNumber || phoneNumber).trim(),
      notes,
    });

    return res.status(201).json({ success: true, data: newCustomer });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/customers/:id
 */
customerRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    if (req.params.id === 'import-template') {
      const buffer = generateImportTemplateBuffer();
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="Alpha_CRM_Import_Template.xlsx"');
      return res.send(buffer);
    }

    let customer: any = null;
    if (Types.ObjectId.isValid(req.params.id)) {
      customer = await Customer.findById(req.params.id).populate('bdmId', 'name email phone');
    } else {
      customer = await Customer.findOne({ customerId: req.params.id.toUpperCase() }).populate('bdmId', 'name email phone');
    }

    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    // Fetch related projects, payments, and WhatsApp message history in parallel (excluding heavy base64 blobs)
    const [projects, payments, messages] = await Promise.all([
      Project.find({ customerId: customer._id })
        .select('-drawingData -installationStages.images -installationStages.imageUrl')
        .sort({ createdAt: -1 }),
      Payment.find({ customerId: customer._id }).sort({ paymentDate: -1 }).lean(),
      WhatsAppMessage.find({ customerId: customer._id }).sort({ createdAt: -1 }).limit(50).lean(),
    ]);

    // Normalize or backfill customer.assignedTl from projects if needed
    if (customer.assignedTl) {
      customer.assignedTl = normalizeCanonicalTlName(customer.assignedTl) || customer.assignedTl;
    } else if (projects.length > 0) {
      const projWithTl = projects.find((p: any) => p.assignedTl);
      if (projWithTl?.assignedTl) {
        customer.assignedTl = normalizeCanonicalTlName(projWithTl.assignedTl) || projWithTl.assignedTl;
        if (!customer.assignedTlId && projWithTl.assignedTlId) {
          customer.assignedTlId = projWithTl.assignedTlId;
        }
      }
    }

    if (!isCustomerAccessibleByTl(customer, req.user)) {
      return res.status(403).json({ success: false, message: 'Access denied. This customer is assigned to another TL.' });
    }

    return res.json({
      success: true,
      data: {
        customer,
        projects,
        payments,
        messages,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/customers/:id/documents
 */
customerRouter.post(
  '/:id/documents',
  authorize('ADMIN', 'CRM', 'MANAGER', 'BDM', 'TECHNICAL_LEAD', 'TECHNICAL_MANAGER'),
  handleCustomerDocUploadMiddleware,
  async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const docName = req.body.name || req.file.originalname;
    const docUrl = `/uploads/${req.file.filename}`;

    if (!customer.documents) {
      customer.documents = [];
    }

    let docData: string | undefined;
    const docMimeType = req.file.mimetype || 'application/pdf';
    try {
      const uploadedPath = req.file.path || path.join(ensureUploadsDir(), req.file.filename);
      if (fs.existsSync(uploadedPath)) {
        docData = fs.readFileSync(uploadedPath).toString('base64');
      }
    } catch (encodeErr: any) {
      console.warn('[CustomerDocUpload] Unable to store document base64 in MongoDB:', encodeErr.message);
    }

    customer.documents.push({
      name: docName,
      url: docUrl,
      data: docData,
      mimeType: docMimeType,
      uploadedAt: new Date(),
    });

    await customer.save();

    return res.json({ success: true, data: customer.documents });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * DELETE /api/customers/:id/documents/:docId
 */
customerRouter.delete('/:id/documents/:docId', authorize('ADMIN', 'CRM', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    if (!customer.documents) return res.json({ success: true });

    const docIndex = customer.documents.findIndex((d: any) => d._id.toString() === req.params.docId);
    if (docIndex > -1) {
      const doc = customer.documents[docIndex];
      // Try to delete physical file
      if (doc.url && doc.url.startsWith('/uploads/')) {
        const filePath = path.join(__dirname, '..', doc.url);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
      customer.documents.splice(docIndex, 1);
      await customer.save();
    }

    return res.json({ success: true, data: customer.documents });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PUT /api/customers/:id
 */
customerRouter.put(
  '/:id',
  authorize('ADMIN', 'CRM', 'MANAGER', 'BDM', 'ACCOUNTANT', 'TECHNICAL_LEAD', 'TECHNICAL_MANAGER', 'LOGISTICS', 'LOGISTICS_TL'),
  async (req: AuthRequest, res: Response) => {
  try {
    const updateData = { ...req.body };
    if (updateData.googleMapsLink) {
      updateData.googleMapsLink = updateData.googleMapsLink.trim();
      if (!updateData.address) updateData.address = updateData.googleMapsLink;
    } else if (updateData.address && (updateData.address.startsWith('http') || updateData.address.includes('maps'))) {
      updateData.googleMapsLink = updateData.address.trim();
    }

    const hasTlUpdate = Object.prototype.hasOwnProperty.call(updateData, 'assignedTl');
    if (hasTlUpdate) {
      const { tlName, tlUserId } = await resolveTlAssignment(updateData.assignedTl);
      updateData.assignedTl = tlName;
      updateData.assignedTlId = tlUserId;
    }

    if (updateData.bdmId && String(updateData.bdmId).trim() !== '') {
      const rawBdmId = String(updateData.bdmId).trim();
      let bdmUser = null;
      if (Types.ObjectId.isValid(rawBdmId)) {
        bdmUser = await User.findById(rawBdmId);
      } else {
        bdmUser = await User.findOne({ $or: [{ email: rawBdmId.toLowerCase() }, { name: rawBdmId }] });
      }
      if (bdmUser) {
        updateData.bdmId = bdmUser._id;
        updateData.assignedEmployee = bdmUser.name;
        if (!updateData.bdmPhone && bdmUser.phone) {
          updateData.bdmPhone = bdmUser.phone;
        }
      } else {
        delete updateData.bdmId;
      }
    }

    const updated = await Customer.findByIdAndUpdate(req.params.id, updateData, { new: true }).populate('bdmId', 'name email phone');
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    if (hasTlUpdate) {
      await Project.updateMany(
        { customerId: updated._id },
        {
          $set: {
            assignedTl: updated.assignedTl || null,
            assignedTlId: updated.assignedTlId || null,
          },
        }
      );
    }

    return res.json({ success: true, data: updated });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PATCH / PUT / POST /api/customers/:id/assign-tl
 * Assigns a customer and all their projects to a specific Team Lead (Srinivasan, Sundaram, Bala)
 */
const handleAssignCustomerTl = async (req: AuthRequest, res: Response) => {
  try {
    const { assignedTl } = req.body;
    let customer: any = null;
    if (Types.ObjectId.isValid(req.params.id)) {
      customer = await Customer.findById(req.params.id);
    } else {
      customer = await Customer.findOne({ customerId: req.params.id.toUpperCase() });
    }
    
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const { tlName, tlUserId } = await resolveTlAssignment(assignedTl);

    customer.assignedTl = tlName;
    customer.assignedTlId = tlUserId;
    await customer.save();

    // Also synchronize assignedTl to all projects of this customer
    await Project.updateMany(
      { customerId: customer._id },
      {
        $set: {
          assignedTl: tlName,
          assignedTlId: tlUserId,
        },
      }
    );

    const populated = await Customer.findById(customer._id).populate('bdmId', 'name email phone');

    return res.json({
      success: true,
      message: tlName ? `Customer assigned to TL ${tlName} successfully` : 'Customer unassigned from TL',
      data: populated || customer,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const assignTlAuth = authorize('ADMIN', 'CRM', 'MANAGER', 'BDM', 'ACCOUNTANT', 'TECHNICAL_LEAD', 'TECHNICAL_MANAGER', 'LOGISTICS', 'LOGISTICS_TL');
customerRouter.patch('/:id/assign-tl', assignTlAuth, handleAssignCustomerTl);
customerRouter.put('/:id/assign-tl', assignTlAuth, handleAssignCustomerTl);
customerRouter.post('/:id/assign-tl', assignTlAuth, handleAssignCustomerTl);

/**
 * PATCH /api/customers/:id/opt-in
 */
customerRouter.patch('/:id/opt-in', authorize('ADMIN', 'CRM', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const { whatsappOptIn } = req.body;
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    customer.whatsappOptIn = !!whatsappOptIn;
    if (whatsappOptIn) {
      customer.optInDate = new Date();
      customer.optInSource = req.body.optInSource || 'MANUAL_OVERRIDE';
    }

    await customer.save();
    return res.json({ success: true, data: customer });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PATCH /api/customers/:id/assign-bdm
 * Assigns a customer and all their projects to a specific BDM
 */
customerRouter.patch('/:id/assign-bdm', authorize('ADMIN', 'CRM', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const { bdmId } = req.body;
    const customer = await Customer.findById(req.params.id);
    
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    if (!bdmId) {
      customer.bdmId = undefined; // Unassign
    } else {
      customer.bdmId = bdmId;
    }
    
    await customer.save();

    // Also update all projects belonging to this customer
    if (!bdmId) {
      await Project.updateMany({ customerId: customer._id }, { $unset: { bdmId: "" } });
    } else {
      await Project.updateMany({ customerId: customer._id }, { $set: { bdmId: bdmId } });
    }

    return res.json({ success: true, message: 'BDM assigned successfully', data: customer });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * DELETE /api/customers/:id
 * Deletes a customer and automatically resequences all remaining customer IDs (e.g. if CUST-122 is deleted, CUST-123 becomes CUST-122)
 */
customerRouter.delete('/:id', authorize('ADMIN', 'CRM', 'MANAGER', 'TECHNICAL_LEAD', 'TECHNICAL_MANAGER', 'BDM'), async (req: AuthRequest, res: Response) => {
  try {
    let customer: any = null;
    if (Types.ObjectId.isValid(req.params.id)) {
      customer = await Customer.findById(req.params.id);
    }
    if (!customer) {
      const cleanCode = req.params.id.replace(/\s+/g, '').toUpperCase();
      customer = await Customer.findOne({ customerId: cleanCode });
    }
    if (!customer) {
      const numMatch = req.params.id.match(/\d+/);
      if (numMatch) {
        const paddedCode = `CUST-${numMatch[0].padStart(3, '0')}`;
        customer = await Customer.findOne({ customerId: paddedCode });
      }
    }
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const deletedCode = customer.customerId;
    const deletedName = customer.fullName;

    // 1. Delete customer
    await Customer.findByIdAndDelete(customer._id);

    // 2. Cascade cleanup on linked collections
    await Project.deleteMany({ customerId: customer._id });
    await Payment.deleteMany({ customerId: customer._id });
    await WhatsAppMessage.deleteMany({ customerId: customer._id });
    await Quotation.updateMany(
      { createdCustomerId: customer._id },
      { $unset: { createdCustomerId: '', createdCustomerCode: '' } }
    );

    // 3. Automatically resequence remaining customer IDs to shift down numbers with zero gaps (e.g. CUST-123 becomes CUST-122)
    const resequenceResult = await resequenceCustomerIds();

    return res.json({
      success: true,
      message: `Customer ${deletedCode} (${deletedName}) deleted successfully. Remaining ${resequenceResult.totalResequenced} customer IDs shifted down dynamically without gaps.`,
      resequenceResult,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/customers/resequence
 * Manually trigger resequencing of all customer IDs across database
 */
customerRouter.post('/resequence', authorize('ADMIN', 'CRM', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const result = await resequenceCustomerIds();
    return res.json({
      success: true,
      message: `Resequenced customer IDs: ${result.updatedCount} updated out of ${result.totalResequenced} total customers.`,
      data: result,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});
