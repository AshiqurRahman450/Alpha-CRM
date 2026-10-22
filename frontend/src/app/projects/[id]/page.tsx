'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Building2,
  Calendar,
  IndianRupee,
  MessageSquare,
  Send,
  Clock,
  Pause,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  FileText,
  User,
  MapPin,
  ExternalLink,
  ChevronLeft,
  Link2,
  Bell,
  Edit2,
  Trash2,
  Upload,
  Sparkles,
  Lock,
  Truck,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { api, getStoredUser } from '../../../lib/api';
import Timeline, { formatProjectStatus, STAGES_ORDER } from '../../../components/Timeline';
import SendUpdateModal from '../../../components/SendUpdateModal';
import PostponeModal from '../../../components/PostponeModal';
import RecordPaymentModal from '../../../components/RecordPaymentModal';
import EditPaymentModal from '../../../components/EditPaymentModal';
import EditScheduleModal from '../../../components/EditScheduleModal';
import WhatsAppGroupCard from '../../../components/WhatsAppGroupCard';
import RequestPaymentModal from '../../../components/RequestPaymentModal';

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [projectData, setProjectData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const isCrm = user?.role === 'CRM';
  const isAccountant = user?.role === 'ACCOUNTANT';

  // Modals
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [isPostponeModalOpen, setIsPostponeModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isEditPaymentModalOpen, setIsEditPaymentModalOpen] = useState(false);
  const [selectedPaymentToEdit, setSelectedPaymentToEdit] = useState<any>(null);
  const [isEditScheduleModalOpen, setIsEditScheduleModalOpen] = useState(false);
  const [isRequestPaymentModalOpen, setIsRequestPaymentModalOpen] = useState(false);
  const [requestLoading, setRequestLoading] = useState(false);

  const handleCancelPaymentRequest = async () => {
    if (!confirm('Are you sure you want to cancel the active payment collection request?')) return;
    try {
      setRequestLoading(true);
      await api.cancelProjectPaymentRequest(projectId);
      toast.success('Payment collection request cancelled');
      await fetchProject();
    } catch (err: any) {
      toast.error(err.message || 'Failed to cancel request');
    } finally {
      setRequestLoading(false);
    }
  };

  // Quick reply input
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  // Link group input
  const [linkingGroup, setLinkingGroup] = useState(false);
  const [newGroupId, setNewGroupId] = useState('');

  // Frequency changer
  const [frequencyDays, setFrequencyDays] = useState('20');

  // New Note
  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);

  // Drawing Upload
  const [uploadingDrawing, setUploadingDrawing] = useState(false);

  // Reminder Modal
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [reminderTitle, setReminderTitle] = useState('');
  const [reminderNotes, setReminderNotes] = useState('');
  const [reminderDueAt, setReminderDueAt] = useState('');
  const [creatingReminder, setCreatingReminder] = useState(false);
  const [sendingReceiptId, setSendingReceiptId] = useState<string | null>(null);

  const handleSendReceiptToGroup = async (paymentId: string) => {
    try {
      setSendingReceiptId(paymentId);
      const res = await api.sendPaymentReceiptToGroup(paymentId);
      toast.success(res?.message || 'Payment receipt sent directly to WhatsApp group!');
      await fetchProject();
    } catch (err: any) {
      toast.error(`Failed to send receipt to group: ${err.message}`);
    } finally {
      setSendingReceiptId(null);
    }
  };

  const fetchProject = async (isInitial = false) => {
    try {
      if (isInitial || !projectData) setLoading(true);
      setError(null);
      const res = await api.getProjectById(projectId);
      setProjectData(res.data);
      if (res.data?.project?.updateFrequencyDays) {
        setFrequencyDays(String(res.data.project.updateFrequencyDays));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch project details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const stored = getStoredUser();
    setUser(stored);
    api.getCurrentUser().then(res => {
      if (res?.user) setUser(res.user);
    }).catch(() => {});
    if (projectId) {
      fetchProject();
    }
  }, [projectId]);

  const handleStatusChange = async (newStatus: string, trackingNumber?: string) => {
    try {
      const res = await api.updateProjectStatus(projectId, newStatus, undefined, trackingNumber);
      if (res && res.groupMessageDispatched) {
        toast.success(
          trackingNumber
            ? `Stage updated to ${formatProjectStatus(newStatus)}! VRL Tracking No (${trackingNumber}) attached and WhatsApp update dispatched.`
            : `Stage updated to ${formatProjectStatus(newStatus)}! Automated WhatsApp update dispatched inside group.`
        );
      } else if (res && res.groupMessageError) {
        toast(`Stage updated to ${formatProjectStatus(newStatus)}, but WhatsApp note: ${res.groupMessageError}`, { icon: '⚠️' });
      } else {
        toast.success(`Stage updated to ${formatProjectStatus(newStatus)}.`);
      }
      if (res && res.bdmNotified) {
        toast.success('1-to-1 Approval notification dispatched to assigned BDM via WATI!');
      }
      await fetchProject();
    } catch (err: any) {
      toast.error(`Failed to update status: ${err.message}`);
    }
  };

  const handleDateChange = async (stageKey: string, type: 'scheduleDate' | 'executedDate', date: string) => {
    try {
      const scheduleDate = type === 'scheduleDate' ? date : undefined;
      const executedDate = type === 'executedDate' ? date : undefined;
      await api.updateProjectStageDates(projectId, stageKey, scheduleDate, executedDate);
      
      // Auto-advance to next stage if executed date is provided
      if (type === 'executedDate' && date) {
        const currentIndex = STAGES_ORDER.findIndex(s => s.key === stageKey);
        if (currentIndex !== -1 && currentIndex + 1 < STAGES_ORDER.length) {
          const nextStage = STAGES_ORDER[currentIndex + 1].key;
          await api.updateProjectStatus(projectId, nextStage, `Auto-advanced after completing ${stageKey}`);
        }
      }

      await fetchProject();
    } catch (err: any) {
      alert(`Failed to update date: ${err.message}`);
    }
  };

  const handleBulkDateChange = async (updates: { stageKey: string, scheduleDate?: string | null, executedDate?: string | null }[]) => {
    try {
      setLoading(true);
      await api.updateProjectStageDatesBulk(projectId, updates);
      await fetchProject();
    } catch (err: any) {
      alert(`Failed to bulk update dates: ${err.message}`);
      setLoading(false);
    }
  };

  const handleDrawingUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    try {
      setUploadingDrawing(true);
      const res = await api.uploadProjectDrawing(projectId, file);
      if (res && res.documentSentToGroup) {
        toast.success('Drawing & Cabin Design uploaded and automatically sent directly into the WhatsApp group!');
      } else if (res && res.documentSendError) {
        toast.success(`Drawing uploaded! (WhatsApp note: ${res.documentSendError})`);
      } else {
        toast.success(res?.message || 'Drawing uploaded successfully!');
      }
      await fetchProject();
    } catch (err: any) {
      toast.error(`Failed to upload drawing: ${err.message}`);
    } finally {
      setUploadingDrawing(false);
      e.target.value = '';
    }
  };

  const handleToggleAutomation = async () => {
    try {
      if (projectData?.project?.automationEnabled) {
        await api.pauseWhatsAppAutomation({ projectId });
      } else {
        await api.resumeWhatsAppAutomation({ projectId });
      }
      await fetchProject();
    } catch (err: any) {
      alert(`Error toggling automation: ${err.message}`);
    }
  };

  const handleFrequencyChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setFrequencyDays(val);
    try {
      await api.updateWhatsAppFrequency({ projectId, frequencyDays: Number(val) });
      await fetchProject();
    } catch (err: any) {
      alert(`Error changing frequency: ${err.message}`);
    }
  };

  const handleLinkGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupId.trim()) return;
    try {
      setLinkingGroup(true);
      await api.linkWhatsAppGroup({
        projectId,
        whatsappGroupId: newGroupId.trim(),
      });
      setNewGroupId('');
      await fetchProject();
    } catch (err: any) {
      alert(`Failed to link group: ${err.message}`);
    } finally {
      setLinkingGroup(false);
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    try {
      setSendingReply(true);
      await api.replyToWhatsApp({
        projectId,
        messageText: replyText.trim(),
      });
      setReplyText('');
      await fetchProject();
    } catch (err: any) {
      alert(`Failed to send reply: ${err.message}`);
    } finally {
      setSendingReply(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    try {
      setAddingNote(true);
      await api.addProjectNote(projectId, newNote.trim());
      setNewNote('');
      await fetchProject();
    } catch (err: any) {
      alert(`Failed to save note: ${err.message}`);
    } finally {
      setAddingNote(false);
    }
  };

  const handleCreateReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reminderTitle || !reminderDueAt) return;
    try {
      setCreatingReminder(true);
      await api.createReminder({
        title: reminderTitle,
        notes: reminderNotes,
        dueAt: new Date(reminderDueAt).toISOString(),
        relatedProjectId: projectId,
      });
      toast.success('Reminder created for this project!');
      setIsReminderModalOpen(false);
      setReminderTitle('');
      setReminderNotes('');
      setReminderDueAt('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create reminder');
    } finally {
      setCreatingReminder(false);
    }
  };

  const project = projectData?.project || (projectData?._id ? projectData : null);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-sky-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs font-semibold text-slate-500">Loading Alpha Elevators Project...</p>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-sm space-y-3">
        <p className="font-bold">{error || 'Project not found'}</p>
        <Link href="/projects" className="text-xs text-sky-600 font-semibold underline">
          &larr; Return to Projects
        </Link>
      </div>
    );
  }

  const { channel, payments = [], messages = [], activities = [] } = projectData?.project ? projectData : { channel: null, payments: [], messages: [], activities: [] };
  const customer = project.customerId || {};
  const paidPercent = Math.round(((project.totalPaid || 0) / project.orderValue) * 100);

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Navigation back */}
      <div className="flex items-center justify-between">
        <Link
          href="/projects"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back to Projects Directory</span>
        </Link>
        <div className="flex items-center gap-4">
          <button onClick={() => setIsReminderModalOpen(true)} className="flex items-center gap-2 text-xs font-bold text-amber-600 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg transition-colors border border-amber-200 shadow-sm">
            <Bell className="w-3.5 h-3.5" />
            Set Reminder
          </button>
          <span className="text-xs font-mono text-slate-400">Project Code: {project.projectId}</span>
        </div>
      </div>

      {/* MASTER HEADER (Matching Section 36 specification) */}
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-extrabold text-sky-600 bg-sky-50 px-2.5 py-1 rounded-lg border border-sky-200">
                {project.projectId}
              </span>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">{project.projectName}</h1>
            </div>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              <span>{project.siteAddress}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Status Badge */}
            <div className="px-4 py-2 bg-amber-50 text-amber-800 border border-amber-200 rounded-2xl text-xs font-black">
              STATUS: {formatProjectStatus(project.projectStatus)}
            </div>

            {/* Payment Badge */}
            <div className="px-4 py-2 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-2xl text-xs font-black">
              PAYMENT: {paidPercent}% Paid (₹{project.totalPaid?.toLocaleString('en-IN')})
            </div>

            {/* Expected Delivery Date */}
            <div className="px-4 py-2 bg-slate-100 text-slate-700 rounded-2xl text-xs font-bold">
              DELIVERY: {new Date(project.expectedDeliveryDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
            </div>

            {/* VRL Tracking Badge if available */}
            {(project.vrlLrNumber || project.trackingNumber) && (
              <div className="px-4 py-2 bg-sky-50 text-sky-800 border border-sky-200 rounded-2xl text-xs font-bold flex items-center gap-1.5 shadow-2xs">
                <Truck className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                <span>VRL: <strong className="font-mono">{project.vrlLrNumber || project.trackingNumber}</strong></span>
              </div>
            )}
          </div>
        </div>

        {/* Customer & Lift Specs Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
            <span className="text-slate-400 block text-[11px]">Elevator Model</span>
            <strong className="text-slate-900 text-sm">{project.liftModel}</strong>
            <span className="text-[10px] text-slate-500 block mt-0.5">{project.liftType}</span>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
            <span className="text-slate-400 block text-[11px]">Total Contract Value</span>
            <strong className="text-slate-900 text-sm">₹{project.orderValue?.toLocaleString('en-IN')}</strong>
            <span className="text-[10px] text-emerald-600 font-semibold block mt-0.5">
              Advance: ₹{project.advanceAmount?.toLocaleString('en-IN')} {project.advancePercentage ? `(${project.advancePercentage}%)` : ''}
            </span>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
            <span className="text-slate-400 block text-[11px]">Primary Customer</span>
            <strong className="text-slate-900 text-sm">{customer.fullName || 'Client'}</strong>
            <span className="text-[10px] text-slate-500 block mt-0.5">{customer.phoneNumber}</span>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
            <span className="text-slate-400 block text-[11px]">WhatsApp Opt-In</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className={`w-2 h-2 rounded-full ${customer.whatsappOptIn ? 'bg-emerald-500' : 'bg-rose-500'}`}
              ></span>
              <strong className={customer.whatsappOptIn ? 'text-emerald-700' : 'text-rose-700'}>
                {customer.whatsappOptIn ? 'Opt-In Enabled' : 'Opt-In Disabled'}
              </strong>
            </div>
            <span className="text-[10px] text-slate-400 block">Via Project Confirmation</span>
          </div>
        </div>
      </div>

      {/* SECTION 21: VISUAL PROJECT TIMELINE (Hidden for Accountant) */}
      {!isAccountant && (
        <Timeline 
          currentStatus={project.projectStatus} 
          onStatusChange={handleStatusChange} 
          isEditable={true} 
          stageDates={project.stageDates}
          onDateChange={handleDateChange}
          onBulkDateChange={handleBulkDateChange}
          currentUserRole={user?.role}
          customerCity={customer?.city}
          projectId={project._id}
          projectName={project.projectName}
          projectCode={project.projectId}
          customerName={customer?.fullName}
          customerPhone={customer?.phone}
          whatsappGroupName={project.whatsappGroupName || project.whatsapp?.groupName}
          vrlLrNumber={project.vrlLrNumber || project.trackingNumber}
          onHandoverDateChanged={async () => {
            await fetchProject(false);
          }}
          initiallyOpenInstallation={user?.role === 'TECHNICAL_LEAD'}
        />
      )}

      {/* BDM APPROVAL ALERT (Drawing and Cabin Design Approval) */}
      {!isAccountant && project.projectStatus === 'CUSTOMER_APPROVAL' && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/90 rounded-3xl p-5 md:p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 border border-amber-300">
                  Action Required
                </span>
                <h3 className="text-sm font-extrabold text-amber-950">
                  Drawing and Cabin Design Approval Active
                </h3>
              </div>
              <p className="text-xs text-amber-900">
                Assigned BDM: <strong>{project.bdmId?.name || customer?.bdmId?.name || 'BDM'}</strong>{' '}
                {project.bdmPhone || customer?.bdmPhone ? (
                  <span className="font-mono text-emerald-800 font-bold bg-white/70 px-1.5 py-0.5 rounded border border-amber-200">
                    +{String(project.bdmPhone || customer?.bdmPhone).replace(/\D/g, '')}
                  </span>
                ) : (
                  <span className="text-rose-600 font-medium">(No WhatsApp number assigned)</span>
                )}
              </p>
              <p className="text-[11px] text-amber-800/80 leading-relaxed">
                A 1-to-1 WhatsApp notification is automatically sent via WhatsApp Web Bot to the BDM to review and obtain customer design approval.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={async () => {
                try {
                  toast.loading('Sending 1:1 WhatsApp approval request to BDM via WhatsApp Bot...', { id: 'bdm-notify-btn' });
                  const res = await api.notifyBdmApproval(projectId);
                  toast.success(res?.message || '1:1 WhatsApp approval request sent to BDM via WhatsApp Bot!', { id: 'bdm-notify-btn' });
                } catch (err: any) {
                  toast.error(err.message || 'Failed to dispatch BDM approval message via WhatsApp Bot', { id: 'bdm-notify-btn' });
                }
              }}
              className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 flex items-center gap-2 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send BDM Approval Alert (1:1 Bot)</span>
            </button>
          </div>
        </div>
      )}

      {/* DRAWING UPLOAD CONTAINER (Visible if passed SITE_MEASUREMENT and user is not BDM or Accountant) */}
      {!isAccountant && user?.role !== 'BDM' && STAGES_ORDER.findIndex(s => s.key === project.projectStatus) >= 2 && (
        <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center space-x-3 border-b border-slate-100 pb-4">
            <div className="w-10 h-10 rounded-2xl bg-sky-100 text-sky-600 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Drawing and Cabin Design</h3>
              <p className="text-xs text-slate-500">Upload approved cabin drawings</p>
            </div>
          </div>
          
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            {project.drawingUrl ? (
              <div className="flex-1 p-5 bg-emerald-50 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3 text-emerald-800 text-sm font-bold">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <div className="font-extrabold text-emerald-950">Drawing & Cabin Design Uploaded</div>
                    <div className="text-xs font-medium text-emerald-700">Dispatched directly to WhatsApp Group</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}${project.drawingUrl}`} target="_blank" rel="noreferrer" className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm">
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>View Drawing</span>
                  </a>
                  <label htmlFor="drawingUpload" className={`cursor-pointer px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm ${uploadingDrawing ? 'opacity-50 pointer-events-none' : ''}`}>
                    <Upload className="w-3.5 h-3.5 text-slate-500" />
                    <span>{uploadingDrawing ? 'Uploading & Sending...' : 'Upload New & Send to Group'}</span>
                  </label>
                  <input 
                    type="file"
                    id="drawingUpload"
                    className="hidden"
                    onChange={handleDrawingUpload}
                    accept=".pdf,.jpg,.jpeg,.png,.dwg"
                    disabled={uploadingDrawing}
                  />
                </div>
              </div>
            ) : (
              <div className="flex-1 p-6 bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center text-center hover:bg-slate-100 transition-colors">
                <input 
                  type="file"
                  id="drawingUpload"
                  className="hidden"
                  onChange={handleDrawingUpload}
                  accept=".pdf,.jpg,.jpeg,.png,.dwg"
                  disabled={uploadingDrawing}
                />
                <label htmlFor="drawingUpload" className={`cursor-pointer flex flex-col items-center gap-2 ${uploadingDrawing ? 'opacity-50' : ''}`}>
                  <div className="w-12 h-12 rounded-full bg-sky-100 flex items-center justify-center text-sky-600 mb-2">
                    {uploadingDrawing ? (
                      <div className="w-5 h-5 border-2 border-sky-600 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <FileText className="w-6 h-6" />
                    )}
                  </div>
                  <span className="text-sm font-bold text-slate-800">
                    {uploadingDrawing ? 'Uploading & Sending to WhatsApp Group...' : 'Click to Upload Drawing & Cabin Design'}
                  </span>
                  <span className="text-xs text-slate-500">Auto-sends document directly to WhatsApp Group • PDF, JPG, PNG, or DWG</span>
                </label>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SECTION 36 & 8: WHATSAPP COMMUNICATION CARD (Hidden for Accountant & BDM) */}
      {!isAccountant && user?.role !== 'BDM' && (
        <WhatsAppGroupCard
          project={project}
          customer={customer}
          onRefresh={fetchProject}
        />
      )}

      {/* SECTION 7: PAYMENT MANAGEMENT & PROGRESS */}
      {user?.role !== 'BDM' && (
      <React.Fragment>
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-600 text-white flex items-center justify-center shadow-sm">
              <IndianRupee className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Payment Schedule & Collection</h3>
              <p className="text-xs text-slate-500">Milestone allocation, schedule configuration & collection entries</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {/* CRM / Admin / Manager: Request payment from Accountant */}
            {(isCrm || user?.role === 'ADMIN' || user?.role === 'MANAGER') && (
              <button
                onClick={() => setIsRequestPaymentModalOpen(true)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95 ${
                  project.paymentRequest?.status === 'REQUESTED'
                    ? 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300'
                    : 'bg-sky-600 hover:bg-sky-700 text-white'
                }`}
              >
                <Send className="w-3.5 h-3.5" />
                <span>
                  {project.paymentRequest?.status === 'REQUESTED'
                    ? 'Update Collection Request'
                    : 'Request Payment from Accountant'}
                </span>
              </button>
            )}

            {(!isCrm || isAccountant) && (
              <button
                onClick={() => setIsEditScheduleModalOpen(true)}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border border-slate-200"
              >
                <Calendar className="w-3.5 h-3.5 text-slate-600" />
                <span>Edit Schedule</span>
              </button>
            )}

            {/* Record Payment Button: Enabled for Accountant ONLY IF CRM requested */}
            {isAccountant ? (
              project.paymentRequest?.status === 'REQUESTED' ? (
                <button
                  onClick={() => setIsPaymentModalOpen(true)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 active:scale-95 ring-2 ring-emerald-400/30"
                  title="CRM has requested payment collection for this customer"
                >
                  <IndianRupee className="w-3.5 h-3.5" />
                  <span>Record Payment</span>
                </button>
              ) : (
                <button
                  disabled
                  className="px-4 py-2 bg-slate-100 text-slate-400 rounded-xl text-xs font-bold transition-all border border-slate-200 flex items-center gap-1.5 cursor-not-allowed opacity-75"
                  title="Payment recording is restricted. CRM must request payment collection for this customer before you can record payment."
                >
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Record Payment (Awaiting CRM)</span>
                </button>
              )
            ) : (
              <button
                onClick={() => setIsPaymentModalOpen(true)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 active:scale-95"
              >
                <IndianRupee className="w-3.5 h-3.5" />
                <span>Record Payment</span>
              </button>
            )}
          </div>
        </div>

        {/* Active CRM Request Notification Banner */}
        {project.paymentRequest?.status === 'REQUESTED' && (
          <div className="bg-gradient-to-r from-amber-50 via-orange-50/60 to-amber-100/50 border border-amber-200 rounded-2xl p-4.5 flex flex-col md:flex-row md:items-center justify-between gap-4 text-amber-950 shadow-sm animate-fade-in">
            <div className="flex items-start md:items-center gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                <Bell className="w-5 h-5 animate-bounce" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-amber-200/90 text-amber-900 border border-amber-300">
                    CRM Payment Request
                  </span>
                  <span className="text-xs font-extrabold text-amber-900 font-mono">
                    ₹{(project.paymentRequest.requestedAmount || 0).toLocaleString('en-IN')}
                  </span>
                  <span className="text-xs font-semibold text-amber-800">
                    ({project.paymentRequest.paymentType || 'Milestone'})
                  </span>
                </div>
                <p className="text-xs text-amber-800">
                  Requested by <strong className="font-bold text-amber-950">{project.paymentRequest.requestedBy || 'CRM'}</strong>
                  {project.paymentRequest.requestedAt && (
                    <span> on {new Date(project.paymentRequest.requestedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  )}
                </p>
                {project.paymentRequest.notes && (
                  <p className="text-[11px] text-amber-900 bg-white/80 px-3 py-1 rounded-xl border border-amber-200/60 italic mt-1">
                    &ldquo;{project.paymentRequest.notes}&rdquo;
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {isAccountant ? (
                <button
                  onClick={() => setIsPaymentModalOpen(true)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold transition-all shadow-md flex items-center gap-1.5 active:scale-95"
                >
                  <IndianRupee className="w-4 h-4" />
                  <span>Record This Payment</span>
                </button>
              ) : (isCrm || user?.role === 'ADMIN' || user?.role === 'MANAGER') ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsRequestPaymentModalOpen(true)}
                    className="px-3 py-1.5 bg-amber-200/80 hover:bg-amber-200 text-amber-900 rounded-xl text-xs font-bold transition-all border border-amber-300"
                  >
                    Modify
                  </button>
                  <button
                    onClick={handleCancelPaymentRequest}
                    disabled={requestLoading}
                    className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold transition-all border border-rose-200"
                  >
                    {requestLoading ? 'Cancelling...' : 'Cancel Request'}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* Accountant Restriction Notice if no request */}
        {isAccountant && project.paymentRequest?.status !== 'REQUESTED' && (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between gap-3 text-slate-700 text-xs">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-slate-200/80 text-slate-600 flex items-center justify-center shrink-0">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-slate-800 block">Payment Recording Locked for Accountant</span>
                <span className="text-[11px] text-slate-500">
                  CRM must request payment collection from this customer&apos;s Payment Schedule before you can record payment and dispatch receipts.
                </span>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-200/80 text-slate-600 uppercase tracking-wide shrink-0">
              Awaiting CRM Request
            </span>
          </div>
        )}

        {/* Milestone Schedule Cards */}
        {(() => {
          const milestones = [
            { label: 'Booking Advance', pct: project.advancePercentage || 30 },
            { label: 'Production', pct: project.productionPaymentPercent || 0 },
            { label: 'Readiness', pct: project.readinessNotificationPercent || 0 },
            ...((Number(project.dispatchMaterialsPercent) > 0 || !isCrm) ? [
              { label: 'Dispatch', pct: project.dispatchMaterialsPercent || 0 },
            ] : []),
            ...((Number(project.afterInstallationPercent) > 0 || !isCrm) ? [
              { label: 'Installation', pct: project.afterInstallationPercent || 0 },
            ] : []),
          ];

          const gridColsClass =
            milestones.length >= 5
              ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'
              : milestones.length === 4
              ? 'grid-cols-2 sm:grid-cols-4'
              : 'grid-cols-1 sm:grid-cols-3';

          return (
            <div className={`grid gap-3 ${gridColsClass}`}>
              {milestones.map((m, idx) => {
                const milestoneAmt = Math.round(((project.orderValue || 0) * m.pct) / 100);
                return (
                  <div key={idx} className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-3 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">{m.label}</span>
                        <span className="text-[11px] font-extrabold text-slate-700 bg-white px-1.5 py-0.5 rounded-md border border-slate-200/60">{m.pct}%</span>
                      </div>
                      <div className="text-xs font-bold text-slate-900">
                        ₹{milestoneAmt.toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* Visual Payment Progress Bar */}
        <div className="space-y-2 pt-1">
          <div className="flex justify-between text-xs font-semibold">
            <span className="text-slate-600">Total Collected: ₹{project.totalPaid?.toLocaleString('en-IN')}</span>
            <span className="text-rose-600">Remaining Balance: ₹{project.balanceAmount?.toLocaleString('en-IN')}</span>
          </div>
          <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden border border-slate-200">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, paidPercent)}%` }}
            />
          </div>
        </div>

        {/* Payments Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 uppercase text-[10px]">
                <th className="pb-2.5 font-bold">Date</th>
                <th className="pb-2.5 font-bold">Type</th>
                <th className="pb-2.5 font-bold">Method</th>
                <th className="pb-2.5 font-bold">Reference</th>
                <th className="pb-2.5 font-bold">Amount Paid</th>
                <th className="pb-2.5 font-bold">Status</th>
                <th className="pb-2.5 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-400">
                    No payment records found. Click &quot;Record Payment&quot; to add one.
                  </td>
                </tr>
              ) : (
                payments.map((p: any) => (
                  <tr key={p._id} className="text-slate-700 hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 font-medium">
                      {new Date(p.paymentDate).toLocaleDateString('en-GB')}
                    </td>
                    <td className="py-3 font-semibold text-slate-900">{p.paymentType}</td>
                    <td className="py-3">{p.paymentMethod}</td>
                    <td className="py-3 font-mono text-[11px] text-slate-500">{p.transactionReference}</td>
                    <td className="py-3 font-bold text-emerald-700">₹{p.amountPaid?.toLocaleString('en-IN')}</td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        p.paymentStatus === 'SUCCESS'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : p.paymentStatus === 'FAILED'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {p.paymentStatus}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {(!isCrm || isAccountant) && (
                          <button
                            onClick={() => {
                              setSelectedPaymentToEdit(p);
                              setIsEditPaymentModalOpen(true);
                            }}
                            className="px-2.5 py-1 bg-white hover:bg-amber-50 hover:text-amber-700 text-slate-700 rounded-lg text-xs font-bold transition-all flex items-center gap-1 border border-slate-200 shadow-sm"
                            title="Edit recorded amount and payment details"
                          >
                            <Edit2 className="w-3 h-3 text-amber-600" />
                            <span>Edit</span>
                          </button>
                        )}
                        <Link
                          href={`/projects/${projectId}/invoice/${p._id}`}
                          className="p-1 hover:bg-sky-50 hover:text-sky-600 text-slate-400 rounded-lg transition-colors border border-transparent hover:border-sky-200"
                          title="View Receipt"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 8: RECEIPTS VIEW */}
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Generated Receipts</h3>
              <p className="text-xs text-slate-500">View and print invoices for all recorded payments</p>
            </div>
          </div>
        </div>

        {payments.length === 0 ? (
          <div className="text-center p-6 text-slate-400 text-xs">No receipts generated yet.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {payments.map((p: any) => (
              <div key={`receipt-${p._id}`} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col justify-between hover:shadow-md transition-all">
                <div className="mb-4">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{p.paymentType}</span>
                    <span className="text-xs font-bold text-slate-800">{new Date(p.paymentDate).toLocaleDateString('en-GB')}</span>
                  </div>
                  <h4 className="text-lg font-black text-emerald-600">₹{p.amountPaid?.toLocaleString('en-IN')}</h4>
                  <p className="text-[11px] text-slate-500 mt-1 font-mono">Ref: {p.transactionReference}</p>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-[11px] text-slate-500 font-mono">Receipt: {p.receiptNumber || 'N/A'}</p>
                    {p.receiptUrl && (
                      <a
                        href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}${p.receiptUrl}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-sky-600 hover:text-sky-800 font-bold flex items-center gap-0.5"
                      >
                        <ExternalLink className="w-2.5 h-2.5" />
                        <span>PDF</span>
                      </a>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    {(!isCrm || isAccountant) && (
                      <button
                        onClick={() => {
                          setSelectedPaymentToEdit(p);
                          setIsEditPaymentModalOpen(true);
                        }}
                        className="py-2 px-3 bg-white border border-slate-300 hover:border-amber-500 hover:text-amber-600 rounded-xl text-xs font-bold text-slate-700 transition-colors flex items-center justify-center gap-1 shadow-sm"
                        title="Edit payment amount"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-amber-600" />
                        <span>Edit</span>
                      </button>
                    )}
                    <Link
                      href={`/projects/${projectId}/invoice/${p._id}`}
                      className="flex-1 py-2 bg-white border border-slate-300 hover:border-sky-500 hover:text-sky-600 rounded-xl text-xs font-bold text-slate-700 transition-colors flex items-center justify-center gap-2 shadow-sm"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>View Receipt</span>
                    </Link>
                  </div>
                  <button
                    onClick={() => handleSendReceiptToGroup(p._id)}
                    disabled={sendingReceiptId === p._id}
                    className="w-full py-2 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
                    title="Send official receipt document directly to WhatsApp Group"
                  >
                    <Send className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{sendingReceiptId === p._id ? 'Dispatching to Group...' : 'Send Receipt to WhatsApp Group'}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      </React.Fragment>
      )}

      {/* SECTION 22: PROJECT ACTIVITY LOG & NOTES (Hidden for Accountant & BDM) */}
      {!isAccountant && user?.role !== 'BDM' && (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Customer Notes */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <FileText className="w-4 h-4 text-sky-600" />
            <span>Customer & Site Notes</span>
          </h3>

          <form onSubmit={handleAddNote} className="space-y-2">
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Add internal engineer/CRM memo..."
              rows={2}
              className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={addingNote || !newNote.trim()}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50"
            >
              {addingNote ? 'Saving...' : 'Add Note'}
            </button>
          </form>

          {project.notes && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700">
              <strong className="block text-[11px] text-slate-500 mb-1">Project Note:</strong>
              {project.notes}
            </div>
          )}
        </div>

        {/* Activity Log */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <Clock className="w-4 h-4 text-emerald-600" />
            <span>Project Activity History ({activities.length})</span>
          </h3>

          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
            {activities.map((act: any) => (
              <div key={act._id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 text-xs space-y-1">
                <div className="flex items-center justify-between text-[10px] text-slate-500">
                  <span className="font-bold text-slate-700">{act.type}</span>
                  <span>{new Date(act.createdAt).toLocaleString('en-GB')}</span>
                </div>
                <p className="text-slate-800 text-[11px] leading-relaxed">{act.description}</p>
                <div className="text-[10px] text-slate-400">By {act.userName || 'System'}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      )}

      {/* Modals */}
      {isSendModalOpen && (
        <SendUpdateModal
          isOpen={isSendModalOpen}
          onClose={() => setIsSendModalOpen(false)}
          project={project}
          onSuccess={fetchProject}
        />
      )}

      {isPostponeModalOpen && (
        <PostponeModal
          isOpen={isPostponeModalOpen}
          onClose={() => setIsPostponeModalOpen(false)}
          project={project}
          onSuccess={fetchProject}
        />
      )}

      {isPaymentModalOpen && (
        <RecordPaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          project={project}
          onSuccess={(paymentData) => {
            fetchProject();
          }}
        />
      )}

      {isEditPaymentModalOpen && selectedPaymentToEdit && (
        <EditPaymentModal
          isOpen={isEditPaymentModalOpen}
          onClose={() => {
            setIsEditPaymentModalOpen(false);
            setSelectedPaymentToEdit(null);
          }}
          payment={selectedPaymentToEdit}
          project={project}
          onSuccess={() => {
            fetchProject();
          }}
        />
      )}

      {isEditScheduleModalOpen && (
        <EditScheduleModal
          isOpen={isEditScheduleModalOpen}
          onClose={() => setIsEditScheduleModalOpen(false)}
          project={project}
          onSuccess={() => {
            fetchProject();
          }}
        />
      )}

      {/* SET REMINDER MODAL */}
      {isReminderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200">
            <h3 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2">
              <Bell className="w-6 h-6 text-amber-500" />
              Set Project Reminder
            </h3>
            
            <form onSubmit={handleCreateReminder} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Reminder Title *
                </label>
                <input 
                  type="text" 
                  required
                  value={reminderTitle}
                  onChange={(e) => setReminderTitle(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none transition-all font-medium text-slate-900"
                  placeholder="e.g. Call client for dispatch approval"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Date & Time *
                </label>
                <input 
                  type="datetime-local" 
                  required
                  value={reminderDueAt}
                  onChange={(e) => setReminderDueAt(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none transition-all font-medium text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Notes (Optional)
                </label>
                <textarea 
                  value={reminderNotes}
                  onChange={(e) => setReminderNotes(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none transition-all font-medium text-slate-900 resize-none h-24"
                  placeholder="Additional context for this reminder..."
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsReminderModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingReminder}
                  className="px-5 py-2.5 rounded-xl font-bold text-white bg-slate-900 hover:bg-slate-800 transition-colors disabled:opacity-50"
                >
                  {creatingReminder ? 'Saving...' : 'Save Reminder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CRM Request Payment from Accountant Modal */}
      <RequestPaymentModal
        isOpen={isRequestPaymentModalOpen}
        onClose={() => setIsRequestPaymentModalOpen(false)}
        project={project}
        onSuccess={fetchProject}
      />
    </div>
  );
}
