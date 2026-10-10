import bcrypt from 'bcryptjs';
import { connectDB, disconnectDB } from '../config/db';
import {
  User,
  Customer,
  Project,
  Payment,
  WhatsAppChannel,
  WhatsAppMessage,
  WhatsAppTemplate,
  ProjectActivity,
  SystemSettings,
} from '../models';

const TEMPLATES = [
  {
    templateName: 'PAYMENT_CONFIRMATION',
    displayName: 'Payment Confirmation & Project Kickoff',
    category: 'UTILITY',
    stageMapping: 'PAYMENT_RECEIVED',
    bodyText: 'Hello {{customer_name}},\n\nWe have successfully received your initial 30% advance payment for project {{project_name}}.\n\nCurrent Stage: {{project_stage}}\nNext Milestone: {{next_milestone}}\n\nOur technical team has officially commenced project planning.\n\nThank you,\nAlpha Elevators',
    variablesList: ['customer_name', 'project_name', 'project_stage', 'next_milestone'],
  },
  {
    templateName: 'SITE_MEASUREMENT',
    displayName: 'Site Measurement Completed',
    category: 'UTILITY',
    stageMapping: 'SITE_MEASUREMENT',
    bodyText: 'Hello {{customer_name}},\n\nProject Update — {{project_name}}\n\nCurrent Stage: {{project_stage}}\nNext Milestone: {{next_milestone}}\n\nOur civil engineers have recorded all hoistway dimensions to ensure precision fitment.\n\nThank you,\nAlpha Elevators',
    variablesList: ['customer_name', 'project_name', 'project_stage', 'next_milestone'],
  },
  {
    templateName: 'DESIGN_UPDATE',
    displayName: 'Cabin Design & 3D Architectural Drawings',
    category: 'UTILITY',
    stageMapping: 'DESIGN',
    bodyText: 'Hello {{customer_name}},\n\nProject Update — {{project_name}}\n\nCurrent Stage: {{project_stage}}\nNext Milestone: {{next_milestone}}\n\nCabin 3D renderings and structural shaft drawings have been drafted by our architects.\n\nThank you,\nAlpha Elevators',
    variablesList: ['customer_name', 'project_name', 'project_stage', 'next_milestone'],
  },
  {
    templateName: 'CUSTOMER_APPROVAL',
    displayName: 'Awaiting Customer Design Approval',
    category: 'UTILITY',
    stageMapping: 'CUSTOMER_APPROVAL',
    bodyText: 'Hello {{customer_name}},\n\nProject Update — {{project_name}}\n\nCurrent Stage: {{project_stage}}\nNext Milestone: {{next_milestone}}\n\nPlease review and approve the elevator interior finishes and cabin dimensions.\n\nThank you,\nAlpha Elevators',
    variablesList: ['customer_name', 'project_name', 'project_stage', 'next_milestone'],
  },
  {
    templateName: 'ENGINEERING_UPDATE',
    displayName: 'Engineering & Bill of Materials Locked',
    category: 'UTILITY',
    stageMapping: 'ENGINEERING',
    bodyText: 'Hello {{customer_name}},\n\nProject Update — {{project_name}}\n\nCurrent Stage: {{project_stage}}\nNext Milestone: {{next_milestone}}\n\nEngineering specifications and electrical drive configurations are locked for fabrication.\n\nThank you,\nAlpha Elevators',
    variablesList: ['customer_name', 'project_name', 'project_stage', 'next_milestone'],
  },
  {
    templateName: 'MANUFACTURING_UPDATE',
    displayName: 'Factory Manufacturing in Progress',
    category: 'UTILITY',
    stageMapping: 'MANUFACTURING',
    bodyText: 'Hello {{customer_name}},\n\nProject Update — {{project_name}}\n\nCurrent Stage: {{project_stage}}\nNext Milestone: {{next_milestone}}\n\nYour elevator cabin, structural car frame, and German traction motor are being assembled in our factory.\n\nThank you,\nAlpha Elevators',
    variablesList: ['customer_name', 'project_name', 'project_stage', 'next_milestone'],
  },
  {
    templateName: 'PROGRESS_UPDATE',
    displayName: 'Standard Bi-Weekly Progress Update',
    category: 'UTILITY',
    stageMapping: 'PROGRESS_UPDATE',
    bodyText: 'Hello {{customer_name}},\n\nProject Update — {{project_name}}\n\nCurrent Stage: {{project_stage}}\nNext Milestone: {{next_milestone}}\n\nWe will continue to keep you updated.\n\nThank you,\nAlpha Elevators',
    variablesList: ['customer_name', 'project_name', 'project_stage', 'next_milestone'],
  },
  {
    templateName: 'QUALITY_CHECK',
    displayName: 'Factory Quality Check & Safety Compliance',
    category: 'UTILITY',
    stageMapping: 'QUALITY_CHECK',
    bodyText: 'Hello {{customer_name}},\n\nProject Update — {{project_name}}\n\nCurrent Stage: {{project_stage}}\nNext Milestone: {{next_milestone}}\n\nComprehensive 52-point quality check and speed-governor calibration have been certified.\n\nThank you,\nAlpha Elevators',
    variablesList: ['customer_name', 'project_name', 'project_stage', 'next_milestone'],
  },
  {
    templateName: 'DISPATCH_UPDATE',
    displayName: 'Elevator Dispatched from Factory',
    category: 'UTILITY',
    stageMapping: 'DISPATCH',
    bodyText: 'Hello {{customer_name}},\n\nProject Update — {{project_name}}\n\nCurrent Stage: {{project_stage}}\nNext Milestone: {{next_milestone}}\n\nCrated elevator components and control panel have departed the factory and are in transit to your site.\n\nThank you,\nAlpha Elevators',
    variablesList: ['customer_name', 'project_name', 'project_stage', 'next_milestone'],
  },
  {
    templateName: 'DELIVERY_UPDATE',
    displayName: 'Material Delivered to Site',
    category: 'UTILITY',
    stageMapping: 'DELIVERY',
    bodyText: 'Hello {{customer_name}},\n\nProject Update — {{project_name}}\n\nCurrent Stage: {{project_stage}}\nNext Milestone: {{next_milestone}}\n\nAll elevator materials have arrived safely at your site. Rigging and storage checklist completed.\n\nThank you,\nAlpha Elevators',
    variablesList: ['customer_name', 'project_name', 'project_stage', 'next_milestone'],
  },
  {
    templateName: 'INSTALLATION_UPDATE',
    displayName: 'Shaft Installation & Guide Rail Alignment',
    category: 'UTILITY',
    stageMapping: 'INSTALLATION',
    bodyText: 'Hello {{customer_name}},\n\nProject Update — {{project_name}}\n\nCurrent Stage: {{project_stage}}\nNext Milestone: {{next_milestone}}\n\nGuide rail vertical plumb alignment and mechanical car erection are actively underway.\n\nThank you,\nAlpha Elevators',
    variablesList: ['customer_name', 'project_name', 'project_stage', 'next_milestone'],
  },
  {
    templateName: 'PROJECT_COMPLETED',
    displayName: 'Installation Completed & Handover Certified',
    category: 'UTILITY',
    stageMapping: 'COMPLETED',
    bodyText: 'Hello {{customer_name}},\n\nCongratulations! Your elevator project {{project_name}} is completed and certified for safe travel.\n\nWarranty and complimentary 1-year annual maintenance contract (AMC) are now active.\n\nThank you,\nAlpha Elevators',
    variablesList: ['customer_name', 'project_name', 'project_stage', 'next_milestone'],
  },
];

