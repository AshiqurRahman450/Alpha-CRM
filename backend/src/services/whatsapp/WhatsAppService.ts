import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import { config } from '../../config';
import { SystemSettings } from '../../models';

export interface SendTemplateParams {
  recipientType?: 'group' | 'individual';
  to: string; // group_id or customer phone number
  templateName: string;
  languageCode?: string; // e.g. en_US
  components?: Array<{
    type: 'header' | 'body' | 'button';
    parameters?: Array<{
      type: 'text' | 'currency' | 'date_time' | 'image' | 'document';
      text?: string;
      [key: string]: any;
    }>;
  }>;
}

export interface SendTextParams {
  recipientType?: 'group' | 'individual';
  to: string; // group_id or customer phone
  text: string;
}

export interface SendMediaParams {
  recipientType?: 'group' | 'individual';
  to: string;
  mediaType: 'image' | 'document' | 'video';
  mediaUrl: string;
  caption?: string;
  filename?: string;
}

export interface MetaApiResponse {
  success: boolean;
  messageId?: string;
  metaResponse?: any;
  error?: string;
  isTestMode?: boolean;
}

export class WhatsAppService {
  private client: AxiosInstance;
  private apiVersion: string;
  private phoneNumberId: string;
  private accessToken: string;
  private wabaId: string;

