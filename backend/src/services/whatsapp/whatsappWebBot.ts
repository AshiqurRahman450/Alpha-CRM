import type { WASocket } from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';
import { normalizeWhatsAppPhone } from './WatiService';
import { notifyCrmOfCustomerWhatsAppMessage } from './whatsappReminderService';

export type BotConnectionStatus = 'DISCONNECTED' | 'SCAN_QR' | 'CONNECTING' | 'CONNECTED';

class WhatsAppWebBotService {
  private sock: any = null;
  private authDir: string;
  private status: BotConnectionStatus = 'DISCONNECTED';
  private qrCodeDataUrl: string | null = null;
  private botPhoneNumber: string | null = null;
  private groupJidCache: Map<string, string> = new Map(); // inviteCode -> groupJid
  private isInitializing: boolean = false;
  private messageCache: Map<string, any> = new Map(); // messageId -> proto.IMessage
  private outgoingBotMessageIds: Set<string> = new Set();
  private cacheFilePath: string;
  private saveTimer: NodeJS.Timeout | null = null;
  private lastDisconnectInfo: any = null;
  private recentEvents: Array<{ time: string; type: string; details: any }> = [];

  constructor() {
    const candidates = [
      process.env.WHATSAPP_AUTH_DIR,
      path.resolve(__dirname, '../../../data/baileys_auth'),
      path.resolve(process.cwd(), 'data/baileys_auth'),
      path.resolve(process.cwd(), 'backend/data/baileys_auth'),
    ].filter(Boolean) as string[];

    let chosenDir = candidates[1] || candidates[0];
    for (const cand of candidates) {
      if (fs.existsSync(path.join(cand, 'creds.json'))) {
        chosenDir = cand;
        console.log(`[WhatsAppWebBot] Found existing creds.json in: ${chosenDir}`);
        break;
      }
    }
    this.authDir = chosenDir;
    if (!fs.existsSync(this.authDir)) {
      try {
        fs.mkdirSync(this.authDir, { recursive: true });
      } catch (err: any) {
        console.warn('[WhatsAppWebBot] Notice creating auth directory:', err.message);
      }
    }
    this.cacheFilePath = path.resolve(this.authDir, 'message_cache.json');
    this.loadMessageCache();
  }

  private loadMessageCache(): void {
    try {
      if (fs.existsSync(this.cacheFilePath)) {
        const raw = fs.readFileSync(this.cacheFilePath, 'utf-8');
        const entries = JSON.parse(raw);
        if (Array.isArray(entries)) {
          this.messageCache = new Map(entries);
          console.log(`[WhatsAppWebBot] Loaded ${this.messageCache.size} messages from disk into retry cache.`);
        }
      }
    } catch (err: any) {
      console.warn('[WhatsAppWebBot] Notice loading message cache:', err.message);
    }
  }

  private cacheMessage(id: string, rawMessage: any): void {
    if (!id || !rawMessage) return;
    try {
      const msg = rawMessage.message || rawMessage;
      this.messageCache.set(id, msg);
      if (this.messageCache.size > 1000) {
        const oldestKey = this.messageCache.keys().next().value;
        if (oldestKey) this.messageCache.delete(oldestKey);
      }
      this.scheduleSaveCache();
    } catch (err: any) {
      console.warn('[WhatsAppWebBot] Cache message notice:', err.message);
    }
  }

