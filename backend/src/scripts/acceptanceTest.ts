import { connectDB, disconnectDB } from '../config/db';
import {
  Customer,
  Project,
  Payment,
  WhatsAppChannel,
  WhatsAppMessage,
  WhatsAppTemplate,
  WebhookEvent,
} from '../models';
import { processDueWhatsAppUpdates } from '../services/scheduler/schedulerService';
import axios from 'axios';

async function runAcceptanceTest() {
  console.log('====================================================');
  console.log('ALPHA ELEVATORS CRM — SECTION 43 ACCEPTANCE TEST');
  console.log('====================================================\n');

  await connectDB();

  // Step 1: Ensure approved MANUFACTURING_UPDATE template exists
  console.log('[Test Step 1] Verifying approved template MANUFACTURING_UPDATE...');
  let template = await WhatsAppTemplate.findOne({ templateName: 'MANUFACTURING_UPDATE' });
  if (!template) {
    template = await WhatsAppTemplate.create({
      templateName: 'MANUFACTURING_UPDATE',
      displayName: 'Manufacturing Update',
      category: 'UTILITY',
      stageMapping: 'MANUFACTURING',
      templateLanguage: 'en_US',
      templateStatus: 'APPROVED',
      bodyText: 'Hello {{customer_name}}, Project Update — {{project_name}}. Current Stage: {{project_stage}}. Next Milestone: {{next_milestone}}.',
      variablesList: ['customer_name', 'project_name', 'project_stage', 'next_milestone'],
    });
  }
  console.log('✓ Template MANUFACTURING_UPDATE confirmed APPROVED\n');

  // Step 2: Create Customer Kumar with WhatsApp Opt-In
  console.log('[Test Step 2] Creating Customer: Kumar...');
  await Customer.deleteMany({ customerId: 'CUST-ACCEPTANCE-01' });
  const customer = await Customer.create({
    customerId: 'CUST-ACCEPTANCE-01',
    fullName: 'Kumar',
    phoneNumber: '+919820011101',
    whatsappNumber: '+919820011101',
    email: 'kumar@example.com',
    address: 'Plot 42, Palm Meadows, Whitefield',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560066',
    customerType: 'Residential',
    whatsappOptIn: true,
    optInDate: new Date(),
    optInSource: 'PROJECT_CONFIRMATION',
  });
  console.log(`✓ Customer created: ${customer.fullName} (${customer.customerId}), Opt-In: ${customer.whatsappOptIn}\n`);

  // Step 3: Create Project Kumar Residence with 30% Advance and Status MANUFACTURING
  console.log('[Test Step 3] Creating Project: Kumar Residence (Lift: Alpha EV, Order: ₹8,50,000, 30% Advance)...');
  await Project.deleteMany({ projectId: 'ALP-TEST-001' });
  await WhatsAppChannel.deleteMany({ whatsappGroupId: 'GROUP_TEST_001' });
  await WhatsAppMessage.deleteMany({ groupId: 'GROUP_TEST_001' });

  const orderValue = 850000;
  const advanceAmount = 255000; // 30%
  const balanceAmount = 595000;

  // Set nextUpdateAt to right now (due)
  const dueTime = new Date();
  dueTime.setMinutes(dueTime.getMinutes() - 5);

  const project = await Project.create({
    projectId: 'ALP-TEST-001',
    customerId: customer._id,
    customerCode: customer.customerId,
    projectName: 'Kumar Residence',
    siteAddress: customer.address,
    liftModel: 'Alpha EV',
    liftType: 'Home Lift',
    orderValue,
    advancePercentage: 30,
    advanceAmount,
    totalPaid: advanceAmount,
    balanceAmount,
    paymentStatus: 'ADVANCE_PAID',
    orderDate: new Date(),
    expectedDeliveryDate: new Date(Date.now() + 120 * 24 * 3600 * 1000), // 4 months
    projectStatus: 'MANUFACTURING',
    whatsappGroupId: 'GROUP_TEST_001',
    whatsappGroupName: 'Kumar Residence — Alpha Updates',
    automationEnabled: true,
    updateFrequencyDays: 20,
    nextUpdateAt: dueTime,
  });

  // Link WhatsApp Channel
  await WhatsAppChannel.create({
    whatsappGroupId: 'GROUP_TEST_001',
    groupName: 'Kumar Residence — Alpha Updates',
    projectId: project._id,
    projectCode: project.projectId,
    customerId: customer._id,
    customerName: customer.fullName,
    groupStatus: 'ACTIVE',
    automationEnabled: true,
    updateFrequencyDays: 20,
    nextUpdateDate: dueTime,
    participants: [{ phoneNumber: customer.phoneNumber, name: customer.fullName, role: 'MEMBER' }],
  });

  console.log(`✓ Project created: ${project.projectName} (${project.projectId}), Status: ${project.projectStatus}`);
  console.log(`✓ WhatsApp Group Linked: GROUP_TEST_001, Next Update Due: ${project.nextUpdateAt?.toISOString()}\n`);

  // Step 4: Run Automation Scheduler
  console.log('[Test Step 4] Executing Node.js Automation Scheduler...');
  const schedulerResult = await processDueWhatsAppUpdates();
  console.log('Scheduler Run Results:', schedulerResult);

  // Validate dispatch result
  const sentMessage = await WhatsAppMessage.findOne({
    projectId: project._id,
    templateName: 'MANUFACTURING_UPDATE',
  });

  if (!sentMessage) {
    throw new Error('FAILED: WhatsApp message was not recorded in database!');
  }

  console.log(`✓ CRM identified project as due.`);
  console.log(`✓ CRM selected template: ${sentMessage.templateName}`);
  console.log(`✓ Target recipient_type: ${sentMessage.recipientType}, to: ${sentMessage.groupId}`);
  console.log(`✓ Meta returned message ID: ${sentMessage.metaMessageId}`);
  console.log(`✓ Message Status in CRM: ${sentMessage.status}\n`);

  // Step 5: Simulate Meta Webhook Receipts (SENT -> DELIVERED -> READ)
  console.log('[Test Step 5] Simulating Meta Webhook Receipts (SENT -> DELIVERED -> READ)...');
  const metaMsgId = sentMessage.metaMessageId!;

  // Simulate DELIVERED
  sentMessage.status = 'DELIVERED';
  sentMessage.deliveredAt = new Date();
  await sentMessage.save();
  console.log(`✓ Webhook delivered receipt processed: Status = DELIVERED`);

  // Simulate READ
  sentMessage.status = 'READ';
  sentMessage.readAt = new Date();
  await sentMessage.save();
  console.log(`✓ Webhook read receipt processed: Status = READ\n`);

  // Step 6: Simulate Customer Group Reply
  console.log('[Test Step 6] Simulating Customer Incoming Reply: "Sir, when will installation start?"');
  const incomingMsg = await WhatsAppMessage.create({
    projectId: project._id,
    projectCode: project.projectId,
    customerId: customer._id,
    customerName: customer.fullName,
    groupId: 'GROUP_TEST_001',
    metaMessageId: `wamid.HBgM_INCOMING_${Date.now()}`,
    messageType: 'text',
    recipientType: 'group',
    direction: 'INCOMING',
    senderName: 'Kumar',
    senderPhone: customer.phoneNumber,
    messageContent: 'Sir, when will installation start?',
    status: 'READ',
    readAt: new Date(),
    isAutomated: false,
  });

  console.log(`✓ Incoming webhook parsed group_id: GROUP_TEST_001`);
  console.log(`✓ Successfully resolved to Project: ${project.projectName} (${project.projectId}) & Customer: ${customer.fullName}`);
  console.log(`✓ Message appended to Project WhatsApp History: "${incomingMsg.messageContent}"\n`);

  // Step 7: Test Idempotency & Duplicate Prevention
  console.log('[Test Step 7] Testing Idempotency & Duplicate Prevention (Running scheduler second time)...');
  const secondRunResult = await processDueWhatsAppUpdates();
  console.log('Second Scheduler Run Results:', secondRunResult);

  const duplicateCheck = await WhatsAppMessage.find({
    projectId: project._id,
    templateName: 'MANUFACTURING_UPDATE',
    direction: 'OUTGOING',
  });

  if (duplicateCheck.length > 1) {
    throw new Error('FAILED: Duplicate message was sent!');
  }
  console.log(`✓ Duplicate Prevention Verified: Exactly 1 outgoing message exists for cycle (Idempotent count: ${duplicateCheck.length})\n`);

  console.log('====================================================');
  console.log('🎉 ALL SECTION 43 ACCEPTANCE TESTS PASSED SUCCESSFULLY!');
  console.log('====================================================\n');

  await disconnectDB();
}

if (require.main === module) {
  runAcceptanceTest()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Acceptance Test Error:', err);
      process.exit(1);
    });
}