const PILOT_CUSTOMERS_DATA = [
  {
    name: 'Kumar',
    phone: '+919820011101',
    address: 'Plot 42, Palm Meadows, Whitefield',
    city: 'Bengaluru',
    state: 'Karnataka',
    liftModel: 'Alpha EV',
    liftType: 'Home Lift',
    orderValue: 850000,
    status: 'MANUFACTURING',
    groupId: 'GROUP_TEST_001',
    frequency: 20,
    dueToday: true, // for immediate Acceptance Test
  },
  {
    name: 'Raj Sharma',
    phone: '+919820011102',
    address: 'Bungalow 7, Juhu Tara Road',
    city: 'Mumbai',
    state: 'Maharashtra',
    liftModel: 'Alpha Premier',
    liftType: 'Villa Lift',
    orderValue: 1200000,
    status: 'ENGINEERING',
    groupId: 'META_GROUP_XYZ456',
    frequency: 10,
    dueToday: false,
  },
  {
    name: 'Priya Patel',
    phone: '+919820011103',
    address: '14 Alkapuri Green Valley',
    city: 'Vadodara',
    state: 'Gujarat',
    liftModel: 'Alpha Luxe Glass',
    liftType: 'Glass Panoramic',
    orderValue: 1550000,
    status: 'DESIGN',
    groupId: 'META_GROUP_PRIYA',
    frequency: 15,
    dueToday: false,
  },
  {
    name: 'Dr. Vikram Malhotra',
    phone: '+919820011104',
    address: '92 Defence Colony',
    city: 'New Delhi',
    state: 'Delhi',
    liftModel: 'Alpha Hydraulic',
    liftType: 'Home Lift',
    orderValue: 980000,
    status: 'CUSTOMER_APPROVAL',
    groupId: 'META_GROUP_VIKRAM',
    frequency: 20,
    dueToday: false,
  },
  {
    name: 'Sunita Deshmukh',
    phone: '+919820011105',
    address: 'Kalyani Nagar Row House 3',
    city: 'Pune',
    state: 'Maharashtra',
    liftModel: 'Alpha EV',
    liftType: 'Home Lift',
    orderValue: 820000,
    status: 'QUALITY_CHECK',
    groupId: 'META_GROUP_SUNITA',
    frequency: 20,
    dueToday: false,
  },
  {
    name: 'Amit Verma',
    phone: '+919820011106',
    address: 'Penthouse 12B, Golf Course Road',
    city: 'Gurugram',
    state: 'Haryana',
    liftModel: 'Alpha MRL',
    liftType: 'Passenger',
    orderValue: 1100000,
    status: 'DISPATCH',
    groupId: 'META_GROUP_AMIT',
    frequency: 15,
    dueToday: false,
  },
  {
    name: 'Rajesh Singhania',
    phone: '+919820011107',
    address: 'Singhania Villa, Boat Club Road',
    city: 'Chennai',
    state: 'Tamil Nadu',
    liftModel: 'Alpha Luxe Glass',
    liftType: 'Glass Panoramic',
    orderValue: 1800000,
    status: 'DELIVERY',
    groupId: 'META_GROUP_SINGHANIA',
    frequency: 20,
    dueToday: false,
  },
  {
    name: 'Meera Nair',
    phone: '+919820011108',
    address: 'Panampilly Nagar Villa 8',
    city: 'Kochi',
    state: 'Kerala',
    liftModel: 'Alpha EV',
    liftType: 'Home Lift',
    orderValue: 790000,
    status: 'INSTALLATION',
    groupId: 'META_GROUP_MEERA',
    frequency: 10,
    dueToday: false,
  },
  {
    name: 'Sanjay Gupta',
    phone: '+919820011109',
    address: 'Civil Lines Heritage House',
    city: 'Jaipur',
    state: 'Rajasthan',
    liftModel: 'Alpha Premier',
    liftType: 'Home Lift',
    orderValue: 1050000,
    status: 'TESTING',
    groupId: 'META_GROUP_SANJAY',
    frequency: 20,
    dueToday: false,
  },
  {
    name: 'Anand Kulkarni',
    phone: '+919820011110',
    address: 'Sadashiv Peth Estate',
    city: 'Pune',
    state: 'Maharashtra',
    liftModel: 'Alpha EV',
    liftType: 'Home Lift',
    orderValue: 850000,
    status: 'COMPLETED',
    groupId: 'META_GROUP_ANAND',
    frequency: 20,
    dueToday: false,
  },
];

