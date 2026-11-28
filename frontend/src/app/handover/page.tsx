'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Handshake,
  Search,
  Filter,
  ArrowRight,
  FileSpreadsheet,
  Building2,
  Phone,
  MessageSquare,
  Calendar,
  IndianRupee,
  Clock,
  CheckCircle2,
  CheckCheck,
  ExternalLink,
  MapPin,
  RefreshCw,
  Check,
  Layers,
  ArrowUpRight,
  Briefcase,
  Wrench,
  UserCheck,
  ShieldCheck,
  Plus,
  Edit2,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../../lib/api';
import { buildWarrantyText, parseWarrantyText } from '../../types/quotation';
import SiteProblemsView, { AssignCallbackProblemModal } from '../../components/SiteProblemsView';

export default function HandoverCustomersPage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'HANDOVER' | 'TESTING' | 'COMPLETED'>('HANDOVER');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [exporting, setExporting] = useState(false);
  const [callbackModalOpen, setCallbackModalOpen] = useState(false);
  const [selectedCallbackCustomer, setSelectedCallbackCustomer] = useState<any>(null);
  const [selectedCallbackProject, setSelectedCallbackProject] = useState<any>(null);
  const [problemsRefreshKey, setProblemsRefreshKey] = useState(0);

  // AMC / Warranty Modal State for Manual Customers (and editing existing AMC)
  const [amcModalProject, setAmcModalProject] = useState<any | null>(null);
  const [amcMotorWarranty, setAmcMotorWarranty] = useState<string>('Lifetime');
  const [amcMfgWarranty, setAmcMfgWarranty] = useState<string>('5 years');
  const [amcFreeMaintenance, setAmcFreeMaintenance] = useState<string>('1 Years');
  const [amcIncludeBattery, setAmcIncludeBattery] = useState<boolean>(false);
  const [amcFullText, setAmcFullText] = useState<string>('');
  const [savingAmc, setSavingAmc] = useState<boolean>(false);

  const fetchHandoverProjects = async () => {
    try {
      setLoading(true);
      const [res, quotesRes] = await Promise.all([
        api.getProjects({
          status: statusFilter,
          paymentStatus: paymentFilter || undefined,
          search: search || undefined,
        }),
        api.quotations.getBdmStageWiseQuotations({ all: true }).catch(() => ({ data: [] })),
      ]);

      const rawList = res.data || [];
      const quoteGroups: any[] = quotesRes?.data || [];

      const enriched = rawList.map((proj: any) => {
        if (proj.amcWarranty && String(proj.amcWarranty).trim()) {
          const parsed = parseWarrantyText(proj.amcWarranty);
          return {
            ...proj,
            motorWarranty: proj.motorWarranty || parsed.motorWarranty,
            manufacturingWarranty: proj.manufacturingWarranty || parsed.manufacturingWarranty,
            freeMaintenance: proj.freeMaintenance || parsed.freeMaintenance,
          };
        }

        const customer = proj.customerId || {};
        const projCode = String(proj.projectId || '').trim().toUpperCase();
        const custCode = String(customer.customerId || proj.customerCode || '').trim().toUpperCase();
        const custNameNorm = String(customer.fullName || proj.projectName || '')
          .replace(/\s*residence$/i, '')
          .replace(/^Dear\s*/i, '')
          .trim()
          .toLowerCase();
        const custPhoneClean = String(customer.phoneNumber || proj.customerPhone || '').replace(/\D/g, '').slice(-10);

        const matchedGroup = quoteGroups.find((g: any) => {
          if (projCode && String(g.createdProjectCode || '').toUpperCase() === projCode) return true;
          if (custCode && String(g.createdCustomerCode || '').toUpperCase() === custCode) return true;
          if (proj._id && String(g.createdProjectId || '') === String(proj._id)) return true;
          if (customer._id && String(g.createdCustomerId || '') === String(customer._id)) return true;

          const isApproved =
            g.latestStatus === 'CRM_APPROVED' ||
            g.stages?.stage4?.status === 'CRM_APPROVED' ||
            g.stages?.stage3?.status === 'CRM_APPROVED';
          if (isApproved) {
            const gPhone = String(g.customerPhone || '').replace(/\D/g, '').slice(-10);
            if (custPhoneClean && custPhoneClean.length === 10 && gPhone === custPhoneClean) return true;
            const gName = String(g.customerName || '')
              .replace(/^Dear\s*/i, '')
              .trim()
              .toLowerCase();
            if (custNameNorm && gName && gName === custNameNorm) return true;
          }
          return false;
        });

        if (matchedGroup) {
          const bestStage =
            matchedGroup.stages?.stage4 ||
            matchedGroup.stages?.stage3 ||
            matchedGroup.stages?.stage2 ||
            matchedGroup.stages?.stage1;
          const qData = bestStage?.data || {};
          const qWarranty =
            qData.warranty ||
            'Lifetime- MOTOR WARRANTY, 5 years - manufacturing warranty + 1 Years Free Maintenance';
          const parsed = parseWarrantyText(qWarranty);
          return {
            ...proj,
            amcWarranty: qWarranty,
            motorWarranty: qData.motorWarranty || parsed.motorWarranty || 'Lifetime',
            manufacturingWarranty: qData.manufacturingWarranty || parsed.manufacturingWarranty || '5 years',
            freeMaintenance: qData.freeMaintenance || parsed.freeMaintenance || '1 Years',
            amcSource: 'QUOTATION',
            quotationOfferNo: bestStage?.offerNo || matchedGroup.baseOfferNo,
          };
        }

        return proj;
      });

      setProjects(enriched);
    } catch (err: any) {
      console.error('Failed to load handover projects:', err);
    } finally {
      setLoading(false);
    }
  };

  const openAmcModal = (proj: any) => {
    const existingText = String(proj.amcWarranty || '').trim();
    const isEv = Boolean(
      (proj.liftModel && /\bEV\b|home\s*EV|battery/i.test(proj.liftModel)) ||
        /battery\s*warranty/i.test(existingText)
    );
    const parsed = parseWarrantyText(existingText);
    const motor = proj.motorWarranty || parsed.motorWarranty || 'Lifetime';
    const mfg = proj.manufacturingWarranty || parsed.manufacturingWarranty || '5 years';
    const maint = proj.freeMaintenance || parsed.freeMaintenance || '1 Years';
    const full =
      existingText ||
      buildWarrantyText({
        motorWarranty: motor,
        manufacturingWarranty: mfg,
        freeMaintenance: maint,
        isEv,
      });

    setAmcModalProject(proj);
    setAmcMotorWarranty(motor);
    setAmcMfgWarranty(mfg);
    setAmcFreeMaintenance(maint);
    setAmcIncludeBattery(isEv);
    setAmcFullText(full);
  };

  const handleAmcDropdownChange = (updates: {
    motorWarranty?: string;
    manufacturingWarranty?: string;
    freeMaintenance?: string;
    includeBattery?: boolean;
  }) => {
    const nextMotor = updates.motorWarranty !== undefined ? updates.motorWarranty : amcMotorWarranty;
    const nextMfg = updates.manufacturingWarranty !== undefined ? updates.manufacturingWarranty : amcMfgWarranty;
    const nextMaint = updates.freeMaintenance !== undefined ? updates.freeMaintenance : amcFreeMaintenance;
    const nextBat = updates.includeBattery !== undefined ? updates.includeBattery : amcIncludeBattery;

    setAmcMotorWarranty(nextMotor);
    setAmcMfgWarranty(nextMfg);
    setAmcFreeMaintenance(nextMaint);
    setAmcIncludeBattery(nextBat);
    setAmcFullText(
      buildWarrantyText({
        motorWarranty: nextMotor,
        manufacturingWarranty: nextMfg,
        freeMaintenance: nextMaint,
        isEv: nextBat,
      })
    );
  };

  const handleSaveAmc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amcModalProject) return;
    const cleanText = amcFullText.trim();
    if (!cleanText) {
      toast.error('Please enter or select AMC / Warranty details');
      return;
    }
    try {
      setSavingAmc(true);
      const source: 'QUOTATION' | 'MANUAL' =
        amcModalProject.amcSource === 'QUOTATION' ? 'QUOTATION' : 'MANUAL';
      const payload = {
        amcWarranty: cleanText,
        motorWarranty: amcMotorWarranty,
        manufacturingWarranty: amcMfgWarranty,
        freeMaintenance: amcFreeMaintenance,
        amcSource: source,
      };
      await api.updateProjectAmc(amcModalProject._id, payload, amcModalProject.projectId);
      setProjects((prev) =>
        prev.map((p) => (String(p._id) === String(amcModalProject._id) ? { ...p, ...payload } : p))
      );
      toast.success(`AMC (Warranty) saved for ${amcModalProject.projectName}!`);
      setAmcModalProject(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save AMC / Warranty');
    } finally {
      setSavingAmc(false);
    }
  };

  useEffect(() => {
    fetchHandoverProjects();
  }, [statusFilter, paymentFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchHandoverProjects();
  };

  const handleExportExcel = async () => {
    try {
      setExporting(true);
      const blob = await api.exportProjectsExcel({
        status: statusFilter,
        paymentStatus: paymentFilter || undefined,
        search: search || undefined,
      });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Handover_Customers_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Error exporting Excel: ${err.message}`);
    } finally {
      setExporting(false);
    }
  };

  // KPI Calculations
  const metrics = useMemo(() => {
    const total = projects.length;
    const inTesting = projects.filter((p) => p.projectStatus === 'TESTING').length;
    const completed = projects.filter((p) => p.projectStatus === 'COMPLETED').length;
    const totalValue = projects.reduce((sum, p) => sum + (Number(p.orderValue) || 0), 0);
    const fullyPaid = projects.filter((p) => p.paymentStatus === 'FULLY_PAID').length;
    return { total, inTesting, completed, totalValue, fullyPaid };
  }, [projects]);

  const getCleanPhone = (phone?: string) => {
    if (!phone) return '';
    return phone.replace(/\D/g, '');
  };

  const formatCurrency = (val?: number | string) => {
    const n = Number(val || 0);
    return `₹${n.toLocaleString('en-IN')}`;
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-teal-900 via-slate-900 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-slate-800">
        <div className="absolute right-0 top-0 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30 text-xs font-semibold">
              <Handshake className="w-3.5 h-3.5" />
              <span>Dedicated Portal</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2.5">
              Handover Customers
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Monitoring all clients in final Testing &amp; Commissioning or Completed Handover stages. Pre-handover manufacturing &amp; site execution projects remain segregated in the main projects view.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                setSelectedCallbackCustomer(null);
                setSelectedCallbackProject(null);
                setCallbackModalOpen(true);
              }}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-extrabold transition-all shadow-lg shadow-amber-950/30 active:scale-95 flex items-center gap-2 cursor-pointer"
            >
              <Wrench className="w-4 h-4" />
              <span>Callback Customer &amp; Assign Lift Problem</span>
            </button>

            <button
              onClick={handleExportExcel}
              disabled={exporting || loading}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-950/30 active:scale-95 flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>{exporting ? 'Exporting...' : 'Export Handover Excel'}</span>
            </button>

            <Link
              href="/projects"
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 flex items-center gap-2"
            >
              <span>Active Execution Projects</span>
              <ArrowRight className="w-4 h-4 text-slate-400" />
            </Link>
          </div>
        </div>

        {/* Quick KPI Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-6 pt-6 border-t border-slate-800/80">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 backdrop-blur-sm">
            <div className="text-[11px] font-medium text-slate-400">Total Handover Customers</div>
            <div className="text-xl sm:text-2xl font-black text-white mt-1">{metrics.total}</div>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3.5 backdrop-blur-sm">
            <div className="text-[11px] font-medium text-amber-300 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>In Testing / Commissioning</span>
            </div>
            <div className="text-xl sm:text-2xl font-black text-amber-400 mt-1">{metrics.inTesting}</div>
          </div>
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-3.5 backdrop-blur-sm">
            <div className="text-[11px] font-medium text-emerald-300 flex items-center gap-1.5">
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Project Completed</span>
            </div>
            <div className="text-xl sm:text-2xl font-black text-emerald-400 mt-1">{metrics.completed}</div>
          </div>
          <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-2xl p-3.5 backdrop-blur-sm">
            <div className="text-[11px] font-medium text-cyan-300 flex items-center gap-1.5">
              <IndianRupee className="w-3.5 h-3.5" />
              <span>Total Handover Value</span>
            </div>
            <div className="text-lg sm:text-xl font-black text-cyan-400 mt-1 truncate">
              {formatCurrency(metrics.totalValue)}
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3">
        <form onSubmit={handleSearchSubmit} className="flex-1 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search handover customers by name, code (ALP-001), phone, site address..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </form>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Filter className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Stage:</span>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none bg-white text-slate-700 font-semibold cursor-pointer"
          >
            <option value="HANDOVER">All Handover (Testing &amp; Completed)</option>
            <option value="TESTING">In Testing / Handover Stage</option>
            <option value="COMPLETED">Completed &amp; Handed Over</option>
          </select>

          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none bg-white text-slate-700 cursor-pointer"
          >
            <option value="">All Payments</option>
            <option value="FULLY_PAID">Fully Paid</option>
            <option value="PARTIAL_PAID">Partially Paid</option>
            <option value="ADVANCE_PAID">Advance Paid</option>
          </select>

          <button
            onClick={fetchHandoverProjects}
            className="p-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-600 transition-colors"
            title="Refresh List"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Customer Projects List / Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-16 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-teal-600 animate-spin mx-auto" />
            <p className="text-xs font-semibold text-slate-600">Loading Handover Customers...</p>
          </div>
        ) : projects.length === 0 ? (
          <div className="p-16 text-center space-y-4 max-w-md mx-auto">
            <div className="w-16 h-16 rounded-3xl bg-teal-50 border border-teal-200 flex items-center justify-center mx-auto text-teal-600">
              <Handshake className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">No Handover Customers Found</h3>
              <p className="text-xs text-slate-500 mt-1">
                {search || paymentFilter || statusFilter !== 'HANDOVER'
                  ? 'No handover records match your current search and filter criteria.'
                  : 'There are currently no elevator projects in Testing / Handover or Completed status.'}
              </p>
            </div>
            {(search || paymentFilter || statusFilter !== 'HANDOVER') && (
              <button
                onClick={() => {
                  setSearch('');
                  setStatusFilter('HANDOVER');
                  setPaymentFilter('');
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-400 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3.5 px-4 font-bold">Project / Code</th>
                  <th className="py-3.5 px-4 font-bold">Customer Details</th>
                  <th className="py-3.5 px-4 font-bold">Handover Status</th>
                  <th className="py-3.5 px-4 font-bold">Financial Summary</th>
                  <th className="py-3.5 px-4 font-bold">AMC (Warranty)</th>
                  <th className="py-3.5 px-4 font-bold">Specs &amp; Location</th>
                  <th className="py-3.5 px-4 font-bold">WhatsApp Group</th>
                  <th className="py-3.5 px-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {projects.map((proj) => {
                  const customer = proj.customerId || {};
                  const isCompleted = proj.projectStatus === 'COMPLETED';
                  const isTesting = proj.projectStatus === 'TESTING';
                  const phone = customer.phoneNumber || proj.customerPhone || '';
                  const cleanPhone = getCleanPhone(phone);
                  const orderVal = Number(proj.orderValue || 0);
                  const advanceVal = Number(proj.advanceAmount || 0);
                  const balanceVal = Math.max(0, orderVal - advanceVal);

                  return (
                    <tr key={proj._id} className="hover:bg-slate-50/80 transition-colors group">
                      {/* Project Code & Name */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <Link
                            href={`/projects/${proj._id}`}
                            className="font-bold text-slate-900 group-hover:text-teal-600 transition-colors flex items-center gap-1.5"
                          >
                            <span>{proj.projectName}</span>
                            <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-teal-600" />
                          </Link>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[11px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                              {proj.projectId}
                            </span>
                            {customer.customerCode && (
                              <span className="text-[10px] text-slate-400 font-mono">
                                ({customer.customerCode})
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Customer Details */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <div className="font-semibold text-slate-800">
                            {customer.fullName || 'Unknown Customer'}
                          </div>
                          {phone && (
                            <div className="text-slate-500 text-[11px] flex items-center gap-1 font-mono">
                              <Phone className="w-3 h-3 text-slate-400" />
                              <span>{phone}</span>
                            </div>
                          )}
                          {customer.city && (
                            <div className="text-slate-400 text-[10px] flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-slate-300" />
                              <span>{customer.city}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Handover Status */}
                      <td className="py-3.5 px-4">
                        {isCompleted ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Completed &amp; Handed Over</span>
                          </span>
                        ) : isTesting ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            <span>Handover Testing</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-300">
                            <span>{proj.projectStatus}</span>
                          </span>
                        )}
                      </td>

                      {/* Financial Summary */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <div className="font-bold text-slate-800">
                            {formatCurrency(orderVal)}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {proj.paymentStatus === 'FULLY_PAID' ? (
                              <span className="text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                Fully Paid
                              </span>
                            ) : (
                              <span className="text-amber-700 font-medium">
                                Bal: {formatCurrency(balanceVal)}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* AMC (Warranty) Column */}
                      <td className="py-3.5 px-4">
                        {proj.amcWarranty ? (
                          <div className="space-y-1.5 max-w-[250px]">
                            <div className="flex items-center justify-between gap-1.5">
                              {proj.amcSource === 'QUOTATION' ? (
                                <span
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200"
                                  title={
                                    proj.quotationOfferNo
                                      ? `Auto-populated from Approved Quotation (${proj.quotationOfferNo})`
                                      : 'Auto-populated from Approved Quotation'
                                  }
                                >
                                  <ShieldCheck className="w-3 h-3 text-teal-600" />
                                  <span>Quotation Warranty</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
                                  <ShieldCheck className="w-3 h-3 text-indigo-600" />
                                  <span>Manual AMC</span>
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => openAmcModal(proj)}
                                className="p-1 text-slate-400 hover:text-teal-700 hover:bg-teal-50 rounded-lg transition-colors cursor-pointer"
                                title="Edit AMC / Warranty"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {proj.motorWarranty && (
                                <span className="text-[10px] font-semibold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200">
                                  Motor: {proj.motorWarranty}
                                </span>
                              )}
                              {proj.manufacturingWarranty && (
                                <span className="text-[10px] font-semibold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200">
                                  Mfg: {proj.manufacturingWarranty}
                                </span>
                              )}
                              {proj.freeMaintenance && (
                                <span className="text-[10px] font-bold bg-emerald-50 text-emerald-800 px-1.5 py-0.5 rounded border border-emerald-200">
                                  AMC: {proj.freeMaintenance} Free
                                </span>
                              )}
                            </div>
                            <div
                              className="text-[10px] text-slate-500 line-clamp-2 leading-snug"
                              title={proj.amcWarranty}
                            >
                              {proj.amcWarranty}
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            <span className="inline-block text-[10px] font-medium text-slate-400">
                              Manual Customer • No AMC Set
                            </span>
                            <div>
                              <button
                                type="button"
                                onClick={() => openAmcModal(proj)}
                                className="px-2.5 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-300 rounded-lg font-bold text-[11px] transition-colors inline-flex items-center gap-1 cursor-pointer shadow-2xs"
                              >
                                <Plus className="w-3 h-3 text-teal-600" />
                                <span>Add AMC (Warranty)</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Specs & Location */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5 max-w-[200px]">
                          <div className="font-medium text-slate-700 truncate">
                            {proj.liftModel || 'Standard Elevator'}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {proj.numberOfFloors ? `${proj.numberOfFloors} Floors` : 'Elevator'} • {proj.liftType || 'Lift'}
                          </div>
                          {proj.siteAddress && (
                            <div className="text-[10px] text-slate-400 truncate" title={proj.siteAddress}>
                              {proj.siteAddress}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* WhatsApp Group */}
                      <td className="py-3.5 px-4">
                        {proj.whatsapp?.groupId || proj.whatsappGroupId ? (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono text-[10px]">
                              <MessageSquare className="w-3 h-3 text-emerald-600" />
                              <span>Linked</span>
                            </span>
                            {proj.whatsapp?.inviteLink && (
                              <div>
                                <a
                                  href={proj.whatsapp.inviteLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[10px] text-teal-600 hover:underline flex items-center gap-1"
                                >
                                  <span>Open Group</span>
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[10px] italic">Not linked</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {cleanPhone && (
                            <>
                              <a
                                href={`tel:${cleanPhone}`}
                                className="p-1.5 text-slate-600 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors border border-transparent hover:border-sky-200"
                                title={`Call ${phone}`}
                              >
                                <Phone className="w-3.5 h-3.5" />
                              </a>
                              <a
                                href={`https://wa.me/${cleanPhone.startsWith('91') ? cleanPhone : '91' + cleanPhone}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors border border-transparent hover:border-emerald-200"
                                title={`WhatsApp Chat with ${customer.fullName || 'Customer'}`}
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                              </a>
                            </>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCallbackCustomer(customer);
                              setSelectedCallbackProject(proj);
                              setCallbackModalOpen(true);
                            }}
                            className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg font-extrabold text-[11px] transition-colors flex items-center gap-1 cursor-pointer"
                            title="Callback customer & assign lift problem to Srinivasan, Sundaram, Bala, or Maari"
                          >
                            <Wrench className="w-3 h-3 text-amber-600" />
                            <span>Assign Issue</span>
                          </button>

                          <Link
                            href={`/projects/${proj._id}`}
                            className="px-2.5 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded-lg font-bold text-[11px] transition-colors flex items-center gap-1"
                          >
                            <span>Details</span>
                            <ArrowRight className="w-3 h-3" />
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

      {/* Post-Handover Customer Callback & Lift Problem Assignment Section */}
      <SiteProblemsView key={problemsRefreshKey} mode="crm" />

      <AssignCallbackProblemModal
        isOpen={callbackModalOpen}
        onClose={() => setCallbackModalOpen(false)}
        initialCustomer={selectedCallbackCustomer}
        initialProject={selectedCallbackProject}
        onSuccess={() => setProblemsRefreshKey((k) => k + 1)}
      />

      {/* Add / Edit AMC (Warranty) Modal for Handover Customers */}
      {amcModalProject && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-fade-in">
            <div className="bg-gradient-to-r from-teal-900 via-slate-900 to-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-teal-500/20 border border-teal-400/40 text-teal-300 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black tracking-tight">
                    {amcModalProject.amcWarranty ? 'Edit AMC (Warranty)' : 'Add AMC (Warranty) — Manual Customer'}
                  </h3>
                  <p className="text-xs text-slate-300">
                    {amcModalProject.projectName} ({amcModalProject.projectId})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAmcModalProject(null)}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAmc} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Motor Warranty:
                  </label>
                  <select
                    value={amcMotorWarranty}
                    onChange={(e) => handleAmcDropdownChange({ motorWarranty: e.target.value })}
                    className="w-full text-xs px-2.5 py-2 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-teal-500 font-semibold text-slate-800"
                  >
                    <option value="Lifetime">Lifetime</option>
                    <option value="1years">1years</option>
                    <option value="2years">2years</option>
                    <option value="3years">3years</option>
                    <option value="4years">4years</option>
                    <option value="5years">5years</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Manufacturing Warranty:
                  </label>
                  <select
                    value={amcMfgWarranty}
                    onChange={(e) => handleAmcDropdownChange({ manufacturingWarranty: e.target.value })}
                    className="w-full text-xs px-2.5 py-2 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-teal-500 font-semibold text-slate-800"
                  >
                    <option value="1 years">1 years</option>
                    <option value="2 years">2 years</option>
                    <option value="3 years">3 years</option>
                    <option value="4 years">4 years</option>
                    <option value="5 years">5 years</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Free Maintenance (AMC):
                  </label>
                  <select
                    value={amcFreeMaintenance}
                    onChange={(e) => handleAmcDropdownChange({ freeMaintenance: e.target.value })}
                    className="w-full text-xs px-2.5 py-2 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-teal-500 font-semibold text-slate-800"
                  >
                    <option value="1 Years">1 Years</option>
                    <option value="2 Years">2 Years</option>
                    <option value="3 Years">3 Years</option>
                    <option value="4 Years">4 Years</option>
                    <option value="5 Years">5 Years</option>
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={amcIncludeBattery}
                  onChange={(e) => handleAmcDropdownChange({ includeBattery: e.target.checked })}
                  className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                />
                <span className="text-xs font-semibold text-slate-700">
                  Include 5 Years EV Battery Warranty (3 Years Replaceable &amp; 2 Years Service)
                </span>
              </label>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Full AMC / Warranty Term Text:
                </label>
                <textarea
                  rows={3}
                  value={amcFullText}
                  onChange={(e) => setAmcFullText(e.target.value)}
                  placeholder="e.g. Lifetime- MOTOR WARRANTY, 5 years - manufacturing warranty + 1 Years Free Maintenance"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 font-medium bg-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAmcModalProject(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingAmc}
                  className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white font-bold shadow-sm transition-colors cursor-pointer"
                >
                  {savingAmc ? 'Saving...' : 'Save AMC (Warranty)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
