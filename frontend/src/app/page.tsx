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
} from 'lucide-react';
import { api, getStoredUser } from '../lib/api';
import { formatProjectStatus } from '../components/Timeline';
import SendUpdateModal from '../components/SendUpdateModal';
import PostponeModal from '../components/PostponeModal';

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [activeProject, setActiveProject] = useState<any>(null);
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [isPostponeModalOpen, setIsPostponeModalOpen] = useState(false);

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
    setUser(getStoredUser());
    fetchDashboard();
  }, []);

  const handleOpenSend = (project: any) => {
    setActiveProject(project);
    setIsSendModalOpen(true);
  };

  const handleOpenPostpone = (project: any) => {
    setActiveProject(project);
    setIsPostponeModalOpen(true);
  };

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
            <div className="inline-flex items-center space-x-2 px-3 py-1 bg-sky-400/20 text-sky-200 border border-sky-300/30 rounded-full text-xs font-semibold mb-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Meta WhatsApp Cloud API Connected</span>
            </div>
            <h2 className="text-2xl font-black tracking-tight font-poppins">Alpha Elevators Customer CRM</h2>
            <p className="text-xs text-slate-300 mt-0.5 max-w-xl font-poppins">
              Automating customer trust across 4-month elevator manufacturing and installation cycles. Dedicated group messaging, stage-specific templates & scheduler.
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
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
      </div>

      {user?.role === 'BDM' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Link href="/projects" className="block">
            <div className="bg-gradient-to-br from-amber-50 to-orange-50/40 p-5 rounded-2xl border border-amber-200 shadow-sm hover:shadow-md transition-all cursor-pointer">
              <div className="flex items-center justify-between text-amber-800 text-xs font-bold">
                <span>Pending Approvals (Drawing & Cabin)</span>
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-2xl font-black text-amber-700 mt-2">{cards.pendingApprovalCount ?? 0}</div>
              <div className="text-[11px] text-amber-600 mt-1">Click to view pending approval projects</div>
            </div>
          </Link>
        </div>
      ) : (
        <React.Fragment>
          {/* 9 Core Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-4">
          {/* Total Customers */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-slate-300 transition-all">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
              <span>Total Customers</span>
              <Users className="w-4 h-4 text-sky-600" />
            </div>
            <div className="text-2xl font-black text-slate-900 mt-2">{cards.totalCustomers ?? 0}</div>
            <div className="text-[11px] text-slate-400 mt-1">Verified elevator buyers</div>
          </div>

          {/* Active Projects */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-slate-300 transition-all">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
              <span>Active Projects</span>
              <Building2 className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-2xl font-black text-blue-700 mt-2">{cards.activeProjects ?? 0}</div>
            <div className="text-[11px] text-slate-400 mt-1">Order confirmed & in progress</div>
          </div>

          {/* Projects Awaiting Payment */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-slate-300 transition-all">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
              <span>Awaiting Payment</span>
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-2xl font-black text-amber-600 mt-2">{cards.projectsAwaitingPayment ?? 0}</div>
            <div className="text-[11px] text-slate-400 mt-1">Balance or milestone pending</div>
          </div>

          {/* In Manufacturing */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-slate-300 transition-all">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
              <span>In Manufacturing</span>
              <Wrench className="w-4 h-4 text-orange-600" />
            </div>
            <div className="text-2xl font-black text-orange-600 mt-2">{cards.projectsInManufacturing ?? 0}</div>
            <div className="text-[11px] text-slate-400 mt-1">Factory fabrication stage</div>
          </div>

          {/* Ready for Delivery */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-slate-300 transition-all">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
              <span>Ready for Delivery</span>
              <Truck className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="text-2xl font-black text-indigo-600 mt-2">{cards.projectsReadyForDelivery ?? 0}</div>
            <div className="text-[11px] text-slate-400 mt-1">QC passed & transit ready</div>
          </div>

          {/* Installation Ongoing */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-slate-300 transition-all">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
              <span>Installation Ongoing</span>
              <Wrench className="w-4 h-4 text-purple-600" />
            </div>
            <div className="text-2xl font-black text-purple-600 mt-2">{cards.installationOngoing ?? 0}</div>
            <div className="text-[11px] text-slate-400 mt-1">Shaft rigging & testing</div>
          </div>

          {/* Updates Due Today */}
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50/40 p-5 rounded-2xl border border-emerald-200 shadow-sm">
            <div className="flex items-center justify-between text-emerald-800 text-xs font-bold">
              <span>Updates Due Today</span>
              <Calendar className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-emerald-700 mt-2">{cards.whatsappUpdatesDueToday ?? 0}</div>
            <div className="text-[11px] text-emerald-600 mt-1">Scheduled for automated dispatch</div>
          </div>

          {/* WhatsApp Sent */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-slate-300 transition-all">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
              <span>WhatsApp Sent</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-emerald-600 mt-2">{cards.whatsappMessagesSent ?? 0}</div>
            <div className="text-[11px] text-slate-400 mt-1">Delivered to customer groups</div>
          </div>

          {/* WhatsApp Failed */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-slate-300 transition-all">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
              <span>WhatsApp Failed</span>
              <AlertTriangle className="w-4 h-4 text-rose-600" />
            </div>
            <div className="text-2xl font-black text-rose-600 mt-2">{cards.whatsappMessagesFailed ?? 0}</div>
            <div className="text-[11px] text-slate-400 mt-1">API errors or invalid groups</div>
          </div>
        </div>
        </React.Fragment>
      )}

      {/* TODAY'S ACTIONS SECTION (CRITICAL REQUIREMENT) */}
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
            <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl flex items-center justify-between">
              <div>
                <span className="font-bold text-emerald-950 block">Today</span>
                <span className="text-[11px] text-emerald-700">Scheduled for today</span>
              </div>
              <span className="text-lg font-black text-emerald-800">
                {data?.upcomingSummary?.todayCount ?? 0}
              </span>
            </div>

            {/* Tomorrow */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-800 block">Tomorrow</span>
                <span className="text-[11px] text-slate-500">Upcoming in 24 hours</span>
              </div>
              <span className="text-lg font-black text-slate-800">
                {data?.upcomingSummary?.tomorrowCount ?? 0}
              </span>
            </div>

            {/* Next 7 Days */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-800 block">Next 7 Days</span>
                <span className="text-[11px] text-slate-500">Scheduled in next week</span>
              </div>
              <span className="text-lg font-black text-slate-800">
                {data?.upcomingSummary?.next7DaysCount ?? 0}
              </span>
            </div>
          </div>
        </div>

        {/* Status Distribution */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2 border-b border-slate-100 pb-3">
            <Wrench className="w-4 h-4 text-orange-600" />
            <span>Project Status Pipeline</span>
          </h3>

          <div className="space-y-2.5">
            {Object.entries(data?.statusDistribution || {}).map(([stage, count]: any) => (
              <div key={stage} className="flex items-center justify-between text-xs">
                <span className="text-slate-600 font-medium">{stage.replace(/_/g, ' ')}</span>
                <span className="font-mono font-bold bg-slate-100 text-slate-800 px-2 py-0.5 rounded-md">
                  {count}
                </span>
              </div>
            ))}
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
    </div>
  );
}