export async function seed() {
  console.log('[Seed] Connecting to database...');
  await connectDB();

  console.log('[Seed] Clearing existing collections...');
  await Promise.all([
    User.deleteMany({}),
    Customer.deleteMany({}),
    Project.deleteMany({}),
    Payment.deleteMany({}),
    WhatsAppChannel.deleteMany({}),
    WhatsAppMessage.deleteMany({}),
    WhatsAppTemplate.deleteMany({}),
    ProjectActivity.deleteMany({}),
    SystemSettings.deleteMany({}),
  ]);

  // 1. Create Users
  console.log('[Seed] Creating Admin and CRM users...');
  const passwordHash = await bcrypt.hash('admin123', 10);
  const crmPasswordHash = await bcrypt.hash('crm123', 10);

  const admin = await User.create({
    name: 'Ashiqur Rahman (Admin)',
    email: 'admin@alphaelevators.com',
    passwordHash,
    role: 'ADMIN',
    phone: '+91 98200 12345',
  });

  const crmUser = await User.create({
    name: 'Sneha Roy (CRM Specialist)',
    email: 'crm@alphaelevators.com',
    passwordHash: crmPasswordHash,
    role: 'CRM',
    phone: '+91 98200 54321',
  });

  // 2. Create WhatsApp Templates
  console.log('[Seed] Seeding 13 approved WhatsApp templates...');
  for (const t of TEMPLATES) {
    await WhatsAppTemplate.create({
      ...t,
      templateStatus: 'APPROVED',
      templateLanguage: 'en_US',
      metaTemplateId: `META_TMPL_${t.templateName}`,
    });
  }

  // 3. Create SystemSettings
  console.log('[Seed] Initializing SystemSettings...');
  await SystemSettings.create({
    key: 'GLOBAL_CONFIG',
    companyName: 'Alpha Elevators Pvt Ltd',
    pilotModeEnabled: true,
    pilotCustomerLimit: 10,
    whatsappTestMode: true,
    defaultUpdateFrequencyDays: 20,
    defaultUpdateTime: '09:00',
    timezone: 'Asia/Kolkata',
    metaApiVersion: 'v20.0',
    metaWebhookStatus: 'HEALTHY',
  });

  // 4. Create 10 Pilot Customers and Projects
  console.log('[Seed] Seeding 10 Pilot Projects & WhatsApp Channels...');
  const now = new Date();

  for (let i = 0; i < PILOT_CUSTOMERS_DATA.length; i++) {
    const data = PILOT_CUSTOMERS_DATA[i];
    const custId = `CUST-${String(i + 1).padStart(3, '0')}`;
    const projId = `ALP-${String(i + 1).padStart(3, '0')}`;

    const customer = await Customer.create({
      customerId: custId,
      fullName: data.name,
      phoneNumber: data.phone,
      whatsappNumber: data.phone,
      email: `${data.name.toLowerCase().replace(/[^a-z]/g, '')}@example.com`,
      address: data.address,
      city: data.city,
      state: data.state,
      pincode: '400001',
      customerType: 'Residential',
      leadSource: 'Architect Referral',
      assignedEmployee: crmUser.name,
      whatsappOptIn: true,
      optInDate: new Date(),
      optInSource: 'PROJECT_CONFIRMATION',
      optInPhone: data.phone,
      notes: `Pilot Customer #${i + 1} — High-priority villa elevator installation.`,
    });

    const advanceAmount = Math.round((data.orderValue * 30) / 100);
    const balanceAmount = data.orderValue - advanceAmount;

    // Delivery 4 months from order
    const expectedDelivery = new Date(now);
    expectedDelivery.setMonth(expectedDelivery.getMonth() + 4);

    // Next update schedule
    const nextUpdate = new Date(now);
    if (data.dueToday) {
      // Due right now for immediate acceptance testing!
      nextUpdate.setHours(nextUpdate.getHours() - 1);
    } else {
      nextUpdate.setDate(nextUpdate.getDate() + (i * 2 + 1));
      nextUpdate.setHours(9, 0, 0, 0);
    }

    const project = await Project.create({
      projectId: projId,
      customerId: customer._id,
      customerCode: custId,
      projectName: `${data.name} Residence`,
      siteAddress: data.address,
      liftModel: data.liftModel,
      liftType: data.liftType,
      orderValue: data.orderValue,
      advancePercentage: 30,
      advanceAmount,
      totalPaid: advanceAmount,
      balanceAmount,
      paymentStatus: 'ADVANCE_PAID',
      orderDate: new Date(now.getTime() - 15 * 24 * 3600 * 1000),
      expectedDeliveryDate: expectedDelivery,
      projectStatus: data.status,
      assignedEmployee: crmUser.name,
      projectManager: 'Eng. Ramesh Kulkarni',
      notes: `Pilot project #${i + 1}. Dedicated WhatsApp Group: ${data.groupId}`,
      whatsappGroupId: data.groupId,
      whatsappGroupName: `${data.name} Residence — Alpha Updates`,
      automationEnabled: data.status !== 'COMPLETED',
      updateFrequencyDays: data.frequency,
      lastUpdateAt: new Date(now.getTime() - (data.frequency * 24 * 3600 * 1000)),
      nextUpdateAt: nextUpdate,
    });

    // Record 30% Advance Payment
    await Payment.create({
      projectId: project._id,
      projectCode: projId,
      customerId: customer._id,
      customerName: customer.fullName,
      totalOrderValue: data.orderValue,
      advanceRequired: advanceAmount,
      amountPaid: advanceAmount,
      balanceAmount,
      paymentType: 'ADVANCE_30',
      paymentDate: project.orderDate,
      paymentMethod: 'BANK_TRANSFER',
      transactionReference: `ADV-TXN-${projId}-30PCT`,
      paymentStatus: 'SUCCESS',
      receiptNumber: `REC-${projId}-01`,
      notes: 'Initial 30% advance confirmation payment',
    });

    // Create WhatsApp Channel
    await WhatsAppChannel.create({
      whatsappGroupId: data.groupId,
      groupName: `${data.name} Residence — Alpha Updates`,
      projectId: project._id,
      projectCode: projId,
      customerId: customer._id,
      customerName: customer.fullName,
      groupStatus: data.status === 'COMPLETED' ? 'DISABLED' : 'ACTIVE',
      automationEnabled: data.status !== 'COMPLETED',
      updateFrequencyDays: data.frequency,
      nextUpdateDate: nextUpdate,
      lastUpdateDate: project.lastUpdateAt,
      participants: [
        { phoneNumber: data.phone, name: data.name, role: 'MEMBER' },
        { phoneNumber: '+919820012345', name: 'Alpha Support Bot', role: 'ADMIN' },
      ],
    });

    // Record initial Kickoff WhatsApp Message
    const kickMsgId = `wamid.HBgM${Date.now()}${i}INIT`;
    await WhatsAppMessage.create({
      projectId: project._id,
      projectCode: projId,
      customerId: customer._id,
      customerName: customer.fullName,
      groupId: data.groupId,
      templateName: 'PAYMENT_CONFIRMATION',
      metaMessageId: kickMsgId,
      messageType: 'template',
      recipientType: 'group',
      direction: 'OUTGOING',
      messageContent: `Hello ${customer.fullName},\n\nWe have successfully received your initial 30% advance payment for project ${project.projectName}.\n\nCurrent Stage: PAYMENT RECEIVED\nNext Milestone: Site Measurement & Shaft Inspection\n\nThank you,\nAlpha Elevators`,
      status: 'READ',
      sentAt: project.orderDate,
      deliveredAt: new Date(project.orderDate.getTime() + 5000),
      readAt: new Date(project.orderDate.getTime() + 15000),
      isAutomated: true,
      idempotencyKey: `INIT_${projId}_PAYMENT_CONFIRMATION`,
    });

    // Record customer reply for Kumar to test Section 16
    if (i === 0) {
      await WhatsAppMessage.create({
        projectId: project._id,
        projectCode: projId,
        customerId: customer._id,
        customerName: customer.fullName,
        groupId: data.groupId,
        metaMessageId: `wamid.HBgM${Date.now()}REPLY`,
        messageType: 'text',
        recipientType: 'group',
        direction: 'INCOMING',
        senderName: customer.fullName,
        senderPhone: customer.phoneNumber,
        messageContent: 'Sir, when will installation start?',
        status: 'READ',
        readAt: new Date(),
        isAutomated: false,
      });
    }

    // Record ProjectActivity
    await ProjectActivity.create({
      projectId: project._id,
      projectCode: projId,
      type: 'STATUS_CHANGE',
      description: `Project initialized at stage ${data.status}. WhatsApp group ${data.groupId} linked.`,
      userName: 'Sneha Roy (CRM)',
    });
  }

  console.log('[Seed] Database successfully seeded with 10 pilot projects, 13 approved templates, and test users!');
}

if (require.main === module) {
  seed().then(() => {
    console.log('[Seed] Done. Disconnecting...');
    disconnectDB().then(() => process.exit(0));
  });
}
