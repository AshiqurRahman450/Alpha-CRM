import { Customer, Project, User, Reminder, WhatsAppMessage, WhatsAppChannel } from '../../models';
import { logProjectActivity } from '../activity/activityService';

export interface CustomerWhatsAppMessageInput {
  senderPhone: string;
  senderName?: string;
  messageText?: string;
  messageContent?: string;
  groupId?: string;
  groupSubject?: string;
  metaMessageId?: string;
  messageId?: string;
  source?: string;
}

/**
 * Escapes regex special characters in a string
 */
function escapeRegex(text: string): string {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

/**
 * Whenever an incoming WhatsApp message is received from a customer or inside a project WhatsApp group,
 * this function:
 * 1. Resolves the customer and project.
 * 2. Creates a real-time Reminder for the CRM role.
 * 3. Logs the message in WhatsAppMessage and ProjectActivity.
 */
export async function notifyCrmOfCustomerWhatsAppMessage(
  input: CustomerWhatsAppMessageInput
): Promise<any> {
  const { senderPhone, senderName, groupId, groupSubject } = input;
  const messageText = input.messageText || input.messageContent || '';
  const metaMessageId = input.metaMessageId || input.messageId;

  if (!messageText || messageText.trim() === '') {
    return null;
  }

  const cleanPhone = (senderPhone || '').replace(/\D/g, '');
  const last10 = cleanPhone.slice(-10);

  // Only proceed if this is from a connected/linked project group and from a customer
  if (!groupId) {
    return null;
  }

  // 1. Locate linked Project for this WhatsApp group
  let project: any = await Project.findOne({
    $or: [
      { whatsappGroupId: groupId },
      { 'whatsapp.groupId': groupId },
    ],
  }).populate('customerId');

  if (!project) {
    // Check WhatsAppChannel mapping
    const channel = await WhatsAppChannel.findOne({ whatsappGroupId: groupId });
    if (channel && channel.projectId) {
      project = await Project.findById(channel.projectId).populate('customerId');
    }
  }

  // Only show message reminders for CONNECTED project groups
  if (!project) {
    return null;
  }

  // 2. Locate Customer by phone number (matches last 10 digits to handle country codes)
  let customer: any = null;
  if (last10.length >= 10) {
    customer = await Customer.findOne({
      $or: [
        { phoneNumber: { $regex: last10 } },
        { whatsappNumber: { $regex: last10 } },
      ],
    });
  }

  // If project has customerId and customer wasn't resolved by phone, check project's customer
  if (project.customerId) {
    const projectCustomer = project.customerId.fullName ? project.customerId : await Customer.findById(project.customerId);
    if (!customer) {
      customer = projectCustomer;
    }
  }

  // Must be verified as a customer or belonging to this connected project
  if (!customer) {
    return null;
  }

  const resolvedCustomerName =
    customer?.fullName ||
    senderName ||
    (project ? `${project.projectName} Client` : `Customer (+${cleanPhone})`);

  const resolvedGroupName =
    groupSubject ||
    (project ? `${project.projectName} Group` : (groupId ? 'WhatsApp Group' : 'Direct Chat'));

  // 3. Find active CRM or Admin user to assign reminder to
  const crmUser =
    (await User.findOne({ role: 'CRM', isActive: true })) ||
    (await User.findOne({ role: 'ADMIN', isActive: true })) ||
    (await User.findOne({ isActive: true }));

  if (!crmUser) {
    console.warn('[WhatsAppReminder] No active CRM/ADMIN user found to assign reminder.');
    return null;
  }

  const messageId = metaMessageId || `WA_IN_${Date.now()}`;

  // 4. Idempotency check: avoid duplicate reminders for the exact same message
  const recentCutoff = new Date(Date.now() - 45 * 1000);
  const existingReminder = await Reminder.findOne({
    $or: [
      { whatsappMessageId: messageId },
      {
        type: 'WHATSAPP_MESSAGE',
        whatsappSenderPhone: cleanPhone,
        notes: { $regex: escapeRegex(messageText.slice(0, 40)) },
        createdAt: { $gte: recentCutoff },
      },
    ],
  });

  if (existingReminder) {
    return existingReminder;
  }

  // 5. Construct reminder title and notes
  const projectSnippet = project ? ` [${project.projectName} (${project.projectId})]` : '';
  const title = `💬 WhatsApp: ${resolvedCustomerName}${projectSnippet}`;
  const notes = `"${messageText}"\n\n• From: ${resolvedCustomerName} (+${cleanPhone})\n• Group: ${resolvedGroupName}${project ? `\n• Project: ${project.projectName} (${project.projectId})` : ''}`;

  const reminder = await Reminder.create({
    userId: crmUser._id,
    title,
    notes,
    dueAt: new Date(), // Due now so it immediately triggers popup toasts for CRM
    status: 'PENDING',
    type: 'WHATSAPP_MESSAGE',
    relatedProjectId: project?._id,
    relatedCustomerId: customer?._id,
    customerName: resolvedCustomerName,
    actionRequired: true,
    whatsappSenderPhone: cleanPhone,
    whatsappGroupId: groupId,
    whatsappGroupName: resolvedGroupName,
    whatsappMessageId: messageId,
  });

  console.log(`[WhatsAppReminder] Created reminder for CRM: "${title}" (ID: ${reminder._id})`);

  // 6. Record to WhatsAppMessage and ProjectActivity if project exists
  if (project) {
    try {
      await WhatsAppMessage.create({
        projectId: project._id,
        projectCode: project.projectId,
        customerId: customer?._id || project.customerId,
        customerName: resolvedCustomerName,
        groupId: groupId || project.whatsappGroupId || 'DIRECT',
        metaMessageId: messageId,
        messageType: 'text',
        recipientType: groupId ? 'group' : 'individual',
        direction: 'INCOMING',
        senderName: resolvedCustomerName,
        senderPhone: cleanPhone,
        messageContent: messageText,
        status: 'READ',
        isAutomated: false,
        readAt: new Date(),
      });

      await logProjectActivity({
        projectId: project._id,
        projectCode: project.projectId,
        type: 'WHATSAPP_RECEIVED',
        description: `Customer WhatsApp message from ${resolvedCustomerName}: "${messageText}"`,
        metadata: {
          metaMessageId: messageId,
          senderPhone: cleanPhone,
          senderName: resolvedCustomerName,
          groupName: resolvedGroupName,
        },
      });
    } catch (e: any) {
      console.warn('[WhatsAppReminder] Notice logging message/activity:', e.message);
    }
  }

  return reminder;
}
