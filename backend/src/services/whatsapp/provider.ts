export interface CreateGroupParams {
  name: string;
  description?: string;
  ownerEmail?: string;
  operatorEmails?: string[];
  contactTargets: string[]; // E.164 phone numbers or contact IDs, max 7
  joinApprovalMode?: 'auto_approve' | 'manual_approve';
}

export interface InviteContactsParams {
  groupId: string;
}

export interface RemoveParticipantsParams {
  groupId: string;
  operatorEmails?: string[];
  contactTargets?: string[];
}

export interface SendGroupTextParams {
  groupId: string;
  conversationId?: string;
  customerPhone?: string;
  contactName?: string;
  text: string;
  targetType?: 'GROUP' | 'DIRECT';
}

export interface SendGroupMediaParams {
  groupId: string;
  conversationId?: string;
  customerPhone?: string;
  mediaType: 'image' | 'video' | 'document';
  mediaUrl: string;
  caption?: string;
  filename?: string;
}

export interface WatiGroupContact {
  id?: string;
  contact_id?: string;
  wa_id?: string;
  name?: string;
  join_status?: string;
}

export interface WatiGroupResult {
  success: boolean;
  groupId?: string;
  groupName?: string;
  conversationId?: string;
  channelId?: string;
  inviteLink?: string;
  contacts?: WatiGroupContact[];
  rawResponse?: any;
  error?: string;
  errorCode?: number | string;
  requiresOba?: boolean;
  metaGroupsRestricted?: boolean;
  isDryRun?: boolean;
}

export interface WatiInviteResult {
  success: boolean;
  totalPending?: number;
  sent?: number;
  failed?: number;
  results?: Array<{
    contact_name?: string;
    phone?: string;
    success?: boolean;
    error?: string;
  }>;
  rawResponse?: any;
  error?: string;
}

export interface WatiGroupDetailsResult {
  success: boolean;
  groups?: any[];
  group?: any;
  rawResponse?: any;
  error?: string;
  requiresOba?: boolean;
}

export interface WatiSendResult {
  success: boolean;
  supported: boolean;
  messageId?: string;
  status?: string; // 'AWAITING_PROVIDER_CAPABILITY' | 'SENT' | 'FAILED'
  error?: string;
  errorCode?: string | number;
  rawResponse?: any;
  isDryRun?: boolean;
  isTemplateFallback?: boolean;
  fallbackTemplate?: string;
}

export interface WatiMessageStatusResult {
  success: boolean;
  status?: string;
  error?: string;
  rawResponse?: any;
}

/**
 * Standard WhatsApp Provider Interface
 */
export interface IWhatsAppProvider {
  createGroup(params: CreateGroupParams): Promise<WatiGroupResult>;
  inviteContacts(params: InviteContactsParams): Promise<WatiInviteResult>;
  getGroupDetails(groupId: string): Promise<WatiGroupDetailsResult>;
  sendGroupText(params: SendGroupTextParams): Promise<WatiSendResult>;
  sendGroupMedia(params: SendGroupMediaParams): Promise<WatiSendResult>;
  getMessageStatus(messageId: string): Promise<WatiMessageStatusResult>;
}
