'use client';

import React, { useEffect, useState, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Search,
  Building2,
  Users,
  MessageSquare,
  Clock,
  Wrench,
  Truck,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Send,
  IndianRupee,
  RefreshCw,
  Phone,
  ArrowUpRight,
  ExternalLink,
  Calendar,
  Handshake,
  Check,
  Copy,
  Lock,
  Layers,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { api, getStoredUser } from '../../../lib/api';
import { formatProjectStatus } from '../../../components/Timeline';
import SendUpdateModal from '../../../components/SendUpdateModal';
import PostponeModal from '../../../components/PostponeModal';
import RecordPaymentModal from '../../../components/RecordPaymentModal';

function DashboardListContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const type = searchParams.get('type') || 'activeProjects';
  const stage = searchParams.get('stage') || '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cardData, setCardData] = useState<{
    cardType: string;
    title: string;
    subtitle: string;
    count: number;
    itemType: 'project' | 'customer' | 'message';
    data: any[];
  } | null>(null);

  const [search, setSearch] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Modals state
  const [activeProject, setActiveProject] = useState<any>(null);
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [isPostponeModalOpen, setIsPostponeModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    setCurrentUser(getStoredUser());
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getDashboardCardItems({ type, stage });
      if (res.success) {
        setCardData(res);
      } else {
        setError(res.message || 'Failed to fetch details');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load list details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [type, stage]);

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

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filtered items based on search input
  const filteredItems = useMemo(() => {
    if (!cardData?.data) return [];
    if (!search.trim()) return cardData.data;

    const q = search.toLowerCase();
    return cardData.data.filter((item: any) => {
      if (cardData.itemType === 'customer') {
        return (
          item.fullName?.toLowerCase().includes(q) ||
          item.phoneNumber?.toLowerCase().includes(q) ||
          item.whatsappNumber?.toLowerCase().includes(q) ||
          item.email?.toLowerCase().includes(q) ||
          item.city?.toLowerCase().includes(q) ||
          item.address?.toLowerCase().includes(q) ||
          item.bdmName?.toLowerCase().includes(q)
        );
      } else if (cardData.itemType === 'message') {
        return (
          item.customerName?.toLowerCase().includes(q) ||
          item.projectCode?.toLowerCase().includes(q) ||
          item.customerPhone?.toLowerCase().includes(q) ||
          item.groupId?.toLowerCase().includes(q) ||
          item.messageContent?.toLowerCase().includes(q) ||
          item.status?.toLowerCase().includes(q)
        );
      } else {
        // Project
        return (
          item.projectName?.toLowerCase().includes(q) ||
          item.projectId?.toLowerCase().includes(q) ||
          item.customerName?.toLowerCase().includes(q) ||
          item.customerPhone?.toLowerCase().includes(q) ||
          item.liftModel?.toLowerCase().includes(q) ||
          item.siteAddress?.toLowerCase().includes(q) ||
          item.projectStatus?.toLowerCase().includes(q) ||
          item.whatsappGroupId?.toLowerCase().includes(q)
        );
      }
    });
  }, [cardData, search]);

  // Dynamic Theme Config
  const theme = useMemo(() => {
    switch (type) {
      case 'totalCustomers':
        return {
          gradient: 'from-[#0A2540] via-[#123E6B] to-[#1E5692]',
          badgeBg: 'bg-sky-400/20 text-sky-200 border-sky-300/30',
          icon: Users,
          openLink: '/customers',
          openLabel: 'Open in Customers Directory',
        };
      case 'activeProjects':
        return {
          gradient: 'from-[#0F2744] via-[#1B4B7E] to-[#2563EB]',
          badgeBg: 'bg-blue-400/20 text-blue-200 border-blue-300/30',
          icon: Building2,
          openLink: '/projects',
          openLabel: 'Open Projects Manager',
        };
      case 'projectsAwaitingPayment':
      case 'awaitingPayment':
        return {
          gradient: 'from-[#78350F] via-[#B45309] to-[#D97706]',
          badgeBg: 'bg-amber-400/20 text-amber-200 border-amber-300/30',
          icon: Clock,
          openLink: '/projects?paymentStatus=PENDING',
          openLabel: 'View in Projects',
        };
      case 'crmPaymentRequests':
      case 'crmPaymentRequestsCount':
        return {
          gradient: 'from-[#9A3412] via-[#C2410C] to-[#EA580C]',
          badgeBg: 'bg-orange-400/20 text-orange-200 border-orange-300/30',
          icon: IndianRupee,
          openLink: '/projects?crmRequested=true',
          openLabel: 'View in Projects',
        };
      case 'projectsInManufacturing':
      case 'manufacturing':
        return {
          gradient: 'from-[#92400E] via-[#D97706] to-[#F59E0B]',
          badgeBg: 'bg-orange-400/20 text-orange-200 border-orange-300/30',
          icon: Wrench,
          openLink: '/projects?status=MANUFACTURING',
          openLabel: 'Filter in Projects',
        };
      case 'projectsReadyForDelivery':
      case 'readyForDelivery':
        return {
          gradient: 'from-[#312E81] via-[#4338CA] to-[#6366F1]',
          badgeBg: 'bg-indigo-400/20 text-indigo-200 border-indigo-300/30',
          icon: Truck,
          openLink: '/projects?status=DELIVERY',
          openLabel: 'Filter in Projects',
        };
      case 'installationOngoing':
      case 'installation':
        return {
          gradient: 'from-[#4C1D95] via-[#6D28D9] to-[#8B5CF6]',
          badgeBg: 'bg-purple-400/20 text-purple-200 border-purple-300/30',
          icon: Wrench,
          openLink: '/projects?status=INSTALLATION',
          openLabel: 'Filter in Projects',
        };
      case 'handoverCount':
      case 'handover':
        return {
          gradient: 'from-[#115E59] via-[#0F766E] to-[#14B8A6]',
          badgeBg: 'bg-teal-400/20 text-teal-200 border-teal-300/30',
          icon: Handshake,
          openLink: '/projects?status=TESTING',
          openLabel: 'Filter in Projects',
        };
      case 'whatsappUpdatesDueToday':
      case 'updatesDueToday':
      case 'upcoming_today':
        return {
          gradient: 'from-[#064E3B] via-[#047857] to-[#10B981]',
          badgeBg: 'bg-emerald-400/20 text-emerald-200 border-emerald-300/30',
          icon: Calendar,
          openLink: '/projects?updateDue=today',
          openLabel: 'View in Projects',
        };
      case 'upcoming_tomorrow':
        return {
          gradient: 'from-[#164E63] via-[#0E7490] to-[#06B6D4]',
          badgeBg: 'bg-cyan-400/20 text-cyan-200 border-cyan-300/30',
          icon: Calendar,
          openLink: '/projects',
          openLabel: 'View in Projects',
        };
      case 'upcoming_next_7_days':
        return {
          gradient: 'from-[#1E293B] via-[#334155] to-[#475569]',
          badgeBg: 'bg-slate-400/20 text-slate-200 border-slate-300/30',
          icon: Calendar,
          openLink: '/projects',
          openLabel: 'View in Projects',
        };
      case 'whatsappMessagesSent':
        return {
          gradient: 'from-[#064E3B] via-[#059669] to-[#10B981]',
          badgeBg: 'bg-emerald-400/20 text-emerald-200 border-emerald-300/30',
          icon: CheckCircle2,
          openLink: '/whatsapp',
          openLabel: 'Open WhatsApp Hub',
        };
      case 'whatsappMessagesFailed':
        return {
          gradient: 'from-[#881337] via-[#BE123C] to-[#E11D48]',
          badgeBg: 'bg-rose-400/20 text-rose-200 border-rose-300/30',
          icon: AlertTriangle,
          openLink: '/whatsapp',
          openLabel: 'Open WhatsApp Hub',
        };
      case 'pendingApprovals':
      case 'pendingApprovalCount':
        return {
          gradient: 'from-[#78350F] via-[#B45309] to-[#D97706]',
          badgeBg: 'bg-amber-400/20 text-amber-200 border-amber-300/30',
          icon: Clock,
          openLink: '/projects?status=CUSTOMER_APPROVAL',
          openLabel: 'View in Projects',
        };
      default:
        return {
          gradient: 'from-[#0F2744] via-[#1E3A8A] to-[#2563EB]',
          badgeBg: 'bg-sky-400/20 text-sky-200 border-sky-300/30',
          icon: Layers,
          openLink: '/projects',
          openLabel: 'Open Projects Manager',
        };
    }
  }, [type]);

  const HeaderIcon = theme.icon;

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* Top Breadcrumb & Back Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-2 text-xs">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-900 font-semibold transition-colors px-2.5 py-1.5 rounded-xl hover:bg-slate-100"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Dashboard</span>
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
          <span className="text-slate-400 font-medium">Card Drill-down</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
          <span className="font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-100">
            {cardData?.title || 'Details List'}
          </span>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-all shadow-sm active:scale-95 text-xs font-semibold flex items-center gap-1.5"
            title="Refresh list"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-sky-600' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {theme.openLink && (
            <Link
              href={theme.openLink}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 active:scale-95"
            >
              <span>{theme.openLabel}</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
            </Link>
          )}
        </div>
      </div>

      {/* Hero Banner with Dynamic Gradient */}
      <div
        className={`bg-gradient-to-r ${theme.gradient} text-white p-6 sm:p-8 rounded-3xl shadow-xl shadow-slate-950/10 relative overflow-hidden`}
      >
        <div className="absolute right-4 -bottom-6 opacity-10 pointer-events-none select-none">
          <HeaderIcon className="w-48 h-48" />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div
              className={`inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-bold border backdrop-blur-md ${theme.badgeBg}`}
            >
              <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
              <span>Dashboard Drill-down List</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight font-poppins">
              {cardData?.title || 'Loading List...'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-200 max-w-2xl font-poppins opacity-90">
              {cardData?.subtitle || 'Loading records for the requested dashboard card'}
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-2xl shrink-0 text-center min-w-[130px]">
            <div className="text-[11px] uppercase tracking-wider text-white/80 font-bold">
              Total Count
            </div>
            <div className="text-3xl sm:text-4xl font-black text-white font-mono mt-0.5">
              {loading ? '...' : cardData?.count ?? 0}
            </div>
            <div className="text-[10px] text-white/70 mt-0.5 capitalize">
              {cardData?.itemType ? `${cardData.itemType}s` : 'Records'}
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="w-full sm:flex-1 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder={
              cardData?.itemType === 'customer'
                ? 'Filter by customer name, phone, email, city, address...'
                : cardData?.itemType === 'message'
                ? 'Filter by recipient, phone, message content, status...'
                : 'Filter by project name, project ID (ALP-001), customer, lift model, address...'
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-9 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 bg-slate-50/50"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 text-xs font-bold"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto text-xs text-slate-500 font-medium">
          <span>
            Showing <strong className="text-slate-900">{filteredItems.length}</strong> of{' '}
            <strong className="text-slate-900">{cardData?.count ?? 0}</strong> records
          </span>
          {search && (
            <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-md text-[10px] font-bold">
              Filtered
            </span>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-16 text-center space-y-3">
          <div className="w-10 h-10 border-4 border-sky-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs font-semibold text-slate-500">Fetching records for this card...</p>
        </div>
      ) : error ? (
        <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600" />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchData}
            className="px-4 py-1.5 bg-rose-600 text-white rounded-xl text-xs font-semibold hover:bg-rose-700"
          >
            Retry
          </button>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">
            {search ? 'No matching records found' : 'No records currently in this list'}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {search
              ? `No records matched your search query "${search}". Try clearing the search or typing a different keyword.`
              : 'There are no items matching this dashboard category at the moment.'}
          </p>
          {search && (
            <button
              onClick={() => setSearch('')}
              className="mt-2 px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
            >
              Clear Search
            </button>
          )}
        </div>
      ) : cardData?.itemType === 'customer' ? (
        /* CUSTOMERS LIST TABLE */
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-400 uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4 font-bold">Customer Name</th>
                  <th className="py-3 px-4 font-bold">Phone & WhatsApp</th>
                  <th className="py-3 px-4 font-bold">Location</th>
                  <th className="py-3 px-4 font-bold">Category & Source</th>
                  <th className="py-3 px-4 font-bold">Active Projects</th>
                  <th className="py-3 px-4 font-bold">Assigned BDM</th>
                  <th className="py-3 px-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map((c: any) => (
                  <tr key={c._id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4">
                      <span className="font-extrabold text-slate-900 block text-sm">
                        {c.fullName}
                      </span>
                      {c.email && (
                        <span className="text-[11px] text-slate-400 block">{c.email}</span>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-mono font-bold text-slate-800">{c.phoneNumber}</div>
                      {c.whatsappNumber && c.whatsappNumber !== c.phoneNumber && (
                        <div className="text-[10px] text-emerald-600 font-mono">
                          WA: {c.whatsappNumber}
                        </div>
                      )}
                      <div className="mt-0.5">
                        {c.whatsappOptIn ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            WhatsApp Opt-In
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded">
                            No Opt-In
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span className="font-semibold text-slate-800 block">
                        {c.city || 'Mumbai'}{c.state ? `, ${c.state}` : ''}
                      </span>
                      {c.address && (
                        <span className="text-[11px] text-slate-400 line-clamp-1 max-w-xs block">
                          {c.address}
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 inline-block mb-0.5">
                        {c.customerType || 'Residential'}
                      </span>
                      {c.leadSource && (
                        <span className="text-[10px] text-slate-400 block">{c.leadSource}</span>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <span className="font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200 font-mono inline-block">
                        {c.projectCount} Project{c.projectCount === 1 ? '' : 's'}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <span className="text-slate-700 font-medium">{c.bdmName || '—'}</span>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {c.phoneNumber && (
                          <a
                            href={`https://wa.me/${c.phoneNumber.replace(/[^0-9]/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
                            title="Chat on WhatsApp"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </a>
                        )}
                        {c.phoneNumber && (
                          <a
                            href={`tel:${c.phoneNumber}`}
                            className="p-1.5 bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 rounded-lg transition-colors"
                            title="Call customer"
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <Link
                          href={`/customers`}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors"
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
        </div>
      ) : cardData?.itemType === 'message' ? (
        /* WHATSAPP MESSAGES TABLE */
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-400 uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4 font-bold">Recipient / Customer</th>
                  <th className="py-3 px-4 font-bold">Target Group / Phone</th>
                  <th className="py-3 px-4 font-bold">Message Content</th>
                  <th className="py-3 px-4 font-bold">Status</th>
                  <th className="py-3 px-4 font-bold">Date & Time</th>
                  <th className="py-3 px-4 font-bold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map((m: any) => (
                  <tr key={m._id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4">
                      <span className="font-extrabold text-slate-900 block">
                        {m.customerName || 'Customer'}
                      </span>
                      {m.projectCode && (
                        <span className="font-mono text-[10px] text-sky-600 font-bold block">
                          {m.projectCode}
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <span className="font-medium text-slate-700 block truncate max-w-[180px]">
                        {m.groupId || m.customerPhone || 'Direct'}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {m.direction || 'OUTGOING'}
                      </span>
                    </td>

                    <td className="py-3 px-4 max-w-md">
                      <p className="text-slate-700 text-xs line-clamp-2 bg-slate-50 p-2 rounded-xl border border-slate-200/60 font-sans">
                        {m.messageContent}
                      </p>
                      {m.lastError && (
                        <div className="text-[10px] text-rose-600 mt-1 font-semibold flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          <span>{m.lastError}</span>
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border inline-block ${
                          m.status === 'SENT'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : m.status === 'DELIVERED'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : m.status === 'READ'
                            ? 'bg-sky-50 text-sky-700 border-sky-200'
                            : m.status === 'FAILED'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        {m.status}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                      {m.createdAt ? new Date(m.createdAt).toLocaleString('en-GB') : '—'}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => copyToClipboard(m.messageContent, m._id)}
                        className="p-1.5 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                        title="Copy message text"
                      >
                        {copiedId === m._id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* PROJECTS LIST TABLE (DEFAULT) */
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-400 uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4 font-bold">Project / Code</th>
                  <th className="py-3 px-4 font-bold">Customer & Location</th>
                  <th className="py-3 px-4 font-bold">Current Stage</th>
                  <th className="py-3 px-4 font-bold">Financials</th>
                  <th className="py-3 px-4 font-bold">WhatsApp Automation</th>
                  <th className="py-3 px-4 font-bold">Next Update</th>
                  <th className="py-3 px-4 font-bold text-right">Quick Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map((p: any) => {
                  const isRequested = p.paymentRequest?.status === 'REQUESTED';
                  const isAccountant = currentUser?.role === 'ACCOUNTANT';
                  return (
                    <tr key={p._id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Project Code & Name */}
                      <td className="py-3 px-4">
                        <Link
                          href={`/projects/${p._id}`}
                          className="font-extrabold text-slate-900 hover:text-sky-600 block text-sm transition-colors"
                        >
                          {p.projectName}
                        </Link>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="font-mono text-[10px] text-sky-600 font-bold bg-sky-50 px-1.5 py-0.2 rounded border border-sky-100">
                            {p.projectId}
                          </span>
                          {p.liftModel && (
                            <span className="text-[10px] text-slate-400 truncate max-w-[120px]">
                              {p.liftModel}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Customer & Location */}
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-800 block">{p.customerName}</span>
                        <div className="flex items-center gap-1 text-[11px] text-slate-500">
                          {p.customerPhone && <span>{p.customerPhone}</span>}
                        </div>
                        {p.siteAddress && (
                          <span className="text-[10px] text-slate-400 line-clamp-1 max-w-xs block mt-0.5">
                            {p.siteAddress}
                          </span>
                        )}
                      </td>

                      {/* Current Stage */}
                      <td className="py-3 px-4">
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-sky-50 text-sky-800 border border-sky-200 inline-block">
                          {formatProjectStatus(p.projectStatus)}
                        </span>
                      </td>

                      {/* Financials */}
                      <td className="py-3 px-4">
                        <div className="space-y-0.5 font-mono">
                          <div className="text-[11px] text-slate-500">
                            Order: <strong className="text-slate-800">₹{Number(p.orderValue).toLocaleString('en-IN')}</strong>
                          </div>
                          <div className="text-[11px] text-emerald-600 font-semibold">
                            Paid: ₹{Number(p.totalPaid).toLocaleString('en-IN')}
                          </div>
                          <div className="text-[11px] text-rose-600 font-bold">
                            Bal: ₹{Number(p.balanceAmount).toLocaleString('en-IN')}
                          </div>
                          {isRequested && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300 inline-block mt-0.5">
                              CRM Req: ₹{Number(p.paymentRequest.requestedAmount).toLocaleString('en-IN')}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* WhatsApp Automation */}
                      <td className="py-3 px-4">
                        {p.whatsappGroupId ? (
                          <div className="flex items-center gap-1.5 text-xs text-emerald-700">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                            <span className="font-medium truncate max-w-[140px]" title={p.whatsappGroupId}>
                              {p.whatsappGroupId}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md inline-block">
                            No Group Linked
                          </span>
                        )}
                        {p.whatsappOptIn && (
                          <span className="text-[10px] text-emerald-600 block mt-0.5 font-medium">
                            ✓ Opt-in active
                          </span>
                        )}
                      </td>

                      {/* Next Update */}
                      <td className="py-3 px-4">
                        {p.nextUpdateAt ? (
                          <div className="font-mono text-xs">
                            <span className="text-slate-800 block">
                              {new Date(p.nextUpdateAt).toLocaleDateString('en-GB')}
                            </span>
                            {new Date(p.nextUpdateAt) <= new Date() && (
                              <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1 rounded border border-amber-200">
                                Due Today
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400">—</span>
                        )}
                      </td>

                      {/* Quick Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Send Update Button */}
                          <button
                            onClick={() => handleOpenSend(p)}
                            className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1 active:scale-95"
                            title="Send WhatsApp update"
                          >
                            <Send className="w-3 h-3" />
                            <span className="hidden md:inline">Send Update</span>
                          </button>

                          {/* Record Payment (if requested or for accountant/admin) */}
                          <button
                            onClick={() => handleOpenPayment(p)}
                            className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1 active:scale-95"
                            title="Record customer payment"
                          >
                            <IndianRupee className="w-3 h-3" />
                            <span className="hidden md:inline">Payment</span>
                          </button>

                          {/* View details */}
                          <Link
                            href={`/projects/${p._id}`}
                            className="px-2.5 py-1.5 border border-slate-300 hover:border-slate-400 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1"
                          >
                            <span>View</span>
                            <ArrowUpRight className="w-3 h-3 text-slate-400" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Confirmation Modals */}
      {isSendModalOpen && activeProject && (
        <SendUpdateModal
          isOpen={isSendModalOpen}
          onClose={() => setIsSendModalOpen(false)}
          project={activeProject}
          onSuccess={fetchData}
        />
      )}

      {isPostponeModalOpen && activeProject && (
        <PostponeModal
          isOpen={isPostponeModalOpen}
          onClose={() => setIsPostponeModalOpen(false)}
          project={activeProject}
          onSuccess={fetchData}
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
          onSuccess={fetchData}
        />
      )}
    </div>
  );
}

export default function DashboardListPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-3">
            <div className="w-10 h-10 border-4 border-sky-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-xs font-semibold text-slate-500">Loading drill-down list...</p>
          </div>
        </div>
      }
    >
      <DashboardListContent />
    </Suspense>
  );
}
