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
} from 'lucide-react';
import { api } from '../../lib/api';

export default function HandoverCustomersPage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'HANDOVER' | 'TESTING' | 'COMPLETED'>('HANDOVER');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [exporting, setExporting] = useState(false);

  const fetchHandoverProjects = async () => {
    try {
      setLoading(true);
      const res = await api.getProjects({
        status: statusFilter,
        paymentStatus: paymentFilter || undefined,
        search: search || undefined,
      });
      setProjects(res.data || []);
    } catch (err: any) {
      console.error('Failed to load handover projects:', err);
    } finally {
      setLoading(false);
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
    </div>
  );
}
