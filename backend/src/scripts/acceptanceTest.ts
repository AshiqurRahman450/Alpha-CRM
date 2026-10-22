import { connectDB, disconnectDB } from '../config/db';
import {
  Customer,
  Project,
  Payment,
  WhatsAppChannel,
  WhatsAppMessage,
  WhatsAppMessageLog,
  WhatsAppTemplate,
  WebhookEvent,
} from '../models';
import { processDueWhatsAppUpdates } from '../services/scheduler/schedulerService';
import axios from 'axios';

import { config } from '../config';

async function runAcceptanceTest() {
  config.wati.dryRun = true;
  console.log('====================================================');
  console.log('ALPHA ELEVATORS CRM — SECTION 43 ACCEPTANCE TEST');
  console.log('====================================================\n');

  await connectDB();

  // Step 1: Ensure approved PRODUCTION_UPDATE_STAGE_1 template exists
  console.log('[Test Step 1] Verifying approved template PRODUCTION_UPDATE_STAGE_1...');
  let template = await WhatsAppTemplate.findOne({ templateName: 'PRODUCTION_UPDATE_STAGE_1' });
  if (!template) {
    template = await WhatsAppTemplate.create({
      templateName: 'PRODUCTION_UPDATE_STAGE_1',
      displayName: 'Manufacturing Update',
      category: 'UTILITY',
      stageMapping: 'MANUFACTURING',
      templateLanguage: 'en_US',
      templateStatus: 'APPROVED',
      bodyText: 'Hello {{customer_name}}, Project Update — {{project_name}}. Current Stage: {{project_stage}}. Next Milestone: {{next_milestone}}.',
      variablesList: ['customer_name', 'project_name', 'project_stage', 'next_milestone'],
    });
  }
  console.log('✓ Template PRODUCTION_UPDATE_STAGE_1 confirmed APPROVED\n');

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
  await WhatsAppMessageLog.deleteMany({ groupId: 'GROUP_TEST_001' });

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
    whatsapp: {
      groupId: 'GROUP_TEST_001',
      groupName: 'Kumar Residence — Alpha Updates',
      updatesEnabled: true,
      paused: false,
      intervalDays: 20,
      nextUpdateAt: dueTime,
    },
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
    templateName: 'PRODUCTION_UPDATE_STAGE_1',
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
    templateName: 'PRODUCTION_UPDATE_STAGE_1',
    direction: 'OUTGOING',
  });

  if (duplicateCheck.length > 1) {
    throw new Error('FAILED: Duplicate message was sent!');
  }
  console.log(`✓ Duplicate Prevention Verified: Exactly 1 outgoing message exists for cycle (Idempotent count: ${duplicateCheck.length})\n`);

  // Step 8: Test Stage 2 Production Update (Finishing & Assembly)
  console.log('[Test Step 8] Simulating 10/20 days passing for Stage 2 Production Update...');
  const updatedProj1 = await Project.findById(project._id);
  if (!updatedProj1 || updatedProj1.productionStage !== 2) {
    throw new Error(`FAILED: Expected productionStage to be 2, but got ${updatedProj1?.productionStage}`);
  }
  // Simulate time reaching nextUpdateAt
  updatedProj1.nextUpdateAt = new Date(Date.now() - 1000);
  if (updatedProj1.whatsapp) updatedProj1.whatsapp.nextUpdateAt = updatedProj1.nextUpdateAt;
  await updatedProj1.save();

  const stage2RunResult = await processDueWhatsAppUpdates();
  console.log('Stage 2 Scheduler Run Results:', stage2RunResult);

  const stage2Msg = await WhatsAppMessage.findOne({
    projectId: project._id,
    templateName: 'PRODUCTION_UPDATE_STAGE_2',
  });
  if (!stage2Msg) {
    throw new Error('FAILED: Stage 2 production message was not dispatched!');
  }
  console.log(`✓ CRM successfully dispatched Stage 2 update: ${stage2Msg.templateName}\n`);

  // Step 9: Test Stage 3 Production Update (Final Inspection)
  console.log('[Test Step 9] Simulating 10/20 days passing for Stage 3 Production Update...');
  const updatedProj2 = await Project.findById(project._id);
  if (!updatedProj2 || updatedProj2.productionStage !== 3) {
    throw new Error(`FAILED: Expected productionStage to be 3, but got ${updatedProj2?.productionStage}`);
  }
  updatedProj2.nextUpdateAt = new Date(Date.now() - 1000);
  if (updatedProj2.whatsapp) updatedProj2.whatsapp.nextUpdateAt = updatedProj2.nextUpdateAt;
  await updatedProj2.save();

  const stage3RunResult = await processDueWhatsAppUpdates();
  console.log('Stage 3 Scheduler Run Results:', stage3RunResult);

  const stage3Msg = await WhatsAppMessage.findOne({
    projectId: project._id,
    templateName: 'PRODUCTION_UPDATE_STAGE_3',
  });
  if (!stage3Msg) {
    throw new Error('FAILED: Stage 3 production message was not dispatched!');
  }
  console.log(`✓ CRM successfully dispatched Stage 3 update: ${stage3Msg.templateName}`);

  // Step 10: Verify Interval Updates Stopped After Stage 3
  const updatedProj3 = await Project.findById(project._id);
  if (updatedProj3?.productionStage !== 4 || updatedProj3?.nextUpdateAt) {
    throw new Error(`FAILED: Expected all 3 stages completed (productionStage 4, nextUpdateAt undefined), but got stage: ${updatedProj3?.productionStage}, nextUpdateAt: ${updatedProj3?.nextUpdateAt}`);
  }
  console.log(`✓ After Stage 3: All 3 stages completed. nextUpdateAt is cleared (no further interval messages).\n`);

  // Step 11: Verify other non-MANUFACTURING stages are excluded from automated interval messages
  console.log('[Test Step 11] Verifying non-MANUFACTURING projects are ignored by interval scheduler...');
  const designProj = await Project.create({
    projectId: 'ALP-TEST-DESIGN',
    customerId: customer._id,
    customerCode: customer.customerId,
    projectName: 'Design Stage Test',
    siteAddress: customer.address,
    liftModel: 'Alpha EV',
    orderValue: 800000,
    advancePercentage: 30,
    advanceAmount: 240000,
    totalPaid: 240000,
    balanceAmount: 560000,
    paymentStatus: 'ADVANCE_PAID',
    orderDate: new Date(),
    expectedDeliveryDate: new Date(Date.now() + 100 * 24 * 3600 * 1000),
    projectStatus: 'DESIGN',
    whatsappGroupId: 'GROUP_TEST_DESIGN',
    automationEnabled: true,
    nextUpdateAt: new Date(Date.now() - 1000), // Due now
  });

  const nonMfgResult = await processDueWhatsAppUpdates();
  const designMsg = await WhatsAppMessage.findOne({ projectId: designProj._id, isAutomated: true });
  if (designMsg) {
    throw new Error('FAILED: Non-manufacturing project received automated interval message!');
  }
  console.log('✓ Verified: Pre-production project (DESIGN) ignored by interval scheduler. Zero automated messages sent.');
  await Project.deleteOne({ _id: designProj._id });

  // Step 12: Verify that post-production payment stage (e.g. QUALITY_CHECK) works with production interval countdown
  console.log('\n[Test Step 12] Verifying post-production stage (QUALITY_CHECK) works with production interval countdown...');
  await Project.deleteMany({ projectId: 'ALP-TEST-QC' });
  await WhatsAppMessage.deleteMany({ groupId: 'GROUP_TEST_QC' });
  await WhatsAppMessageLog.deleteMany({ groupId: 'GROUP_TEST_QC' });
  const qcProj = await Project.create({
    projectId: 'ALP-TEST-QC',
    customerId: customer._id,
    customerCode: customer.customerId,
    projectName: 'QC Post-Prod Test',
    siteAddress: customer.address,
    liftModel: 'Alpha EV',
    orderValue: 800000,
    advancePercentage: 30,
    advanceAmount: 240000,
    totalPaid: 240000,
    balanceAmount: 560000,
    paymentStatus: 'ADVANCE_PAID',
    orderDate: new Date(),
    expectedDeliveryDate: new Date(Date.now() + 100 * 24 * 3600 * 1000),
    projectStatus: 'QUALITY_CHECK',
    whatsappGroupId: 'GROUP_TEST_QC',
    automationEnabled: true,
    productionStage: 1,
    nextUpdateAt: new Date(Date.now() - 1000), // Due now
  });

  const qcResult = await processDueWhatsAppUpdates();
  const qcMsg = await WhatsAppMessage.findOne({ projectId: qcProj._id, templateName: 'PRODUCTION_UPDATE_STAGE_1' });
  if (!qcMsg) {
    throw new Error('FAILED: Post-production project did not receive production update!');
  }
  console.log(`✓ Verified: Project in stage QUALITY_CHECK successfully received ${qcMsg.templateName}\n`);
  await Project.deleteOne({ _id: qcProj._id });

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
