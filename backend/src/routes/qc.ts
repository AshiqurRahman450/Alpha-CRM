import { Router, Response } from 'express';
import { QCReport, Customer, Project } from '../models';
import { authenticate, AuthRequest } from '../middleware/auth';
import { generateQCReportPdf } from '../services/qc/qcReportGenerator';
import path from 'path';
import fs from 'fs';

export const qcRouter = Router();

// Allow authenticated users (QC, Admin, CRM, etc.)
qcRouter.use(authenticate);

/**
 * POST /api/qc/generate-pdf
 * Generates an official PDF report on-the-fly and returns either the binary stream
 * or JSON metadata with relative download URL.
 */
qcRouter.post('/generate-pdf', async (req: AuthRequest, res: Response) => {
  try {
    const reportData = req.body;
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
 * Saves a new QC Site Inspection Report into database & generates official PDF
 */
qcRouter.post('/reports', async (req: AuthRequest, res: Response) => {
  try {
    const formData = req.body;

    if (!formData.clientName || !formData.jobNo) {
      return res.status(400).json({ success: false, message: 'Job No and Client Name are required.' });
    }

    const reportId = `QCR-${Date.now().toString().slice(-6)}`;

    // Generate PDF
    const { relativeUrl } = await generateQCReportPdf({
      ...formData,
      reportId,
    });

    const report = new QCReport({
      ...formData,
      reportId,
      pdfUrl: relativeUrl,
      createdBy: req.user?._id,
      status: 'SUBMITTED',
    });

    await report.save();

    return res.status(201).json({
      success: true,
      message: 'Site inspection report saved and PDF generated successfully',
      data: report,
    });
  } catch (err: any) {
    console.error('[QC] Save Report Error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to save report' });
  }
});

/**
 * GET /api/qc/reports
 * Lists past site inspection reports
 */
qcRouter.get('/reports', async (req: AuthRequest, res: Response) => {
  try {
    const { search, limit = '50' } = req.query;
    const query: any = {};

    if (search && typeof search === 'string') {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [{ clientName: searchRegex }, { jobNo: searchRegex }, { region: searchRegex }];
    }

    const reports = await QCReport.find(query)
      .populate('createdBy', 'name email role')
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
    const report = await QCReport.findById(req.params.id).populate('createdBy', 'name email role');
    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }
    return res.json({ success: true, data: report });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});