  private scheduleSaveCache(): void {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      try {
        const entries = Array.from(this.messageCache.entries()).slice(-500);
        fs.writeFileSync(this.cacheFilePath, JSON.stringify(entries), 'utf-8');
      } catch (err: any) {
        console.warn('[WhatsAppWebBot] Notice persisting message cache:', err.message);
      }
    }, 2000);
  }

  private async getMessageFromCache(id: string): Promise<any> {
    if (!id) return undefined;
    const found = this.messageCache.get(id);
    if (found) {
      return found;
    }
    return undefined;
  }

  public logEvent(type: string, details: any) {
    this.recentEvents.unshift({
      time: new Date().toISOString(),
      type,
      details,
    });
    if (this.recentEvents.length > 50) this.recentEvents.pop();
  }

  public getDiagnostic() {
    const credsPath = path.join(this.authDir, 'creds.json');
    const hasCreds = fs.existsSync(credsPath);
    let filesCount = 0;
    try {
      if (fs.existsSync(this.authDir)) {
        filesCount = fs.readdirSync(this.authDir).length;
      }
    } catch {}

    return {
      status: this.status,
      isConnected: this.status === 'CONNECTED',
      botPhoneNumber: this.botPhoneNumber,
      authDir: this.authDir,
      credsExists: hasCreds,
      totalAuthFiles: filesCount,
      lastDisconnect: this.lastDisconnectInfo,
      recentEvents: this.recentEvents.slice(0, 15),
      activeSocket: !!this.sock,
    };
  }

  public getStatus() {
    return {
      status: this.status,
      isConnected: this.status === 'CONNECTED',
      qrCode: this.qrCodeDataUrl,
      botPhoneNumber: this.botPhoneNumber,
    };
  }

  public async initialize(): Promise<void> {
    if (this.isInitializing || this.status === 'CONNECTED') {
      return;
    }
    this.isInitializing = true;
    this.status = 'CONNECTING';

    try {
      // Dynamically load Baileys so any environment-specific Baileys issue doesn't crash the entire backend
      const baileys = await import('@whiskeysockets/baileys');
      const makeWASocket = (baileys as any).default || baileys;
      const {
        useMultiFileAuthState,
        fetchLatestBaileysVersion,
        DisconnectReason,
        makeCacheableSignalKeyStore,
        jidNormalizedUser,
      } = baileys as any;

      const pino = (await import('pino')).default || (await import('pino'));
      const logger = pino({ level: 'warn' });

      if (this.sock) {
        try {
          this.sock.ev.removeAllListeners('connection.update');
          this.sock.ev.removeAllListeners('creds.update');
          this.sock.ev.removeAllListeners('messages.upsert');
          this.sock.end(new Error('Resetting socket'));
        } catch {}
        this.sock = null;
      }

      console.log(`[WhatsAppWebBot] Initializing bot socket... AuthDir: ${this.authDir}`);
      const { state, saveCreds } = await useMultiFileAuthState(this.authDir);
      
      let version = [2, 3000, 1015901307];
      try {
        const v = await fetchLatestBaileysVersion();
        if (v?.version) version = v.version;
      } catch (verErr: any) {
        console.warn('[WhatsAppWebBot] Could not fetch latest Baileys version online (using safe fallback):', verErr.message);
      }

      this.sock = makeWASocket({
        version,
        logger,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        printQRInTerminal: true, // Output QR in VPS terminal / pm2 logs
        browser: (baileys as any).Browsers?.ubuntu ? (baileys as any).Browsers.ubuntu('Chrome') : ['Ubuntu', 'Chrome', '22.04.4'],
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 120000,
        keepAliveIntervalMs: 25000, // Send keep-alive pings to keep VPS WebSocket connection active
        markOnlineOnConnect: true,
        syncFullHistory: false,
        fireInitQueries: false, // Critical: Disables failing props query that caused 408 Request Time-out in init queries
        shouldSyncHistoryMessage: () => false,
        generateHighQualityLinkPreview: false,
        getMessage: async (key: any) => {
          if (!key?.id) return undefined;
          const msg = await this.getMessageFromCache(key.id);
          if (msg) {
            console.log(`[WhatsAppWebBot] Provided message for retry request (ID: ${key.id})`);
            return msg;
          }
          return undefined;
        },
      });

      this.sock.ev.on('creds.update', saveCreds);

      this.sock.ev.on('messages.upsert', async (m: any) => {
        for (const msg of m.messages || []) {
          if (msg?.key?.id && msg?.message) {
            this.cacheMessage(msg.key.id, msg.message);

            // Skip automated outgoing bot broadcasts
            if (this.outgoingBotMessageIds.has(msg.key.id)) {
              continue;
            }

            const remoteJid = msg.key?.remoteJid || '';
            const isGroup = remoteJid.endsWith('@g.us');

            // Skip 1-on-1 self-echoes, but allow messages inside groups
            if (msg.key.fromMe && !isGroup) {
              continue;
            }

            try {
              await this.handleIncomingBaileysMessage(msg);
            } catch (err: any) {
              console.warn('[WhatsAppWebBot] Incoming message processing notice:', err.message);
            }
          }
        }
      });

      this.sock.ev.on('connection.update', async (update: any) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          this.status = 'SCAN_QR';
          try {
            this.qrCodeDataUrl = await QRCode.toDataURL(qr);
            console.log('[WhatsAppWebBot] New QR code generated for scanning.');
          } catch (err: any) {
            console.error('[WhatsAppWebBot] QR generation error:', err.message);
          }
        }

        if (connection === 'close') {
          const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
          const isLoggedOut = statusCode === (DisconnectReason?.loggedOut ?? 401);
          const isReplaced = statusCode === (DisconnectReason?.connectionReplaced ?? 440);

          this.lastDisconnectInfo = { statusCode, isLoggedOut, isReplaced, time: new Date().toISOString() };
          this.logEvent('CONNECTION_CLOSED', this.lastDisconnectInfo);
          console.log(`[WhatsAppWebBot] Connection closed (code: ${statusCode}). LoggedOut: ${isLoggedOut}, Replaced: ${isReplaced}`);
          this.status = 'DISCONNECTED';
          this.qrCodeDataUrl = null;
          this.botPhoneNumber = null;
          this.isInitializing = false;

          if (isReplaced) {
            console.warn('[WhatsAppWebBot] ⚠️ Connection replaced! Another instance (e.g. Localhost) is connected with this session.');
            setTimeout(() => {
              this.initialize();
            }, 10000);
          } else if (isLoggedOut) {
            console.log('[WhatsAppWebBot] Bot logged out. Clearing auth directory and regenerating fresh QR code...');
            try {
              fs.rmSync(this.authDir, { recursive: true, force: true });
              fs.mkdirSync(this.authDir, { recursive: true });
            } catch (err: any) {
              console.error('[WhatsAppWebBot] Error clearing auth dir:', err.message);
            }
            setTimeout(() => {
              this.initialize();
            }, 3000);
          } else {
            console.log('[WhatsAppWebBot] Reconnecting in 3s...');
            setTimeout(() => {
              this.initialize();
            }, 3000);
          }
        } else if (connection === 'open') {
          console.log('[WhatsAppWebBot] Connection successfully established with WhatsApp!');
          this.status = 'CONNECTED';
          this.qrCodeDataUrl = null;
          this.isInitializing = false;
          const userJid = this.sock?.user?.id;
          if (userJid) {
            this.botPhoneNumber = userJid.split(':')[0] || userJid.split('@')[0];
            console.log(`[WhatsAppWebBot] Linked Phone Number: +${this.botPhoneNumber}`);
          }
        }
      });
    } catch (err: any) {
      console.warn('[WhatsAppWebBot] Baileys dynamic load/init notice:', err.message);
      this.status = 'DISCONNECTED';
      this.isInitializing = false;
    }
  }

  /**
   * Handle incoming message from customer in a WhatsApp group or direct chat
   */
  private async handleIncomingBaileysMessage(msg: any): Promise<void> {
    const remoteJid = msg.key?.remoteJid || '';
    if (!remoteJid || remoteJid === 'status@broadcast') return;

    const isGroup = remoteJid.endsWith('@g.us');
    // Only process messages from connected WhatsApp groups
    if (!isGroup) return;

    // Skip if it was an automated message sent programmatically by this bot
    if (msg.key?.id && this.outgoingBotMessageIds.has(msg.key.id)) {
      return;
    }

    let participant = msg.key?.participant || (msg as any).participant;
    if (!participant && msg.key?.fromMe) {
      participant = this.sock?.user?.id || this.botPhoneNumber || '';
    }
    if (!participant) {
      participant = remoteJid;
    }
    const rawPhone = participant.split('@')[0].split(':')[0].replace(/\D/g, '');
    if (!rawPhone) return;

    // Unwrap potential ephemeral or view-once wrapper
    const unwrap = (obj: any): any => {
      if (!obj) return null;
      if (obj.ephemeralMessage?.message) return unwrap(obj.ephemeralMessage.message);
      if (obj.viewOnceMessage?.message) return unwrap(obj.viewOnceMessage.message);
      if (obj.viewOnceMessageV2?.message) return unwrap(obj.viewOnceMessageV2.message);
      return obj;
    };
    const m = unwrap(msg.message);

    let text =
      m?.conversation ||
      m?.extendedTextMessage?.text ||
      m?.imageMessage?.caption ||
      m?.videoMessage?.caption ||
      m?.documentMessage?.caption ||
      '';

    if (!text || text.trim() === '') {
      if (m?.imageMessage) text = '📷 [Photo received]';
      else if (m?.videoMessage) text = '🎥 [Video received]';
      else if (m?.documentMessage) text = `📄 [Document: ${m.documentMessage.fileName || 'file'}]`;
      else if (m?.audioMessage) text = '🎤 [Voice note received]';
      else if (m?.locationMessage) text = '📍 [Location shared]';
      else if (m?.contactMessage) text = '👤 [Contact shared]';
      else return; // Ignore protocol/empty messages
    }

    // Get group subject if in a group
    let groupSubject = '';
    if (isGroup) {
      groupSubject = this.groupJidCache.get(remoteJid) || '';
      if (!groupSubject && this.sock?.groupMetadata) {
        try {
          const metaPromise = this.sock.groupMetadata(remoteJid);
          const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(null), 1500));
          const meta: any = await Promise.race([metaPromise, timeoutPromise]);
          if (meta?.subject) {
            groupSubject = meta.subject;
            this.groupJidCache.set(remoteJid, groupSubject);
          }
        } catch {
          // ignore metadata fetch failure
        }
      }
    }

    console.log(`[WhatsAppWebBot] Incoming group message in "${groupSubject || remoteJid}" from +${rawPhone}: "${text.slice(0, 50)}"`);

    await notifyCrmOfCustomerWhatsAppMessage({
      senderPhone: rawPhone,
      senderName: msg.pushName || undefined,
      messageText: text,
      groupId: remoteJid,
      groupSubject: groupSubject || undefined,
      metaMessageId: msg.key?.id,
    });
  }

  /**
   * Extract invite code from full invite link or raw code
   */
  public extractInviteCode(input: string): string {
    if (!input) return '';
    const cleaned = input.trim();
    const match = cleaned.match(/chat\.whatsapp\.com\/([A-Za-z0-9_-]+)/);
    if (match) return match[1];
    return cleaned;
  }

  /**
   * Join group by invite code and return the group JID
   */
  public async resolveOrJoinGroup(inviteLinkOrCode: string): Promise<string> {
    const inviteCode = this.extractInviteCode(inviteLinkOrCode);
    if (!inviteCode) {
      throw new Error('Invalid WhatsApp group invite link or code.');
    }

    if (this.groupJidCache.has(inviteCode)) {
      return this.groupJidCache.get(inviteCode)!;
    }

    if (!this.sock || this.status !== 'CONNECTED') {
      throw new Error('WhatsApp Web Bot is not connected. Please scan the QR code first.');
    }

    try {
      console.log(`[WhatsAppWebBot] Joining group via invite code: ${inviteCode}`);
      const groupJid = await this.sock.groupAcceptInvite(inviteCode);
      const resolvedJid = groupJid ? (groupJid.endsWith('@g.us') ? groupJid : `${groupJid}@g.us`) : '';
      if (resolvedJid) {
        this.groupJidCache.set(inviteCode, resolvedJid);
        console.log(`[WhatsAppWebBot] Successfully joined group. JID: ${resolvedJid}`);
        return resolvedJid;
      }
    } catch (err: any) {
      const msg = err.message || '';
      console.log(`[WhatsAppWebBot] groupAcceptInvite notice: ${msg}`);
      // If already in group, get group metadata by invite info
      try {
        const inviteInfo = await this.sock.groupGetInviteInfo(inviteCode);
        if (inviteInfo?.id) {
          const groupJid = `${inviteInfo.id}@g.us`;
          this.groupJidCache.set(inviteCode, groupJid);
          console.log(`[WhatsAppWebBot] Resolved existing group JID from invite info: ${groupJid}`);
          return groupJid;
        }
      } catch (infoErr: any) {
        console.error('[WhatsAppWebBot] Could not fetch invite info:', infoErr.message);
      }
    }

    // Fallback: list all participating groups to find matching group
    try {
      const groups: Record<string, any> = (await this.sock.groupFetchAllParticipating()) || {};
      for (const [jid, metadata] of Object.entries(groups)) {
        if (metadata?.subject) {
          this.groupJidCache.set(metadata.subject, jid);
        }
      }
    } catch {
      // ignore
    }

    throw new Error('Could not resolve WhatsApp group from invite link. Make sure the bot is an accepted participant.');
  }

  /**
   * Send message directly INSIDE the group with zero navigation
   */
  public async sendMessageToGroup(
    groupTarget: string,
    messageText: string
  ): Promise<{ success: boolean; messageId?: string; groupJid?: string; error?: string }> {
    if (!this.sock || this.status !== 'CONNECTED') {
      return {
        success: false,
        error: 'WhatsApp Web Bot is not connected. Please scan the QR code in Settings/WhatsApp to activate automatic group posting.',
      };
    }

    try {
      let targetJid = groupTarget;

      // If groupTarget is an invite link or invite code, resolve it
      if (groupTarget.includes('chat.whatsapp.com') || !groupTarget.endsWith('@g.us')) {
        targetJid = await this.resolveOrJoinGroup(groupTarget);
      }

      console.log(`[WhatsAppWebBot] Dispatching message inside group JID: ${targetJid}`);
      const res = await this.sock.sendMessage(targetJid, { text: messageText });
      const messageId = res?.key?.id || `WB_${Date.now()}`;
      if (res?.key?.id) this.outgoingBotMessageIds.add(res.key.id);
      if (res?.key?.id && res?.message) {
        this.cacheMessage(res.key.id, res.message);
      }

      console.log(`[WhatsAppWebBot] Message posted successfully inside group! ID: ${messageId}`);
      return {
        success: true,
        messageId,
        groupJid: targetJid,
      };
    } catch (err: any) {
      console.error('[WhatsAppWebBot] Failed to send message to group:', err.message);
      return {
        success: false,
        error: err.message || 'Failed to dispatch message inside WhatsApp group',
      };
    }
  }

  /**
   * Send document / file / image directly INSIDE the group with caption
   */
  public async sendDocumentToGroup(
    groupTarget: string,
    filePath: string,
    fileName: string,
    caption?: string
  ): Promise<{ success: boolean; messageId?: string; groupJid?: string; error?: string }> {
    if (!this.sock || this.status !== 'CONNECTED') {
      return {
        success: false,
        error: 'WhatsApp Web Bot is not connected. Please scan the QR code to activate automatic document sending.',
      };
    }

    try {
      if (!fs.existsSync(filePath)) {
        return { success: false, error: `File not found on server: ${filePath}` };
      }

      let targetJid = groupTarget;
      if (groupTarget.includes('chat.whatsapp.com') || !groupTarget.endsWith('@g.us')) {
        targetJid = await this.resolveOrJoinGroup(groupTarget);
      }

      const fileBuffer = fs.readFileSync(filePath);
      const ext = path.extname(fileName).toLowerCase();
      
      let mimetype = 'application/pdf';
      const isImage = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext);

      if (ext === '.pdf') mimetype = 'application/pdf';
      else if (ext === '.png') mimetype = 'image/png';
      else if (ext === '.jpg' || ext === '.jpeg') mimetype = 'image/jpeg';
      else if (ext === '.webp') mimetype = 'image/webp';
      else if (ext === '.dwg') mimetype = 'application/acad';
      else mimetype = 'application/octet-stream';

      console.log(`[WhatsAppWebBot] Dispatching document "${fileName}" to group ${targetJid} (mimetype: ${mimetype})`);

      let res: any;
      if (isImage) {
        res = await this.sock.sendMessage(targetJid, {
          image: fileBuffer,
          caption: caption || `Alpha Elevators: ${fileName}`,
        });
      } else {
        res = await this.sock.sendMessage(targetJid, {
          document: fileBuffer,
          mimetype,
          fileName,
          caption: caption || `Alpha Elevators: ${fileName}`,
        });
      }

      const messageId = res?.key?.id || `DOC_${Date.now()}`;
      if (res?.key?.id) this.outgoingBotMessageIds.add(res.key.id);
      if (res?.key?.id && res?.message) {
        this.cacheMessage(res.key.id, res.message);
      }
      console.log(`[WhatsAppWebBot] Document posted successfully inside group! ID: ${messageId}`);

      return {
        success: true,
        messageId,
        groupJid: targetJid,
      };
    } catch (err: any) {
      console.error('[WhatsAppWebBot] Failed to send document to group:', err.message);
      return {
        success: false,
        error: err.message || 'Failed to dispatch document inside WhatsApp group',
      };
    }
  }

  /**
   * Send 1-to-1 direct WhatsApp message to an individual phone number (no 24h Meta restriction)
   */
  public async sendDirectMessage(
    phoneNumber: string,
    messageText: string
  ): Promise<{ success: boolean; messageId?: string; directJid?: string; error?: string }> {
    if (!this.sock || this.status !== 'CONNECTED') {
      return {
        success: false,
        error: 'WhatsApp Web Bot is not connected. Please scan the QR code to activate WhatsApp bot messaging.',
      };
    }

    try {
      const cleanPhone = normalizeWhatsAppPhone(phoneNumber);
      if (!cleanPhone) {
        return { success: false, error: 'Invalid phone number provided.' };
      }

      // If destination phone matches the connected bot number, route via sendSelfMessage
      const myBotNum = this.botPhoneNumber || (this.sock?.user?.id ? (this.sock.user.id.split(':')[0] || this.sock.user.id.split('@')[0]) : null);
      if (myBotNum && normalizeWhatsAppPhone(myBotNum) === cleanPhone) {
        console.log(`[WhatsAppWebBot] Target phone (${cleanPhone}) is the bot's own number. Routing via sendSelfMessage.`);
        return this.sendSelfMessage(messageText);
      }

      const directJid = `${cleanPhone}@s.whatsapp.net`;
      console.log(`[WhatsAppWebBot] Dispatching direct message to 1-to-1 JID: ${directJid}`);
      const res = await this.sock.sendMessage(directJid, { text: messageText });
      const messageId = res?.key?.id || `WB_DIR_${Date.now()}`;
      if (res?.key?.id && res?.message) {
        this.cacheMessage(res.key.id, res.message);
      }
      console.log(`[WhatsAppWebBot] Direct message posted successfully! ID: ${messageId}`);
      return {
        success: true,
        messageId,
        directJid,
      };
    } catch (err: any) {
      console.error('[WhatsAppWebBot] Failed to send direct message:', err.message);
      return {
        success: false,
        error: err.message || 'Failed to dispatch 1-to-1 WhatsApp message',
      };
    }
  }

  /**
   * Determine the normalized JID for "Message yourself" (LID for WhatsApp Business, phone JID fallback)
   */
  public getSelfJid(): string | null {
    if (this.sock?.user?.lid) {
      const lidClean = this.sock.user.lid.split(':')[0];
      return `${lidClean}@lid`;
    }
    if (this.sock?.user?.id) {
      const phoneClean = this.sock.user.id.split(':')[0] || this.sock.user.id.split('@')[0];
      const normalized = normalizeWhatsAppPhone(phoneClean);
      if (normalized) {
        return `${normalized}@s.whatsapp.net`;
      }
    }
    if (this.botPhoneNumber) {
      const clean = normalizeWhatsAppPhone(this.botPhoneNumber);
      if (clean) return `${clean}@s.whatsapp.net`;
    }
    return null;
  }

  /**
   * Send 1-to-1 message directly to the connected WhatsApp bot itself ("Message yourself")
   * Uses WhatsApp Business account's normalized LID (@lid) when available so the
   * conversation arrives directly in the self chat and decrypts reliably.
   */
  public async sendSelfMessage(
    messageText: string
  ): Promise<{ success: boolean; messageId?: string; directJid?: string; error?: string }> {
    if (!this.sock || this.status !== 'CONNECTED') {
      return {
        success: false,
        error: 'WhatsApp Web Bot is not connected. Please scan the QR code to activate WhatsApp bot messaging.',
      };
    }

    try {
      const selfJid = this.getSelfJid();
      if (!selfJid) {
        return { success: false, error: 'Could not determine bot self JID.' };
      }

      console.log(`[WhatsAppWebBot] Dispatching self message to "Message yourself" JID: ${selfJid}`);
      const res = await this.sock.sendMessage(selfJid, { text: messageText });
      const messageId = res?.key?.id || `WB_SELF_${Date.now()}`;
      if (res?.key?.id && res?.message) {
        this.cacheMessage(res.key.id, res.message);
      }
      console.log(`[WhatsAppWebBot] Self message posted successfully! ID: ${messageId}`);
      return {
        success: true,
        messageId,
        directJid: selfJid,
      };
    } catch (err: any) {
      console.error('[WhatsAppWebBot] Failed to send self message:', err.message);
      return {
        success: false,
        error: err.message || 'Failed to dispatch self WhatsApp message',
      };
    }
  }

  /**
   * Send document / file / photo directly to the connected WhatsApp bot itself ("Message yourself")
   */
  public async sendSelfDocument(
    filePath: string,
    fileName: string,
    caption?: string
  ): Promise<{ success: boolean; messageId?: string; directJid?: string; error?: string }> {
    if (!this.sock || this.status !== 'CONNECTED') {
      return {
        success: false,
        error: 'WhatsApp Web Bot is not connected. Please scan the QR code to activate automatic document sending.',
      };
    }

    try {
      if (!fs.existsSync(filePath)) {
        return { success: false, error: `File not found on server: ${filePath}` };
      }

      const selfJid = this.getSelfJid();
      if (!selfJid) {
        return { success: false, error: 'Could not determine bot self JID.' };
      }

      const fileBuffer = fs.readFileSync(filePath);
      const ext = path.extname(fileName).toLowerCase();
      let mimetype = 'application/pdf';
      const isImage = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext);

      if (ext === '.pdf') mimetype = 'application/pdf';
      else if (ext === '.png') mimetype = 'image/png';
      else if (ext === '.jpg' || ext === '.jpeg') mimetype = 'image/jpeg';
      else if (ext === '.webp') mimetype = 'image/webp';
      else if (ext === '.dwg') mimetype = 'application/acad';
      else mimetype = 'application/octet-stream';

      console.log(`[WhatsAppWebBot] Dispatching self document "${fileName}" to ${selfJid} (mimetype: ${mimetype})`);

      let res: any;
      if (isImage) {
        res = await this.sock.sendMessage(selfJid, {
          image: fileBuffer,
          caption: caption || `Alpha Elevators: ${fileName}`,
        });
      } else {
        res = await this.sock.sendMessage(selfJid, {
          document: fileBuffer,
          mimetype,
          fileName,
          caption: caption || `Alpha Elevators: ${fileName}`,
        });
      }

      const messageId = res?.key?.id || `DOC_SELF_${Date.now()}`;
      if (res?.key?.id && res?.message) {
        this.cacheMessage(res.key.id, res.message);
      }
      console.log(`[WhatsAppWebBot] Self document posted successfully! ID: ${messageId}`);
      return {
        success: true,
        messageId,
        directJid: selfJid,
      };
    } catch (err: any) {
      console.error('[WhatsAppWebBot] Failed to send self document:', err.message);
      return {
        success: false,
        error: err.message || 'Failed to dispatch self document',
      };
    }
  }

  /**
   * Send 1-to-1 direct document / drawing / photo to an individual phone number with caption
   */
  public async sendDirectDocument(
    phoneNumber: string,
    filePath: string,
    fileName: string,
    caption?: string
  ): Promise<{ success: boolean; messageId?: string; directJid?: string; error?: string }> {
    if (!this.sock || this.status !== 'CONNECTED') {
      return {
        success: false,
        error: 'WhatsApp Web Bot is not connected. Please scan the QR code to activate automatic document sending.',
      };
    }

    try {
      const cleanPhone = normalizeWhatsAppPhone(phoneNumber);
      if (!cleanPhone) {
        return { success: false, error: 'Invalid phone number provided.' };
      }
      if (!fs.existsSync(filePath)) {
        return { success: false, error: `File not found on server: ${filePath}` };
      }

      // If destination matches connected bot number, route via sendSelfDocument
      const myBotNum = this.botPhoneNumber || (this.sock?.user?.id ? (this.sock.user.id.split(':')[0] || this.sock.user.id.split('@')[0]) : null);
      if (myBotNum && normalizeWhatsAppPhone(myBotNum) === cleanPhone) {
        console.log(`[WhatsAppWebBot] Target phone (${cleanPhone}) is the bot's own number. Routing document via sendSelfDocument.`);
        return this.sendSelfDocument(filePath, fileName, caption);
      }

      const directJid = `${cleanPhone}@s.whatsapp.net`;
      const fileBuffer = fs.readFileSync(filePath);
      const ext = path.extname(fileName).toLowerCase();
      let mimetype = 'application/pdf';
      const isImage = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext);

      if (ext === '.pdf') mimetype = 'application/pdf';
      else if (ext === '.png') mimetype = 'image/png';
      else if (ext === '.jpg' || ext === '.jpeg') mimetype = 'image/jpeg';
      else if (ext === '.webp') mimetype = 'image/webp';
      else if (ext === '.dwg') mimetype = 'application/acad';
      else mimetype = 'application/octet-stream';

      console.log(`[WhatsAppWebBot] Dispatching direct document "${fileName}" to ${directJid} (mimetype: ${mimetype})`);

      let res: any;
      if (isImage) {
        res = await this.sock.sendMessage(directJid, {
          image: fileBuffer,
          caption: caption || `Alpha Elevators: ${fileName}`,
        });
      } else {
        res = await this.sock.sendMessage(directJid, {
          document: fileBuffer,
          mimetype,
          fileName,
          caption: caption || `Alpha Elevators: ${fileName}`,
        });
      }

      const messageId = res?.key?.id || `DOC_DIR_${Date.now()}`;
      if (res?.key?.id && res?.message) {
        this.cacheMessage(res.key.id, res.message);
      }
      console.log(`[WhatsAppWebBot] Direct document posted successfully! ID: ${messageId}`);
      return {
        success: true,
        messageId,
        directJid,
      };
    } catch (err: any) {
      console.error('[WhatsAppWebBot] Failed to send direct document:', err.message);
      return {
        success: false,
        error: err.message || 'Failed to dispatch document directly',
      };
    }
  }

  public async logout(): Promise<void> {
    try {
      console.log('[WhatsAppWebBot] Logging out and unlinking WhatsApp session...');
      if (this.sock) {
        try {
          await this.sock.logout();
        } catch (sockErr: any) {
          console.warn('[WhatsAppWebBot] Socket logout note:', sockErr.message);
        }
        try {
          this.sock.end(undefined);
        } catch {}
        this.sock = null;
      }
      if (fs.existsSync(this.authDir)) {
        fs.rmSync(this.authDir, { recursive: true, force: true });
      }
      fs.mkdirSync(this.authDir, { recursive: true });
      this.messageCache.clear();
      if (fs.existsSync(this.cacheFilePath)) {
        try { fs.unlinkSync(this.cacheFilePath); } catch {}
      }
      this.status = 'DISCONNECTED';
      this.qrCodeDataUrl = null;
      this.botPhoneNumber = null;
      this.isInitializing = false;
      this.groupJidCache.clear();
      console.log('[WhatsAppWebBot] Session data cleared. Re-initializing for new number...');
      this.initialize().catch((err) => {
        console.error('[WhatsAppWebBot] Re-initialization error after logout:', err.message);
      });
    } catch (err: any) {
      console.error('[WhatsAppWebBot] Logout error:', err.message);
    }
  }
}

export const whatsAppWebBot = new WhatsAppWebBotService();
