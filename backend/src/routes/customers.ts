import { Router, Response } from 'express';
import { Customer, Project, Payment, WhatsAppMessage, ProjectActivity } from '../models';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
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
    const { search, optIn, customerType } = req.query;
    const query: any = {};

    if (req.user?.role === 'BDM') {
      query.bdmId = req.user._id;
    }

    if (search && typeof search === 'string') {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { fullName: searchRegex },
        { phoneNumber: searchRegex },
        { whatsappNumber: searchRegex },
        { customerId: searchRegex },
        { city: searchRegex },
      ];
    }

    if (optIn !== undefined && optIn !== '') {
      query.whatsappOptIn = optIn === 'true';
    }

    if (customerType && typeof customerType === 'string') {
      query.customerType = customerType;
    }

    const customers = await Customer.find(query).sort({ createdAt: -1 });
    return res.json({ success: true, count: customers.length, data: customers });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/customers
 */
customerRouter.post('/', authorize('ADMIN', 'CRM', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const {
      fullName,
      phoneNumber,
      whatsappNumber,
      email,
      address,
      doorNo,
      streetName,
      landmark,
      city,
      state,
      pincode,
      customerType,
      leadSource,
      assignedEmployee,
      whatsappOptIn,
      optInSource,
      notes,
    } = req.body;

    const fullAddress = (
      address ||
      [doorNo, streetName, landmark].filter(Boolean).join(', ')
    ).trim();

    if (!fullName || !phoneNumber || !fullAddress) {
      return res.status(400).json({ success: false, message: 'Full name, phone number, and address are required' });
    }

    // Auto-generate customerId CUST-XXX
    const count = await Customer.countDocuments();
    const customerId = `CUST-${String(count + 1).padStart(3, '0')}`;

    const newCustomer = await Customer.create({
      customerId,
      fullName: fullName.trim(),
      phoneNumber: phoneNumber.trim(),
      whatsappNumber: (whatsappNumber || phoneNumber).trim(),
      email: email ? email.trim() : undefined,
      doorNo: doorNo ? doorNo.trim() : undefined,
      streetName: streetName ? streetName.trim() : undefined,
      landmark: landmark ? landmark.trim() : undefined,
      address: fullAddress,
      city: city || 'Mumbai',
      state: state || 'Maharashtra',
      pincode: pincode || '',
      customerType: customerType || 'Residential',
      leadSource: leadSource || 'Direct Inquiry',
      assignedEmployee: assignedEmployee || req.user?.name,
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
    const customer = await Customer.findById(req.params.id);
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
customerRouter.put('/:id', authorize('ADMIN', 'CRM', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const updated = await Customer.findByIdAndUpdate(req.params.id, req.body, { new: true });
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
 */
customerRouter.delete('/:id', authorize('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const deleted = await Customer.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }
    return res.json({ success: true, message: 'Customer deleted successfully' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});
