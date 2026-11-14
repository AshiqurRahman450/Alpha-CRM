'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users,
  Building2,
  Clock,
  Wrench,
  Truck,
  CheckCircle2,
  AlertCircle,
  Send,
  MessageSquare,
  ArrowUpRight,
  Calendar,
  AlertTriangle,
  Play,
  RotateCcw,
  Handshake,
  IndianRupee,
  Bell,
  Lock,
  FileText,
  Sparkles,
  ClipboardCheck,
  PackageCheck,
  CheckCheck,
  Layers,
} from 'lucide-react';
import { api, getStoredUser } from '../lib/api';
import { formatProjectStatus } from '../components/Timeline';
import SendUpdateModal from '../components/SendUpdateModal';
import PostponeModal from '../components/PostponeModal';
import RecordPaymentModal from '../components/RecordPaymentModal';
import QCInspectionForm from '../components/QCInspectionForm';

const STAGES_CONFIG = [
  { key: 'PAYMENT_RECEIVED', step: 1, label: 'Advance Payment Received', icon: CheckCircle2, bg: 'bg-emerald-50/70', border: 'border-emerald-200', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-800' },
  { key: 'SITE_MEASUREMENT', step: 2, label: 'Site Visit', icon: ClipboardCheck, bg: 'bg-blue-50/70', border: 'border-blue-200', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-800' },
  { key: 'DESIGN', step: 3, label: 'Drawing and Cabin', icon: Sparkles, bg: 'bg-indigo-50/70', border: 'border-indigo-200', text: 'text-indigo-700', badge: 'bg-indigo-100 text-indigo-800' },
  { key: 'CUSTOMER_APPROVAL', step: 4, label: 'Drawing and Cabin Design Approval', icon: CheckCircle2, bg: 'bg-sky-50/70', border: 'border-sky-200', text: 'text-sky-700', badge: 'bg-sky-100 text-sky-800' },
  { key: 'ENGINEERING', step: 5, label: 'Production Payment', icon: IndianRupee, bg: 'bg-amber-50/70', border: 'border-amber-200', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-800' },
  { key: 'MANUFACTURING', step: 6, label: 'Production in progress', icon: Wrench, bg: 'bg-orange-50/70', border: 'border-orange-200', text: 'text-orange-700', badge: 'bg-orange-100 text-orange-800' },
  { key: 'QUALITY_CHECK', step: 7, label: 'Readiness Payment', icon: PackageCheck, bg: 'bg-purple-50/70', border: 'border-purple-200', text: 'text-purple-700', badge: 'bg-purple-100 text-purple-800' },
  { key: 'DISPATCH', step: 8, label: 'Material ready to Dispatch', icon: Truck, bg: 'bg-blue-50/70', border: 'border-blue-200', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-800' },
  { key: 'MATERIAL_IN_TRANSIT', step: 9, label: 'Material in transit', icon: Truck, bg: 'bg-cyan-50/70', border: 'border-cyan-200', text: 'text-cyan-700', badge: 'bg-cyan-100 text-cyan-800' },
  { key: 'DELIVERY', step: 10, label: 'Pre Site Visit', icon: ClipboardCheck, bg: 'bg-teal-50/70', border: 'border-teal-200', text: 'text-teal-700', badge: 'bg-teal-100 text-teal-800' },
  { key: 'MATERIAL_DELIVERY', step: 11, label: 'Material Delivered', icon: Truck, bg: 'bg-lime-50/70', border: 'border-lime-200', text: 'text-lime-700', badge: 'bg-lime-100 text-lime-800' },
  { key: 'INSTALLATION', step: 12, label: 'Installation in Progress', icon: Wrench, bg: 'bg-rose-50/70', border: 'border-rose-200', text: 'text-rose-700', badge: 'bg-rose-100 text-rose-800' },
  { key: 'TESTING', step: 13, label: 'Handover - Payment Pending', icon: Handshake, bg: 'bg-amber-50/70', border: 'border-amber-200', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-800' },
  { key: 'COMPLETED', step: 14, label: 'Project Completed', icon: CheckCheck, bg: 'bg-emerald-50/70', border: 'border-emerald-200', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-800' },
];

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [activeProject, setActiveProject] = useState<any>(null);
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [isPostponeModalOpen, setIsPostponeModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getDashboard();
      setData(res.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const stored = getStoredUser();
    setUser(stored);
    if (stored?.role === 'QC') {
      setLoading(false);
    } else {
      fetchDashboard();
    }
  }, []);

  const handleOpenSend = (project: any) => {
    setActiveProject(project);
    setIsSendModalOpen(true);
  };

  const handleOpenPostpone = (project: any) => {
    setActiveProject(project);
    setIsPostponeModalOpen(true);
  };

  const handleOpenPayment = (project: any) => {
    setActiveProject(project);
    setIsPaymentModalOpen(true);
  };

  if (user?.role === 'QC') {
    return <QCInspectionForm />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-sky-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs font-semibold text-slate-500">Loading Alpha Elevators CRM Dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600" />
          <span>{error}</span>
        </div>
        <button
          onClick={fetchDashboard}
          className="px-4 py-1.5 bg-rose-600 text-white rounded-xl text-xs font-semibold hover:bg-rose-700"
        >
          Retry
        </button>
      </div>
    );
  }

  const cards = data?.cards || {};

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Top Banner / Welcome */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-[#0F2744] via-[#163861] to-[#1E497C] text-white p-6 rounded-3xl shadow-lg shadow-sky-950/10">
        <div className="flex items-center space-x-4">
          <div className="h-14 w-19 rounded-2xl bg-white/10 border border-white/20 p-2 flex items-center justify-center shrink-0">
            <img src="/logo.png" alt="Alpha Elevators" className="h-full w-full object-contain" />
          </div>
          <div>
            {(user?.role === 'LOGISTICS' || user?.role === 'LOGISTICS_TL') ? (
              <>
                <div className="inline-flex items-center space-x-2 px-3 py-1 bg-cyan-400/20 text-cyan-200 border border-cyan-300/30 rounded-full text-xs font-semibold mb-1.5">
                  <Truck className="w-3.5 h-3.5 text-cyan-300" />
                  <span>Logistics & Dispatch Operations Active</span>
                </div>
                <h2 className="text-2xl font-black tracking-tight font-poppins">Alpha Elevators Logistics Portal</h2>
                <p className="text-xs text-slate-300 mt-0.5 max-w-xl font-poppins">
                  Track elevator material dispatch, transit statuses, pre-site visits, and material site deliveries with dedicated operational controls.
                </p>
              </>
            ) : (
              <>
                <div className="inline-flex items-center space-x-2 px-3 py-1 bg-sky-400/20 text-sky-200 border border-sky-300/30 rounded-full text-xs font-semibold mb-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>Meta WhatsApp Cloud API Connected</span>
                </div>
                <h2 className="text-2xl font-black tracking-tight font-poppins">Alpha Elevators Customer CRM</h2>
                <p className="text-xs text-slate-300 mt-0.5 max-w-xl font-poppins">
                  Automating customer trust across 4-month elevator manufacturing and installation cycles. Dedicated group messaging, stage-specific templates & scheduler.
                </p>
              </>
            )}
          </div>
        </div>
        {(user?.role === 'LOGISTICS' || user?.role === 'LOGISTICS_TL') ? (
          <div className="flex items-center space-x-3">
            <Link
              href="/projects"
              className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 flex items-center gap-1.5"
            >
              <Building2 className="w-4 h-4" />
              <span>View All Projects</span>
              <ArrowUpRight className="w-4 h-4" />
            </Link>
            <Link
              href="/qc"
              className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 flex items-center gap-1.5"
            >
              <ClipboardCheck className="w-4 h-4" />
              <span>QC Site Report</span>
            </Link>
            <Link
              href="/customers"
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <Users className="w-4 h-4" />
              <span>Customers</span>
            </Link>
          </div>
        ) : (
          <div className="flex items-center space-x-3">
            <Link
              href="/quotations"
              className="px-4 py-2 bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-400 hover:to-cyan-500 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 flex items-center gap-1.5"
            >
              <FileText className="w-4 h-4" />
              <span>Create Quotation</span>
            </Link>
            <Link
              href="/projects"
              className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 flex items-center gap-1.5"
            >
              <span>View All Projects</span>
              <ArrowUpRight className="w-4 h-4" />
            </Link>
            <Link
              href="/pilot"
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl text-xs font-bold transition-all"
            >
              Pilot Status ({data?.pilotMode?.currentPilotCount}/10)
            </Link>
          </div>
        )}
      </div>

      {user?.role === 'BDM' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Card 1: Create Quotation (Live PDF Studio) */}
          <Link href="/quotations" className="block group">
            <div className="bg-gradient-to-br from-teal-500 via-teal-600 to-cyan-700 text-white p-5 rounded-2xl border border-teal-400/40 shadow-sm hover:shadow-lg hover:border-teal-300 hover:scale-[1.01] transition-all cursor-pointer relative overflow-hidden">
              <div className="flex items-center justify-between text-teal-100 text-xs font-bold">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-teal-200 animate-pulse" />
                  <span>Quotation Studio</span>
                </span>
                <div className="flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-teal-100" />
                  <ArrowUpRight className="w-3.5 h-3.5 text-teal-200 group-hover:text-white transition-colors" />
                </div>
              </div>
              <div className="text-2xl font-black text-white mt-2 font-poppins">Create Quotation</div>
              <div className="text-[11px] text-teal-100 mt-1 font-medium flex items-center justify-between">
                <span>10-page proposal builder with live PDF preview</span>
                <span className="text-[10px] font-extrabold bg-white/20 text-white px-2.5 py-1 rounded-lg group-hover:bg-white group-hover:text-teal-700 transition-all flex items-center gap-1">
                  <span>Open Studio</span>
                  <span>→</span>
                </span>
              </div>
            </div>
          </Link>

          {/* Card 2: Pending Approvals */}
          <Link href="/dashboard/list?type=pendingApprovals" className="block group">
            <div className="bg-gradient-to-br from-amber-50 to-orange-50/40 p-5 rounded-2xl border border-amber-200 shadow-sm hover:shadow-md hover:border-amber-400 transition-all cursor-pointer">
              <div className="flex items-center justify-between text-amber-800 text-xs font-bold">
                <span>Pending Approvals (Drawing & Cabin)</span>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <ArrowUpRight className="w-3.5 h-3.5 text-amber-400 group-hover:text-amber-700 transition-colors" />
                </div>
              </div>
              <div className="text-2xl font-black text-amber-700 mt-2">{cards.pendingApprovalCount ?? 0}</div>
              <div className="text-[11px] text-amber-600 mt-1 font-medium flex items-center justify-between">
                <span>Click to view pending approval projects</span>
                <span className="text-[10px] font-bold text-amber-700 group-hover:underline">View List →</span>
              </div>
            </div>
          </Link>
        </div>
      ) : user?.role === 'ACCOUNTANT' ? (
        <div className="space-y-6">
          {/* Accountant Top Metric Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Card 1: CRM Payment Requests */}
            <Link href="/dashboard/list?type=crmPaymentRequests" className="block group">
              <div className="bg-gradient-to-br from-amber-500 via-amber-600 to-orange-600 text-white p-6 rounded-3xl shadow-lg shadow-amber-950/10 border border-amber-400/40 relative overflow-hidden hover:shadow-xl hover:scale-[1.01] transition-all cursor-pointer">
                <div className="absolute right-3 top-3 opacity-15">
                  <Bell className="w-24 h-24" />
                </div>
                <div className="flex items-center justify-between text-amber-100 text-xs font-extrabold uppercase tracking-wider">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-white animate-ping"></span>
                    CRM Payment Requests
                  </span>
                  <div className="flex items-center gap-1.5">
                    <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-sm text-white flex items-center justify-center">
                      <Bell className="w-4 h-4" />
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-white/70 group-hover:text-white transition-colors" />
                  </div>
                </div>
                <div className="text-4xl font-black text-white mt-3 font-poppins">
                  {cards.crmPaymentRequestsCount ?? 0}
                </div>
                <div className="text-xs text-amber-100 mt-1 font-medium">
                  Customer payments requested by CRM ready for recording
                </div>
                <div className="mt-4 pt-3 border-t border-white/20 flex items-center justify-between text-xs">
                  <span className="text-amber-100/90 font-medium">Click to view list</span>
                  <span className="font-extrabold bg-white/20 text-white px-2.5 py-0.5 rounded-md text-[11px] flex items-center gap-1">
                    <span>{cards.crmPaymentRequestsCount ?? 0} Requests</span>
                    <ArrowUpRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            </Link>

            {/* Card 2: Total Projects Pending Payment */}
            <Link href="/dashboard/list?type=projectsAwaitingPayment" className="block group">
              <div className="bg-gradient-to-br from-slate-50 via-white to-slate-100/80 p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 hover:scale-[1.01] transition-all cursor-pointer h-full flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-slate-700 text-xs font-bold">
                    <span>Projects with Outstanding Balance</span>
                    <div className="flex items-center gap-1.5">
                      <div className="w-8 h-8 rounded-xl bg-slate-200/80 text-slate-700 flex items-center justify-center">
                        <IndianRupee className="w-4 h-4" />
                      </div>
                      <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-slate-700 transition-colors" />
                    </div>
                  </div>
                  <div className="text-3xl font-black text-slate-900 mt-3 font-poppins">
                    {cards.projectsAwaitingPayment ?? 0}
                  </div>
                  <div className="text-xs text-slate-500 mt-1 font-medium">
                    Total projects with unsettled customer balance
                  </div>
                </div>
                {cards.totalPendingBalance !== undefined && (
                  <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Click to view list:</span>
                    <span className="font-extrabold text-slate-900 font-mono">
                      ₹{Number(cards.totalPendingBalance).toLocaleString('en-IN')} →
                    </span>
                  </div>
                )}
              </div>
            </Link>
          </div>

          {/* SECTION 1: CRM PAYMENT REQUESTS AWAITING RECORDING (PRIMARY ACCOUNTANT WORKFLOW) */}
          <div className="bg-white rounded-3xl p-6 border-2 border-amber-300 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-sm">
                  <Bell className="w-5 h-5 animate-bounce" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-extrabold text-slate-900">Payment Requests from CRM</h3>
                    <span className="px-2 py-0.5 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-300">
                      {cards.crmPaymentRequestsCount ?? 0} Awaiting Recording
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Customers requested by CRM from Payment Schedule. You can record payment and dispatch receipts for these requests.
                  </p>
                </div>
              </div>
              <Link
                href="/projects"
                className="px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-xl text-xs font-bold transition-all border border-amber-200 shrink-0 text-center"
              >
                View Projects
              </Link>
            </div>

            {(!data?.crmPaymentRequests || data.crmPaymentRequests.length === 0) ? (
              <div className="p-8 text-center bg-amber-50/40 rounded-2xl border border-dashed border-amber-200">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-800">No Pending CRM Payment Requests</p>
                <p className="text-[11px] text-slate-500 mt-1 max-w-md mx-auto">
                  When CRM requests payment collection for a customer from their Payment Schedule & Collection section, it will appear here immediately for you to record and generate receipts.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 uppercase text-[10px]">
                      <th className="pb-2.5 font-bold">Customer & Project</th>
                      <th className="pb-2.5 font-bold">Milestone / Stage</th>
                      <th className="pb-2.5 font-bold">Requested Amount</th>
                      <th className="pb-2.5 font-bold">Requested By</th>
                      <th className="pb-2.5 font-bold">CRM Notes</th>
                      <th className="pb-2.5 font-bold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.crmPaymentRequests.map((proj: any) => (
                      <tr key={proj._id} className="text-slate-700 hover:bg-amber-50/40 transition-colors">
                        <td className="py-3">
                          <span className="font-extrabold text-slate-900 block">{proj.customerName}</span>
                          <span className="text-[11px] text-slate-600 block">{proj.projectName}</span>
                          <span className="font-mono text-[10px] text-sky-600 font-bold">{proj.projectId}</span>
                          {proj.customerPhone && (
                            <span className="text-[10px] text-slate-400 block">{proj.customerPhone}</span>
                          )}
                        </td>
                        <td className="py-3">
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-200 inline-block">
                            {proj.paymentRequest?.paymentType || 'Milestone Payment'}
                          </span>
                        </td>
                        <td className="py-3 font-extrabold text-amber-900 text-sm font-mono">
                          ₹{(proj.paymentRequest?.requestedAmount || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="py-3">
                          <span className="font-bold text-slate-800 block">
                            {proj.paymentRequest?.requestedBy || 'CRM'}
                          </span>
                          {proj.paymentRequest?.requestedAt && (
                            <span className="text-[10px] text-slate-400">
                              {new Date(proj.paymentRequest.requestedAt).toLocaleDateString('en-GB')}
                            </span>
                          )}
                        </td>
                        <td className="py-3 max-w-xs">
                          {proj.paymentRequest?.notes ? (
                            <span className="text-[11px] text-slate-600 italic bg-white px-2 py-1 rounded-md border border-slate-200 block truncate">
                              &ldquo;{proj.paymentRequest.notes}&rdquo;
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">—</span>
                          )}
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleOpenPayment(proj)}
                              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold transition-all shadow-sm flex items-center gap-1 active:scale-95 ring-2 ring-emerald-400/20"
                            >
                              <IndianRupee className="w-3.5 h-3.5" />
                              <span>Record Payment</span>
                            </button>
                            <Link
                              href={`/projects/${proj._id}`}
                              className="px-3 py-1.5 border border-slate-300 hover:border-slate-400 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                            >
                              View
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* SECTION 2: ALL PROJECTS WITH OUTSTANDING BALANCE */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-slate-800 text-white flex items-center justify-center shadow-sm">
                  <IndianRupee className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">All Customers with Outstanding Balance</h3>
                  <p className="text-xs text-slate-500">
                    Payment recording is enabled only for customers with an active CRM payment collection request
                  </p>
                </div>
              </div>
              <Link
                href="/projects"
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
              >
                View All Projects
              </Link>
            </div>

            {(!data?.pendingPaymentProjects || data.pendingPaymentProjects.length === 0) ? (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-700">All payments are fully settled!</p>
                <p className="text-[11px] text-slate-400 mt-1">There are no projects with pending balance amounts.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 uppercase text-[10px]">
                      <th className="pb-2.5 font-bold">Project</th>
                      <th className="pb-2.5 font-bold">Customer</th>
                      <th className="pb-2.5 font-bold">Order Value</th>
                      <th className="pb-2.5 font-bold">Advance Required</th>
                      <th className="pb-2.5 font-bold">Total Paid</th>
                      <th className="pb-2.5 font-bold">Balance</th>
                      <th className="pb-2.5 font-bold">CRM Request</th>
                      <th className="pb-2.5 font-bold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.pendingPaymentProjects.map((proj: any) => {
                      const isRequested = proj.paymentRequest?.status === 'REQUESTED';
                      return (
                        <tr key={proj._id} className="text-slate-700 hover:bg-slate-50/60 transition-colors">
                          <td className="py-3">
                            <span className="font-extrabold text-slate-900 block">{proj.projectName}</span>
                            <span className="font-mono text-[10px] text-sky-600 font-bold">{proj.projectId}</span>
                          </td>
                          <td className="py-3">
                            <span className="font-medium text-slate-800 block">{proj.customerName}</span>
                            <span className="text-[10px] text-slate-400">{proj.customerPhone}</span>
                          </td>
                          <td className="py-3 font-semibold text-slate-800">
                            ₹{proj.orderValue?.toLocaleString('en-IN')}
                          </td>
                          <td className="py-3 font-medium text-amber-700">
                            ₹{(proj.advanceAmount || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="py-3 font-bold text-emerald-600">
                            ₹{(proj.totalPaid || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="py-3 font-bold text-rose-600">
                            ₹{(proj.balanceAmount || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="py-3">
                            {isRequested ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300 inline-flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                Requested (₹{(proj.paymentRequest.requestedAmount || 0).toLocaleString('en-IN')})
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500 inline-flex items-center gap-1">
                                <Lock className="w-2.5 h-2.5" />
                                Awaiting CRM
                              </span>
                            )}
                          </td>
                          <td className="py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {isRequested ? (
                                <button
                                  onClick={() => handleOpenPayment(proj)}
                                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1 active:scale-95"
                                >
                                  <IndianRupee className="w-3 h-3" />
                                  <span>Record Payment</span>
                                </button>
                              ) : (
                                <button
                                  disabled
                                  className="px-3 py-1.5 bg-slate-100 text-slate-400 rounded-lg text-xs font-bold transition-all border border-slate-200 flex items-center gap-1 cursor-not-allowed opacity-75"
                                  title="Awaiting CRM collection request before payment can be recorded"
                                >
                                  <Lock className="w-3 h-3 text-slate-400" />
                                  <span>Awaiting CRM</span>
                                </button>
                              )}
                              <Link
                                href={`/projects/${proj._id}`}
                                className="px-3 py-1.5 border border-slate-300 hover:border-slate-400 text-slate-700 rounded-lg text-xs font-bold transition-colors"
                              >
                                View
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (user?.role === 'LOGISTICS' || user?.role === 'LOGISTICS_TL') ? (
        <div className="space-y-6">
          {/* Logistics Top Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Material ready to Dispatch */}
            <Link href="/dashboard/list?type=stage&stage=DISPATCH" className="block group">
              <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white p-5 rounded-2xl border border-blue-400/40 shadow-sm hover:shadow-lg hover:border-blue-300 hover:scale-[1.01] transition-all cursor-pointer relative overflow-hidden">
                <div className="flex items-center justify-between text-blue-100 text-xs font-bold">
                  <span className="flex items-center gap-1.5">
                    <Truck className="w-4 h-4 text-blue-200" />
                    <span>Material ready to Dispatch</span>
                  </span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-blue-200 group-hover:text-white transition-colors" />
                </div>
                <div className="text-3xl font-black text-white mt-2 font-poppins">
                  {(data?.statusDistribution?.['DISPATCH'] || 0) + (data?.statusDistribution?.['MATERIAL_DISPATCHED'] || 0)}
                </div>
                <div className="text-[11px] text-blue-100 mt-1 font-medium flex items-center justify-between">
                  <span>Awaiting VRL tracking & dispatch</span>
                  <span className="font-bold underline">View List →</span>
                </div>
              </div>
            </Link>

            {/* Card 2: Material in transit */}
            <Link href="/dashboard/list?type=stage&stage=MATERIAL_IN_TRANSIT" className="block group">
              <div className="bg-gradient-to-br from-cyan-600 to-teal-700 text-white p-5 rounded-2xl border border-cyan-400/40 shadow-sm hover:shadow-lg hover:border-cyan-300 hover:scale-[1.01] transition-all cursor-pointer relative overflow-hidden">
                <div className="flex items-center justify-between text-cyan-100 text-xs font-bold">
                  <span className="flex items-center gap-1.5">
                    <Truck className="w-4 h-4 text-cyan-200" />
                    <span>Material in transit</span>
                  </span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-cyan-200 group-hover:text-white transition-colors" />
                </div>
                <div className="text-3xl font-black text-white mt-2 font-poppins">
                  {data?.statusDistribution?.['MATERIAL_IN_TRANSIT'] || 0}
                </div>
                <div className="text-[11px] text-cyan-100 mt-1 font-medium flex items-center justify-between">
                  <span>En route with logistics carrier</span>
                  <span className="font-bold underline">View List →</span>
                </div>
              </div>
            </Link>

            {/* Card 3: Pre Site Visit */}
            <Link href="/dashboard/list?type=stage&stage=DELIVERY" className="block group">
              <div className="bg-gradient-to-br from-teal-600 to-emerald-700 text-white p-5 rounded-2xl border border-teal-400/40 shadow-sm hover:shadow-lg hover:border-teal-300 hover:scale-[1.01] transition-all cursor-pointer relative overflow-hidden">
                <div className="flex items-center justify-between text-teal-100 text-xs font-bold">
                  <span className="flex items-center gap-1.5">
                    <ClipboardCheck className="w-4 h-4 text-teal-200" />
                    <span>Pre Site Visit</span>
                  </span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-teal-200 group-hover:text-white transition-colors" />
                </div>
                <div className="text-3xl font-black text-white mt-2 font-poppins">
                  {data?.statusDistribution?.['DELIVERY'] || 0}
                </div>
                <div className="text-[11px] text-teal-100 mt-1 font-medium flex items-center justify-between">
                  <span>Site readiness & shaft verification</span>
                  <span className="font-bold underline">View List →</span>
                </div>
              </div>
            </Link>

            {/* Card 4: Material Delivered */}
            <Link href="/dashboard/list?type=stage&stage=MATERIAL_DELIVERY" className="block group">
              <div className="bg-gradient-to-br from-lime-600 to-emerald-700 text-white p-5 rounded-2xl border border-lime-400/40 shadow-sm hover:shadow-lg hover:border-lime-300 hover:scale-[1.01] transition-all cursor-pointer relative overflow-hidden">
                <div className="flex items-center justify-between text-lime-100 text-xs font-bold">
                  <span className="flex items-center gap-1.5">
                    <PackageCheck className="w-4 h-4 text-lime-200" />
                    <span>Material Delivered</span>
                  </span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-lime-200 group-hover:text-white transition-colors" />
                </div>
                <div className="text-3xl font-black text-white mt-2 font-poppins">
                  {data?.statusDistribution?.['MATERIAL_DELIVERY'] || 0}
                </div>
                <div className="text-[11px] text-lime-100 mt-1 font-medium flex items-center justify-between">
                  <span>Components delivered on site</span>
                  <span className="font-bold underline">View List →</span>
                </div>
              </div>
            </Link>
          </div>

          {/* Quick Summary Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Link href="/projects" className="block group">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-sky-300 hover:shadow-md transition-all">
                <div className="text-xs text-slate-500 font-medium">Total Active Projects</div>
                <div className="text-3xl font-black text-slate-900 mt-1">{cards.activeProjects ?? 0}</div>
                <div className="text-[11px] text-sky-600 font-semibold mt-1">Manage project stages & executive →</div>
              </div>
            </Link>
            <Link href="/customers" className="block group">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-emerald-300 hover:shadow-md transition-all">
                <div className="text-xs text-slate-500 font-medium">Customer Directory</div>
                <div className="text-3xl font-black text-emerald-600 mt-1">{cards.totalCustomers ?? 0}</div>
                <div className="text-[11px] text-emerald-600 font-semibold mt-1">Client contacts & delivery addresses →</div>
              </div>
            </Link>
            <Link href="/qc" className="block group">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-purple-300 hover:shadow-md transition-all">
                <div className="text-xs text-slate-500 font-medium">QC Site Reports</div>
                <div className="text-3xl font-black text-purple-600 mt-1">Inspection Ready</div>
                <div className="text-[11px] text-purple-600 font-semibold mt-1">View & submit site quality reports →</div>
              </div>
            </Link>
          </div>
        </div>
      ) : (
        <React.Fragment>
          {/* 10 Core Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-4">
            {/* Total Customers */}
            <Link href="/dashboard/list?type=totalCustomers" className="block group">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-sky-400 hover:shadow-md hover:scale-[1.02] transition-all cursor-pointer h-full flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                    <span>Total Customers</span>
                    <div className="flex items-center gap-1">
                      <Users className="w-4 h-4 text-sky-600" />
                      <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-sky-600 transition-colors" />
                    </div>
                  </div>
                  <div className="text-2xl font-black text-slate-900 mt-2">{cards.totalCustomers ?? 0}</div>
                  <div className="text-[11px] text-slate-400 mt-1">Verified elevator buyers</div>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-sky-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                  <span>View Customer List</span>
                  <span>→</span>
                </div>
              </div>
            </Link>

            {/* Active Projects */}
            <Link href="/dashboard/list?type=activeProjects" className="block group">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-blue-400 hover:shadow-md hover:scale-[1.02] transition-all cursor-pointer h-full flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                    <span>Active Projects</span>
                    <div className="flex items-center gap-1">
                      <Building2 className="w-4 h-4 text-blue-600" />
                      <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-600 transition-colors" />
                    </div>
                  </div>
                  <div className="text-2xl font-black text-blue-700 mt-2">{cards.activeProjects ?? 0}</div>
                  <div className="text-[11px] text-slate-400 mt-1">Order confirmed & in progress</div>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-blue-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                  <span>View Active Projects</span>
                  <span>→</span>
                </div>
              </div>
            </Link>

            {/* Projects Awaiting Payment */}
            <Link href="/dashboard/list?type=projectsAwaitingPayment" className="block group">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-amber-400 hover:shadow-md hover:scale-[1.02] transition-all cursor-pointer h-full flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                    <span>Awaiting Payment</span>
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4 text-amber-600" />
                      <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-amber-600 transition-colors" />
                    </div>
                  </div>
                  <div className="text-2xl font-black text-amber-600 mt-2">{cards.projectsAwaitingPayment ?? 0}</div>
                  <div className="text-[11px] text-slate-400 mt-1">Balance or milestone pending</div>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-amber-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                  <span>View Pending Payments</span>
                  <span>→</span>
                </div>
              </div>
            </Link>

            {/* In Manufacturing */}
            <Link href="/dashboard/list?type=projectsInManufacturing" className="block group">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-orange-400 hover:shadow-md hover:scale-[1.02] transition-all cursor-pointer h-full flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                    <span>In Manufacturing</span>
                    <div className="flex items-center gap-1">
                      <Wrench className="w-4 h-4 text-orange-600" />
                      <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-orange-600 transition-colors" />
                    </div>
                  </div>
                  <div className="text-2xl font-black text-orange-600 mt-2">{cards.projectsInManufacturing ?? 0}</div>
                  <div className="text-[11px] text-slate-400 mt-1">Factory fabrication stage</div>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-orange-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                  <span>View Factory Projects</span>
                  <span>→</span>
                </div>
              </div>
            </Link>

            {/* Ready for Delivery */}
            <Link href="/dashboard/list?type=projectsReadyForDelivery" className="block group">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-indigo-400 hover:shadow-md hover:scale-[1.02] transition-all cursor-pointer h-full flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                    <span>Ready for Delivery</span>
                    <div className="flex items-center gap-1">
                      <Truck className="w-4 h-4 text-indigo-600" />
                      <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-600 transition-colors" />
                    </div>
                  </div>
                  <div className="text-2xl font-black text-indigo-600 mt-2">{cards.projectsReadyForDelivery ?? 0}</div>
                  <div className="text-[11px] text-slate-400 mt-1">QC passed & transit ready</div>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-indigo-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                  <span>View Delivery List</span>
                  <span>→</span>
                </div>
              </div>
            </Link>

            {/* Installation Ongoing */}
            <Link href="/dashboard/list?type=installationOngoing" className="block group">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-purple-400 hover:shadow-md hover:scale-[1.02] transition-all cursor-pointer h-full flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                    <span>Installation Ongoing</span>
                    <div className="flex items-center gap-1">
                      <Wrench className="w-4 h-4 text-purple-600" />
                      <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-purple-600 transition-colors" />
                    </div>
                  </div>
                  <div className="text-2xl font-black text-purple-600 mt-2">{cards.installationOngoing ?? 0}</div>
                  <div className="text-[11px] text-slate-400 mt-1">Shaft rigging & testing</div>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-purple-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                  <span>View Site Installations</span>
                  <span>→</span>
                </div>
              </div>
            </Link>

            {/* Handover */}
            <Link href="/dashboard/list?type=handoverCount" className="block group">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-teal-400 hover:shadow-md hover:scale-[1.02] transition-all cursor-pointer h-full flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                    <span>Handover</span>
                    <div className="flex items-center gap-1">
                      <Handshake className="w-4 h-4 text-teal-600" />
                      <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-teal-600 transition-colors" />
                    </div>
                  </div>
                  <div className="text-2xl font-black text-teal-600 mt-2">{cards.handoverCount ?? 0}</div>
                  <div className="text-[11px] text-slate-400 mt-1">Final testing & client handover</div>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-teal-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                  <span>View Handover Projects</span>
                  <span>→</span>
                </div>
              </div>
            </Link>

            {/* Updates Due Today */}
            <Link href="/dashboard/list?type=whatsappUpdatesDueToday" className="block group">
              <div className="bg-gradient-to-br from-emerald-50 to-teal-50/40 p-5 rounded-2xl border border-emerald-200 shadow-sm hover:border-emerald-400 hover:shadow-md hover:scale-[1.02] transition-all cursor-pointer h-full flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-emerald-800 text-xs font-bold">
                    <span>Updates Due Today</span>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4 text-emerald-600" />
                      <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400 group-hover:text-emerald-700 transition-colors" />
                    </div>
                  </div>
                  <div className="text-2xl font-black text-emerald-700 mt-2">{cards.whatsappUpdatesDueToday ?? 0}</div>
                  <div className="text-[11px] text-emerald-600 mt-1 font-medium">Scheduled for automated dispatch</div>
                </div>
                <div className="mt-2 pt-2 border-t border-emerald-100 flex items-center justify-between text-[10px] text-emerald-800 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                  <span>View Due Today List</span>
                  <span>→</span>
                </div>
              </div>
            </Link>

            {/* WhatsApp Sent */}
            <Link href="/dashboard/list?type=whatsappMessagesSent" className="block group">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-emerald-400 hover:shadow-md hover:scale-[1.02] transition-all cursor-pointer h-full flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                    <span>WhatsApp Sent</span>
                    <div className="flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-emerald-600 transition-colors" />
                    </div>
                  </div>
                  <div className="text-2xl font-black text-emerald-600 mt-2">{cards.whatsappMessagesSent ?? 0}</div>
                  <div className="text-[11px] text-slate-400 mt-1">Delivered to customer groups</div>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-emerald-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                  <span>View Sent Messages</span>
                  <span>→</span>
                </div>
              </div>
            </Link>

            {/* WhatsApp Failed */}
            <Link href="/dashboard/list?type=whatsappMessagesFailed" className="block group">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-rose-400 hover:shadow-md hover:scale-[1.02] transition-all cursor-pointer h-full flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                    <span>WhatsApp Failed</span>
                    <div className="flex items-center gap-1">
                      <AlertTriangle className="w-4 h-4 text-rose-600" />
                      <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-rose-600 transition-colors" />
                    </div>
                  </div>
                  <div className="text-2xl font-black text-rose-600 mt-2">{cards.whatsappMessagesFailed ?? 0}</div>
                  <div className="text-[11px] text-slate-400 mt-1">API errors or invalid groups</div>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-rose-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                  <span>View Failed Dispatches</span>
                  <span>→</span>
                </div>
              </div>
            </Link>
          </div>
        </React.Fragment>
      )}

      {/* ALL PROJECT STAGES PIPELINE OVERVIEW */}
      {user?.role !== 'ACCOUNTANT' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-[#0F2744] text-white flex items-center justify-center shadow-sm">
                <Layers className="w-5 h-5 text-sky-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                    Project Stages Pipeline
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-sky-100 text-sky-800 border border-sky-300">
                    {STAGES_CONFIG.length} Stages
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Live project counts for every stage in the elevator manufacturing, delivery & installation workflow
                </p>
              </div>
            </div>
            <Link
              href="/projects"
              className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1 self-start sm:self-auto shrink-0"
            >
              <span>View All Projects</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {STAGES_CONFIG.map((stage) => {
              const count = data?.statusDistribution?.[stage.key] ?? 0;
              const Icon = stage.icon;
              return (
                <Link
                  key={stage.key}
                  href={`/dashboard/list?type=stage&stage=${stage.key}`}
                  className={`p-3.5 rounded-2xl border ${stage.border} ${stage.bg} hover:shadow-md hover:scale-[1.02] transition-all cursor-pointer group flex flex-col justify-between`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Stage {stage.step}
                      </span>
                      <div className="p-1.5 rounded-lg bg-white/80 shadow-xs">
                        <Icon className={`w-3.5 h-3.5 ${stage.text}`} />
                      </div>
                    </div>
                    <div className={`text-2xl font-black mt-2 font-poppins ${count > 0 ? stage.text : 'text-slate-400'}`}>
                      {count}
                    </div>
                    <div className="text-[11px] font-bold text-slate-800 mt-1 line-clamp-2 leading-tight" title={stage.label}>
                      {stage.label}
                    </div>
                  </div>
                  <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px] font-bold text-slate-500 group-hover:text-sky-600 transition-colors">
                    <span>View List</span>
                    <ArrowUpRight className="w-3 h-3" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* TODAY'S ACTIONS SECTION (Hidden for Accountant, BDM, and Logistics) */}
      {user?.role !== 'ACCOUNTANT' && user?.role !== 'BDM' && user?.role !== 'LOGISTICS' && user?.role !== 'LOGISTICS_TL' && (
      <React.Fragment>
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2.5">
            <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></div>
            <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
              Today's Actions — Scheduled WhatsApp Updates
            </h3>
          </div>
          <span className="text-xs bg-slate-100 text-slate-600 font-semibold px-3 py-1 rounded-full">
            {data?.todayActions?.length ?? 0} Action Required
          </span>
        </div>

        {data?.todayActions?.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-700">All updates are current!</p>
            <p className="text-[11px] text-slate-400 mt-1">
              No WhatsApp project updates are due today. The 10/15/20-day cadence is running smoothly.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data?.todayActions?.map((action: any) => (
              <div
                key={action._id}
                className="p-5 rounded-2xl border border-slate-200 bg-slate-50/60 hover:bg-white hover:border-sky-300 transition-all shadow-sm space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xs font-bold text-slate-400 tracking-wider">
                      {action.projectId}
                    </div>
                    <h4 className="text-base font-extrabold text-slate-900">{action.projectName}</h4>
                    <p className="text-xs text-slate-500">{action.customerName} • {action.customerPhone}</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                    {action.projectStatus.replace(/_/g, ' ')}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs bg-white p-3 rounded-xl border border-slate-200/80">
                  <div className="flex items-center gap-2 text-slate-600">
                    <MessageSquare className="w-4 h-4 text-emerald-600" />
                    <span>Group: <strong className="text-slate-800">{action.whatsappGroupId || 'Not Linked'}</strong></span>
                  </div>
                  <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Update Due Today
                  </span>
                </div>

                {/* 3 Explicit Action Buttons from Spec */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => handleOpenSend(action)}
                    className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 flex items-center justify-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Update</span>
                  </button>
                  <button
                    onClick={() => handleOpenPostpone(action)}
                    className="flex-1 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-all"
                  >
                    Postpone
                  </button>
                  <Link
                    href={`/projects/${action._id}`}
                    className="px-3.5 py-2 border border-slate-300 hover:border-slate-400 text-slate-700 rounded-xl text-xs font-bold transition-colors text-center"
                  >
                    View Project
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* UPCOMING UPDATES & STATUS DISTRIBUTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming Updates Breakdown */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Calendar className="w-4 h-4 text-sky-600" />
              <span>Upcoming WhatsApp Schedule</span>
            </h3>
          </div>

          <div className="space-y-3 text-xs">
            {/* Today */}
            <Link href="/dashboard/list?type=upcoming_today" className="block group">
              <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl flex items-center justify-between hover:border-emerald-400 hover:shadow-sm hover:bg-emerald-50 transition-all cursor-pointer">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-emerald-950 block">Today</span>
                    <ArrowUpRight className="w-3 h-3 text-emerald-400 group-hover:text-emerald-700 transition-colors" />
                  </div>
                  <span className="text-[11px] text-emerald-700">Scheduled for today</span>
                </div>
                <span className="text-lg font-black text-emerald-800">
                  {data?.upcomingSummary?.todayCount ?? 0}
                </span>
              </div>
            </Link>

            {/* Tomorrow */}
            <Link href="/dashboard/list?type=upcoming_tomorrow" className="block group">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between hover:border-sky-300 hover:shadow-sm hover:bg-sky-50/50 transition-all cursor-pointer">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-800 block">Tomorrow</span>
                    <ArrowUpRight className="w-3 h-3 text-slate-400 group-hover:text-sky-600 transition-colors" />
                  </div>
                  <span className="text-[11px] text-slate-500">Upcoming in 24 hours</span>
                </div>
                <span className="text-lg font-black text-slate-800">
                  {data?.upcomingSummary?.tomorrowCount ?? 0}
                </span>
              </div>
            </Link>

            {/* Next 7 Days */}
            <Link href="/dashboard/list?type=upcoming_next_7_days" className="block group">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between hover:border-sky-300 hover:shadow-sm hover:bg-sky-50/50 transition-all cursor-pointer">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-800 block">Next 7 Days</span>
                    <ArrowUpRight className="w-3 h-3 text-slate-400 group-hover:text-sky-600 transition-colors" />
                  </div>
                  <span className="text-[11px] text-slate-500">Scheduled in next week</span>
                </div>
                <span className="text-lg font-black text-slate-800">
                  {data?.upcomingSummary?.next7DaysCount ?? 0}
                </span>
              </div>
            </Link>
          </div>
        </div>

        {/* Status Distribution */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Layers className="w-4 h-4 text-sky-600" />
              <span>Project Status Pipeline</span>
            </h3>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              {STAGES_CONFIG.length} Stages
            </span>
          </div>

          <div className="space-y-1.5 overflow-y-auto max-h-[380px] pr-1">
            {STAGES_CONFIG.map((stage) => {
              const count = data?.statusDistribution?.[stage.key] ?? 0;
              const Icon = stage.icon;
              return (
                <Link
                  key={stage.key}
                  href={`/dashboard/list?type=stage&stage=${stage.key}`}
                  className="flex items-center justify-between text-xs p-2 rounded-xl hover:bg-sky-50/60 hover:border-sky-200 border border-transparent transition-all group cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-slate-400 w-4 text-right">
                      {stage.step}.
                    </span>
                    <Icon className={`w-3.5 h-3.5 ${stage.text}`} />
                    <span className="text-slate-700 font-medium group-hover:text-sky-900 transition-colors">
                      {stage.label}
                    </span>
                    <ArrowUpRight className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity text-sky-600" />
                  </div>
                  <span className={`font-mono font-bold px-2 py-0.5 rounded-md transition-colors ${
                    count > 0 ? 'bg-sky-100 text-sky-800' : 'bg-slate-100 text-slate-400'
                  }`}>
                    {count}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Recent WhatsApp Feed */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-emerald-600" />
              <span>Recent WhatsApp Stream</span>
            </h3>
            <Link href="/whatsapp" className="text-[11px] text-sky-600 hover:underline font-semibold">
              View all
            </Link>
          </div>

          <div className="space-y-3 overflow-y-auto max-h-[260px] pr-1">
            {data?.recentMessages?.length === 0 ? (
              <p className="text-xs text-slate-400">No recent messages.</p>
            ) : (
              data?.recentMessages?.map((msg: any) => (
                <div
                  key={msg._id}
                  className={`p-3 rounded-xl text-xs space-y-1 border ${
                    msg.direction === 'INCOMING'
                      ? 'bg-sky-50/60 border-sky-200'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 text-[11px]">
                      {msg.customerName} ({msg.projectCode})
                    </span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                        msg.status === 'READ'
                          ? 'bg-sky-100 text-sky-800'
                          : msg.status === 'DELIVERED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : msg.status === 'FAILED'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-slate-200 text-slate-800'
                      }`}
                    >
                      {msg.status}
                    </span>
                  </div>
                  <p className="text-slate-600 line-clamp-2 text-[11px]">
                    {msg.messageContent}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      </React.Fragment>
      )}

      {/* Confirmation Modals */}
      {isSendModalOpen && activeProject && (
        <SendUpdateModal
          isOpen={isSendModalOpen}
          onClose={() => setIsSendModalOpen(false)}
          project={activeProject}
          onSuccess={fetchDashboard}
        />
      )}

      {isPostponeModalOpen && activeProject && (
        <PostponeModal
          isOpen={isPostponeModalOpen}
          onClose={() => setIsPostponeModalOpen(false)}
          project={activeProject}
          onSuccess={fetchDashboard}
        />
      )}

      {isPaymentModalOpen && activeProject && (
        <RecordPaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => {
            setIsPaymentModalOpen(false);
            setActiveProject(null);
          }}
          project={activeProject}
          onSuccess={() => {
            fetchDashboard();
          }}
        />
      )}
    </div>
  );
}
