import { Router, Response } from 'express';
import { Customer, Project, Payment, WhatsAppMessage, ProjectActivity, User, Quotation } from '../models';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { PROJECT_STAGE_NEXT_WORK } from './reminders';
import { getNextCustomerId, getNextOldCustomerId, splitSharedCustomerProjects, resequenceCustomerIds } from '../utils/idGenerators';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, req.params.id + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

export const customerRouter = Router();

customerRouter.use(authenticate);

/**
 * GET /api/customers
 */
customerRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { search, optIn, customerType, bdmId, isOldCustomer } = req.query;
    const query: any = {};

    // Ensure each project has its own dedicated individual customer
    await splitSharedCustomerProjects();

    // Auto-link any customer created from an approved quotation that is missing bdmId
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
      // Non-blocking sync
    }

    if (req.user?.role === 'BDM') {
      const bdmConditions: any[] = [{ bdmId: req.user._id }];
      if (req.user.name) {
        bdmConditions.push({ assignedEmployee: new RegExp(`^${req.user.name.trim()}$`, 'i') });
      }
      if (req.user.phone) {
        const cleanPhone = req.user.phone.replace(/\D/g, '').slice(-10);
        if (cleanPhone) {
          bdmConditions.push({ bdmPhone: new RegExp(cleanPhone) });
        }
      }
      query.$or = bdmConditions;
    } else if (bdmId && bdmId !== 'ALL') {
      const bdmMatch = await User.findById(bdmId).catch(() => null);
      if (bdmMatch) {
        query.$or = [
          { bdmId: bdmMatch._id },
          { assignedEmployee: new RegExp(`^${bdmMatch.name.trim()}$`, 'i') },
        ];
      } else {
        query.bdmId = bdmId;
      }
    }

    if (search && typeof search === 'string') {
      const searchRegex = new RegExp(search.trim(), 'i');
      const searchOr = [
        { fullName: searchRegex },
        { phoneNumber: searchRegex },
        { whatsappNumber: searchRegex },
        { customerId: searchRegex },
        { city: searchRegex },
      ];
      if (query.$or) {
        query.$and = [{ $or: query.$or }, { $or: searchOr }];
        delete query.$or;
      } else {
        query.$or = searchOr;
      }
    }

    if (optIn !== undefined && optIn !== '') {
      query.whatsappOptIn = optIn === 'true';
    }

    if (customerType && typeof customerType === 'string') {
      query.customerType = customerType;
    }

    if (String(isOldCustomer) === 'true') {
      const oldFilter = {
        $or: [
          { isOldCustomer: true },
          { customerId: { $regex: /^OLD/i } },
        ],
      };
      if (query.$or) {
        query.$and = (query.$and || []).concat([{ $or: query.$or }, oldFilter]);
        delete query.$or;
      } else if (query.$and) {
        query.$and.push(oldFilter);
      } else {
        query.$or = oldFilter.$or;
      }
    } else if (String(isOldCustomer) === 'false') {
      const regularFilter = {
        isOldCustomer: { $ne: true },
        customerId: { $regex: /^(?!OLD)/i },
      };
      if (query.$and) {
        query.$and.push(regularFilter);
      } else {
        Object.assign(query, regularFilter);
      }
    }

    const customers = await Customer.find(query).populate('bdmId', 'name email phone').lean();

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
    }).select('customerId projectId projectName projectStatus nextUpdateAt').lean();

    const projectMap = new Map();
    activeProjects.forEach((p) => {
      if (!projectMap.has(String(p.customerId))) {
        const nextInfo = PROJECT_STAGE_NEXT_WORK[p.projectStatus];
        projectMap.set(String(p.customerId), {
          ...p,
          nextWork: nextInfo?.nextWork || 'Next Stage Due',
          nextWorkDesc: nextInfo?.description || '',
          currentStageLabel: nextInfo?.currentLabel || p.projectStatus,
        });
      }
    });

    const data = strictlyFiltered.map((c) => {
      const cObj: any = c.toObject ? c.toObject() : c;
      cObj.activeProject = projectMap.get(String(c._id)) || null;
      return cObj;
    });

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
    const customer = await Customer.findById(req.params.id).populate('bdmId', 'name email phone');
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    // Fetch related projects
    const projects = await Project.find({ customerId: customer._id }).sort({ createdAt: -1 });

    // Fetch related payments
    const payments = await Payment.find({ customerId: customer._id }).sort({ paymentDate: -1 });

    // Fetch related WhatsApp message history
    const messages = await WhatsAppMessage.find({ customerId: customer._id }).sort({ createdAt: -1 }).limit(50);

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
customerRouter.post('/:id/documents', authorize('ADMIN', 'CRM', 'MANAGER'), upload.single('document'), async (req: AuthRequest, res: Response) => {
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

    customer.documents.push({
      name: docName,
      url: docUrl,
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
customerRouter.put('/:id', authorize('ADMIN', 'CRM', 'MANAGER', 'BDM'), async (req: AuthRequest, res: Response) => {
  try {
    const updateData = { ...req.body };
    if (updateData.googleMapsLink) {
      updateData.googleMapsLink = updateData.googleMapsLink.trim();
      if (!updateData.address) updateData.address = updateData.googleMapsLink;
    } else if (updateData.address && (updateData.address.startsWith('http') || updateData.address.includes('maps'))) {
      updateData.googleMapsLink = updateData.address.trim();
    }
    const updated = await Customer.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }
    return res.json({ success: true, data: updated });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

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
 * Deletes a customer and automatically resequences all remaining customer IDs (e.g. CUST-003 becomes CUST-002)
 */
customerRouter.delete('/:id', authorize('ADMIN', 'CRM', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const deletedCode = customer.customerId;
    const deletedName = customer.fullName;

    // 1. Delete customer
    await Customer.findByIdAndDelete(req.params.id);

    // 2. Cascade cleanup on linked collections
    await Project.deleteMany({ customerId: customer._id });
    await Payment.deleteMany({ customerId: customer._id });
    await WhatsAppMessage.deleteMany({ customerId: customer._id });
    await Quotation.updateMany(
      { createdCustomerId: customer._id },
      { $unset: { createdCustomerId: '', createdCustomerCode: '' } }
    );

    // 3. Automatically resequence remaining customer IDs to shift down numbers with zero gaps
    const resequenceResult = await resequenceCustomerIds();

    return res.json({
      success: true,
      message: `Customer ${deletedCode} (${deletedName}) deleted successfully. Remaining ${resequenceResult.totalResequenced} customer IDs resequenced dynamically.`,
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
