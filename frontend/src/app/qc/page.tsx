'use client';

import React, { useState, useEffect } from 'react';
import QCInspectionForm from '../../components/QCInspectionForm';
import { api, getStoredUser } from '../../lib/api';
import {
  ClipboardCheck,
  History,
  Download,
  Calendar,
  User,
  MapPin,
  Search,
  ExternalLink,
  ShieldCheck,
  FileCheck2,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Clock,
  Send,
  MessageSquare,
  FileText,
  Ruler,
  Layers,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function QCPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'form' | 'approvals' | 'history'>('form');
  const [pastReports, setPastReports] = useState<any[]>([]);
  const [loadingReports, setLoadingReports] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');

  // Approval Modal State
  const [approvalModalReport, setApprovalModalReport] = useState<any | null>(null);
  const [approvalNotes, setApprovalNotes] = useState<string>('');
  const [isApproving, setIsApproving] = useState<boolean>(false);

  // Rejection Modal State
  const [rejectionModalReport, setRejectionModalReport] = useState<any | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [isRejecting, setIsRejecting] = useState<boolean>(false);

  useEffect(() => {
    const user = getStoredUser();
    setCurrentUser(user);
    if (user?.role === 'TECHNICAL_MANAGER') {
      setActiveTab('approvals');
    }
  }, []);

  const fetchReports = async () => {
    try {
      setLoadingReports(true);
      const res = await api.getQCReports({
        search: searchQuery,
        approvalStatus: statusFilter === 'ALL' ? undefined : statusFilter,
      });
      setPastReports(res.data || []);
    } catch (err: any) {
      console.warn('Failed to load QC reports:', err.message);
    } finally {
      setLoadingReports(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [searchQuery, statusFilter]);

  const pendingReports = pastReports.filter(
    (r) => !r.approvalStatus || r.approvalStatus === 'PENDING'
  );

  const getDynamicGreeting = () => {
    const hours = new Date().getHours();
    if (hours < 12) return 'Good Morning';
    if (hours < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const handleDownloadPdf = async (report: any) => {
    try {
      toast.loading(`Generating PDF for ${report.jobNo}...`, { id: 'pdf-dl' });
      const blob = await api.generateQCPdf(report);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Alpha-Elevators-SiteReport-${report.jobNo}-${report.clientName}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success('Downloaded report PDF!', { id: 'pdf-dl' });
    } catch (err: any) {
      toast.error('Download error: ' + err.message, { id: 'pdf-dl' });
    }
  };

  const handleConfirmApprove = async () => {
    if (!approvalModalReport) return;
    try {
      setIsApproving(true);
      const res = await api.approveQCReport(approvalModalReport._id, approvalNotes);
      toast.success(
        res.message || 'Report approved! Project stage updated to Site Visit and WhatsApp group notified.',
        { duration: 6000 }
      );
      setApprovalModalReport(null);
      setApprovalNotes('');
      await fetchReports();
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve report');
    } finally {
      setIsApproving(false);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectionModalReport) return;
    if (!rejectionReason.trim()) {
      toast.error('Please specify a rejection reason for QC revision');
      return;
    }
    try {
      setIsRejecting(true);
      const res = await api.rejectQCReport(rejectionModalReport._id, rejectionReason);
      toast.success(res.message || 'Report rejected. QC has been notified to revise the form.');
      setRejectionModalReport(null);
      setRejectionReason('');
      await fetchReports();
    } catch (err: any) {
      toast.error(err.message || 'Failed to reject report');
    } finally {
      setIsRejecting(false);
    }
  };

  const isTechnicalManagerOrAdmin =
    currentUser?.role === 'TECHNICAL_MANAGER' || currentUser?.role === 'ADMIN';

  return (
    <div className="space-y-6">
      {/* Subnav Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Technical Approvals Tab */}
          <button
            type="button"
            onClick={() => setActiveTab('approvals')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 relative ${
              activeTab === 'approvals'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/30'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-amber-300" />
            <span>Technical Manager Approvals</span>
            {pendingReports.length > 0 && (
              <span
                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                  activeTab === 'approvals'
                    ? 'bg-amber-400 text-slate-900'
                    : 'bg-amber-100 text-amber-900 border border-amber-300'
                }`}
              >
                {pendingReports.length} Pending
              </span>
            )}
          </button>

          {/* Form Tab */}
          <button
            type="button"
            onClick={() => setActiveTab('form')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${
              activeTab === 'form'
                ? 'bg-sky-600 text-white shadow-md shadow-sky-900/30'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <ClipboardCheck className="w-4 h-4" />
            <span>Digital Site Inspection Form</span>
          </button>

          {/* Past Reports History Tab */}
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${
              activeTab === 'history'
                ? 'bg-sky-600 text-white shadow-md shadow-sky-900/30'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <History className="w-4 h-4" />
            <span>All Inspection Reports ({pastReports.length})</span>
          </button>
        </div>

        <div className="text-xs text-slate-500 flex items-center gap-1.5 font-medium">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Logged in as: </span>
          <strong className="text-slate-800">{currentUser?.name || 'User'}</strong>
          <span className="text-[10px] bg-slate-200 px-2 py-0.5 rounded-full font-mono text-slate-700 uppercase">
            {currentUser?.role === 'TECHNICAL_MANAGER'
              ? 'Technical Manager (Kishore)'
              : currentUser?.role || 'QC'}
          </span>
        </div>
      </div>

      {/* ============================================================== */}
      {/* TAB 1: TECHNICAL MANAGER APPROVALS (KISHORE) */}
      {/* ============================================================== */}
      {activeTab === 'approvals' && (
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-sky-950 rounded-3xl p-6 border border-indigo-800/40 text-white shadow-xl relative overflow-hidden">
            <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 bg-amber-400/20 text-amber-300 border border-amber-400/30 rounded-full text-[11px] font-bold tracking-wide uppercase flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Technical Manager Approval Workflow
                  </span>
                  <span className="text-xs text-slate-300 font-mono">Role: Kishore</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-white font-poppins">
                  Pre-Production Site Inspection Approvals
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
                  Review submitted millimeter site measurements & wall specs. Upon your approval, the project
                  stage advances from <strong className="text-amber-300">Advance Payment Received</strong> to{' '}
                  <strong className="text-emerald-300">Site Visit (SITE_MEASUREMENT)</strong>, the executed date
                  is recorded, and the official report PDF with completion notification is posted to the
                  customer's WhatsApp group.
                </p>
              </div>

              <div className="p-4 bg-white/10 backdrop-blur-md rounded-2xl border border-white/15 text-center shrink-0 min-w-[140px]">
                <div className="text-3xl font-black text-amber-300 font-mono">
                  {pendingReports.length}
                </div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-300 mt-0.5">
                  Pending Review
                </div>
              </div>
            </div>
          </div>

          {/* Pending Reports List */}
          {pendingReports.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 border border-slate-200 text-center space-y-3 shadow-sm">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
              <div className="text-base font-bold text-slate-800">
                All Pre-Production Site Reports Approved!
              </div>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                There are currently no QC site inspection reports pending technical manager approval. When QC
                submits a new report, it will appear here instantly for Kishore's review.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className="mt-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors inline-flex items-center gap-1.5"
              >
                <History className="w-4 h-4" />
                <span>View Historical Approved Reports</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
                Awaiting Kishore's Technical Approval ({pendingReports.length})
              </div>

              <div className="grid grid-cols-1 gap-4">
                {pendingReports.map((report) => (
                  <div
                    key={report._id}
                    className="bg-white rounded-3xl p-6 border-2 border-amber-300/60 shadow-md hover:shadow-lg transition-all space-y-4 relative"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                      <div className="flex items-start space-x-3.5">
                        <div className="w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-400/30 flex items-center justify-center text-amber-700 shrink-0">
                          <ClipboardCheck className="w-6 h-6" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-bold text-slate-900 font-poppins">
                              {report.clientName}
                            </h3>
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-sky-100 text-sky-800 border border-sky-200">
                              Job: {report.jobNo}
                            </span>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-slate-100 text-slate-600">
                              {report.reportId}
                            </span>
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-amber-600" />
                              Pending Approval
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-slate-400" />
                              <span>{report.region}</span>
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              <span>Inspection Date: {report.reportDate}</span>
                            </span>
                            {report.createdBy?.name && (
                              <span className="flex items-center gap-1">
                                <User className="w-3.5 h-3.5 text-slate-400" />
                                <span>QC Inspector: {report.createdBy.name}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Top Action Buttons */}
                      <div className="flex flex-wrap items-center gap-2 self-start lg:self-center">
                        <button
                          type="button"
                          onClick={() => handleDownloadPdf(report)}
                          className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
                        >
                          <Download className="w-4 h-4 text-slate-600" />
                          <span>View / Download PDF</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setRejectionModalReport(report)}
                          className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold transition-colors border border-rose-200 flex items-center gap-1.5"
                        >
                          <XCircle className="w-4 h-4" />
                          <span>Reject</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setApprovalModalReport(report)}
                          className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-900/20 transition-all flex items-center gap-1.5 active:scale-95"
                        >
                          <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                          <span>Approve & Post to Group</span>
                        </button>
                      </div>
                    </div>

                    {/* Report Technical Details Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50/80 rounded-2xl p-4 border border-slate-200/60 text-xs">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">
                          Product Series
                        </span>
                        <span className="font-bold text-slate-800">{report.product || 'Standard'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">
                          Floor Stops
                        </span>
                        <span className="font-bold text-slate-800">
                          {report.floorConfig} Stops ({report.propertyStage || 'Under Construction'})
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">
                          Shaft Measurements (W × D)
                        </span>
                        <span className="font-mono font-bold text-sky-800">
                          {report.shaftA || '-'} × {report.shaftB || '-'} mm
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">
                          Travel & Pit
                        </span>
                        <span className="font-mono font-bold text-slate-800">
                          Travel: {report.totalTravel || '-'} mm • Pit: {report.pitClient || '-'} mm
                        </span>
                      </div>
                    </div>

                    {report.remarks && (
                      <div className="text-xs bg-amber-50/60 rounded-xl p-3 border border-amber-200/50 text-slate-700">
                        <span className="font-bold text-amber-900 block mb-0.5">QC Remarks:</span>
                        <span>{report.remarks}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: DIGITAL SITE INSPECTION FORM (QC) */}
      {/* ============================================================== */}
      {activeTab === 'form' && (
        <QCInspectionForm
          onSaved={() => {
            fetchReports();
          }}
        />
      )}

      {/* ============================================================== */}
      {/* TAB 3: ALL INSPECTION REPORTS */}
      {/* ============================================================== */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Submitted Site Inspection Reports</h2>
              <p className="text-xs text-slate-500">
                Historical elevator pre-production inspections and downloadable PDF reports
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Status Filter Tabs */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      statusFilter === st
                        ? 'bg-white text-slate-900 shadow-sm font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {st === 'ALL' ? 'All' : st === 'PENDING' ? 'Pending' : st === 'APPROVED' ? 'Approved' : 'Rejected'}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search job no, client, or city..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>
          </div>

          {loadingReports ? (
            <div className="p-8 text-center text-xs text-slate-500">Loading reports...</div>
          ) : pastReports.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <FileCheck2 className="w-12 h-12 text-slate-300 mx-auto" />
              <div className="text-sm font-bold text-slate-700">No Inspection Reports Found</div>
              <p className="text-xs text-slate-400">
                Fill and submit a report from the "Digital Site Inspection Form" tab above.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('form')}
                className="mt-2 px-4 py-2 bg-sky-600 text-white rounded-xl text-xs font-bold hover:bg-sky-500 transition-colors"
              >
                Create New Report
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                    <th className="p-3">Report ID / Job No</th>
                    <th className="p-3">Client Details</th>
                    <th className="p-3">Region / Location</th>
                    <th className="p-3">Inspection Date</th>
                    <th className="p-3">Product / Stops</th>
                    <th className="p-3">Technical Manager Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pastReports.map((report) => (
                    <tr key={report._id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="p-3 font-semibold text-slate-900">
                        <div className="font-mono text-sky-700 font-bold">{report.jobNo}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{report.reportId}</div>
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-slate-800">{report.clientName}</div>
                        <div className="text-[11px] text-slate-500">{report.clientPhone}</div>
                      </td>
                      <td className="p-3 text-slate-600">{report.region}</td>
                      <td className="p-3 text-slate-600 font-mono">{report.reportDate}</td>
                      <td className="p-3">
                        <div className="font-medium text-slate-800">{report.product}</div>
                        <div className="text-[10px] text-slate-500">{report.floorConfig} Stops</div>
                      </td>
                      <td className="p-3">
                        {report.approvalStatus === 'APPROVED' ? (
                          <div className="space-y-0.5">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Approved by Kishore
                            </span>
                            {report.approvedAt && (
                              <div className="text-[9px] text-slate-400 font-mono">
                                {new Date(report.approvedAt).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                        ) : report.approvalStatus === 'REJECTED' ? (
                          <div className="space-y-0.5">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300 inline-flex items-center gap-1">
                              <XCircle className="w-3 h-3 text-rose-600" />
                              Rejected
                            </span>
                            {report.rejectionReason && (
                              <div className="text-[9px] text-rose-600 truncate max-w-[150px]" title={report.rejectionReason}>
                                {report.rejectionReason}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 inline-flex items-center gap-1">
                            <Clock className="w-3 h-3 text-amber-600" />
                            Pending Approval
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleDownloadPdf(report)}
                            className="px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 font-bold rounded-lg border border-sky-200 transition-colors inline-flex items-center gap-1"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>PDF</span>
                          </button>

                          {isTechnicalManagerOrAdmin &&
                            (!report.approvalStatus || report.approvalStatus === 'PENDING') && (
                              <button
                                type="button"
                                onClick={() => setApprovalModalReport(report)}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-colors inline-flex items-center gap-1 shadow-sm"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Approve</span>
                              </button>
                            )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* APPROVAL CONFIRMATION MODAL */}
      {/* ============================================================== */}
      {approvalModalReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-5 my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center space-x-3.5">
                <div className="w-11 h-11 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 shadow-sm">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 font-poppins">
                    Approve Site Report & Advance Stage
                  </h3>
                  <p className="text-xs text-slate-500">
                    Technical Manager Action for Kishore • Automatic WhatsApp Group Milestone Dispatch
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setApprovalModalReport(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors text-xs font-bold"
              >
                ✕
              </button>
            </div>

            {/* Target Client & Project Info */}
            <div className="p-4 bg-gradient-to-r from-slate-50 to-sky-50/40 rounded-2xl border border-slate-200/90 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-2">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Client & Project</span>
                  <span className="font-extrabold text-slate-900 text-sm block mt-0.5">
                    {approvalModalReport.clientName}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Job / Project ID</span>
                  <span className="font-mono font-bold text-sky-700 bg-sky-100 px-2 py-0.5 rounded-md inline-block mt-0.5">
                    {approvalModalReport.jobNo}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Inspection Date & Region</span>
                  <span className="text-slate-700 font-medium block mt-0.5">
                    {approvalModalReport.reportDate} • {approvalModalReport.region}
                  </span>
                </div>
              </div>
            </div>

            {/* 2-Column Responsive Layout: Actions Checklist & WhatsApp Preview */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left Column: Execution Checklist */}
              <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-4 text-xs space-y-3 text-emerald-950 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-emerald-200/70">
                    <span className="font-bold text-emerald-900 text-xs flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      Actions Executed on Confirmation:
                    </span>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                      Automated
                    </span>
                  </div>
                  <div className="space-y-2.5 text-[11px] text-emerald-800 leading-relaxed">
                    <div className="flex items-start gap-2.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-1.5 shrink-0"></span>
                      <span>
                        Report marked as <strong>Approved by Technical Manager Kishore</strong>.
                      </span>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-1.5 shrink-0"></span>
                      <span>
                        Project stage advances from <strong>Advance Payment Received</strong> to{' '}
                        <strong>Site Visit (SITE_MEASUREMENT)</strong>.
                      </span>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-1.5 shrink-0"></span>
                      <span>
                        Executed date on <strong>Site Visit</strong> is recorded as{' '}
                        <strong>{approvalModalReport.reportDate}</strong>.
                      </span>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-1.5 shrink-0"></span>
                      <span>
                        Official milestone template message ({getDynamicGreeting()} Sir) posted to customer&apos;s WhatsApp group.
                      </span>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-1.5 shrink-0"></span>
                      <span>
                        Official Pre-Production Site Visit Report <strong>PDF document</strong> is posted directly to WhatsApp group.
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-emerald-200/60 text-[10.5px] text-emerald-700 font-medium">
                  ✓ Automatically triggers milestone activity log & timeline synchronization.
                </div>
              </div>

              {/* Right Column: WhatsApp Message Preview */}
              <div className="bg-[#0B141A] text-slate-200 rounded-2xl p-4 text-[11px] font-mono leading-relaxed space-y-2.5 flex flex-col justify-between border border-slate-800 shadow-inner">
                <div>
                  <div className="text-[10px] text-emerald-400 uppercase font-bold tracking-wider flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                      WhatsApp Group Message Preview
                    </span>
                    <span className="text-[9.5px] bg-slate-800/80 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30 font-mono">
                      {getDynamicGreeting()}
                    </span>
                  </div>
                  <div className="bg-[#111B21] border border-slate-800/80 rounded-xl p-3 my-2 text-slate-200 text-xs leading-relaxed whitespace-pre-line shadow-sm">
                    {getDynamicGreeting()} Sir,
                    {'\n\n'}We have successfully completed the site visit on the scheduled date and shared the site visit report with you via email.
                    {'\n\n'}Kindly review the report and confirm your approval by replying to the email so that we can initiate the drawing process based on the site measurements.
                    {'\n\n'}Thank you for your support and cooperation.
                    {'\n\n'}Regards,
                    {'\n'}CRM Department
                    {'\n'}Alpha Elevators
                  </div>
                </div>

                <div className="text-[10.5px] text-slate-400 border-t border-slate-800/80 pt-2 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-emerald-300 font-sans">
                    📄 Pre-Production Site Visit Report.pdf attached
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">Auto-Attached</span>
                </div>
              </div>
            </div>

            {/* Optional Approval Notes */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                Approval Notes (Optional):
              </label>
              <input
                type="text"
                placeholder="e.g. Dimensions verified with client architect, proceeding to drawing"
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-800 placeholder:text-slate-400"
              />
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setApprovalModalReport(null)}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmApprove}
                disabled={isApproving}
                className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-900/30 transition-all flex items-center gap-2 disabled:opacity-50 active:scale-98"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isApproving ? 'Approving & Dispatching...' : 'Approve & Send to Group'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* REJECTION MODAL */}
      {/* ============================================================== */}
      {rejectionModalReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 flex items-center justify-center shrink-0">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Reject Site Report</h3>
                <p className="text-xs text-slate-500">
                  {rejectionModalReport.clientName} ({rejectionModalReport.jobNo})
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Please enter the reason for rejecting this site inspection report. QC inspector Dinesh will be
              prompted to re-measure or revise the form.
            </p>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Rejection Reason / Required Corrections: *
              </label>
              <textarea
                rows={3}
                required
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g. Headroom measurement looks inconsistent with floor travel; please re-verify with site supervisor."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectionModalReport(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={isRejecting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50"
              >
                {isRejecting ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
