import { Router, Response } from 'express';
import { QCReport, Customer, Project, WhatsAppMessage, WhatsAppMessageLog } from '../models';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { generateQCReportPdf } from '../services/qc/qcReportGenerator';
import { whatsAppWebBot } from '../services/whatsapp/whatsappWebBot';
import { logProjectActivity } from '../services/activity/activityService';
import { autoFillExecutedDatesForCompletedStages } from '../utils/stageDates';
import path from 'path';
import fs from 'fs';

export const qcRouter = Router();

// Allow authenticated users (QC, Admin, CRM, etc.)
qcRouter.use(authenticate);

/**
 * POST /api/qc/generate-pdf
 * Generates an official PDF report on-the-fly and returns either the binary stream
 * or JSON metadata with relative download URL.
 * If `_id` or `reportId` is provided without photos, hydrates stored photos/signatures from MongoDB.
 */
qcRouter.post('/generate-pdf', async (req: AuthRequest, res: Response) => {
  try {
    const reportData = { ...req.body };

    // Hydrate stored photos/signatures from MongoDB when downloading an existing saved report
    if (reportData._id || reportData.reportId) {
      const hasPhotos =
        reportData.photos &&
        typeof reportData.photos === 'object' &&
        Object.values(reportData.photos).some((arr: any) => Array.isArray(arr) && arr.length > 0);
      if (!hasPhotos) {
        const existingReport = reportData._id
          ? await QCReport.findById(reportData._id).lean().catch(() => null)
          : await QCReport.findOne({ reportId: reportData.reportId }).lean().catch(() => null);
        if (existingReport) {
          reportData.clientName = reportData.clientName || existingReport.clientName;
          reportData.jobNo = reportData.jobNo || existingReport.jobNo;
          reportData.photos = existingReport.photos || reportData.photos;
          reportData.supportPhotos = (existingReport as any).supportPhotos || reportData.supportPhotos;
          reportData.technicianSignatureImage =
            reportData.technicianSignatureImage || (existingReport as any).technicianSignatureImage;
          reportData.clientSignatureImage =
            reportData.clientSignatureImage || (existingReport as any).clientSignatureImage;
        }
      }
    }

    if (!reportData.clientName || !reportData.jobNo) {
      return res.status(400).json({ success: false, message: 'Client Name and Job No are required to generate PDF' });
    }

    const { buffer, relativeUrl, fileName } = await generateQCReportPdf(reportData);

    const isDirectDownload = req.query.download === 'true' || req.headers.accept === 'application/pdf';

    if (isDirectDownload) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      return res.send(buffer);
    }

    return res.json({
      success: true,
      message: 'Pre-production report PDF generated successfully',
      fileName,
      relativeUrl,
      downloadUrl: `/api/qc/download-file?name=${encodeURIComponent(fileName)}`,
    });
  } catch (err: any) {
    console.error('[QC] Generate PDF Error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to generate PDF' });
  }
});

/**
 * GET /api/qc/reports/:id/pdf
 * Generates and streams the official PDF for a saved QC report directly from MongoDB
 * without requiring the client browser to re-upload large base64 photo payloads.
 */
qcRouter.get('/reports/:id/pdf', async (req: AuthRequest, res: Response) => {
  try {
    const report = await QCReport.findById(req.params.id).lean();
    if (!report) {
      return res.status(404).json({ success: false, message: 'Site inspection report not found' });
    }

    const { buffer, fileName } = await generateQCReportPdf(report as any);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return res.send(buffer);
  } catch (err: any) {
    console.error('[QC] GET Report PDF Error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to generate report PDF' });
  }
});

/**
 * GET /api/qc/download-file
 * Direct download file stream
 */
