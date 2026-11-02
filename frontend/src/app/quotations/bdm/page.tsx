'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Briefcase,
  FileText,
  Search,
  Filter,
  Layers,
  ArrowRight,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  Send,
  Award,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  Building2,
  Phone,
  MapPin,
  User,
  ShieldCheck,
  Plus,
  Loader2,
  Sparkles,
  Check,
  Copy,
  DollarSign,
  ArrowUpRight,
  Eye,
  Calendar,
} from 'lucide-react';
import { api, getStoredUser } from '../../../lib/api';
import toast from 'react-hot-toast';

export default function BdmQuotationsPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [quotations, setQuotations] = useState<any[]>([]);
  const [availableBdms, setAvailableBdms] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>({
    totalBaseQuotations: 0,
    totalStage1: 0,
    totalStage2: 0,
    totalStage3: 0,
    totalCrmApproved: 0,
    totalPipelineValue: 0,
  });
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedBdm, setSelectedBdm] = useState<string>('ALL');
  const [selectedStage, setSelectedStage] = useState<string>('ALL'); // 'ALL' | '1' | '2' | '3' | 'APPROVED'
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [viewMyOnly, setViewMyOnly] = useState<boolean>(false);

  // WhatsApp Send Modal State
  const [showWhatsAppModal, setShowWhatsAppModal] = useState<boolean>(false);
  const [waOfferNo, setWaOfferNo] = useState<string>('');
  const [waStage, setWaStage] = useState<number>(1);
  const [waCustomerName, setWaCustomerName] = useState<string>('');
  const [waPhone, setWaPhone] = useState<string>('');
  const [isSendingWa, setIsSendingWa] = useState<boolean>(false);

  // CRM Approve State
  const [approvingOfferNo, setApprovingOfferNo] = useState<string | null>(null);

  // Load user on mount
  useEffect(() => {
    const user = getStoredUser();
    setCurrentUser(user);
    if (user?.role === 'BDM') {
      setViewMyOnly(true);
      setSelectedBdm(user.name || 'ALL');
    }
  }, []);

  // Fetch quotations list
  const fetchQuotations = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (searchTerm.trim()) params.search = searchTerm.trim();
      if (selectedBdm !== 'ALL') params.bdmName = selectedBdm;
      if (selectedStage !== 'ALL' && selectedStage !== 'APPROVED') {
        params.stage = Number(selectedStage);
      }
      if (selectedStatus !== 'ALL') params.status = selectedStatus;
      if (currentUser?.role === 'BDM' && !viewMyOnly) {
        params.all = true;
      }

      const res = await api.quotations.getBdmStageWiseQuotations(params);
      if (res?.success) {
        setQuotations(res.data || []);
        if (res.metrics) setMetrics(res.metrics);
        if (res.availableBdms) setAvailableBdms(res.availableBdms);
      } else {
        toast.error(res?.message || 'Failed to load BDM quotations');
      }
    } catch (err: any) {
      console.error('Fetch quotations error:', err);
      toast.error(err.message || 'Error loading quotations pipeline');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuotations();
  }, [searchTerm, selectedBdm, selectedStage, selectedStatus, viewMyOnly]);

  // Client-side stage filter for 'APPROVED'
  const filteredQuotations = useMemo(() => {
    if (selectedStage === 'APPROVED') {
      return quotations.filter(
        (q) => q.latestStatus === 'CRM_APPROVED' || q.stages?.stage3?.status === 'CRM_APPROVED'
      );
    }
    return quotations;
  }, [quotations, selectedStage]);

  // Handle CRM Approval right from the pipeline
  const handleCrmApprove = async (offerNo: string) => {
    setApprovingOfferNo(offerNo);
    try {
      const isBdm = currentUser?.role === 'BDM';
      if (isBdm) {
        const res = await api.quotations.requestApproval({ offerNo });
        if (res?.success) {
          toast.success('Approval request sent to CRM & Admin on Reminders!');
          fetchQuotations();
        } else {
          toast.error(res?.message || 'Failed to request approval');
        }
      } else {
        const res = await api.quotations.crmApprove({ offerNo });
        if (res?.success) {
          if (res.requestSent) {
            toast.success('Approval request sent to CRM & Admin on Reminders!');
          } else {
            toast.success(
              `Quotation Approved! New Customer ${res.customer?.customerId} and Project ${res.project?.projectId} created in CRM.`,
              { duration: 6000 }
            );
          }
          fetchQuotations();
        } else {
          toast.error(res?.message || 'Failed to approve quotation');
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Error processing approval');
    } finally {
      setApprovingOfferNo(null);
    }
  };

  // Handle WhatsApp Send Dispatch
  const handleSendWhatsAppSubmit = async () => {
    if (!waPhone || waPhone.replace(/\D/g, '').length < 10) {
      toast.error('Please enter a valid 10-digit WhatsApp number');
      return;
    }

    setIsSendingWa(true);
    try {
      const res = await api.quotations.sendWhatsApp({
        offerNo: waOfferNo,
        stage: waStage,
        customerPhone: waPhone,
        customerName: waCustomerName,
      });

      if (res?.success) {
        toast.success(`Quotation PDF dispatched to ${waPhone} via WhatsApp!`);
        setShowWhatsAppModal(false);
        fetchQuotations();
      } else {
        toast.error(res?.message || 'Failed to send WhatsApp quotation');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error sending WhatsApp quotation');
    } finally {
      setIsSendingWa(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`Copied "${text}" to clipboard`);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans pb-16">
      {/* Top Banner & Breadcrumb */}
      <div className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-sky-900/40">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black text-white tracking-tight">
                  BDM Quotations Pipeline
                </h1>
                <span className="text-[10px] font-mono font-bold bg-sky-500/20 text-sky-300 px-2.5 py-0.5 rounded-full border border-sky-500/30">
                  Stage-Wise View
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Manage and track customer quotes across Stage 1 (Initial: -1), Stage 2 (Negotiation: -2), and Stage 3 (Final & CRM: -3).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={fetchQuotations}
              disabled={loading}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-700/80"
              title="Refresh Pipeline"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-sky-400' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <Link
              href="/quotations"
              className="px-4 py-2 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md shadow-teal-950/50 active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Create Quotation</span>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 w-full">
        {/* KPI Metrics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Total Quotations */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 shadow-sm space-y-1">
            <div className="flex items-center justify-between text-slate-400 text-[11px] font-bold">
              <span>Total Quotes</span>
              <FileText className="w-3.5 h-3.5 text-sky-400" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-white">
              {metrics.totalBaseQuotations || 0}
            </div>
            <div className="text-[10px] text-slate-500">Across all customers</div>
          </div>

          {/* Stage 1 Count */}
          <div className="bg-slate-900/90 border border-blue-500/30 rounded-2xl p-3.5 shadow-sm space-y-1">
            <div className="flex items-center justify-between text-blue-300 text-[11px] font-bold">
              <span>Stage 1 (Initial)</span>
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
            </div>
            <div className="text-xl sm:text-2xl font-black text-blue-400">
              {metrics.totalStage1 || 0}
            </div>
            <div className="text-[10px] text-slate-500">Initial Proposals (-1)</div>
          </div>

          {/* Stage 2 Count */}
          <div className="bg-slate-900/90 border border-amber-500/30 rounded-2xl p-3.5 shadow-sm space-y-1">
            <div className="flex items-center justify-between text-amber-300 text-[11px] font-bold">
              <span>Stage 2 (Negotiation)</span>
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            </div>
            <div className="text-xl sm:text-2xl font-black text-amber-400">
              {metrics.totalStage2 || 0}
            </div>
            <div className="text-[10px] text-slate-500">Under Negotiation (-2)</div>
          </div>

          {/* Stage 3 Count */}
          <div className="bg-slate-900/90 border border-teal-500/30 rounded-2xl p-3.5 shadow-sm space-y-1">
            <div className="flex items-center justify-between text-teal-300 text-[11px] font-bold">
              <span>Stage 3 (Final)</span>
              <span className="w-2 h-2 rounded-full bg-teal-400"></span>
            </div>
            <div className="text-xl sm:text-2xl font-black text-teal-400">
              {metrics.totalStage3 || 0}
            </div>
            <div className="text-[10px] text-slate-500">Commercial Finalized (-3)</div>
          </div>

          {/* CRM Approved */}
          <div className="bg-slate-900/90 border border-emerald-500/30 rounded-2xl p-3.5 shadow-sm space-y-1">
            <div className="flex items-center justify-between text-emerald-300 text-[11px] font-bold">
              <span>CRM Approved</span>
              <Award className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-emerald-400">
              {metrics.totalCrmApproved || 0}
            </div>
            <div className="text-[10px] text-slate-500">Converted to Customers & Projects</div>
          </div>

          {/* Pipeline Value */}
          <div className="bg-gradient-to-br from-slate-900 to-indigo-950/60 border border-indigo-500/30 rounded-2xl p-3.5 shadow-sm space-y-1">
            <div className="flex items-center justify-between text-indigo-300 text-[11px] font-bold">
              <span>Pipeline Value</span>
              <DollarSign className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <div className="text-lg sm:text-xl font-black text-indigo-300 truncate">
              ₹{(metrics.totalPipelineValue || 0).toLocaleString('en-IN')}
            </div>
            <div className="text-[10px] text-slate-500">Active contract total</div>
          </div>
        </div>

        {/* Filters & Search Toolbar */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by customer name, phone, city, offer code..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>

            {/* BDM Selector Dropdown */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-400 whitespace-nowrap flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-sky-400" />
                <span>BDM Rep:</span>
              </label>
              <select
                value={selectedBdm}
                onChange={(e) => setSelectedBdm(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
              >
                <option value="ALL">All BDM Representatives</option>
                {availableBdms.map((b) => (
                  <option key={b._id} value={b.name}>
                    {b.name} ({b.phone || 'BDM'})
                  </option>
                ))}
              </select>

              {currentUser?.role === 'BDM' && (
                <button
                  type="button"
                  onClick={() => {
                    setViewMyOnly(!viewMyOnly);
                    setSelectedBdm(!viewMyOnly ? currentUser.name : 'ALL');
                  }}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                    viewMyOnly
                      ? 'bg-sky-600/30 text-sky-300 border-sky-500/50'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  {viewMyOnly ? '✓ My Quotes' : 'All Quotes'}
                </button>
              )}
            </div>

            {/* Status Dropdown */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-400 whitespace-nowrap">
                Status:
              </label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="SENT_TO_CUSTOMER">Sent to Customer (WhatsApp)</option>
                <option value="FINALIZED">Finalized</option>
                <option value="CRM_APPROVED">CRM Approved ✅</option>
              </select>
            </div>
          </div>

          {/* Stage Filter Pills */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/60 text-xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">
              Filter Stage:
            </span>
            {[
              { id: 'ALL', label: 'All Quotations' },
              { id: '1', label: 'Stage 1: Initial Offer (-1)' },
              { id: '2', label: 'Stage 2: Negotiation (-2)' },
              { id: '3', label: 'Stage 3: Final Commercial (-3)' },
              { id: 'APPROVED', label: 'CRM Approved Projects' },
            ].map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setSelectedStage(st.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  selectedStage === st.id
                    ? 'bg-sky-600 text-white shadow-md shadow-sky-950/50'
                    : 'bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800/80 border border-slate-800/80'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        {/* Customer Quotation Stage Cards List */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
            <p className="text-xs font-semibold">Loading stage-wise quotations...</p>
          </div>
        ) : filteredQuotations.length === 0 ? (
          <div className="py-16 bg-slate-900/60 border border-dashed border-slate-800 rounded-3xl text-center space-y-4 p-8">
            <div className="w-14 h-14 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto text-slate-500">
              <Briefcase className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white">No Quotations Found</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                No quotations match your current search or filter criteria. Create your first customer quotation in the studio!
              </p>
            </div>
            <Link
              href="/quotations"
              className="inline-flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-sky-900/40"
            >
              <Plus className="w-4 h-4" />
              <span>Create Quotation Now</span>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredQuotations.map((item) => {
              const s1 = item.stages?.stage1;
              const s2 = item.stages?.stage2;
              const s3 = item.stages?.stage3;
              const isApproved = item.latestStatus === 'CRM_APPROVED' || s3?.status === 'CRM_APPROVED';

              return (
                <div
                  key={item.baseOfferNo}
                  className={`bg-slate-900/90 border rounded-2xl p-4 sm:p-5 transition-all shadow-sm space-y-4 hover:border-slate-700 ${
                    isApproved
                      ? 'border-emerald-500/40 shadow-emerald-950/20'
                      : item.highestStage === 2
                      ? 'border-amber-500/30'
                      : 'border-slate-800'
                  }`}
                >
                  {/* Card Header: Customer Info & Base Code */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm sm:text-base font-black text-white">
                          {item.customerName || 'Valued Customer'}
                        </span>
                        {item.customerCity && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 bg-slate-800 px-2.5 py-0.5 rounded-full">
                            <MapPin className="w-3 h-3 text-sky-400" />
                            {item.customerCity}
                          </span>
                        )}
                        {/* Current Highest Stage Pill */}
                        <span
                          className={`text-[10px] font-bold font-mono px-2.5 py-0.5 rounded-full border ${
                            isApproved
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              : item.highestStage === 3
                              ? 'bg-teal-500/20 text-teal-300 border-teal-500/40'
                              : item.highestStage === 2
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              : 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                          }`}
                        >
                          {isApproved
                            ? 'CRM Approved ✅'
                            : item.highestStage === 3
                            ? 'Stage 3: Final Commercial'
                            : item.highestStage === 2
                            ? 'Stage 2: Negotiation Active'
                            : 'Stage 1: Initial Offer'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                        {/* Phone with WhatsApp link */}
                        {item.customerPhone ? (
                          <a
                            href={`https://wa.me/${item.customerPhone.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-medium"
                          >
                            <Phone className="w-3 h-3" />
                            <span>{item.customerPhone}</span>
                          </a>
                        ) : (
                          <span className="text-slate-500">No phone provided</span>
                        )}

                        {/* Model & Stops info */}
                        <span className="text-slate-600">•</span>
                        <span>
                          Model: <strong className="text-slate-200">{item.elevatorModel}</strong> ({item.noOfStops})
                        </span>

                        {/* BDM Representative */}
                        <span className="text-slate-600">•</span>
                        <span className="inline-flex items-center gap-1 text-sky-400">
                          <User className="w-3 h-3" />
                          <span>BDM: {item.bdmName}</span>
                        </span>
                      </div>
                    </div>

                    {/* Base Offer Code & Actions */}
                    <div className="flex items-center gap-2 self-start md:self-auto">
                      <div
                        onClick={() => copyToClipboard(item.baseOfferNo)}
                        className="bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-xs font-mono font-bold text-slate-300 flex items-center gap-2 cursor-pointer hover:border-slate-700"
                        title="Click to copy base offer code"
                      >
                        <span>{item.baseOfferNo}</span>
                        <Copy className="w-3 h-3 text-slate-500" />
                      </div>

                      {/* Export Excel Button */}
                      <a
                        href={api.quotations.getExportExcelUrl(item.baseOfferNo)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-800/80 rounded-xl transition-colors cursor-pointer"
                        title="Download Stage 1 vs 2 vs 3 Comparison Excel (.xlsx)"
                      >
                        <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                      </a>
                    </div>
                  </div>

                  {/* 3-STAGE VISUAL PROGRESS PIPELINE */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* STAGE 1: INITIAL OFFER */}
                    <div
                      className={`p-3.5 rounded-xl border space-y-2.5 transition-all ${
                        s1
                          ? 'bg-blue-950/20 border-blue-500/30'
                          : 'bg-slate-950/40 border-slate-800/80 opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-black flex items-center justify-center">
                            1
                          </span>
                          <span className="text-xs font-bold text-white">Stage 1: Initial</span>
                        </div>
                        {s1 ? (
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                            {s1.status}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500">Not Created</span>
                        )}
                      </div>

                      {s1 ? (
                        <div className="space-y-1.5 text-xs">
                          <div className="text-[11px] font-mono font-bold text-blue-200">
                            {s1.offerNo}
                          </div>
                          <div className="text-sm font-extrabold text-white">
                            ₹{s1.grandTotal.toLocaleString('en-IN')}{' '}
                            <span className="text-[10px] text-slate-400 font-normal">
                              (Incl. 18% GST)
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400">
                            Saved:{' '}
                            {new Date(s1.updatedAt).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </div>

                          <div className="pt-2 flex items-center gap-1.5">
                            <Link
                              href={`/quotations?offerNo=${encodeURIComponent(s1.offerNo)}&stage=1`}
                              className="flex-1 py-1 px-2.5 bg-blue-600/80 hover:bg-blue-600 text-white rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-all"
                            >
                              <FileText className="w-3 h-3" />
                              <span>Studio</span>
                            </Link>
                            <button
                              type="button"
                              onClick={() => {
                                setWaOfferNo(s1.offerNo);
                                setWaStage(1);
                                setWaCustomerName(item.customerName);
                                setWaPhone(item.customerPhone || '');
                                setShowWhatsAppModal(true);
                              }}
                              className="p-1 px-2 bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                              title="Send Stage 1 PDF via WhatsApp"
                            >
                              <Send className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="py-4 text-center">
                          <Link
                            href={`/quotations?offerNo=${encodeURIComponent(item.baseOfferNo)}-1&stage=1`}
                            className="text-xs text-sky-400 hover:underline font-semibold"
                          >
                            + Start Stage 1
                          </Link>
                        </div>
                      )}
                    </div>

                    {/* STAGE 2: NEGOTIATION */}
                    <div
                      className={`p-3.5 rounded-xl border space-y-2.5 transition-all ${
                        s2
                          ? 'bg-amber-950/20 border-amber-500/30'
                          : 'bg-slate-950/40 border-slate-800/80'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-amber-600 text-white text-[10px] font-black flex items-center justify-center">
                            2
                          </span>
                          <span className="text-xs font-bold text-white">Stage 2: Negotiation</span>
                        </div>
                        {s2 ? (
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            {s2.status}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500">Pending</span>
                        )}
                      </div>

                      {s2 ? (
                        <div className="space-y-1.5 text-xs">
                          <div className="text-[11px] font-mono font-bold text-amber-200">
                            {s2.offerNo}
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-extrabold text-white">
                              ₹{s2.grandTotal.toLocaleString('en-IN')}
                            </div>
                            {/* Price difference vs Stage 1 */}
                            {s1 && (
                              <span
                                className={`text-[10px] font-bold font-mono px-1.5 py-0.5 rounded ${
                                  s2.grandTotal < s1.grandTotal
                                    ? 'bg-emerald-500/20 text-emerald-300'
                                    : s2.grandTotal > s1.grandTotal
                                    ? 'bg-amber-500/20 text-amber-300'
                                    : 'bg-slate-800 text-slate-400'
                                }`}
                              >
                                {s2.grandTotal === s1.grandTotal
                                  ? 'No variance'
                                  : s2.grandTotal < s1.grandTotal
                                  ? `-₹${(s1.grandTotal - s2.grandTotal).toLocaleString('en-IN')}`
                                  : `+₹${(s2.grandTotal - s1.grandTotal).toLocaleString('en-IN')}`}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            Updated:{' '}
                            {new Date(s2.updatedAt).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </div>

                          <div className="pt-2 flex items-center gap-1.5">
                            <Link
                              href={`/quotations?offerNo=${encodeURIComponent(s2.offerNo)}&stage=2`}
                              className="flex-1 py-1 px-2.5 bg-amber-600/80 hover:bg-amber-600 text-white rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-all"
                            >
                              <FileText className="w-3 h-3" />
                              <span>Studio</span>
                            </Link>
                            <button
                              type="button"
                              onClick={() => {
                                setWaOfferNo(s2.offerNo);
                                setWaStage(2);
                                setWaCustomerName(item.customerName);
                                setWaPhone(item.customerPhone || '');
                                setShowWhatsAppModal(true);
                              }}
                              className="p-1 px-2 bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                              title="Send Stage 2 PDF via WhatsApp"
                            >
                              <Send className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="py-4 text-center">
                          {s1 ? (
                            <Link
                              href={`/quotations?offerNo=${encodeURIComponent(s1.offerNo)}&stage=2`}
                              className="text-xs text-amber-400 hover:text-amber-300 font-bold inline-flex items-center gap-1 bg-amber-950/40 border border-amber-800/80 px-2.5 py-1 rounded-lg"
                            >
                              <span>+ Start Negotiation (-2)</span>
                              <ArrowRight className="w-3 h-3" />
                            </Link>
                          ) : (
                            <span className="text-[11px] text-slate-500">Requires Stage 1</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* STAGE 3: FINAL & CRM APPROVAL */}
                    <div
                      className={`p-3.5 rounded-xl border space-y-2.5 transition-all ${
                        s3
                          ? isApproved
                            ? 'bg-emerald-950/30 border-emerald-500/50 shadow-inner'
                            : 'bg-teal-950/20 border-teal-500/30'
                          : 'bg-slate-950/40 border-slate-800/80'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-teal-600 text-white text-[10px] font-black flex items-center justify-center">
                            3
                          </span>
                          <span className="text-xs font-bold text-white">Stage 3: Final CRM</span>
                        </div>
                        {s3 ? (
                          <span
                            className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                              isApproved
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                : 'bg-teal-500/20 text-teal-300 border-teal-500/40'
                            }`}
                          >
                            {isApproved ? 'CRM_APPROVED ✅' : s3.status}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500">Pending</span>
                        )}
                      </div>

                      {s3 ? (
                        <div className="space-y-1.5 text-xs">
                          <div className="text-[11px] font-mono font-bold text-teal-200">
                            {s3.offerNo}
                          </div>
                          <div className="text-sm font-extrabold text-white">
                            ₹{s3.grandTotal.toLocaleString('en-IN')}{' '}
                            <span className="text-[10px] text-slate-400 font-normal">
                              (Contract Value)
                            </span>
                          </div>

                          {/* Linked Customer & Project IDs if approved */}
                          {item.createdCustomerCode || item.createdProjectCode ? (
                            <div className="p-1.5 rounded-lg bg-emerald-950/60 border border-emerald-500/30 text-[10px] font-mono text-emerald-300 flex items-center justify-between">
                              <span>Customer: {item.createdCustomerCode || 'CUST'}</span>
                              <span>Project: {item.createdProjectCode || 'ALP'}</span>
                            </div>
                          ) : (
                            <div className="text-[10px] text-slate-400">
                              Finalized:{' '}
                              {new Date(s3.updatedAt).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </div>
                          )}

                          <div className="pt-2 flex items-center gap-1.5">
                            <Link
                              href={`/quotations?offerNo=${encodeURIComponent(s3.offerNo)}&stage=3`}
                              className="flex-1 py-1 px-2.5 bg-teal-600/80 hover:bg-teal-600 text-white rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-all"
                            >
                              <FileText className="w-3 h-3" />
                              <span>Studio</span>
                            </Link>

                            {!isApproved && (
                              s3.status === 'APPROVAL_REQUESTED' && currentUser?.role === 'BDM' ? (
                                <span className="py-1 px-2 bg-amber-950/60 text-amber-300 border border-amber-800/80 rounded-lg text-[10px] font-black flex items-center gap-1">
                                  <span>⏳ Awaiting CRM</span>
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  disabled={approvingOfferNo === s3.offerNo}
                                  onClick={() => handleCrmApprove(s3.offerNo)}
                                  className={`py-1 px-2.5 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50 ${
                                    currentUser?.role === 'BDM'
                                      ? 'bg-sky-700 hover:bg-sky-600'
                                      : 'bg-emerald-700 hover:bg-emerald-600'
                                  }`}
                                  title={
                                    currentUser?.role === 'BDM'
                                      ? 'Submit request for CRM Approval'
                                      : 'CRM Role: Approve and Auto-create Customer and Project'
                                  }
                                >
                                  {approvingOfferNo === s3.offerNo ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : currentUser?.role === 'BDM' ? (
                                    <Send className="w-3 h-3" />
                                  ) : (
                                    <Award className="w-3 h-3" />
                                  )}
                                  <span>{currentUser?.role === 'BDM' ? 'Request Approval' : 'Approve'}</span>
                                </button>
                              )
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                setWaOfferNo(s3.offerNo);
                                setWaStage(3);
                                setWaCustomerName(item.customerName);
                                setWaPhone(item.customerPhone || '');
                                setShowWhatsAppModal(true);
                              }}
                              className="p-1 px-2 bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                              title="Send Stage 3 PDF via WhatsApp"
                            >
                              <Send className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="py-4 text-center">
                          {s2 ? (
                            <Link
                              href={`/quotations?offerNo=${encodeURIComponent(s2.offerNo)}&stage=3`}
                              className="text-xs text-teal-400 hover:text-teal-300 font-bold inline-flex items-center gap-1 bg-teal-950/40 border border-teal-800/80 px-2.5 py-1 rounded-lg"
                            >
                              <span>+ Finalize Stage 3 (-3)</span>
                              <ArrowRight className="w-3 h-3" />
                            </Link>
                          ) : (
                            <span className="text-[11px] text-slate-500">Requires Stage 2</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* WhatsApp Send Modal */}
      {showWhatsAppModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">
                  Send Stage {waStage} PDF via WhatsApp
                </h3>
              </div>
              <button
                onClick={() => setShowWhatsAppModal(false)}
                className="text-slate-400 hover:text-white text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Customer Name:</label>
                <div className="font-bold text-white bg-slate-950 px-3 py-2 rounded-xl border border-slate-800">
                  {waCustomerName}
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Offer Number:</label>
                <div className="font-mono font-bold text-sky-400 bg-slate-950 px-3 py-2 rounded-xl border border-slate-800">
                  {waOfferNo}
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Customer WhatsApp Number:</label>
                <input
                  type="text"
                  value={waPhone}
                  onChange={(e) => setWaPhone(e.target.value)}
                  placeholder="e.g. 98401 23456"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-[11px] text-emerald-300">
                The official Stage {waStage} proposal document will be generated and attached directly to the WhatsApp message sent to the customer.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowWhatsAppModal(false)}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSendingWa}
                onClick={handleSendWhatsAppSubmit}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-emerald-950/50 disabled:opacity-50 cursor-pointer"
              >
                {isSendingWa ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Sending PDF...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Send PDF to WhatsApp</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

