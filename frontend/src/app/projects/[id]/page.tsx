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
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { api, getStoredUser } from '../../../lib/api';
import Timeline, { formatProjectStatus, STAGES_ORDER } from '../../../components/Timeline';
import SendUpdateModal from '../../../components/SendUpdateModal';
import PostponeModal from '../../../components/PostponeModal';
import RecordPaymentModal from '../../../components/RecordPaymentModal';

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [projectData, setProjectData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  // Modals
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [isPostponeModalOpen, setIsPostponeModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

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

  const fetchProject = async () => {
    try {
      setLoading(true);
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
    setUser(getStoredUser());
    if (projectId) {
      fetchProject();
    }
  }, [projectId]);

  const handleStatusChange = async (newStatus: string) => {
    try {
      await api.updateProjectStatus(projectId, newStatus);
      await fetchProject();
    } catch (err: any) {
      alert(`Failed to update status: ${err.message}`);
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
      await api.uploadProjectDrawing(projectId, file);
      await fetchProject();
    } catch (err: any) {
      alert(`Failed to upload drawing: ${err.message}`);
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

  if (error || !projectData?.project) {
    return (
      <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-sm space-y-3">
        <p className="font-bold">{error || 'Project not found'}</p>
        <Link href="/projects" className="text-xs text-sky-600 font-semibold underline">
          &larr; Return to Projects
        </Link>
      </div>
    );
  }

  const { project, channel, payments = [], messages = [], activities = [] } = projectData;
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
              Advance 30%: ₹{project.advanceAmount?.toLocaleString('en-IN')}
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

      {/* SECTION 21: VISUAL PROJECT TIMELINE */}
      <Timeline 
        currentStatus={project.projectStatus} 
        onStatusChange={handleStatusChange} 
        isEditable={true} 
        stageDates={project.stageDates}
        onDateChange={handleDateChange}
        onBulkDateChange={handleBulkDateChange}
        currentUserRole={user?.role}
        customerCity={customer.city}
      />

      {/* DRAWING UPLOAD CONTAINER (Visible if passed SITE_MEASUREMENT and user is not BDM) */}
      {user?.role !== 'BDM' && STAGES_ORDER.findIndex(s => s.key === project.projectStatus) >= 2 && (
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
              <div className="flex-1 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3 text-emerald-800 text-sm font-bold">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span>Drawing Uploaded Successfully</span>
                </div>
                <a href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}${project.drawingUrl}`} target="_blank" rel="noreferrer" className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5">
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>View Drawing</span>
                </a>
              </div>
            ) : (
              <div className="flex-1 p-6 bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center text-center hover:bg-slate-100 transition-colors">
                <input 
                  type="file"
                  id="drawingUpload"
                  className="hidden"
                  onChange={handleDrawingUpload}
                  accept=".pdf,.jpg,.jpeg,.png"
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
                    {uploadingDrawing ? 'Uploading...' : 'Click to Upload Drawing'}
                  </span>
                  <span className="text-xs text-slate-500">PDF, JPG, or PNG</span>
                </label>
              </div>
            )}
          </div>
        </div>
      )}
      {/* SECTION 36 & 8: WHATSAPP COMMUNICATION CARD */}
      {user?.role !== 'BDM' && (
      <React.Fragment>
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Dedicated WhatsApp Communication Group</h3>
              <p className="text-xs text-slate-500">Official Meta WhatsApp Business Cloud API Group Channel</p>
            </div>
          </div>

          {/* Action Buttons from Section 12 */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsSendModalOpen(true)}
              disabled={!project.whatsappGroupId || !customer.whatsappOptIn}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send Update Now</span>
            </button>

            <button
              onClick={() => setIsPostponeModalOpen(true)}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Postpone</span>
            </button>

            <button
              onClick={handleToggleAutomation}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                project.automationEnabled
                  ? 'bg-slate-200 text-slate-800 hover:bg-slate-300'
                  : 'bg-sky-600 text-white hover:bg-sky-700'
              }`}
            >
              {project.automationEnabled ? (
                <>
                  <Pause className="w-3.5 h-3.5" />
                  <span>Pause Automation</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  <span>Resume Automation</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* WhatsApp Group Parameters & Link Status */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
            <span className="text-slate-400 block">WhatsApp Group Name</span>
            <strong className="text-slate-900 text-sm block mt-0.5 truncate">
              {project.whatsappGroupName || 'Not Assigned'}
            </strong>
            <span className="text-[10px] text-slate-500 font-mono mt-1 block">
              ID: {project.whatsappGroupId || 'Missing'}
            </span>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
            <span className="text-slate-400 block">Automation Status</span>
            <div className="flex items-center gap-1.5 mt-1">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  project.automationEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                }`}
              ></span>
              <strong className="text-slate-900 text-sm">
                {project.automationEnabled ? 'ACTIVE (ON)' : 'PAUSED (OFF)'}
              </strong>
            </div>
            {project.pauseReason && (
              <span className="text-[10px] text-rose-500 block mt-1">{project.pauseReason}</span>
            )}
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
            <span className="text-slate-400 block">Update Cadence / Frequency</span>
            <div className="mt-1 flex items-center gap-2">
              <select
                value={frequencyDays}
                onChange={handleFrequencyChange}
                className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                <option value="10">10 Days</option>
                <option value="15">15 Days</option>
                <option value="20">20 Days (Default)</option>
                <option value="30">30 Days</option>
              </select>
            </div>
            <span className="text-[10px] text-slate-400 block mt-1">Auto-dispatched at 09:00 AM</span>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
            <span className="text-slate-400 block">Next Scheduled Update</span>
            <strong className="text-sky-700 text-sm block mt-0.5 font-bold">
              {project.nextUpdateAt
                ? new Date(project.nextUpdateAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                : 'Not Scheduled'}
            </strong>
            <span className="text-[10px] text-slate-500 block mt-1">
              Last Sent: {project.lastUpdateAt ? new Date(project.lastUpdateAt).toLocaleDateString('en-GB') : 'None'}
            </span>
          </div>
        </div>

        {/* If group is not linked yet, show Linking Form (Section 38 & 39) */}
        {!project.whatsappGroupId && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 text-amber-900">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
              <span>
                <strong>WhatsApp group not linked.</strong> Automatic group messaging is disabled until a unique WhatsApp Group ID is linked.
              </span>
            </div>
            <form onSubmit={handleLinkGroup} className="flex items-center gap-2 w-full md:w-auto">
              <input
                type="text"
                placeholder="e.g. GROUP_KUMAR_01"
                value={newGroupId}
                onChange={(e) => setNewGroupId(e.target.value)}
                className="px-3 py-1.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={linkingGroup}
                className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold"
              >
                {linkingGroup ? 'Linking...' : 'Link Group'}
              </button>
            </form>
          </div>
        )}

        {/* INTERACTIVE MESSAGE HISTORY & INCOMING REPLIES (Section 16 & 17) */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/50">
          <div className="p-4 bg-slate-100/80 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <MessageSquare className="w-4 h-4 text-emerald-600" />
              <h4 className="text-xs font-bold text-slate-800">
                Live WhatsApp Group Stream ({messages.length} Messages)
              </h4>
            </div>
            <span className="text-[11px] text-slate-500 font-medium">
              Synchronized via Meta Webhook
            </span>
          </div>

          <div className="p-5 max-h-[420px] overflow-y-auto space-y-4 bg-[#EFEAE2]/30">
            {messages.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No WhatsApp messages sent or received yet for this project.
              </div>
            ) : (
              messages.map((msg: any) => {
                const isIncoming = msg.direction === 'INCOMING';
                return (
                  <div
                    key={msg._id}
                    className={`flex flex-col ${isIncoming ? 'items-start' : 'items-end'}`}
                  >
                    <div
                      className={`max-w-lg p-3.5 rounded-2xl text-xs shadow-sm space-y-1.5 ${
                        isIncoming
                          ? 'bg-white text-slate-900 border border-slate-200 rounded-tl-none'
                          : 'bg-[#DCF8C6] text-slate-900 border border-emerald-200 rounded-tr-none'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4 text-[10px] text-slate-500 border-b border-black/5 pb-1 font-semibold">
                        <span>{isIncoming ? `Customer: ${msg.senderName}` : 'Alpha Elevators Bot'}</span>
                        <span>
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <p className="whitespace-pre-line text-xs text-slate-800 leading-relaxed font-sans">
                        {msg.messageContent}
                      </p>

                      <div className="flex items-center justify-between pt-1 text-[10px] text-slate-500">
                        {msg.templateName && (
                          <span className="font-mono text-emerald-800 font-bold">
                            [{msg.templateName}]
                          </span>
                        )}
                        <span className="font-bold flex items-center gap-1">
                          {msg.status === 'READ' ? (
                            <span className="text-sky-600">✓✓ Read</span>
                          ) : msg.status === 'DELIVERED' ? (
                            <span className="text-slate-600">✓✓ Delivered</span>
                          ) : msg.status === 'SENT' ? (
                            <span className="text-slate-500">✓ Sent</span>
                          ) : (
                            <span className="text-rose-600">⚠ {msg.status}</span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Quick Reply Form (Section 16) */}
          <form onSubmit={handleSendReply} className="p-3 bg-white border-t border-slate-200 flex items-center gap-2">
            <input
              type="text"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Type message or reply to customer in WhatsApp group..."
              className="flex-1 text-xs p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={sendingReply || !project.whatsappGroupId}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{sendingReply ? 'Sending...' : 'Reply'}</span>
            </button>
          </form>
        </div>
      </div>

      {/* SECTION 7: PAYMENT MANAGEMENT & PROGRESS */}
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-600 text-white flex items-center justify-center">
              <IndianRupee className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Payment Schedule & Collection</h3>
              <p className="text-xs text-slate-500">30% advance confirmation + milestone tracking</p>
            </div>
          </div>
          <button
            onClick={() => setIsPaymentModalOpen(true)}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
          >
            <IndianRupee className="w-3.5 h-3.5" />
            <span>Record Payment</span>
          </button>
        </div>

        {/* Visual Payment Progress Bar */}
        <div className="space-y-2">
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
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payments.map((p: any) => (
                <tr key={p._id} className="text-slate-700">
                  <td className="py-3 font-medium">
                    {new Date(p.paymentDate).toLocaleDateString('en-GB')}
                  </td>
                  <td className="py-3 font-semibold text-slate-900">{p.paymentType}</td>
                  <td className="py-3">{p.paymentMethod}</td>
                  <td className="py-3 font-mono text-[11px] text-slate-500">{p.transactionReference}</td>
                  <td className="py-3 font-bold text-emerald-700">₹{p.amountPaid?.toLocaleString('en-IN')}</td>
                  <td className="py-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {p.paymentStatus}
                    </span>
                  </td>
                </tr>
              ))}
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
                  <p className="text-[11px] text-slate-500 font-mono">Receipt: {p.receiptNumber || 'N/A'}</p>
                </div>
                <Link
                  href={`/projects/${projectId}/invoice/${p._id}`}
                  className="w-full py-2 bg-white border border-slate-300 hover:border-sky-500 hover:text-sky-600 rounded-xl text-xs font-bold text-slate-700 transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>View Receipt</span>
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECTION 22: PROJECT ACTIVITY LOG & NOTES */}
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
      </React.Fragment>
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
    </div>
  );
}
