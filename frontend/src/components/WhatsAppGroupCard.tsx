'use client';

import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Send,
  CheckCircle2,
  AlertCircle,
  Clock,
  Pause,
  Play,
  RotateCcw,
  ShieldAlert,
  Users,
  Phone,
  Calendar,
  RefreshCw,
  Eye,
  Sparkles,
  ExternalLink,
  ChevronDown,
  Info,
  Check,
  X,
  Link2,
  Trash2,
  Copy,
  Share2,
  Bot,
  UserCheck,
  Plus,
  QrCode,
  PhoneCall,
  LogOut,
  Unlink,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { api } from '../lib/api';

interface WhatsAppGroupCardProps {
  project: any;
  customer: any;
  onRefresh: () => void;
}

export default function WhatsAppGroupCard({
  project,
  customer,
  onRefresh,
}: WhatsAppGroupCardProps) {
  // State
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(true);

  // Group connection modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<'link' | 'api'>('link');
  const [customGroupName, setCustomGroupName] = useState('');
  const [groupInviteLink, setGroupInviteLink] = useState('');
  const [selectedInterval, setSelectedInterval] = useState<'1' | '10' | '15' | '20'>('15');
  const [useDryRun, setUseDryRun] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [metaErrorNotice, setMetaErrorNotice] = useState<string | null>(null);

  // Preview modal state
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [customNote, setCustomNote] = useState('');

  // Test send state
  const [sendingTest, setSendingTest] = useState(false);
  const [testDryRun, setTestDryRun] = useState(false);

  // Retrying log ID
  const [retryingId, setRetryingId] = useState<string | null>(null);

  // Multi-Recipient Broadcast Participants State
  const [participants, setParticipants] = useState<any[]>(project.whatsapp?.participants || []);
  const [isAddParticipantOpen, setIsAddParticipantOpen] = useState(false);
  const [newParticipantPhone, setNewParticipantPhone] = useState('');
  const [newParticipantName, setNewParticipantName] = useState('');
  const [newParticipantRole, setNewParticipantRole] = useState('Site Engineer');
  const [addingParticipant, setAddingParticipant] = useState(false);

  // WhatsApp Web Bot state for zero-navigation inside-group automation
  const [botStatus, setBotStatus] = useState<any>({ isConnected: false, status: 'DISCONNECTED', qrCode: null });
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [botLoading, setBotLoading] = useState(false);

  const fetchBotStatus = async () => {
    try {
      const res = await api.getWhatsAppBotStatus();
      if (res && res.success) {
        setBotStatus(res);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchBotStatus();
    const interval = setInterval(fetchBotStatus, 4000);
    return () => clearInterval(interval);
  }, []);

  const whatsapp = project.whatsapp || {};
  const groupId = whatsapp.groupId || project.whatsappGroupId;
  const groupName = whatsapp.groupName || project.whatsappGroupName || `${project.projectName} — Alpha Updates`;
  const invitationStatus = whatsapp.invitationStatus || (groupId ? 'PENDING' : 'NOT_INVITED');
  const groupStatus = whatsapp.groupStatus || (groupId ? (project.automationEnabled ? 'ACTIVE' : 'PAUSED') : 'NOT_LINKED');
  const isAutomationEnabled = whatsapp.updatesEnabled ?? project.automationEnabled ?? false;
  const intervalDays = String(whatsapp.intervalDays || project.updateFrequencyDays || 15);
  const nextUpdateAt = whatsapp.nextUpdateAt || project.nextUpdateAt;
  const botPhoneNumber = whatsapp.botPhoneNumber || '+91 93848 20316';

  // Format international phone
  const rawPhone = customer?.whatsappNumber || customer?.phoneNumber || '';
  const internationalPhone = rawPhone.startsWith('+')
    ? rawPhone
    : `+91 ${rawPhone.replace(/^0+/, '')}`;

  // Fetch message history
  const fetchMessages = async () => {
    if (!project?._id) return;
    try {
      setMessagesLoading(true);
      const res = await api.getWhatsAppProjectMessages(project._id);
      const logs = res.data?.logs || [];
      const legacy = res.data?.legacy || [];
      // Combine if logs are present or fallback to legacy
      setMessages(logs.length > 0 ? logs : legacy);
    } catch (err: any) {
      console.error('Failed to load message history:', err);
    } finally {
      setMessagesLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
    if (project.whatsapp?.participants) {
      setParticipants(project.whatsapp.participants);
    }
  }, [project?._id]);

  // Fetch participants
  const fetchParticipants = async () => {
    if (!project?._id) return;
    try {
      const res = await api.getProjectParticipants(project._id);
      if (res.participants) {
        setParticipants(res.participants);
      }
    } catch {
      // ignore
    }
  };

  // Add Participant Handler
  const handleAddParticipant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newParticipantPhone.trim()) {
      toast.error('Please enter a valid WhatsApp phone number');
      return;
    }
    try {
      setAddingParticipant(true);
      const res = await api.addProjectParticipant(project._id, {
        phoneNumber: newParticipantPhone.trim(),
        name: newParticipantName.trim() || undefined,
        role: newParticipantRole,
      });
      if (res.success) {
        toast.success(`Recipient ${newParticipantName || newParticipantPhone} added!`);
        setParticipants(res.participants || []);
        setIsAddParticipantOpen(false);
        setNewParticipantPhone('');
        setNewParticipantName('');
        onRefresh();
      } else {
        toast.error(res.message || 'Failed to add recipient');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to add recipient');
    } finally {
      setAddingParticipant(false);
    }
  };

  // Remove Participant Handler
  const handleRemoveParticipant = async (phone: string) => {
    try {
      const res = await api.removeProjectParticipant(project._id, phone);
      if (res.success) {
        toast.success('Recipient removed from broadcast');
        setParticipants(res.participants || []);
        onRefresh();
      } else {
        toast.error(res.message || 'Failed to remove recipient');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove recipient');
    }
  };

  // Open Create/Connect Modal
  const openCreateModal = () => {
    setCustomGroupName(project.whatsapp?.groupName || project.whatsappGroupName || `${project.projectName} — Alpha Updates`);
    setGroupInviteLink(project.whatsapp?.inviteLink || '');
    setSelectedInterval(String(project.whatsapp?.intervalDays || project.updateFrequencyDays || 15) as any);
    setUseDryRun(false);
    setMetaErrorNotice(null);
    setModalTab('link'); // Default to reliable direct link
    setIsCreateModalOpen(true);
  };

  // Handle Group Linking or Creation
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer?.whatsappOptIn) {
      toast.error('Customer has not consented to WhatsApp communications');
      return;
    }

    try {
      setCreatingGroup(true);
      setMetaErrorNotice(null);

      if (modalTab === 'link') {
        if (!groupInviteLink.trim()) {
          toast.error('Please enter the WhatsApp Group Invite Link or Group ID');
          return;
        }

        const res = await api.createWhatsAppGroup(project._id, {
          groupNameOverride: customGroupName.trim() || undefined,
          intervalDays: Number(selectedInterval),
          inviteLink: groupInviteLink.trim(),
          forceRelink: true,
        });

        toast.success(res.message || 'WhatsApp Group linked successfully!');
        setIsCreateModalOpen(false);
        onRefresh();
        fetchMessages();
      } else {
        const res = await api.createWhatsAppGroup(project._id, {
          groupNameOverride: customGroupName.trim() || undefined,
          intervalDays: Number(selectedInterval),
          dryRun: useDryRun,
          forceRelink: true,
        });

        toast.success(res.message || 'WhatsApp Group created successfully!');
        setIsCreateModalOpen(false);
        onRefresh();
        fetchMessages();
      }
    } catch (err: any) {
      const msg = err.message || 'Failed to connect WhatsApp group';
      if (
        msg.includes('131000') ||
        msg.includes('Meta') ||
        msg.includes('OAuthException') ||
        msg.includes('restricted') ||
        err.errorCode === 131000 ||
        err.metaGroupsRestricted
      ) {
        setMetaErrorNotice(
          'Meta Cloud API Error 131000: Programmatic group creation is restricted by Meta on this WhatsApp Business Account. Meta requires special developer permission to create groups via code. Please use the "Link Existing Group" tab or enable Dry-Run mode.'
        );
        toast.error('Meta Cloud API restricts automated group creation (Error 131000). Use the "Link Existing Group" option.');
      } else if (msg.includes('Official Business Account') || msg.includes('7013')) {
        setMetaErrorNotice('WATI requires Official Business Account (OBA / Blue Tick) verification to create WhatsApp Groups via API.');
        toast.error('WATI requires Official Business Account verification. You can test with Dry-Run mode or link an existing group.');
      } else {
        toast.error(msg);
      }
    } finally {
      setCreatingGroup(false);
    }
  };

  // Handle Unlink Group
  const handleUnlinkGroup = async () => {
    if (!window.confirm('Are you sure you want to unlink the WhatsApp group from this project?')) return;
    try {
      setLoading(true);
      await api.unlinkWhatsAppGroup(project._id);
      toast.success('WhatsApp group unlinked successfully');
      onRefresh();
      fetchMessages();
    } catch (err: any) {
      toast.error(err.message || 'Failed to unlink group');
    } finally {
      setLoading(false);
    }
  };

  // Handle Send Invites
  const handleSendInvites = async () => {
    try {
      setLoading(true);
      const res = await api.inviteWhatsAppContacts(project._id);
      toast.success(res.message || 'Group invitations dispatched to contacts!');
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to send group invitations');
    } finally {
      setLoading(false);
    }
  };

  // Handle Toggle Automation
  const handleToggleAutomation = async () => {
    try {
      setLoading(true);
      if (isAutomationEnabled) {
        await api.pauseWhatsAppAutomation({ projectId: project._id, reason: 'Manually paused by manager' });
        toast.success('Automation paused');
      } else {
        await api.resumeWhatsAppAutomation({ projectId: project._id });
        toast.success('Automation resumed');
      }
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update automation state');
    } finally {
      setLoading(false);
    }
  };

  // Handle Interval Change
  const handleIntervalChange = async (newVal: '1' | '10' | '15' | '20') => {
    try {
      setLoading(true);
      await api.updateWhatsAppConfig(project._id, { intervalDays: Number(newVal) });
      toast.success(`Update cadence updated to every ${newVal === '1' ? '1 day' : `${newVal} days`}`);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update cadence');
    } finally {
      setLoading(false);
    }
  };

  // Open Preview Modal
  const openPreview = async () => {
    try {
      setIsPreviewModalOpen(true);
      setPreviewLoading(true);
      const res = await api.previewWhatsAppUpdate(project._id, customNote.trim() || undefined);
      setPreviewData(res.data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate preview');
    } finally {
      setPreviewLoading(false);
    }
  };

  // Update preview when note changes
  const handleRefreshPreviewWithNote = async () => {
    try {
      setPreviewLoading(true);
      const res = await api.previewWhatsAppUpdate(project._id, customNote.trim() || undefined);
      setPreviewData(res.data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to refresh preview');
    } finally {
      setPreviewLoading(false);
    }
  };

  // Copy message text and open group directly
  const handleCopyAndOpenGroup = async () => {
    if (!previewData?.previewText) return;
    navigator.clipboard.writeText(previewData.previewText);
    toast.success('Update text copied to clipboard! Opening WhatsApp Group...');
    const inviteUrl = project.whatsapp?.inviteLink;
    if (inviteUrl) {
      window.open(inviteUrl, '_blank');
    } else {
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(previewData.previewText)}`, '_blank');
    }
    // Record in history log
    try {
      await api.sendTestWhatsAppMessage(project._id, {
        customNote: customNote.trim() || undefined,
        dryRun: true,
        targetType: 'GROUP',
      });
      fetchMessages();
    } catch {
      // ignore
    }
  };

  // Direct share via WhatsApp Web / Mobile with text pre-filled
  const handleShareToWhatsApp = () => {
    if (!previewData?.previewText) return;
    const shareUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(previewData.previewText)}`;
    window.open(shareUrl, '_blank');
  };

  // Send directly to WhatsApp Group automatically via Web Bot without navigation
  const handleSendToGroup = async () => {
    try {
      setSendingTest(true);
      const res = await api.sendTestWhatsAppMessage(project._id, {
        customNote: customNote.trim() || undefined,
        dryRun: testDryRun,
        targetType: 'GROUP',
      });

      if (res && res.success) {
        toast.success(res.message || 'Message posted directly inside the WhatsApp group!');
        setIsPreviewModalOpen(false);
        fetchMessages();
        onRefresh();
      } else if (res && res.requiresScan) {
        setBotStatus((prev: any) => ({ ...prev, qrCode: res.qrCode, status: res.botStatus }));
        setIsQrModalOpen(true);
        toast('Please scan the QR code to link your bot for automatic group posting.');
      } else {
        toast.error(res?.message || 'Failed to dispatch group update');
      }
    } catch (err: any) {
      if (err.requiresScan || err.message?.includes('scan the QR code') || err.message?.includes('not connected')) {
        setIsQrModalOpen(true);
        fetchBotStatus();
        toast('Please scan the QR code to link your bot for automatic group posting.');
      } else {
        toast.error(err.message || 'Failed to dispatch group update');
      }
    } finally {
      setSendingTest(false);
    }
  };

  const handleSendTestMessage = handleSendToGroup;

  // Handle Retry Failed Job
  const handleRetryMessage = async (logId: string) => {
    try {
      setRetryingId(logId);
      const res = await api.retryWhatsAppMessage(logId);
      if (res.success) {
        toast.success('Message retried successfully!');
      } else {
        toast.error(res.message || 'Retry attempt finished with notice.');
      }
      fetchMessages();
    } catch (err: any) {
      toast.error(err.message || 'Failed to retry message');
    } finally {
      setRetryingId(null);
    }
  };

  // Status Badge Helper
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">ACTIVE</span>;
      case 'PAUSED':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300">PAUSED</span>;
      case 'AWAITING_OBA_APPROVAL':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">OBA REQUIRED</span>;
      case 'DISCONNECTED':
      case 'FAILED':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">DISCONNECTED</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">NOT LINKED</span>;
    }
  };

  const getInvitationBadge = (status: string) => {
    switch (status) {
      case 'ACCEPTED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">Accepted</span>;
      case 'SENT':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-800">Invited (Sent)</span>;
      case 'PENDING':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">Pending Acceptance</span>;
      case 'FAILED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">Invite Failed</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">Not Invited</span>;
    }
  };

  const getLogStatusBadge = (status: string) => {
    switch (status) {
      case 'SENT':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">SENT</span>;
      case 'DELIVERED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-100 text-teal-800">DELIVERED</span>;
      case 'READ':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-800">READ</span>;
      case 'AWAITING_PROVIDER_CAPABILITY':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">AWAITING API CAPABILITY</span>;
      case 'FAILED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">FAILED</span>;
      case 'PENDING':
      case 'SCHEDULED':
      case 'SENDING':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800">PENDING</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">{status}</span>;
    }
  };

  return (
    <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-sm space-y-6 animate-fade-in">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-extrabold text-slate-900">WhatsApp Group Automation</h3>
              <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold tracking-wider uppercase border border-slate-200">
                WATI Business API
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Automated milestone communications with clients via verified WhatsApp Groups
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {!groupId ? (
            <button
              onClick={openCreateModal}
              disabled={loading || !customer?.whatsappOptIn}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/20 active:scale-95 disabled:opacity-50 flex items-center gap-2"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Connect WhatsApp Group</span>
            </button>
          ) : (
            <>
              <button
                onClick={openPreview}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
              >
                <Eye className="w-3.5 h-3.5 text-slate-600" />
                <span>Preview Message</span>
              </button>

              <button
                onClick={handleSendToGroup}
                disabled={loading || sendingTest}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                title="Send update directly to WhatsApp Group"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send to Group</span>
              </button>

              <button
                onClick={handleToggleAutomation}
                disabled={loading}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  isAutomationEnabled
                    ? 'bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-200'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm'
                }`}
              >
                {isAutomationEnabled ? (
                  <>
                    <Pause className="w-3.5 h-3.5 text-amber-600" />
                    <span>Pause Automation</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" />
                    <span>Resume Automation</span>
                  </>
                )}
              </button>

              {invitationStatus === 'PENDING' && (
                <button
                  onClick={handleSendInvites}
                  disabled={loading}
                  className="px-3.5 py-2 bg-sky-50 text-sky-800 hover:bg-sky-100 border border-sky-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Invites</span>
                </button>
              )}

              <button
                onClick={openCreateModal}
                disabled={loading}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5"
                title="Change or re-link WhatsApp group"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                <span>Change Group</span>
              </button>

              <button
                onClick={handleUnlinkGroup}
                disabled={loading}
                className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-xl transition-all"
                title="Unlink WhatsApp group from project"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          <button
            onClick={() => {
              onRefresh();
              fetchMessages();
            }}
            disabled={loading}
            title="Refresh Status"
            className="p-2 border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Customer Opt-In Alert Banner if disabled */}
      {!customer?.whatsappOptIn && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3 text-xs text-amber-900">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
          <div className="flex-1">
            <strong>Customer WhatsApp Consent Required:</strong> Customer has not opted in for automated updates. Consent must be confirmed before group creation or message dispatch.
          </div>
        </div>
      )}

      {/* OBA Alert Banner if status is AWAITING_OBA_APPROVAL */}
      {groupStatus === 'AWAITING_OBA_APPROVAL' && (
        <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-2xl flex items-start gap-3 text-xs text-indigo-950">
          <Info className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <strong>WATI Official Business Account (OBA) Notice:</strong>
            <p className="text-indigo-800 leading-relaxed">
              WATI API requires Official Business Account verification (Meta Blue Tick) on this workspace to create live WhatsApp Groups via API. In the meantime, you can test and preview all automated workflows using <strong>Dry-Run Mode</strong>.
            </p>
          </div>
        </div>
      )}

      {/* Core Metadata Dashboard Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
        {/* Project & Client Card */}
        <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80 space-y-1.5">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Customer & Project</span>
          <strong className="text-slate-900 text-sm block truncate">{customer?.fullName || '—'}</strong>
          <div className="flex items-center gap-1.5 text-slate-600 text-xs font-mono">
            <Phone className="w-3 h-3 text-emerald-600" />
            <span>{internationalPhone}</span>
          </div>
          <span className="text-[11px] text-slate-500 block truncate">{project.projectName}</span>
        </div>

        {/* Group Details Card */}
        <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Group Connection</span>
            {getStatusBadge(groupStatus)}
          </div>
          <strong className="text-slate-900 text-sm block truncate" title={groupName}>
            {groupId ? groupName : 'Not Connected'}
          </strong>
          <span className="text-[11px] text-slate-500 font-mono block truncate">
            ID: {groupId || '—'}
          </span>
          <div className="pt-0.5 flex items-center justify-between text-[11px] text-slate-500">
            <div className="flex items-center gap-1">
              <span>Status:</span>
              {getInvitationBadge(invitationStatus)}
            </div>
            {whatsapp.inviteLink && (
              <a
                href={whatsapp.inviteLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-600 hover:text-emerald-700 font-bold flex items-center gap-1"
                title="Open WhatsApp Group"
              >
                <ExternalLink className="w-3 h-3" />
                <span>Open</span>
              </a>
            )}
          </div>
        </div>

        {/* Cadence & Frequency Card */}
        <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80 space-y-1.5">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Update Interval</span>
          <div className="flex items-center gap-2">
            <select
              value={intervalDays}
              onChange={(e) => handleIntervalChange(e.target.value as any)}
              disabled={loading || !groupId}
              className="bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
            >
              <option value="1">Every 1 Day (Daily)</option>
              <option value="10">Every 10 Days</option>
              <option value="15">Every 15 Days</option>
              <option value="20">Every 20 Days</option>
            </select>
          </div>
          <span className="text-[10px] text-slate-400 block">Checked every 15 mins by persistent scheduler</span>
        </div>

        {/* Next Scheduled Dispatch */}
        <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80 space-y-1.5">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Next Scheduled Update</span>
          <strong className="text-sky-700 text-sm block font-bold">
            {nextUpdateAt
              ? new Date(nextUpdateAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
              : 'Not Scheduled'}
          </strong>
          {['MANUFACTURING', 'QUALITY_CHECK', 'DELIVERY', 'DISPATCH', 'INSTALLATION', 'TESTING'].includes(project.projectStatus) && (
            <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 inline-block mt-0.5">
              {project.productionStage === 2
                ? 'Production Stage 2 (Finishing & Assembly)'
                : project.productionStage === 3
                ? 'Production Stage 3 (Final Inspection)'
                : project.productionStage >= 4
                ? 'All 3 Production Stages Completed'
                : 'Production Stage 1 (Fabrication)'}
            </span>
          )}
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <span
              className={`w-2 h-2 rounded-full ${
                isAutomationEnabled && groupId ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
              }`}
            ></span>
            <span>{isAutomationEnabled && groupId ? 'Automation Active' : 'Automation Paused'}</span>
          </div>
          {project.pauseReason && (
            <span className="text-[10px] text-rose-500 block truncate" title={project.pauseReason}>
              {project.pauseReason}
            </span>
          )}
        </div>
      </div>

      {/* WhatsApp Group Exclusive Channel Card (Group Purpose Only) */}
      <div className="p-4 bg-gradient-to-r from-emerald-500/5 via-slate-50 to-emerald-500/10 border border-emerald-200/90 rounded-2xl shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-md shadow-emerald-600/20">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-sm font-bold text-slate-900">
                  {groupName || 'WhatsApp Project Group'}
                </h4>
                <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-full font-bold text-[10px] uppercase tracking-wider">
                  Group Purpose Only
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                All milestone & progress updates are routed directly to this group. 1-to-1 individual messaging is removed.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-stretch sm:self-auto">
            {botStatus.isConnected ? (
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setIsQrModalOpen(true)}
                  className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 rounded-xl font-bold flex items-center gap-1.5 text-xs shadow-xs transition-all cursor-pointer"
                  title="Click to view connected bot status or change number"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>Web Bot Linked (+{botStatus.botPhoneNumber || 'Device'})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsQrModalOpen(true)}
                  className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-800 rounded-xl font-bold flex items-center gap-1.5 text-xs shadow-xs transition-all cursor-pointer"
                  title="Change the linked phone number"
                >
                  <PhoneCall className="w-3.5 h-3.5 text-amber-600" />
                  <span>Change Number</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsQrModalOpen(true)}
                className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-bold flex items-center gap-1.5 text-xs shadow-sm transition-all active:scale-95 shrink-0"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Link WhatsApp Bot (QR Code)</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleSendToGroup}
              disabled={loading || sendingTest}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center gap-1.5 text-xs shadow-md shadow-emerald-600/30 transition-all active:scale-95 shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{sendingTest ? 'Dispatching...' : 'Send Update to Group'}</span>
            </button>
          </div>
        </div>

        {/* Group Metadata Details */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-emerald-100 text-xs">
          <div className="bg-white/80 p-2.5 rounded-xl border border-slate-200">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Target WhatsApp Group</span>
            <strong className="text-slate-800 truncate block mt-0.5">{groupName || 'Connected Group'}</strong>
          </div>
          <div className="bg-white/80 p-2.5 rounded-xl border border-slate-200">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Invite Link</span>
            <span className="text-slate-600 font-mono text-[11px] truncate block mt-0.5">
              {whatsapp.inviteLink || 'No link configured'}
            </span>
          </div>
          <div className="bg-white/80 p-2.5 rounded-xl border border-slate-200">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">WATI Group Bot</span>
            <span className="text-emerald-700 font-bold block mt-0.5">
              {botPhoneNumber || '+91 93848 20316'}
            </span>
          </div>
        </div>
      </div>

      {/* Message History Stream Header & Toggle */}
      <div className="pt-2 border-t border-slate-100">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-500" />
            <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
              Message History & Job Tracking ({messages.length})
            </h4>
          </div>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="text-xs text-sky-700 hover:text-sky-900 font-bold"
          >
            {showHistory ? 'Hide History' : 'Show History'}
          </button>
        </div>

        {/* Message Log Table */}
        {showHistory && (
          <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-inner">
            {messagesLoading ? (
              <div className="p-8 text-center text-xs text-slate-500">Loading message log stream...</div>
            ) : messages.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No message records found for this project yet. Scheduled updates will be recorded here automatically.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-400 uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-4 font-bold">Scheduled / Dispatched</th>
                      <th className="py-2.5 px-4 font-bold">Message Content</th>
                      <th className="py-2.5 px-4 font-bold">Status</th>
                      <th className="py-2.5 px-4 font-bold">Attempts</th>
                      <th className="py-2.5 px-4 font-bold">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {messages.map((m: any) => {
                      const text = m.messageText || m.messageContent || '';
                      const logStatus = m.status;
                      const date = m.sentAt || m.scheduledAt || m.createdAt;
                      const isRetryable = logStatus === 'FAILED' || logStatus === 'AWAITING_PROVIDER_CAPABILITY';

                      return (
                        <tr key={m._id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3 px-4 text-slate-600 whitespace-nowrap text-[11px] font-mono">
                            {date ? new Date(date).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                          </td>
                          <td className="py-3 px-4 max-w-md">
                            <p className="line-clamp-2 text-slate-800 text-[11px] leading-relaxed">
                              {text}
                            </p>
                            {m.lastError && (
                              <span className="text-[10px] text-rose-500 block mt-0.5 truncate" title={m.lastError}>
                                Error: {m.lastError}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            {getLogStatusBadge(logStatus)}
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                            {m.attemptCount ?? 1}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            {isRetryable && (
                              <button
                                onClick={() => handleRetryMessage(m._id)}
                                disabled={retryingId === m._id}
                                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1"
                              >
                                <RotateCcw className={`w-3 h-3 ${retryingId === m._id ? 'animate-spin' : ''}`} />
                                <span>Retry</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* CONNECT / LINK WHATSAPP GROUP MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-[#0F2744] text-white p-6 flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">Connect WhatsApp Project Group</h3>
                  <p className="text-[11px] text-slate-300">Alpha Elevators Automated Milestone Notifications</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-3 gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setModalTab('link');
                  setMetaErrorNotice(null);
                }}
                className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${
                  modalTab === 'link'
                    ? 'border-emerald-600 text-emerald-700 bg-white rounded-t-xl border-t border-x border-slate-200'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Link2 className="w-4 h-4 text-emerald-600" />
                <span>Link Existing WhatsApp Group</span>
                <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 text-[9px] rounded font-extrabold uppercase">
                  Recommended
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setModalTab('api');
                  setMetaErrorNotice(null);
                }}
                className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
                  modalTab === 'api'
                    ? 'border-emerald-600 text-emerald-700 bg-white rounded-t-xl border-t border-x border-slate-200'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Sparkles className="w-4 h-4 text-slate-500" />
                <span>Create via WATI API</span>
              </button>
            </div>

            <form onSubmit={handleCreateGroup} className="p-6 space-y-4 text-xs overflow-y-auto">
              {/* Meta 131000 Error Warning Banner */}
              {metaErrorNotice && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex flex-col gap-2 text-rose-900 animate-shake">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    <div className="flex-1 space-y-1">
                      <strong className="block text-xs font-bold text-rose-800">
                        Meta WhatsApp Cloud API Restriction (Error 131000)
                      </strong>
                      <p className="text-[11px] text-rose-700 leading-relaxed">
                        Meta restricts automated programmatic group creation on this WhatsApp Business Account. Meta requires special developer permissions to generate groups via code.
                      </p>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-rose-200/60 flex items-center justify-between">
                    <span className="text-[11px] text-rose-800 font-semibold">
                      Solution: Link your existing WhatsApp group directly via invite link.
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setModalTab('link');
                        setMetaErrorNotice(null);
                      }}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-sm"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                      <span>Switch to Link Group</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Customer Info Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                <div className="flex justify-between items-center text-slate-600">
                  <span>Customer:</span>
                  <strong className="text-slate-900">{customer?.fullName}</strong>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span>Phone Number (E.164):</span>
                  <strong className="font-mono text-emerald-700">{internationalPhone}</strong>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span>Consent Status:</span>
                  <span className="font-bold text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Consented
                  </span>
                </div>
              </div>

              {/* TAB 1: Link Existing Group */}
              {modalTab === 'link' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex items-start gap-2.5 text-emerald-950">
                    <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="text-[11px] leading-relaxed">
                      <strong>How to link in 10 seconds:</strong>
                      <ol className="list-decimal ml-4 mt-1 space-y-0.5 text-emerald-800">
                        <li>Create a WhatsApp group on your phone or WhatsApp Web with the customer.</li>
                        <li>In WhatsApp, tap <strong>Group Info → Invite via Link → Copy Link</strong>.</li>
                        <li>Paste the link below and click <strong>Link WhatsApp Group</strong>!</li>
                      </ol>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      WhatsApp Group Invite Link or Group ID: <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. https://chat.whatsapp.com/L41F98GcDxD... or Group ID"
                      value={groupInviteLink}
                      onChange={(e) => setGroupInviteLink(e.target.value)}
                      required={modalTab === 'link'}
                      className="w-full text-xs p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 font-mono text-slate-800 placeholder:font-sans placeholder:text-slate-400"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Group Display Name in CRM:
                    </label>
                    <input
                      type="text"
                      value={customGroupName}
                      onChange={(e) => setCustomGroupName(e.target.value)}
                      required
                      className="w-full text-xs p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 font-semibold text-slate-800"
                    />
                  </div>
                </div>
              )}

              {/* TAB 2: Create via WATI API */}
              {modalTab === 'api' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-2.5 text-amber-900">
                    <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="text-[11px] leading-relaxed">
                      <strong>Meta Cloud API Notice:</strong> Meta WhatsApp Cloud API restricts programmatic group creation unless Meta has granted your WhatsApp Business Account specialized Cloud API Groups permissions. If Meta returns error 131000, please use the <strong>Link Existing Group</strong> tab.
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      WhatsApp Group Name:
                    </label>
                    <input
                      type="text"
                      value={customGroupName}
                      onChange={(e) => setCustomGroupName(e.target.value)}
                      required={modalTab === 'api'}
                      className="w-full text-xs p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 font-semibold text-slate-800"
                    />
                  </div>

                  {/* Dry Run Toggle */}
                  <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-800 block text-[11px]">Dry-Run Simulation Mode</span>
                      <span className="text-[10px] text-slate-500 block">
                        Simulate group creation and cadence testing without invoking Meta Graph API
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={useDryRun}
                      onChange={(e) => setUseDryRun(e.target.checked)}
                      className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                    />
                  </div>
                </div>
              )}

              {/* Cadence Selection (common to both tabs) */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Automated Milestone Update Cadence:
                </label>
                <select
                  value={selectedInterval}
                  onChange={(e) => setSelectedInterval(e.target.value as any)}
                  className="w-full text-xs p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 font-semibold text-slate-800 bg-white"
                >
                  <option value="1">Every 1 Day (Daily Updates)</option>
                  <option value="10">Every 10 Days (Frequent Updates)</option>
                  <option value="15">Every 15 Days (Recommended Standard)</option>
                  <option value="20">Every 20 Days (Extended Milestone Cycle)</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={creatingGroup}
                  className="px-4 py-2.5 border border-slate-300 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition-all text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingGroup}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-md shadow-emerald-700/20 active:scale-95 flex items-center gap-2 transition-all text-xs"
                >
                  {creatingGroup ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>{modalTab === 'link' ? 'Linking Group...' : 'Creating on WATI...'}</span>
                    </>
                  ) : (
                    <>
                      {modalTab === 'link' ? <Link2 className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                      <span>{modalTab === 'link' ? 'Link WhatsApp Group' : 'Create via WATI API'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PREVIEW & TEST DISPATCH MODAL */}
      {isPreviewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-[#0F2744] text-white p-6 flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-300">
                  <Eye className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">Preview Scheduled WhatsApp Update</h3>
                  <p className="text-[11px] text-slate-300">Interpolated with verified project attributes</p>
                </div>
              </div>
              <button
                onClick={() => setIsPreviewModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs overflow-y-auto flex-1">
              {previewLoading ? (
                <div className="p-8 text-center text-slate-500">Generating live preview...</div>
              ) : previewData ? (
                <>
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                    <div className="flex justify-between text-slate-600">
                      <span>Target WhatsApp Group:</span>
                      <strong className="text-slate-900 font-mono">{previewData.targetGroupId}</strong>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Next Scheduled Date:</span>
                      <strong className="text-sky-700">
                        {previewData.nextScheduledAt ? new Date(previewData.nextScheduledAt).toDateString() : 'Immediate'}
                      </strong>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Next Milestone:</span>
                      <span className="font-semibold text-amber-800">{previewData.nextMilestone}</span>
                    </div>
                  </div>

                  {/* WhatsApp Group Exclusive Target Banner */}
                  <div className="p-3.5 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-200/90 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-emerald-600/30">
                        <MessageSquare className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-extrabold text-emerald-950">Target Destination:</span>
                          <span className="px-2 py-0.5 bg-white border border-emerald-300 text-emerald-800 rounded font-bold text-xs uppercase tracking-wider">
                            WhatsApp Group Only
                          </span>
                        </div>
                        <p className="text-[11px] text-emerald-800 mt-0.5">
                          Directly posts to: <strong>{groupName || 'Ashik residence WhatsApp group'}</strong>. Individual 1-to-1 messaging is removed.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Add Optional Note / Memo:
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={customNote}
                        onChange={(e) => setCustomNote(e.target.value)}
                        placeholder="e.g. Guide rails unloaded safely at basement."
                        className="flex-1 p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-sky-500"
                      />
                      <button
                        type="button"
                        onClick={handleRefreshPreviewWithNote}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold"
                      >
                        Apply
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Message Content (Verified Data):
                    </label>
                    <div className="p-4 bg-emerald-50/50 border border-emerald-200/80 rounded-2xl font-sans text-slate-800 whitespace-pre-line leading-relaxed text-[11px]">
                      {previewData.previewText}
                    </div>
                  </div>

                  {/* Meta Group Cloud Policy Notice */}
                  <div className="p-3.5 bg-amber-50/80 border border-amber-200/90 rounded-2xl text-[11px] text-amber-950 flex items-start gap-2.5">
                    <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <strong className="block font-bold text-amber-900">Why automated API messages cannot post directly to user-created groups:</strong>
                      <p className="text-amber-800 leading-relaxed text-[10.5px]">
                        Meta (WhatsApp) strictly restricts Cloud API bots from programmatically messaging inside consumer-created WhatsApp groups without an Official Business Account (Meta Blue Tick).
                      </p>
                      <p className="text-amber-900 font-semibold text-[10.5px] pt-0.5">
                        👉 Click <span className="text-emerald-700 underline font-bold">Post to WhatsApp Group</span> to copy update &amp; jump into the group in 1-click, or use <span className="text-slate-900 font-bold">Send 1-to-1 via API</span> to deliver directly to the customer.
                      </p>
                    </div>
                  </div>

                  {/* Dry Run Toggle for Test Send */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-slate-700">
                    <div>
                      <span className="font-bold text-[11px] block">Test in Dry-Run Mode</span>
                      <span className="text-[10px] text-slate-500 block">
                        Record message log in database without sending out to WATI network
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={testDryRun}
                      onChange={(e) => setTestDryRun(e.target.checked)}
                      className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                    />
                  </div>
                </>
              ) : null}
            </div>

            {/* Pinned Footer with Action Buttons */}
            {previewData && (
              <div className="p-4 px-6 bg-slate-50/90 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (!previewData?.previewText) return;
                      navigator.clipboard.writeText(previewData.previewText);
                      toast.success('Update text copied to clipboard!');
                    }}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all text-xs"
                    title="Copy update message text to clipboard"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Text</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleShareToWhatsApp}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all text-xs"
                    title="Share pre-filled update via WhatsApp Web"
                  >
                    <Share2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Share on WhatsApp</span>
                  </button>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPreviewModalOpen(false)}
                    disabled={sendingTest}
                    className="px-3.5 py-2 border border-slate-300 text-slate-700 rounded-xl font-bold hover:bg-white text-xs"
                  >
                    Close
                  </button>

                  <button
                    type="button"
                    onClick={handleSendToGroup}
                    disabled={sendingTest}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-md shadow-emerald-600/30 active:scale-95 flex items-center gap-1.5 transition-all text-xs"
                    title="Copy update and open WhatsApp Group"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{sendingTest ? 'Opening WhatsApp Group...' : 'Send to WhatsApp Group'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* WhatsApp Web Bot Link / QR Code Modal */}
      {isQrModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-scale-in text-center space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
                  <QrCode className="w-4 h-4" />
                </div>
                <h3 className="font-extrabold text-slate-900 text-sm">Link WhatsApp Group Bot</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsQrModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Scan this QR code using WhatsApp on your phone (<strong>Settings &gt; Linked Devices &gt; Link a Device</strong>) to activate automatic inside-group posting with zero navigation.
            </p>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col items-center justify-center min-h-[260px]">
              {botStatus.isConnected ? (
                <div className="space-y-4 py-4 text-center w-full max-w-sm mx-auto">
                  <div className="w-14 h-14 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/30">
                    <Check className="w-7 h-7" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-slate-900 text-base">WhatsApp Web Bot Connected</h4>
                    <p className="text-sm font-black text-emerald-700 font-mono mt-1">
                      +{botStatus.botPhoneNumber || 'Linked Device'}
                    </p>
                    <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                      All drawing uploads, milestone stage transitions, and payment receipts are automatically dispatched inside your WhatsApp groups from this number.
                    </p>
                  </div>

                  <div className="pt-2 w-full max-w-xs mx-auto border-t border-slate-200">
                    <button
                      type="button"
                      onClick={async () => {
                        const confirmed = window.confirm(
                          `Do you want to unlink +${botStatus.botPhoneNumber || 'the current number'} and link a new phone number? This will disconnect the bot and show a fresh QR code to scan.`
                        );
                        if (!confirmed) return;
                        try {
                          setBotLoading(true);
                          await api.logoutWhatsAppBot();
                          toast.success('Bot unlinked. Generating fresh QR code for your new number...');
                          await fetchBotStatus();
                        } catch (err: any) {
                          toast.error(err.message || 'Failed to unlink bot');
                        } finally {
                          setBotLoading(false);
                        }
                      }}
                      disabled={botLoading}
                      className="w-full py-2.5 px-4 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-xs"
                    >
                      <LogOut className={`w-4 h-4 ${botLoading ? 'animate-spin' : ''}`} />
                      <span>{botLoading ? 'Disconnecting...' : 'Unlink & Change Phone Number'}</span>
                    </button>
                  </div>
                </div>
              ) : botStatus.qrCode ? (
                <div className="space-y-3">
                  <img
                    src={botStatus.qrCode}
                    alt="WhatsApp QR Code"
                    className="w-56 h-56 mx-auto rounded-xl shadow-md border border-white"
                  />
                  <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                    <span>Point your phone camera at the QR code</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 py-8">
                  <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <p className="text-xs text-slate-500">Generating WhatsApp QR code...</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={async () => {
                  try {
                    setBotLoading(true);
                    await api.initWhatsAppBot();
                    await fetchBotStatus();
                    toast.success('QR Code refreshed');
                  } catch (err: any) {
                    toast.error(err.message || 'Failed to refresh QR');
                  } finally {
                    setBotLoading(false);
                  }
                }}
                disabled={botLoading}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${botLoading ? 'animate-spin' : ''}`} />
                <span>Refresh QR</span>
              </button>

              <button
                type="button"
                onClick={() => setIsQrModalOpen(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
