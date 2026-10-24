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

export const TEMPLATES = [
  {
    templateName: 'SITE_VISIT_SCHEDULE_PM',
    displayName: 'Site Visit Schedule P M',
    category: 'UTILITY',
    stageMapping: 'SITE_MEASUREMENT',
    bodyText: 'Dear Sir/Madam,\nYour site visit has been scheduled for [Date] at [Time]. Our technical team will visit the site for measurement and inspection.\nKindly ensure site accessibility during the scheduled time.',
    variablesList: ['Date', 'Time'],
  },
  {
    templateName: 'SITE_VISIT_COMPLETED',
    displayName: 'Site Visit Completed',
    category: 'UTILITY',
    stageMapping: 'SITE_MEASUREMENT',
    bodyText: 'Good Afternoon Sir,\n\nWe have successfully completed the site visit on the scheduled date and shared the site visit report with you via email.\n\nKindly review the report and confirm your approval by replying to the email so that we can initiate the drawing process based on the site measurements.\n\nThank you for your support and cooperation.\n\nRegards,\nCRM Department\nAlpha Elevators',
    variablesList: [],
  },
  {
    templateName: 'DRAWING_CABIN_APPROVAL',
    displayName: 'Drawing & Cabin Approval',
    category: 'UTILITY',
    stageMapping: 'DESIGN',
    bodyText: 'Dear Sir/Madam,\nThe elevator drawing and cabin design are ready for your review and approval. Kindly review and confirm your approval to proceed to the next stage.',
    variablesList: [],
  },
  {
    templateName: 'DRAWING_CABIN_APPROVAL_REMINDER',
    displayName: 'Drawing & Cabin Approval Remainder',
    category: 'UTILITY',
    stageMapping: 'CUSTOMER_APPROVAL',
    bodyText: 'Dear Sir/Madam,\nThis is a gentle reminder to kindly review and approves the elevator drawing and cabin design shared with you, so that we can proceed with the next stage without delay.',
    variablesList: [],
  },
  {
    templateName: 'THANK_YOU_FOR_APPROVAL',
    displayName: 'Thank you for your approval',
    category: 'UTILITY',
    stageMapping: 'CUSTOMER_APPROVAL',
    bodyText: 'Dear Sir/Madam,\nWe have received your drawing and cabin approval. Kindly request you to make the production payment to initiate the production process.',
    variablesList: [],
  },
  {
    templateName: 'PRODUCTION_PAYMENT',
    displayName: 'Production Payment',
    category: 'UTILITY',
    stageMapping: 'ENGINEERING',
    bodyText: 'Dear Sir/Madam,\nThank you for the production payment. We have received the payment and will proceed with the production process accordingly.',
    variablesList: [],
  },
  {
    templateName: 'PRODUCTION_PAYMENT_REMINDER',
    displayName: 'Production Payment remainder',
    category: 'UTILITY',
    stageMapping: 'ENGINEERING',
    bodyText: 'Dear Sir/Madam,\nThis is a gentle reminder to kindly release the production payment to initiate the production process.\nPlease note that the production timeline is approximately 60 days from the date of payment and approval. Kindly complete the payment at the earliest to avoid any delay in the production schedule.',
    variablesList: [],
  },
  {
    templateName: 'PRODUCTION_PAYMENT_RECEIVED',
    displayName: 'Production Payment Received',
    category: 'UTILITY',
    stageMapping: 'ENGINEERING',
    bodyText: 'Dear Sir/Madam,\nThank you for the production payment. We have received the payment and will proceed with the production process accordingly.',
    variablesList: [],
  },
  {
    templateName: 'PRODUCTION_UPDATE_STAGE_1',
    displayName: 'Production Update – Stage 1 Production & Fabrication',
    category: 'UTILITY',
    stageMapping: 'MANUFACTURING',
    bodyText: 'Dear Sir/Madam,\nYour elevator production is currently in the fabrication and material processing stage, including structure, cabin, and door fabrication.\nWe will share the next production update within 10 days.',
    variablesList: [],
  },
  {
    templateName: 'PRODUCTION_UPDATE_STAGE_2',
    displayName: 'Production Update Stage 2 – Finishing & Assembly',
    category: 'UTILITY',
    stageMapping: 'MANUFACTURING',
    bodyText: 'Dear Sir/Madam,\nYour elevator is currently in the finishing and assembly stage, including painting, cabin finishing, and electrical & mechanical assembly.\nWe will share the next production update within 10 days.',
    variablesList: [],
  },
  {
    templateName: 'PRODUCTION_UPDATE_STAGE_3',
    displayName: 'Production Update Stage 3 – Final Inspection & Ready',
    category: 'UTILITY',
    stageMapping: 'QUALITY_CHECK',
    bodyText: 'Dear Sir/Madam,\nYour elevator is in the final inspection stage. Quality checks are being completed, and the material will be prepared for dispatch upon completion.',
    variablesList: [],
  },
  {
    templateName: 'READINESS_PAYMENT',
    displayName: 'Readiness Payment',
    category: 'UTILITY',
    stageMapping: 'QUALITY_CHECK',
    bodyText: 'Dear Sir/Madam,\nYour elevator is ready for dispatch. Kindly release the readiness payment to proceed with the material dispatch process.\nWe request you to complete the payment at the earliest to avoid any delay in dispatch.',
    variablesList: [],
  },
  {
    templateName: 'READINESS_PAYMENT_REMINDER',
    displayName: 'Readiness Payment Reminder',
    category: 'UTILITY',
    stageMapping: 'QUALITY_CHECK',
    bodyText: 'Dear Sir/Madam,\nThis is a gentle reminder to kindly release the Readiness payment to proceed with the Material dispatch.\nWe request you to complete the payment at the earliest to avoid any delay in the dispatch schedule.',
    variablesList: [],
  },
  {
    templateName: 'READINESS_PAYMENT_RECEIVED',
    displayName: 'Readiness Payment Received',
    category: 'UTILITY',
    stageMapping: 'QUALITY_CHECK',
    bodyText: 'Dear Sir/Madam,\nThank you for the readiness payment. We have received the payment and will proceed with the material dispatch process accordingly.',
    variablesList: [],
  },
  {
    templateName: 'MATERIAL_DISPATCHED_PM',
    displayName: 'Material Dispatched PM',
    category: 'UTILITY',
    stageMapping: 'DISPATCH',
    bodyText: 'Dear Sir/Madam,\nYour elevator material has been dispatched through VRL Logistics.\nVRL Tracking No.: [Tracking Number]\nYou can use the above tracking number to track the material movement. We will keep you updated on the delivery status.\nNote: Kindly ensure proper space and access for safe unloading and material storage.',
    variablesList: ['Tracking Number'],
  },
  {
    templateName: 'PRE_INSTALLATION_SITE_VISIT_PM',
    displayName: 'Pre-Installation Site Visit ( P M )',
    category: 'UTILITY',
    stageMapping: 'DELIVERY',
    bodyText: 'Dear Sir/Madam,\nOur technical team will visit the site for a pre-installation inspection to verify site readiness and installation requirements.\nKindly ensure the site is ready and accessible for the scheduled visit.',
    variablesList: [],
  },
  {
    templateName: 'MATERIAL_UNLOADING',
    displayName: 'Material Unloading',
    category: 'UTILITY',
    stageMapping: 'DELIVERY',
    bodyText: 'Dear Sir/Madam,\nYour elevator material has been Delivered to the site and unloading is in progress. We will keep you Updated on our installation team arrival shortly.',
    variablesList: [],
  },
  {
    templateName: 'INSTALLATION_TEAM_ARRIVAL_PM',
    displayName: 'Installation Team Arrival ( P M )',
    category: 'UTILITY',
    stageMapping: 'INSTALLATION',
    bodyText: 'Dear Sir/Madam,\nOur installation team has arrived at the site and will commence the elevator installation work as per the planned schedule.',
    variablesList: [],
  },
  {
    templateName: 'INSTALLATION_FEEDBACK',
    displayName: 'Installation Feedback',
    category: 'UTILITY',
    stageMapping: 'INSTALLATION',
    bodyText: 'Dear Sir/Madam,\nAs the installation work is in progress, kindly share your feedback or any concerns regarding the work. Our team will be happy to assist and address them promptly.',
    variablesList: [],
  },
  {
    templateName: 'HAND_OVER_PM',
    displayName: 'Hand Over ( P M)',
    category: 'UTILITY',
    stageMapping: 'TESTING',
    bodyText: 'Dear Sir/Madam,\nThis is to inform you that the elevator installation work is expected to be completed by tomorrow. Kindly share a convenient date and time for the handover, so that we can plan and complete the necessary handover formalities accordingly.',
    variablesList: [],
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

  const accountantPasswordHash = await bcrypt.hash('vincy123', 10);
  const accountantUser = await User.create({
    name: 'Vincy (Accountant)',
    email: 'vincy@alphaelevators.com',
    passwordHash: accountantPasswordHash,
    role: 'ACCOUNTANT',
    phone: '+91 98400 99881',
  });

  const qcPasswordHash = await bcrypt.hash('qc123', 10);
  const qcUser = await User.create({
    name: 'Dinesh Kumar S (QC Inspector)',
    email: 'qc@alphaelevators.com',
    passwordHash: qcPasswordHash,
    role: 'QC',
    phone: '+91 98400 11223',
  });

  const techLeadPasswordHash = await bcrypt.hash('tech123', 10);
  const techLeadUser = await User.create({
    name: 'Suresh Kumar (Technical Team Lead)',
    email: 'techlead@alphaelevators.com',
    passwordHash: techLeadPasswordHash,
    role: 'TECHNICAL_LEAD',
    phone: '+91 98401 55667',
  });

  const techManagerPasswordHash = await bcrypt.hash('kishore123', 10);
  const techManagerUser = await User.create({
    name: 'Kishore (Technical Manager)',
    email: 'kishore@alphaelevators.in',
    passwordHash: techManagerPasswordHash,
    role: 'TECHNICAL_MANAGER',
    phone: '+91 93848 20214',
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
      templateName: 'SITE_VISIT_SCHEDULE_PM',
      metaMessageId: kickMsgId,
      messageType: 'template',
      recipientType: 'group',
      direction: 'OUTGOING',
      messageContent: `Dear Sir/Madam,\nYour site visit has been scheduled for 25 Oct 2026 at 11:00 AM. Our technical team will visit the site for measurement and inspection.\nKindly ensure site accessibility during the scheduled time.`,
      status: 'READ',
      sentAt: project.orderDate,
      deliveredAt: new Date(project.orderDate.getTime() + 5000),
      readAt: new Date(project.orderDate.getTime() + 15000),
      isAutomated: true,
      idempotencyKey: `INIT_${projId}_SITE_VISIT_SCHEDULE_PM`,
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
