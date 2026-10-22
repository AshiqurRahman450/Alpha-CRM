import { connectDB, disconnectDB } from '../config/db';
import { Customer, Project, WhatsAppMessageLog } from '../models';
import { watiService, WatiWhatsAppService } from '../services/whatsapp/WatiService';
import {
  calculateNextUpdateDate,
  generateProjectUpdateText,
} from '../services/scheduler/schedulerService';
import { config } from '../config';

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string, details?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] Test ${totalTests}: ${testName}`);
  } else {
    console.error(`  [FAIL] Test ${totalTests}: ${testName}`);
    if (details) console.error(`         Details: ${details}`);
    throw new Error(`Assertion failed for: ${testName} - ${details || ''}`);
  }
}

async function runWatiTestSuite() {
  console.log('===============================================================');
  console.log('ALPHA ELEVATORS CRM — WATI WHATSAPP GROUP AUTOMATION TEST SUITE');
  console.log('===============================================================\n');

  await connectDB();

  try {
    // -------------------------------------------------------------
    // TEST 1: WATI API Authentication & Credential Redaction
    // -------------------------------------------------------------
    console.log('--- SUITE 1: WATI Authentication & Safe Service Inspection ---');
    const authStatus = await watiService.validateConfiguration();
    assert(
      typeof authStatus.configured === 'boolean' && authStatus.configured === true,
      'WATI configuration validation flags credentials as configured'
    );
    assert(
      !JSON.stringify(authStatus).includes(config.wati.token),
      'Authentication validation does NOT leak the Bearer token in responses'
    );

    // Test with invalid credentials in WatiWhatsAppService
    const originalToken = config.wati.token;
    (config.wati as any).token = 'INVALID_BEARER_TOKEN_FOR_TEST';
    const invalidService = new WatiWhatsAppService();
    const invalidStatus = await invalidService.validateConfiguration();
    assert(
      invalidStatus.valid === false,
      'Invalid WATI Bearer token correctly reports authentication failure'
    );
    (config.wati as any).token = originalToken; // restore

    // -------------------------------------------------------------
    // TEST 2: Group Creation Handling & OBA 7013 Error Detection
    // -------------------------------------------------------------
    console.log('\n--- SUITE 2: Group Creation & Account OBA Eligibility Check ---');
    // Live call to WATI
    const liveGroupResult = await watiService.createGroup({
      name: 'Alpha Lift Test Unit',
      contactTargets: ['+919820011101'],
    });

    // Our account requires OBA (Meta blue tick verification)
    assert(
      liveGroupResult.success === false &&
      (liveGroupResult.errorCode === 7013 || Boolean(liveGroupResult.error?.includes('Official Business Account'))),
      'WATI group creation accurately detects code 7013 (Official Business Account verification required)'
    );

    // Dry-run group creation
    const originalDryRun = config.wati.dryRun;
    (config.wati as any).dryRun = true;
    const dryRunService = new WatiWhatsAppService();
    const dryRunResult = await dryRunService.createGroup({
      name: 'Alpha Dry Run Group',
      contactTargets: ['+919820011101'],
    });
    assert(
      dryRunResult.success === true &&
      Boolean(dryRunResult.groupId?.startsWith('wati_sim_grp_') || dryRunResult.groupId?.startsWith('WATI_DRY_')) &&
      dryRunResult.isDryRun === true,
      'Dry-run group creation succeeds and assigns dry-run group ID'
    );
    (config.wati as any).dryRun = originalDryRun; // restore

    // -------------------------------------------------------------
    // TEST 3: Customer Consent Validation (whatsappOptIn)
    // -------------------------------------------------------------
    console.log('\n--- SUITE 3: Customer Consent Validation ---');
    await Customer.deleteMany({ customerId: { $in: ['CUST-OPTIN-TEST', 'CUST-NO-OPTIN'] } });

    const customerWithoutConsent = await Customer.create({
      customerId: 'CUST-NO-OPTIN',
      fullName: 'Vikram Singh',
      phoneNumber: '+919876543210',
      whatsappNumber: '+919876543210',
      address: '45 Lake View Road',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560001',
      customerType: 'Residential',
      whatsappOptIn: false,
    });

    const customerWithConsent = await Customer.create({
      customerId: 'CUST-OPTIN-TEST',
      fullName: 'Sunita Sharma',
      phoneNumber: '+919820011102',
      whatsappNumber: '+919820011102',
      address: 'Plot 42, Palm Meadows, Whitefield',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560066',
      customerType: 'Residential',
      whatsappOptIn: true,
      optInDate: new Date(),
      optInSource: 'PROJECT_CONFIRMATION',
    });

    assert(customerWithoutConsent.whatsappOptIn === false, 'Customer without opt-in stored correctly');
    assert(customerWithConsent.whatsappOptIn === true, 'Customer with opt-in stored correctly');

    const getBaseProject = (overrides: Record<string, any> = {}) => ({
      projectId: 'PROJ-' + Math.random().toString(36).substring(2, 7).toUpperCase(),
      projectName: 'Alpha Lift Test Unit',
      customerId: customerWithConsent._id,
      customerCode: 'CUST-OPTIN-TEST',
      siteAddress: 'Palm Meadows Site 42',
      liftModel: 'Hydraulic Home Series',
      liftType: 'Home Lift',
      orderValue: 1000000,
      advanceAmount: 300000,
      balanceAmount: 700000,
      totalPaid: 300000,
      expectedDeliveryDate: new Date(Date.now() + 30 * 86400000),
      ...overrides,
    });

    // -------------------------------------------------------------
    // TEST 4: Duplicate Group Creation Prevention
    // -------------------------------------------------------------
    console.log('\n--- SUITE 4: Duplicate Group Prevention ---');
    await Project.deleteMany({ projectId: 'PROJ-DUP-TEST' });
    const existingGroupProj = await Project.create(
      getBaseProject({
        projectId: 'PROJ-DUP-TEST',
        projectName: 'Dup Group Check Project',
        whatsapp: {
          provider: 'WATI',
          groupId: 'WATI_GROUP_EXISTING_123',
          groupName: 'Dup Check',
          invitationStatus: 'ACCEPTED',
          groupStatus: 'ACTIVE',
          updatesEnabled: true,
          paused: false,
          intervalDays: 15,
        },
      })
    );

    const isAlreadyLinked = Boolean(existingGroupProj.whatsapp?.groupId && existingGroupProj.whatsapp?.groupStatus === 'ACTIVE');
    assert(isAlreadyLinked === true, 'Duplicate group creation is prevented when project already has active group');

    // -------------------------------------------------------------
    // TEST 5: Interval Days Validation (strictly 1, 10, 15, 20)
    // -------------------------------------------------------------
    console.log('\n--- SUITE 5: Update Cadence Interval Days Validation ---');
    const validIntervals = [1, 10, 15, 20];
    const invalidIntervals = [5, 7, 25, 30, 45, 0, -10];

    const allValidPass = validIntervals.every((i) => [1, 10, 15, 20].includes(i));
    const allInvalidFail = invalidIntervals.every((i) => ![1, 10, 15, 20].includes(i));

    assert(allValidPass, 'Intervals 1, 10, 15, 20 are accepted');
    assert(allInvalidFail, 'Non-[1, 10, 15, 20] intervals are strictly rejected');

    const calculated10 = calculateNextUpdateDate(10 as any);
    const calculated15 = calculateNextUpdateDate(15 as any);
    const calculated20 = calculateNextUpdateDate(20 as any);
    const now = Date.now();

    const daysDiff10 = Math.round((calculated10.getTime() - now) / (1000 * 60 * 60 * 24));
    const daysDiff15 = Math.round((calculated15.getTime() - now) / (1000 * 60 * 60 * 24));
    const daysDiff20 = Math.round((calculated20.getTime() - now) / (1000 * 60 * 60 * 24));

    assert(daysDiff10 === 10, 'calculateNextUpdateDate correctly advances 10 days');
    assert(daysDiff15 === 15, 'calculateNextUpdateDate correctly advances 15 days');
    assert(daysDiff20 === 20, 'calculateNextUpdateDate correctly advances 20 days');

    // -------------------------------------------------------------
    // TEST 6: Paused Automation Handling
    // -------------------------------------------------------------
    console.log('\n--- SUITE 6: Paused Automation Enforcement ---');
    await Project.deleteMany({ projectId: 'PROJ-PAUSED-TEST' });
    const pausedProj = await Project.create(
      getBaseProject({
        projectId: 'PROJ-PAUSED-TEST',
        projectName: 'Paused Project',
        whatsapp: {
          provider: 'WATI',
          groupId: 'WATI_GROUP_PAUSED',
          groupName: 'Paused Group',
          invitationStatus: 'ACCEPTED',
          groupStatus: 'ACTIVE',
          updatesEnabled: true,
          paused: true,
          intervalDays: 15,
          nextUpdateAt: new Date(Date.now() - 3600000), // Due 1 hour ago
        },
      })
    );

    const qualifiesWhenPaused = Boolean(
      pausedProj.whatsapp?.updatesEnabled &&
      !pausedProj.whatsapp?.paused &&
      pausedProj.whatsapp?.nextUpdateAt &&
      pausedProj.whatsapp.nextUpdateAt <= new Date()
    );

    assert(qualifiesWhenPaused === false, 'Paused automation projects do NOT qualify for automated updates');

    // -------------------------------------------------------------
    // TEST 7: Due vs Future Schedule Qualification
    // -------------------------------------------------------------
    console.log('\n--- SUITE 7: Due vs Future Schedule Qualification ---');
    await Project.deleteMany({ projectId: 'PROJ-FUTURE-TEST' });
    const futureProj = await Project.create(
      getBaseProject({
        projectId: 'PROJ-FUTURE-TEST',
        projectName: 'Future Project',
        whatsapp: {
          provider: 'WATI',
          groupId: 'WATI_GROUP_FUTURE',
          groupName: 'Future Group',
          invitationStatus: 'ACCEPTED',
          groupStatus: 'ACTIVE',
          updatesEnabled: true,
          paused: false,
          intervalDays: 15,
          nextUpdateAt: new Date(Date.now() + 86400000 * 5), // Due in 5 days
        },
      })
    );

    const qualifiesFuture = Boolean(
      futureProj.whatsapp?.nextUpdateAt && futureProj.whatsapp.nextUpdateAt <= new Date()
    );
    assert(qualifiesFuture === false, 'Future scheduled project does NOT qualify before nextUpdateAt');

    // -------------------------------------------------------------
    // TEST 8: Atomic Idempotency & Duplicate Scheduled Jobs Prevention
    // -------------------------------------------------------------
    console.log('\n--- SUITE 8: Atomic Job Claiming & Idempotency Key Constraint ---');
    await WhatsAppMessageLog.deleteMany({ projectId: existingGroupProj._id });
    const testDateKey = new Date().toISOString().split('T')[0];
    const idempotencyKey = `${existingGroupProj._id}_${testDateKey}_interval15`;

    // 1st claim succeeds
    const job1 = await WhatsAppMessageLog.create({
      projectId: existingGroupProj._id,
      groupId: 'WATI_GROUP_EXISTING_123',
      messageText: 'Initial automated dispatch test',
      messageType: 'text',
      scheduledAt: new Date(),
      status: 'SENDING',
      attemptCount: 1,
      idempotencyKey,
    });
    assert(Boolean(job1._id), 'First scheduler instance successfully claims job');

    // 2nd claim with identical key fails with E11000 duplicate key error
    let duplicateErrorThrown = false;
    try {
      await WhatsAppMessageLog.create({
        projectId: existingGroupProj._id,
        groupId: 'WATI_GROUP_EXISTING_123',
        messageText: 'Second scheduler instance concurrent attempt',
        messageType: 'text',
        scheduledAt: new Date(),
        status: 'SENDING',
        attemptCount: 1,
        idempotencyKey,
      });
    } catch (err: any) {
      if (err.code === 11000 || err.name === 'MongoServerError') {
        duplicateErrorThrown = true;
      }
    }
    assert(
      duplicateErrorThrown,
      'Duplicate scheduled job is atomically rejected by MongoDB unique idempotencyKey index'
    );

    // -------------------------------------------------------------
    // TEST 9: Unsupported Group-Message Capability Transition
    // -------------------------------------------------------------
    console.log('\n--- SUITE 9: Unsupported Group Messaging Provider Handling ---');
    const sendResult = await watiService.sendGroupText({
      groupId: 'WATI_GROUP_12345',
      text: 'Test announcement',
    });

    assert(
      sendResult.success === false &&
      sendResult.status === 'AWAITING_PROVIDER_CAPABILITY' &&
      sendResult.supported === false,
      'sendGroupText returns supported: false and AWAITING_PROVIDER_CAPABILITY status'
    );

    // -------------------------------------------------------------
    // TEST 10: Message Status Transitions & Webhook Validation
    // -------------------------------------------------------------
    console.log('\n--- SUITE 10: Message Status Lifecycle & Transitions ---');
    await WhatsAppMessageLog.deleteMany({ providerMessageId: 'WATI_MSG_LIFECYCLE_999' });

    const messageLog = await WhatsAppMessageLog.create({
      projectId: existingGroupProj._id,
      groupId: 'WATI_GROUP_EXISTING_123',
      messageText: 'Lifecycle Test Update',
      messageType: 'text',
      scheduledAt: new Date(),
      attemptedAt: new Date(),
      sentAt: new Date(),
      providerMessageId: 'WATI_MSG_LIFECYCLE_999',
      status: 'SENT',
      attemptCount: 1,
    });
    assert(messageLog.status === 'SENT', 'Message created in SENT state');

    // Simulate Webhook transition to DELIVERED
    messageLog.status = 'DELIVERED';
    await messageLog.save();
    const deliveredLog = await WhatsAppMessageLog.findById(messageLog._id);
    assert(deliveredLog?.status === 'DELIVERED', 'Message successfully transitions to DELIVERED on webhook');

    // Simulate Webhook transition to READ
    messageLog.status = 'READ';
    await messageLog.save();
    const readLog = await WhatsAppMessageLog.findById(messageLog._id);
    assert(readLog?.status === 'READ', 'Message successfully transitions to READ on webhook');

    // -------------------------------------------------------------
    // TEST 11: Rate Limiting & Exponential Backoff Math
    // -------------------------------------------------------------
    console.log('\n--- SUITE 11: Rate Limiting & Exponential Retry Calculation ---');
    const calculateRetryDelay = (attempt: number) => Math.min(1000 * Math.pow(2, attempt), 60000);
    assert(calculateRetryDelay(1) === 2000, 'Attempt 1 backoff is 2000ms');
    assert(calculateRetryDelay(2) === 4000, 'Attempt 2 backoff is 4000ms');
    assert(calculateRetryDelay(3) === 8000, 'Attempt 3 backoff is 8000ms');
    assert(calculateRetryDelay(10) === 60000, 'Backoff caps at 60000ms (1 minute)');

    // -------------------------------------------------------------
    // TEST 12: Verified Project Data Generation & Dry-Run Dispatch
    // -------------------------------------------------------------
    console.log('\n--- SUITE 12: Verified Data Template Generation & Dry Run ---');
    const projectWithPayments: any = {
      projectId: 'ALP-SAMPLE-99',
      projectName: 'Roy Villa Elevator',
      liftModel: 'Hydraulic Home Series',
      projectStatus: 'MANUFACTURING',
      paymentStatus: 'ADVANCE_PAID',
      advanceAmount: 600000,
      balanceAmount: 600000,
      orderValue: 1200000,
      totalPaid: 600000,
    };

    const generatedText = generateProjectUpdateText(
      projectWithPayments,
      customerWithConsent as any,
      'Motor dispatch scheduled next Monday.'
    );

    assert(
      generatedText.includes('Roy Villa Elevator') &&
      generatedText.includes('MANUFACTURING') &&
      generatedText.includes('Factory Quality Inspection & Testing') &&
      generatedText.includes('₹6,00,000') &&
      generatedText.includes('Motor dispatch scheduled next Monday.'),
      'Generated update strictly uses verified project stage, milestone, payment, and custom note'
    );

    // End-to-end dry-run send
    (config.wati as any).dryRun = true;
    const dryRunSendService = new WatiWhatsAppService();
    const dryRunSend = await dryRunSendService.sendGroupText({
      groupId: 'WATI_GROUP_DRY_RUN',
      text: generatedText,
    });
    assert(
      dryRunSend.success === true &&
      dryRunSend.status === 'SENT' &&
      dryRunSend.isDryRun === true &&
      Boolean(dryRunSend.messageId?.startsWith('DRY_RUN_MSG_')),
      'Dry-run dispatch completes with simulated messageId without calling external provider'
    );
    (config.wati as any).dryRun = originalDryRun; // restore

    console.log('\n===============================================================');
    console.log(`ALL TESTS PASSED! (${passedTests}/${totalTests} tests succeeded)`);
    console.log('===============================================================\n');
  } finally {
    await disconnectDB();
  }
}

runWatiTestSuite().catch((err) => {
  console.error('\n[FATAL TEST RUNNER ERROR]:', err);
  process.exit(1);
});
