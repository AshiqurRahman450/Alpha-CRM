import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import { config } from '../../config';
import {
  IWhatsAppProvider,
  CreateGroupParams,
  InviteContactsParams,
  SendGroupTextParams,
  SendGroupMediaParams,
  WatiGroupResult,
  WatiInviteResult,
  WatiGroupDetailsResult,
  WatiSendResult,
  WatiMessageStatusResult,
} from './provider';

export function normalizeWhatsAppPhone(phone?: string): string {
  if (!phone) return '';
  let digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  // If 10-digit mobile number (e.g. 7810091290), automatically prefix India country code 91
  if (digits.length === 10 && /^[6-9]/.test(digits)) {
    return `91${digits}`;
  }
  // If 11 digits with leading 0, replace with 91
  if (digits.length === 11 && digits.startsWith('0')) {
    return `91${digits.slice(1)}`;
  }
  return digits;
}

export class WatiWhatsAppService implements IWhatsAppProvider {
  private client: AxiosInstance;
  private originUrl: string;
  private token: string;
  private ownerEmail: string;
  private isDryRun: boolean;

  constructor() {
    // Read credentials exclusively from backend config
    this.token = config.wati.token;
    this.ownerEmail = config.wati.ownerEmail;
    this.isDryRun = config.wati.dryRun;

    // Normalize base URL: strip trailing tenant IDs if present for v3 API
    // e.g. "https://live-mt-server.wati.io/10269884" -> "https://live-mt-server.wati.io"
    this.originUrl = config.wati.baseUrl.replace(/\/+\d*\/?$/, '').replace(/\/+$/, '');

    this.client = axios.create({
      baseURL: this.originUrl,
      timeout: config.wati.timeoutMs || 15000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Safely formats Authorization header
   */
  private getAuthHeaders() {
    const cleanToken = this.token.replace(/^Bearer\s+/i, '').trim();
    return {
      Authorization: `Bearer ${cleanToken}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Safe logger redacting secrets
   */
  private log(message: string, meta?: any) {
    const sanitizedMeta = meta ? JSON.stringify(meta).replace(/Bearer\s+[a-zA-Z0-9_\-\.]+/gi, 'Bearer [REDACTED]') : '';
    console.log(`[WatiService] ${message} ${sanitizedMeta}`);
  }

  /**
   * Safe error logger redacting secrets
   */
  private logError(message: string, error?: any) {
    const errorMsg = error?.response?.data?.message || error?.message || String(error);
    const sanitized = errorMsg.replace(/Bearer\s+[a-zA-Z0-9_\-\.]+/gi, 'Bearer [REDACTED]');
    console.error(`[WatiService:ERROR] ${message}:`, sanitized);
  }

  /**
   * Creates a WhatsApp group using official WATI V3 Groups API
   * POST /api/ext/v3/conversations/groups
   */
  public async createGroup(
    params: CreateGroupParams,
    options?: { dryRun?: boolean }
  ): Promise<WatiGroupResult> {
    const dryRun = options?.dryRun ?? this.isDryRun;

    if (!params.name || !params.contactTargets || params.contactTargets.length === 0) {
      return {
        success: false,
        error: 'Group name and at least one contact target are required.',
      };
    }

    // WATI limit: Maximum 7 contacts per group
    if (params.contactTargets.length > 7) {
      return {
        success: false,
        error: `WATI WhatsApp Groups API allows a maximum of 7 contacts per group (provided: ${params.contactTargets.length}).`,
      };
    }

    if (dryRun) {
      const simulatedGroupId = `wati_sim_grp_${Date.now()}`;
      this.log(`[DRY-RUN] Simulating group creation for: "${params.name}" (ID: ${simulatedGroupId})`);
      return {
        success: true,
        groupId: simulatedGroupId,
        groupName: params.name,
        conversationId: `conv_sim_${Date.now()}`,
        inviteLink: `https://chat.whatsapp.com/simulated_${Date.now()}`,
        contacts: params.contactTargets.map((target, idx) => ({
          id: `contact_sim_${idx}`,
          wa_id: target,
          name: 'Customer Contact',
          join_status: 'pending',
        })),
        isDryRun: true,
      };
    }

    const cleanedContactTargets = (params.contactTargets || []).map((target) =>
      target.replace(/[^\d+]/g, '')
    );

    const payload = {
      name: params.name,
      description: params.description || 'Alpha Elevators Project Updates Group',
      owner_email: params.ownerEmail || this.ownerEmail,
      operator_emails: params.operatorEmails || [this.ownerEmail],
      contact_targets: cleanedContactTargets,
      join_approval_mode: params.joinApprovalMode || 'auto_approve',
    };

    try {
      this.log(`Calling POST /api/ext/v3/conversations/groups for group "${params.name}"`);
      const response = await this.client.post(
        '/api/ext/v3/conversations/groups',
        payload,
        { headers: this.getAuthHeaders() }
      );

      const groupData = response.data?.group || response.data;
      return {
        success: true,
        groupId: groupData.id,
        groupName: groupData.name || params.name,
        conversationId: groupData.conversation_id,
        channelId: groupData.channel_id,
        inviteLink: groupData.invite_link,
        contacts: groupData.contacts || [],
        rawResponse: response.data,
      };
    } catch (err: any) {
      const status = err.response?.status;
      const data = err.response?.data;
      const code = data?.code;
      const msg = data?.message || err.message;

      this.logError(`Group creation failed (Status: ${status}, Code: ${code})`, err);

      // Handle official error 7013: OBA verification required
      if (code === 7013 || (typeof msg === 'string' && msg.includes('Official Business Account'))) {
        return {
          success: false,
          requiresOba: true,
          errorCode: 7013,
          error: 'Official Business Account (OBA / Blue Tick) verification is required by WATI to create WhatsApp Groups via API.',
          rawResponse: data,
        };
      }

      // Handle Meta Graph API Error 131000 / WATI Code 7002: Programmatic group creation restricted by Meta
      const isMetaGroupRestricted =
        code === 7002 ||
        (typeof msg === 'string' &&
          (msg.includes('131000') ||
            msg.includes('failed to create group on Meta') ||
            msg.includes('OAuthException')));

      if (isMetaGroupRestricted) {
        return {
          success: false,
          metaGroupsRestricted: true,
          errorCode: 131000,
          error: 'Meta WhatsApp Cloud API restricts programmatic group creation on this account (Error 131000). Please link an existing WhatsApp Group via invite link or enable Dry-Run mode.',
          rawResponse: data,
        };
      }

      return {
        success: false,
        errorCode: code || status,
        error: msg || 'Failed to create WhatsApp group via WATI API',
        rawResponse: data,
      };
    }
  }

  /**
   * Sends group invitation template to pending contacts
   * POST /api/ext/v3/conversations/groups/{groupId}/invites
   */
  public async inviteContacts(params: InviteContactsParams): Promise<WatiInviteResult> {
    if (!params.groupId) {
      return { success: false, error: 'Group ID is required to dispatch invites.' };
    }

    if (this.isDryRun) {
      return {
        success: true,
        totalPending: 1,
        sent: 1,
        failed: 0,
        results: [{ contact_name: 'Customer', success: true }],
      };
    }

    try {
      this.log(`Dispatching invites for group: ${params.groupId}`);
      const response = await this.client.post(
        `/api/ext/v3/conversations/groups/${encodeURIComponent(params.groupId)}/invites`,
        {},
        { headers: this.getAuthHeaders() }
      );

      return {
        success: true,
        totalPending: response.data?.total_pending,
        sent: response.data?.sent,
        failed: response.data?.failed,
        results: response.data?.results,
        rawResponse: response.data,
      };
    } catch (err: any) {
      this.logError(`Invite dispatch failed for group ${params.groupId}`, err);
      return {
        success: false,
        error: err.response?.data?.message || err.message,
        rawResponse: err.response?.data,
      };
    }
  }

  /**
   * Retrieves active groups or single group details from WATI
   * POST /api/ext/v3/conversations/groups/list
   */
  public async getGroupDetails(groupId: string): Promise<WatiGroupDetailsResult> {
    if (this.isDryRun) {
      return {
        success: true,
        group: { id: groupId, name: 'Simulated Project Group', status: 'ACTIVE' },
      };
    }

    try {
      const response = await this.client.post(
        '/api/ext/v3/conversations/groups/list',
        { limit: 50 },
        { headers: this.getAuthHeaders() }
      );

      const groups = response.data?.groups || [];
      const matched = groups.find((g: any) => g.id === groupId);

      return {
        success: true,
        groups,
        group: matched || null,
        rawResponse: response.data,
      };
    } catch (err: any) {
      const code = err.response?.data?.code;
      if (code === 7013) {
        return {
          success: false,
          requiresOba: true,
          error: 'Official Business Account verification is required to list WhatsApp Groups on WATI.',
          rawResponse: err.response?.data,
        };
      }
      return {
        success: false,
        error: err.response?.data?.message || err.message,
        rawResponse: err.response?.data,
      };
    }
  }

  /**
   * Sends text message via WATI WhatsApp Provider.
   * If customerPhone or group target is provided, dispatches live message via WATI API.
   */
  public async sendGroupText(params: SendGroupTextParams): Promise<WatiSendResult> {
    this.log(`Group text send requested for group ${params.groupId}...`);

    if (this.isDryRun) {
      this.log(`[DRY-RUN] Simulated text send to group ${params.groupId}`);
      return {
        success: true,
        supported: true,
        status: 'SENT',
        messageId: `DRY_RUN_MSG_${Date.now()}`,
        isDryRun: true,
      };
    }

    try {
      // Determine recipient target: customer WhatsApp phone or group identifier
      const cleanPhone = normalizeWhatsAppPhone(params.customerPhone);
      
      // If targetType is GROUP, check if params.groupId is a valid WhatsApp group JID/phone.
      // If it is a synthetic ID (e.g. starts with 'wati_grp_'), fall back to cleanPhone so dispatch succeeds.
      let target = cleanPhone;
      const effectiveGroup = params.target || params.groupId;
      if (params.targetType === 'GROUP') {
        const isSynthetic = !effectiveGroup || effectiveGroup.startsWith('wati_grp_') || !/^\d{8,15}(@g\.us)?$/.test(effectiveGroup);
        target = !isSynthetic && effectiveGroup ? effectiveGroup : cleanPhone;
      } else {
        target = cleanPhone || effectiveGroup || '';
      }

      if (!target) {
        return {
          success: false,
          supported: true,
          status: 'FAILED',
          error: 'No valid recipient phone number or WhatsApp group target provided.',
        };
      }

      this.log(`Attempting live WATI dispatch to target ${target} (type: ${params.targetType || 'DEFAULT'})...`);

      // Try official WATI V3 conversation text messaging endpoint first
      try {
        const v3Res = await this.client.post(
          '/api/ext/v3/conversations/messages/text',
          {
            text: params.text,
            target: target,
          },
          { headers: this.getAuthHeaders() }
        );

        const v3Msg = v3Res.data?.message;
        if (v3Msg?.id || v3Msg?.status === 'sent') {
          const messageId = v3Msg.id || v3Msg.local_message_id || `WATI_V3_${Date.now()}`;
          this.log(`WATI V3 text message dispatched successfully for target ${target}, id: ${messageId}`);
          return {
            success: true,
            supported: true,
            status: 'SENT',
            messageId,
            rawResponse: v3Res.data,
          };
        }
      } catch (v3Err: any) {
        this.log(`V3 text dispatch returned note: ${v3Err.response?.data?.message || v3Err.message}. Trying session/template API...`);
      }

      // Fallback: Try WATI session message endpoint
      let url = `${config.wati.baseUrl}/api/v1/sendSessionMessage/${encodeURIComponent(target)}?messageText=${encodeURIComponent(params.text)}`;

      let response = await this.client.post(
        url,
        {},
        { headers: this.getAuthHeaders() }
      );

      let data = response.data;

      // If contact was not found, auto-add contact to WATI and retry send
      if (data?.result === false && data?.info && typeof data.info === 'string' && data.info.includes('not found') && cleanPhone) {
        this.log(`Contact ${cleanPhone} not found in WATI. Auto-registering contact in WATI...`);
        try {
          await this.client.post(
            `${config.wati.baseUrl}/api/v1/addContact/${encodeURIComponent(cleanPhone)}`,
            {},
            { headers: this.getAuthHeaders() }
          );
          // Retry sending message
          response = await this.client.post(url, {}, { headers: this.getAuthHeaders() });
          data = response.data;
        } catch (addErr) {
          this.logError(`Failed to auto-add contact ${cleanPhone}`, addErr);
        }
      }

      // If Meta/WATI returns 'Invalid Conversation' or 'Ticket has been expired.',
      // the 24-hour customer session window is inactive.
      // Automatically fall back to dispatching via WATI approved Template Message ('new_chat_v1')
      const isSessionExpired =
        data?.result === false &&
        (data?.info === 'Invalid Conversation' ||
          data?.message === 'Ticket has been expired.' ||
          (typeof data?.info === 'string' && data.info.toLowerCase().includes('conversation')) ||
          (typeof data?.message === 'string' && data.message.toLowerCase().includes('expired')));

      if (isSessionExpired) {
        this.log(`24-hour session inactive for ${target} ('${data?.info || data?.message}'). Falling back to approved WATI Template Message...`);
        try {
          const recipientName = params.contactName || (params.targetType === 'DIRECT' ? 'BDM' : 'Customer');
          const tplRes = await this.client.post(
            `${config.wati.baseUrl}/api/v1/sendTemplateMessage?whatsappNumber=${encodeURIComponent(cleanPhone || target)}`,
            {
              template_name: 'new_chat_v1',
              broadcast_name: 'AlphaElevatorsProjectUpdate',
              parameters: [{ name: 'name', value: recipientName }],
            },
            { headers: this.getAuthHeaders() }
          );

          if (tplRes.data?.result === true || tplRes.data?.ok === true) {
            const messageId =
              tplRes.data?.local_message_id || tplRes.data?.messageId || `WATI_TPL_${Date.now()}`;
            this.log(`Template fallback dispatch succeeded for ${target}, messageId: ${messageId}`);
            return {
              success: true,
              supported: true,
              status: 'SENT',
              messageId,
              rawResponse: tplRes.data,
              isTemplateFallback: true,
              fallbackTemplate: 'new_chat_v1',
            };
          } else {
            this.logError('Template fallback dispatch was not acknowledged', tplRes.data);
          }
        } catch (tplErr: any) {
          this.logError(`Template fallback dispatch error for ${target}`, tplErr);
        }
      }

      if (data?.result === 'success' || data?.ok === true || data?.result === true) {
        const messageId = data?.message?.whatsappMessageId || data?.messageId || `WATI_${Date.now()}`;
        this.log(`Live WATI dispatch successful for target ${target}, messageId: ${messageId}`);
        return {
          success: true,
          supported: true,
          status: 'SENT',
          messageId,
          rawResponse: data,
        };
      }

      let errMsg = 'WATI message dispatch was not acknowledged';
      if (isSessionExpired) {
        errMsg = 'WhatsApp 24-Hour Window Closed: Customer has not messaged your WhatsApp number in the past 24 hours. Meta requires an approved Template message.';
      } else if (data?.fullTrialEnd || (typeof data === 'string' && (data.includes('<!doctype html>') || data.includes('switch_plan')))) {
        errMsg = 'WATI account trial or subscription has expired (fullTrialEnd). Please renew your plan in the WATI dashboard.';
      } else if (data?.info || data?.message || data?.error) {
        errMsg = data?.info || data?.message || data?.error;
      }
      this.logError(`WATI dispatch returned notice: ${errMsg}`, data);
      return {
        success: false,
        supported: true,
        status: 'FAILED',
        error: errMsg,
        rawResponse: data,
      };
    } catch (err: any) {
      const errData = err.response?.data;
      const errMsg = errData?.info || errData?.message || err.message;
      this.logError(`WATI text send failed for target ${params.customerPhone || params.groupId}`, err);

      return {
        success: false,
        supported: true,
        status: 'FAILED',
        error: errMsg || 'Failed to dispatch WhatsApp message via WATI',
        rawResponse: errData,
      };
    }
  }

  /**
   * Sends media message to WhatsApp target via WATI
   */
  public async sendGroupMedia(params: SendGroupMediaParams): Promise<WatiSendResult> {
    if (this.isDryRun) {
      this.log(`[DRY-RUN] Simulated media send to group ${params.groupId}`);
      return {
        success: true,
        supported: true,
        status: 'SENT',
        messageId: `DRY_RUN_MEDIA_${Date.now()}`,
        isDryRun: true,
      };
    }

    try {
      const cleanPhone = normalizeWhatsAppPhone(params.customerPhone);
      const target = cleanPhone || params.groupId;

      const url = `${config.wati.baseUrl}/api/v1/sendSessionFile/${encodeURIComponent(target)}`;
      const response = await this.client.post(
        url,
        {
          url: params.mediaUrl,
          caption: params.caption,
        },
        { headers: this.getAuthHeaders() }
      );

      const data = response.data;
      if (data?.result === 'success' || data?.ok === true || data?.result === true) {
        return {
          success: true,
          supported: true,
          status: 'SENT',
          messageId: data?.message?.whatsappMessageId || data?.messageId || `WATI_MEDIA_${Date.now()}`,
          rawResponse: data,
        };
      }

      return {
        success: false,
        supported: true,
        status: 'FAILED',
        error: data?.info || data?.message || 'Failed to dispatch media via WATI',
        rawResponse: data,
      };
    } catch (err: any) {
      return {
        success: false,
        supported: true,
        status: 'FAILED',
        error: err.response?.data?.message || err.message,
        rawResponse: err.response?.data,
      };
    }
  }

  /**
   * Retrieves message status
   */
  public async getMessageStatus(messageId: string): Promise<WatiMessageStatusResult> {
    return {
      success: true,
      status: 'AWAITING_PROVIDER_CAPABILITY',
    };
  }

  /**
   * Validates configuration health
   */
  public async validateConfiguration(): Promise<{
    configured: boolean;
    valid: boolean;
    details: {
      baseUrl: string;
      originUrl: string;
      tokenConfigured: boolean;
      ownerEmailConfigured: boolean;
      dryRun: boolean;
    };
    error?: string;
  }> {
    const details = {
      baseUrl: config.wati.baseUrl,
      originUrl: this.originUrl,
      tokenConfigured: !!this.token,
      ownerEmailConfigured: !!this.ownerEmail,
      dryRun: this.isDryRun,
    };

    if (!this.token) {
      return {
        configured: false,
        valid: false,
        details,
        error: 'WATI_API_TOKEN is not configured in backend environment variables.',
      };
    }

    try {
      // Test connectivity against WATI groups list endpoint
      const res = await this.client.post(
        '/api/ext/v3/conversations/groups/list',
        { limit: 1 },
        { headers: this.getAuthHeaders() }
      );
      return {
        configured: true,
        valid: true,
        details,
      };
    } catch (err: any) {
      const code = err.response?.data?.code;
      const msg = err.response?.data?.message || err.message;
      // Code 7013 means auth is 100% valid, but OBA status is required
      if (code === 7013) {
        return {
          configured: true,
          valid: true,
          details,
          error: 'Authenticated with WATI successfully. Account requires Official Business Account (OBA) verification for WhatsApp Groups activation.',
        };
      }

      if (err.response?.status === 401) {
        return {
          configured: true,
          valid: false,
          details,
          error: 'Invalid or expired WATI API token (HTTP 401 Unauthorized).',
        };
      }

      return {
        configured: true,
        valid: false,
        details,
        error: msg,
      };
    }
  }

  /**
   * Sends an approved template message via WATI (e.g. 'new_chat_v1')
   */
  public async sendTemplateMessage(params: {
    whatsappNumber: string;
    templateName: string;
    broadcastName?: string;
    parameters?: Array<{ name: string; value: string }>;
  }): Promise<WatiSendResult> {
    const cleanPhone = normalizeWhatsAppPhone(params.whatsappNumber);
    if (!cleanPhone) {
      return { success: false, supported: true, error: 'Invalid WhatsApp phone number' };
    }
    if (this.isDryRun) {
      this.log(`[DRY-RUN] Simulated template "${params.templateName}" to ${cleanPhone}`);
      return { success: true, supported: true, status: 'SENT', messageId: `DRY_TPL_${Date.now()}` };
    }

    try {
      const url = `${config.wati.baseUrl}/api/v1/sendTemplateMessage?whatsappNumber=${encodeURIComponent(cleanPhone)}`;
      const payload = {
        template_name: params.templateName,
        broadcast_name: params.broadcastName || 'AlphaElevatorsProjectUpdate',
        parameters: params.parameters || [{ name: 'name', value: 'Customer' }],
      };
      const res = await this.client.post(url, payload, { headers: this.getAuthHeaders() });
      if (res.data?.result === true || res.data?.ok === true) {
        const messageId = res.data?.local_message_id || res.data?.messageId || `WATI_TPL_${Date.now()}`;
        this.log(`WATI template ${params.templateName} dispatched to ${cleanPhone}, id: ${messageId}`);
        return {
          success: true,
          supported: true,
          status: 'SENT',
          messageId,
          rawResponse: res.data,
        };
      }
      return {
        success: false,
        supported: true,
        error: res.data?.info || res.data?.message || 'Failed to dispatch WATI template',
        rawResponse: res.data,
      };
    } catch (err: any) {
      this.logError(`Failed to send WATI template ${params.templateName} to ${cleanPhone}`, err);
      return {
        success: false,
        supported: true,
        error: err.response?.data?.message || err.message,
      };
    }
  }

  /**
   * Verifies incoming webhook
   */
  public verifyWebhook(req: any): boolean {
    const secret = config.wati.webhookSecret;
    if (!secret) return true; // If no secret configured, accept
    const headerSig = req.headers['x-wati-signature'] || req.headers['x-hub-signature-256'];
    if (!headerSig) return true;
    try {
      const hmac = crypto.createHmac('sha256', secret);
      const digest = 'sha256=' + hmac.update(JSON.stringify(req.body)).digest('hex');
      return crypto.timingSafeEqual(Buffer.from(headerSig), Buffer.from(digest));
    } catch {
      return false;
    }
  }
}

// Singleton export
export const watiService = new WatiWhatsAppService();