qcRouter.get('/download-file', async (req: AuthRequest, res: Response) => {
  try {
    const fileName = req.query.name as string;
    if (!fileName) {
      return res.status(400).json({ success: false, message: 'File name is required' });
    }

    const safeName = path.basename(fileName);
    const filePath = path.resolve(__dirname, '../../uploads/qc-reports', safeName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'Report PDF file not found' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    return res.sendFile(filePath);
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/qc/reports
 * Saves a new QC Site Inspection Report into database, generates official PDF,
 * and routes it for Technical Manager (Kishore) approval.
 */
qcRouter.post('/reports', async (req: AuthRequest, res: Response) => {
  try {
    const formData = req.body;

    if (!formData.clientName || !formData.jobNo) {
      return res.status(400).json({ success: false, message: 'Job No and Client Name are required.' });
    }

    const reportId = `QCR-${Date.now().toString().slice(-6)}`;

    // Generate PDF & save to disk
    const { filePath, relativeUrl, fileName } = await generateQCReportPdf({
      ...formData,
      reportId,
    });

    // Match associated project
    let matchedProject = null;
    if (formData.projectId) {
      matchedProject = await Project.findById(formData.projectId);
    }
    if (!matchedProject && formData.jobNo) {
      matchedProject = await Project.findOne({
        projectId: new RegExp(`^${formData.jobNo.trim()}$`, 'i'),
      });
    }

    const report = new QCReport({
      ...formData,
      reportId,
      pdfUrl: relativeUrl,
      pdfFilePath: filePath,
      projectId: matchedProject?._id || formData.projectId,
      customerId: matchedProject?.customerId || formData.customerId,
      createdBy: req.user?._id,
      status: 'SUBMITTED',
      approvalStatus: 'PENDING',
    });

    await report.save();

    // Alert Technical Manager (Kishore) via direct WhatsApp
    try {
      const techManagerPhone = '+919384820214';
      const botStatus = whatsAppWebBot.getStatus();
      if (botStatus.isConnected) {
        const alertText = `🔔 *Alpha CRM - Technical Manager Approval Request*\n\nA new Pre-Production Site Visit Report has been submitted by QC Inspector (${req.user?.name || 'QC'}).\n\n• *Project / Job No:* ${formData.jobNo}\n• *Client:* ${formData.clientName}\n• *Region:* ${formData.region}\n• *Date:* ${formData.reportDate}\n\nPlease review and approve the report in Alpha CRM to mark Site Visit as Done, move the stage to Drawing and Cabin, and dispatch the report PDF to the client group.`;
        whatsAppWebBot.sendDirectMessage(techManagerPhone, alertText).catch((err) => {
          console.warn('[QC] Notice alerting Kishore via WhatsApp:', err.message);
        });
      }
    } catch {
      // Non-blocking notification
    }

    return res.status(201).json({
      success: true,
      message: 'Site inspection report submitted and routed to Technical Manager (Kishore) for approval.',
      data: report,
    });
  } catch (err: any) {
    console.error('[QC] Save Report Error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to save report' });
  }
});

/**
 * GET /api/qc/reports
 * Lists site inspection reports with optional search and approvalStatus filtering
 */
qcRouter.get('/reports', async (req: AuthRequest, res: Response) => {
  try {
    const { search, approvalStatus, limit = '100' } = req.query;
    const query: any = {};

    if (search && typeof search === 'string') {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [{ clientName: searchRegex }, { jobNo: searchRegex }, { region: searchRegex }];
    }

    if (approvalStatus && typeof approvalStatus === 'string') {
      query.approvalStatus = approvalStatus.toUpperCase();
    }

    const reports = await QCReport.find(query)
      .populate('createdBy', 'name email role')
      .populate('approvedBy', 'name email role')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit as string, 10));

    return res.json({ success: true, count: reports.length, data: reports });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/qc/reports/:id
 */
qcRouter.get('/reports/:id', async (req: AuthRequest, res: Response) => {
  try {
    const report = await QCReport.findById(req.params.id)
      .populate('createdBy', 'name email role')
      .populate('approvedBy', 'name email role');
    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }
    return res.json({ success: true, data: report });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PUT /api/qc/reports/:id
 * Updates an existing QC Site Inspection Report, regenerates the official PDF,
 * resets approvalStatus to PENDING, and routes the edited report to Technical Manager (Kishore) for approval.
 */
qcRouter.put('/reports/:id', async (req: AuthRequest, res: Response) => {
  try {
    const existing = await QCReport.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Site inspection report not found' });
    }

    const formData = req.body;
    if (!formData.clientName || !formData.jobNo) {
      return res.status(400).json({ success: false, message: 'Job No and Client Name are required.' });
    }

    const reportId = existing.reportId || `QCR-${Date.now().toString().slice(-6)}`;

    // Regenerate official PDF with edited fields
    const { filePath, relativeUrl } = await generateQCReportPdf({
      ...formData,
      reportId,
    });

    // Match associated project
    let matchedProject = null;
    if (formData.projectId) {
      matchedProject = await Project.findById(formData.projectId);
    }
    if (!matchedProject && formData.jobNo) {
      matchedProject = await Project.findOne({
        projectId: new RegExp(`^${formData.jobNo.trim()}$`, 'i'),
      });
    }

    const updatePayload: any = {
      ...formData,
      reportId,
      pdfUrl: relativeUrl,
      pdfFilePath: filePath,
      projectId: matchedProject?._id || formData.projectId || existing.projectId,
      customerId: matchedProject?.customerId || formData.customerId || existing.customerId,
      status: 'SUBMITTED',
      approvalStatus: 'PENDING',
      rejectionReason: undefined,
      approvedAt: undefined,
      approvedBy: undefined,
    };
    delete updatePayload._id;
    delete updatePayload.createdAt;
    delete updatePayload.updatedAt;

    Object.assign(existing, updatePayload);
    existing.approvalStatus = 'PENDING';
    existing.rejectionReason = undefined;
    existing.approvedAt = undefined;
    existing.approvedBy = undefined;
    await existing.save();

    // Alert Technical Manager (Kishore) via direct WhatsApp
    try {
      const techManagerPhone = '+919384820214';
      const botStatus = whatsAppWebBot.getStatus();
      if (botStatus.isConnected) {
        const alertText = `🔔 *Alpha CRM - Edited QC Report Resubmitted for Approval*\n\nAn updated Pre-Production Site Visit Report (${reportId}) has been edited and submitted by ${req.user?.name || 'QC'} for your approval.\n\n• *Project / Job No:* ${formData.jobNo}\n• *Client:* ${formData.clientName}\n• *Region:* ${formData.region}\n• *Date:* ${formData.reportDate}\n\nPlease review and approve the updated report in Alpha CRM.`;
        whatsAppWebBot.sendDirectMessage(techManagerPhone, alertText).catch((err) => {
          console.warn('[QC] Notice alerting Kishore via WhatsApp:', err.message);
        });
      }
    } catch {
      // Non-blocking notification
    }

    return res.json({
      success: true,
      message: 'Edited QC report saved and sent to Technical Manager (Kishore) for approval!',
      data: existing,
    });
  } catch (err: any) {
    console.error('[QC] Update Report Error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to update QC report' });
  }
});

/**
 * POST /api/qc/reports/:id/approve
 * Technical Manager (Kishore) or Admin approves the Pre-Production Site Visit Report.
 * Actions:
 * 1. Sets report.approvalStatus = 'APPROVED'
 * 2. Marks Site Visit (SITE_MEASUREMENT) as Done by recording executedDate in project.stageDates
 * 3. Advances project stage to Drawing and Cabin (DESIGN)
 * 4. Dispatches time-based greeting message to the project's WhatsApp group
 * 5. Sends the official Pre-Production Site Report PDF directly to the WhatsApp group
 */
qcRouter.post('/:id/approve', authorize('TECHNICAL_MANAGER', 'ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const report = await QCReport.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ success: false, message: 'Site inspection report not found' });
    }

    report.approvalStatus = 'APPROVED';
    report.approvedBy = req.user?._id;
    report.approvedAt = new Date();
    if (req.body.notes) {
      report.approvalNotes = req.body.notes;
    }
    await report.save();

    // Find linked project
    let project = null;
    if (report.projectId) {
      project = await Project.findById(report.projectId);
    }
    if (!project && report.jobNo) {
      project = await Project.findOne({
        projectId: new RegExp(`^${report.jobNo.trim()}$`, 'i'),
      });
    }

    let messageSent = false;
    let pdfSent = false;

    if (project) {
      // 1. Mark Site Visit (SITE_MEASUREMENT) as Done by recording executedDate
      if (!project.stageDates) {
        project.stageDates = new Map();
      }
      const siteVisitStage = project.stageDates.get('SITE_MEASUREMENT') || {};
      const inspectionDate = report.reportDate ? new Date(report.reportDate) : new Date();
      const resolvedExecDate = isNaN(inspectionDate.getTime()) ? new Date() : inspectionDate;
      siteVisitStage.executedDate = resolvedExecDate;
      if (!siteVisitStage.scheduleDate) {
        siteVisitStage.scheduleDate = resolvedExecDate;
      }
      project.stageDates.set('SITE_MEASUREMENT', siteVisitStage);

      // 2. Move project stage from Site Visit (SITE_MEASUREMENT) to Drawing and Cabin (DESIGN)
      if (!project.projectStatus || project.projectStatus === 'PAYMENT_RECEIVED' || project.projectStatus === 'SITE_MEASUREMENT') {
        project.projectStatus = 'DESIGN';
      }

      autoFillExecutedDatesForCompletedStages(project);
      await project.save();

      // Log project stage change activity
      await logProjectActivity({
        projectId: project._id,
        projectCode: project.projectId,
        type: 'STATUS_CHANGE',
        description: `Technical Manager (${req.user?.name || 'Kishore'}) approved Pre-Production Site Visit Report. Site Visit (SITE_MEASUREMENT) marked Done and project stage moved to Drawing and Cabin (DESIGN).`,
        userId: req.user?._id,
        userName: req.user?.name,
      });

      // 3. Compute dynamic time-based greeting
      const now = new Date();
      const currentHour = now.getHours();
      let greeting = 'Good Afternoon';
      if (currentHour < 12) {
        greeting = 'Good Morning';
      } else if (currentHour >= 17) {
        greeting = 'Good Evening';
      }

      const messageText = `Dear Sir/Madam,

We have successfully completed the site visit on the scheduled date and shared the site visit report with you via email.

Kindly review the report and confirm your approval by replying to the email so that we can initiate the drawing process based on the site measurements.

Thank you for your support and cooperation.

Regards,
Alpha Elevators Team`;

      // 4. Resolve group target & send text + PDF document
      const inviteTarget = project.whatsapp?.inviteLink || project.whatsapp?.groupId || project.whatsappGroupId;

      // Ensure PDF file path is available
      let pdfPath = report.pdfFilePath;
      if (!pdfPath || !fs.existsSync(pdfPath)) {
        const safeName = path.basename(report.pdfUrl || '');
        const candidate = path.resolve(__dirname, '../../uploads/qc-reports', safeName);
        if (fs.existsSync(candidate)) {
          pdfPath = candidate;
        }
      }

      if (!pdfPath || !fs.existsSync(pdfPath)) {
        try {
          const gen = await generateQCReportPdf({
            ...report.toObject(),
            reportId: report.reportId,
          });
          pdfPath = gen.filePath;
          report.pdfFilePath = gen.filePath;
          report.pdfUrl = gen.relativeUrl;
          await report.save();
        } catch (pdfErr) {
          console.error('[QC Approve] Could not recompile PDF on the fly:', pdfErr);
        }
      }

      if (inviteTarget) {
        const botStatus = whatsAppWebBot.getStatus();
        let providerMsgId = `SV_${Date.now()}`;

        if (botStatus.isConnected) {
          // Send WhatsApp text message to group
          const msgRes = await whatsAppWebBot.sendMessageToGroup(inviteTarget, messageText);
          if (msgRes.success) {
            messageSent = true;
            providerMsgId = msgRes.messageId || providerMsgId;
          }

          // Send PDF document to group
          if (pdfPath && fs.existsSync(pdfPath)) {
            const fileName = path.basename(pdfPath);
            const docRes = await whatsAppWebBot.sendDocumentToGroup(
              inviteTarget,
              pdfPath,
              fileName,
              `📄 Alpha Elevators - Pre-Production Site Visit Report (${project.projectId})`
            );
            if (docRes.success) {
              pdfSent = true;
            }
          }
        }

        // Record message log
        await WhatsAppMessageLog.create({
          projectId: project._id,
          groupId: inviteTarget,
          messageText,
          messageType: 'text',
          scheduledAt: new Date(),
          attemptedAt: new Date(),
          sentAt: messageSent ? new Date() : undefined,
          providerMessageId: providerMsgId,
          status: messageSent ? 'SENT' : 'AWAITING_PROVIDER_CAPABILITY',
          attemptCount: 1,
          isDryRun: false,
        });

        // Record legacy WhatsAppMessage for UI
        const customer: any = (project.customerId as any)?._id ? project.customerId : await Customer.findById(project.customerId);
        await WhatsAppMessage.create({
          projectId: project._id,
          projectCode: project.projectId,
          customerId: project.customerId,
          customerName: customer?.fullName || project.projectName || 'Customer',
          groupId: inviteTarget,
          templateName: 'SITE_VISIT_COMPLETED',
          messageType: 'template',
          recipientType: 'group',
          direction: 'OUTGOING',
          messageContent: messageText,
          status: messageSent ? 'SENT' : 'AWAITING_PROVIDER_CAPABILITY',
          isAutomated: true,
          idempotencyKey: `SV_APPROVED_${project.projectId}_${Date.now()}`,
        });

        await logProjectActivity({
          projectId: project._id,
          projectCode: project.projectId,
          type: 'WHATSAPP_SENT',
          description: `Site visit completed update & report PDF posted to WhatsApp group (${project.whatsappGroupName || inviteTarget})`,
          userId: req.user?._id,
          userName: req.user?.name,
        });
      }
    }

    return res.json({
      success: true,
      message: 'Report approved by Technical Manager! Site Visit marked Done, project stage moved to Drawing and Cabin, and WhatsApp group update + PDF sent.',
      data: {
        report,
        projectStatus: project?.projectStatus,
        whatsappSent: messageSent,
        pdfSent,
      },
    });
  } catch (err: any) {
    console.error('[QC Approve Error]:', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to approve report' });
  }
});

/**
 * POST /api/qc/reports/:id/reject
 * Technical Manager (Kishore) or Admin rejects the Pre-Production Site Visit Report
 */
qcRouter.post('/:id/reject', authorize('TECHNICAL_MANAGER', 'ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { reason } = req.body;
    const report = await QCReport.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ success: false, message: 'Site inspection report not found' });
    }

    report.approvalStatus = 'REJECTED';
    report.rejectionReason = reason || 'Rejected by Technical Manager';
    await report.save();

    return res.json({
      success: true,
      message: 'Report has been rejected. QC has been notified to make revisions.',
      data: report,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