  constructor() {
    this.apiVersion = config.meta.apiVersion || 'v20.0';
    this.phoneNumberId = config.meta.phoneNumberId;
    this.accessToken = config.meta.accessToken;
    this.wabaId = config.meta.wabaId;

    this.client = axios.create({
      baseURL: `${config.meta.baseUrl}/${this.apiVersion}`,
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Refreshes active credentials from environment or DB configuration
   */
  public async refreshConfig(): Promise<void> {
    try {
      const settings = await SystemSettings.findOne({ key: 'GLOBAL_CONFIG' });
      if (settings) {
        if (settings.metaApiVersion) this.apiVersion = settings.metaApiVersion;
        if (settings.metaPhoneNumberId) this.phoneNumberId = settings.metaPhoneNumberId;
        if (settings.metaWabaId) this.wabaId = settings.metaWabaId;
      }
    } catch {
      // ignore
    }
  }

  /**
   * Check whether system is in Test Mode or credentials are not yet configured
   */
  public async isTestModeActive(): Promise<boolean> {
    try {
      const settings = await SystemSettings.findOne({ key: 'GLOBAL_CONFIG' });
      if (settings && typeof settings.whatsappTestMode === 'boolean') {
        return settings.whatsappTestMode;
      }
    } catch {
      // ignore
    }
    // If access token or phone number id is missing, automatically consider test mode active
    return !this.accessToken || !this.phoneNumberId;
  }

  /**
   * Validates Meta WhatsApp Business API credentials & health
   */
  public async validateConfiguration(): Promise<{
    configured: boolean;
    valid: boolean;
    details: {
      apiVersion: string;
      phoneNumberIdConfigured: boolean;
      wabaIdConfigured: boolean;
      accessTokenConfigured: boolean;
      testModeActive: boolean;
      metaAccountStatus?: string;
    };
    error?: string;
  }> {
    await this.refreshConfig();
    const testMode = await this.isTestModeActive();

    const details = {
      apiVersion: this.apiVersion,
      phoneNumberIdConfigured: !!this.phoneNumberId,
      wabaIdConfigured: !!this.wabaId,
      accessTokenConfigured: !!this.accessToken,
      testModeActive: testMode,
      metaAccountStatus: testMode ? 'TEST_MODE_ACTIVE' : 'CONNECTED',
    };

    if (!this.accessToken || !this.phoneNumberId) {
      return {
        configured: false,
        valid: false,
        details,
        error: 'META_ACCESS_TOKEN or META_PHONE_NUMBER_ID is not configured.',
      };
    }

    try {
      // Validate by querying phone number node on Graph API
      const res = await axios.get(
        `${config.meta.baseUrl}/${this.apiVersion}/${this.phoneNumberId}`,
        {
          headers: { Authorization: `Bearer ${this.accessToken}` },
          params: { fields: 'verified_name,code_verification_status,display_phone_number,quality_rating' },
        }
      );

      return {
        configured: true,
        valid: true,
        details: {
          ...details,
          metaAccountStatus: res.data.code_verification_status || 'VERIFIED',
        },
      };
    } catch (err: any) {
      return {
        configured: true,
        valid: false,
        details: { ...details, metaAccountStatus: 'API_ERROR' },
        error: err.response?.data?.error?.message || err.message,
      };
    }
  }

  /**
   * Sends a group template message via official Meta WhatsApp Business Platform
   * recipient_type = "group"
   * to = GROUP_ID
   */
  public async sendGroupTemplateMessage(params: SendTemplateParams): Promise<MetaApiResponse> {
    await this.refreshConfig();
    const testMode = await this.isTestModeActive();

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: params.recipientType || 'group',
      to: params.to,
      type: 'template',
      template: {
        name: params.templateName.toLowerCase(),
        language: {
          code: params.languageCode || 'en_US',
        },
        components: params.components || [],
      },
    };

    console.log(`[WhatsAppService] Sending template "${params.templateName}" to ${params.recipientType || 'group'}: ${params.to}`);

    if (testMode) {
      // Generates real Meta-shaped message ID in test mode
      const simulatedMsgId = `wamid.HBgM${Date.now()}${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
      console.log(`[WhatsAppService:TEST_MODE] Simulating Meta dispatch. Generated ID: ${simulatedMsgId}`);
      return {
        success: true,
        messageId: simulatedMsgId,
        isTestMode: true,
        metaResponse: {
          messaging_product: 'whatsapp',
          contacts: [{ input: params.to, wa_id: params.to }],
          messages: [{ id: simulatedMsgId, message_status: 'accepted' }],
        },
      };
    }

    try {
      const response = await this.client.post(`/${this.phoneNumberId}/messages`, payload, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      const messageId = response.data?.messages?.[0]?.id;
      return {
        success: true,
        messageId,
        metaResponse: response.data,
        isTestMode: false,
      };
    } catch (error: any) {
      const metaErr = error.response?.data?.error;
      const errorMsg = metaErr?.message || error.message;
      console.error(`[WhatsAppService] Meta API error:`, metaErr || error.message);
      return {
        success: false,
        error: errorMsg,
        metaResponse: error.response?.data,
        isTestMode: false,
      };
    }
  }

  /**
   * Alias for sendGroupTemplateMessage
   */
  public async sendGroupTemplate(params: SendTemplateParams): Promise<MetaApiResponse> {
    return this.sendGroupTemplateMessage(params);
  }

  /**
   * Sends a group text message
   */
  public async sendGroupTextMessage(params: SendTextParams): Promise<MetaApiResponse> {
    await this.refreshConfig();
    const testMode = await this.isTestModeActive();

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: params.recipientType || 'group',
      to: params.to,
      type: 'text',
      text: {
        preview_url: false,
        body: params.text,
      },
    };

    if (testMode) {
      const simulatedMsgId = `wamid.HBgM${Date.now()}${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
      return {
        success: true,
        messageId: simulatedMsgId,
        isTestMode: true,
        metaResponse: {
          messaging_product: 'whatsapp',
          contacts: [{ input: params.to, wa_id: params.to }],
          messages: [{ id: simulatedMsgId }],
        },
      };
    }

    try {
      const response = await this.client.post(`/${this.phoneNumberId}/messages`, payload, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      return {
        success: true,
        messageId: response.data?.messages?.[0]?.id,
        metaResponse: response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message,
        metaResponse: error.response?.data,
      };
    }
  }

  /**
   * Sends media (e.g. lift drawing, inspection checklist, dispatch photo)
   */
  public async sendMediaMessage(params: SendMediaParams): Promise<MetaApiResponse> {
    await this.refreshConfig();
    const testMode = await this.isTestModeActive();

    const mediaObject: any = {
      link: params.mediaUrl,
    };
    if (params.caption) mediaObject.caption = params.caption;
    if (params.filename && params.mediaType === 'document') mediaObject.filename = params.filename;

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: params.recipientType || 'group',
      to: params.to,
      type: params.mediaType,
      [params.mediaType]: mediaObject,
    };

    if (testMode) {
      const simulatedMsgId = `wamid.HBgM${Date.now()}${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
      return {
        success: true,
        messageId: simulatedMsgId,
        isTestMode: true,
        metaResponse: { messages: [{ id: simulatedMsgId }] },
      };
    }

    try {
      const response = await this.client.post(`/${this.phoneNumberId}/messages`, payload, {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });
      return {
        success: true,
        messageId: response.data?.messages?.[0]?.id,
        metaResponse: response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message,
      };
    }
  }

  /**
   * Query message status directly from Meta Graph API
   */
  public async getMessageStatus(metaMessageId: string): Promise<any> {
    if (!this.accessToken) {
      return { status: 'UNKNOWN', note: 'No access token provided' };
    }
    try {
      const response = await axios.get(
        `${config.meta.baseUrl}/${this.apiVersion}/${metaMessageId}`,
        {
          headers: { Authorization: `Bearer ${this.accessToken}` },
        }
      );
      return response.data;
    } catch (err: any) {
      return { error: err.response?.data?.error?.message || err.message };
    }
  }

  /**
   * Verifies incoming webhook HMAC SHA256 signature against META_APP_SECRET
   */
  public verifyWebhookSignature(payloadRaw: Buffer | string, signatureHeader?: string): boolean {
    if (!config.meta.appSecret || !signatureHeader) {
      // If app secret not set in dev, accept with warning
      return true;
    }
    try {
      const parts = signatureHeader.split('=');
      const sigHash = parts[1];
      const expectedHash = crypto
        .createHmac('sha256', config.meta.appSecret)
        .update(payloadRaw)
        .digest('hex');

      return crypto.timingSafeEqual(Buffer.from(sigHash, 'utf8'), Buffer.from(expectedHash, 'utf8'));
    } catch (err) {
      return false;
    }
  }
}

// Singleton export
export const whatsappService = new WhatsAppService();
