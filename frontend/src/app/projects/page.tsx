'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Building2,
  Search,
  Filter,
  Plus,
  Send,
  MessageSquare,
  IndianRupee,
  Calendar,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  X,
} from 'lucide-react';
import { api, getStoredUser } from '../../lib/api';
import { formatProjectStatus, STAGES_ORDER } from '../../components/Timeline';

export default function ProjectsPage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');

  // User role
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const u = getStoredUser();
    setCurrentUser(u);
    api.getCurrentUser().then(res => {
      if (res?.user) setCurrentUser(res.user);
    }).catch(() => {});
  }, []);

  const isCrm = currentUser?.role === 'CRM';

  // Add Project Modal State
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newProject, setNewProject] = useState({
    customerId: '',
    projectName: '',
    siteAddress: '',
    liftModel: 'Hydraulic Home Series',
    liftType: 'Home Lift',
    numberOfFloors: 'G+1',
    shaftModel: '',
    liftAmount: '0',
    shaftAmount: '0',
    liftBaseAmount: '0',
    liftCashAmount: '0',
    liftNonCashAmount: '0',
    shaftBaseAmount: '0',
    shaftCashAmount: '0',
    shaftNonCashAmount: '0',
    advancePercentage: '30',
    productionPaymentPercent: '40',
    readinessNotificationPercent: '20',
    dispatchMaterialsPercent: '5',
    afterInstallationPercent: '5',
    expectedDeliveryDate: '',
    updateFrequencyDays: '20',
    whatsappGroupId: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const [projRes, custRes] = await Promise.all([
        api.getProjects({
          search: search || undefined,
          status: statusFilter || undefined,
          paymentStatus: paymentFilter || undefined,
        }),
        api.getCustomers(),
      ]);
      setProjects(projRes.data || []);
      setCustomers(custRes.data || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [statusFilter, paymentFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchProjects();
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const liftCash = Number(newProject.liftCashAmount || 0);
      const liftNonCash = Number(newProject.liftNonCashAmount || 0);
      const computedLiftAmount = liftCash + liftNonCash + (liftNonCash * 0.18);

      const shaftCash = newProject.shaftModel === 'Customer Scope' ? 0 : Number(newProject.shaftCashAmount || 0);
      const shaftNonCash = newProject.shaftModel === 'Customer Scope' ? 0 : Number(newProject.shaftNonCashAmount || 0);
      const computedShaftAmount = shaftCash + shaftNonCash + (shaftNonCash * 0.18);

      const computedOrderValue = computedLiftAmount + computedShaftAmount;

      await api.createProject({ 
        ...newProject, 
        dispatchMaterialsPercent: isCrm ? '0' : newProject.dispatchMaterialsPercent,
        afterInstallationPercent: isCrm ? '0' : newProject.afterInstallationPercent,
        liftAmount: computedLiftAmount,
        shaftAmount: computedShaftAmount,
        orderValue: computedOrderValue 
      });
      setIsAddOpen(false);
      setNewProject({
        customerId: '',
        projectName: '',
        siteAddress: '',
        liftModel: 'Hydraulic Home Series',
        liftType: 'Home Lift',
        numberOfFloors: 'G+1',
        shaftModel: '',
        liftAmount: '0',
        shaftAmount: '0',
        liftBaseAmount: '0',
        liftCashAmount: '0',
        liftNonCashAmount: '0',
        shaftBaseAmount: '0',
        shaftCashAmount: '0',
        shaftNonCashAmount: '0',
        advancePercentage: '30',
        productionPaymentPercent: '40',
        readinessNotificationPercent: '20',
        dispatchMaterialsPercent: '5',
        afterInstallationPercent: '5',
        expectedDeliveryDate: '',
        updateFrequencyDays: '20',
        whatsappGroupId: '',
        notes: '',
      });
      fetchProjects();
    } catch (err: any) {
      alert(`Error creating project: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">Active Elevator Projects</h2>
          <p className="text-xs text-slate-500">
            Monitoring {projects.length} installation projects and Meta WhatsApp communication groups
          </p>
        </div>
        <button
          onClick={() => setIsAddOpen(true)}
          className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-sky-950/20 active:scale-95 flex items-center gap-1.5 self-start"
        >
          <Plus className="w-4 h-4" />
          <span>New Customer Project</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3">
        <form onSubmit={handleSearchSubmit} className="flex-1 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search by project name, code (ALP-001), site address..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </form>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none bg-white text-slate-700"
          >
            <option value="">All Stages</option>
            {STAGES_ORDER.map((stage) => (
              <option key={stage.key} value={stage.key}>
                {stage.label}
              </option>
            ))}
          </select>

          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none bg-white text-slate-700"
          >
            <option value="">All Payments</option>
            <option value="ADVANCE_PAID">30% Advance Paid</option>
            <option value="PARTIAL_PAID">Partially Paid</option>
            <option value="FULLY_PAID">Fully Paid</option>
          </select>
        </div>
      </div>

      {/* Projects Table / Cards */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500">Loading projects...</div>
        ) : projects.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Building2 className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs font-bold text-slate-700">No matching projects found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-400 uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4 font-bold">Project / Code</th>
                  <th className="py-3 px-4 font-bold">Customer</th>
                  <th className="py-3 px-4 font-bold">Stage</th>
                  <th className="py-3 px-4 font-bold">Payment</th>
                  <th className="py-3 px-4 font-bold">WhatsApp Group</th>
                  <th className="py-3 px-4 font-bold">Next Update</th>
                  <th className="py-3 px-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {projects.map((p) => {
                  const customer = p.customerId || {};
                  return (
                    <tr key={p._id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-4 px-4">
                        <Link href={`/projects/${p._id}`} className="group">
                          <span className="font-extrabold text-slate-900 group-hover:text-sky-600 block text-xs">
                            {p.projectName}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">{p.projectId} • {p.liftModel}</span>
                        </Link>
                      </td>

                      <td className="py-4 px-4">
                        <span className="font-semibold text-slate-800 block">{customer.fullName || 'Client'}</span>
                        <span className="text-[10px] text-slate-400">{customer.phoneNumber}</span>
                      </td>

                      <td className="py-4 px-4">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          {formatProjectStatus(p.projectStatus)}
                        </span>
                      </td>

                      <td className="py-4 px-4">
                        <div className="text-slate-800 font-bold">
                          ₹{p.totalPaid?.toLocaleString('en-IN')}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          of ₹{p.orderValue?.toLocaleString('en-IN')}
                        </div>
                      </td>

                      <td className="py-4 px-4">
                        {p.whatsappGroupId ? (
                          <div className="flex items-center gap-1.5 text-emerald-700 font-semibold text-[11px]">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            <span>{p.whatsappGroupId}</span>
                          </div>
                        ) : (
                          <span className="text-rose-600 text-[10px] font-semibold bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                            Unlinked
                          </span>
                        )}
                      </td>

                      <td className="py-4 px-4">
                        {p.nextUpdateAt ? (
                          <span className="text-slate-700 font-medium">
                            {new Date(p.nextUpdateAt).toLocaleDateString('en-GB')}
                          </span>
                        ) : (
                          <span className="text-slate-400">None</span>
                        )}
                        <span className="text-[10px] text-slate-400 block font-mono">
                          Every {p.updateFrequencyDays || 20}d
                        </span>
                      </td>

                      <td className="py-4 px-4 text-right">
                        <Link
                          href={`/projects/${p._id}`}
                          className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1"
                        >
                          <span>Manage</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Project Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-7xl w-full shadow-2xl border border-slate-200 overflow-hidden my-4 flex flex-col max-h-[90vh]">
            <div className="bg-[#0F2744] text-white p-5 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-sm font-bold">Create New Elevator Project</h3>
                <p className="text-[11px] text-slate-300">Confirms initial 30% advance & links WhatsApp group</p>
              </div>
              <button onClick={() => setIsAddOpen(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="p-6 space-y-4 text-xs overflow-y-auto">
              {/* Customer & Project Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Select Customer: *
                  </label>
                  <select
                    required
                    value={newProject.customerId}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      const selectedCustomer = customers.find(c => c._id === selectedId);
                      setNewProject({
                        ...newProject,
                        customerId: selectedId,
                        siteAddress: selectedCustomer ? selectedCustomer.address : newProject.siteAddress,
                      });
                    }}
                    className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  >
                    <option value="">-- Choose Customer --</option>
                    {customers.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.fullName} ({c.customerId}) - {c.phoneNumber}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Project / Residence Name: *
                  </label>
                  <input
                    type="text"
                    required
                    value={newProject.projectName}
                    onChange={(e) => setNewProject({ ...newProject, projectName: e.target.value })}
                    placeholder="e.g. Kumar Residence"
                    className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Site Address */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Site Address: *
                </label>
                <input
                  type="text"
                  required
                  value={newProject.siteAddress}
                  onChange={(e) => setNewProject({ ...newProject, siteAddress: e.target.value })}
                  placeholder="e.g. Plot 42, Palm Meadows, Whitefield, Bengaluru"
                  className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              {/* Lift & Shaft Info */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Lift Model: *
                      </label>
                      <select
                        required
                        value={newProject.liftModel}
                        onChange={(e) => setNewProject({ ...newProject, liftModel: e.target.value })}
                        className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none"
                      >
                        <option value="Hydraulic Home Series">Hydraulic Home Series</option>
                        <option value="Gearless Belt Home Series">Gearless Belt Home Series</option>
                        <option value="Gearless Belt Home Series EV">Gearless Belt Home Series EV</option>
                        <option value="Semi Home Lift">Semi Home Lift</option>
                        <option value="Circle Lift">Circle Lift</option>
                        <option value="Circle Max Lift">Circle Max Lift</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Floors: *
                      </label>
                      <select
                        required
                        value={newProject.numberOfFloors || 'G+1'}
                        onChange={(e) => setNewProject({ ...newProject, numberOfFloors: e.target.value })}
                        className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none"
                      >
                        <option value="G+1">G+1</option>
                        <option value="G+2">G+2</option>
                        <option value="G+3">G+3</option>
                        <option value="G+4">G+4</option>
                        <option value="G+5">G+5</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Base Amount (Non GST) (₹):
                      </label>
                      <input
                        type="number"
                        value={newProject.liftBaseAmount || ''}
                        onChange={(e) => setNewProject({ ...newProject, liftBaseAmount: e.target.value })}
                        className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Cash Amount (₹): *
                      </label>
                      <input
                        type="number"
                        required
                        value={newProject.liftCashAmount || ''}
                        onChange={(e) => setNewProject({ ...newProject, liftCashAmount: e.target.value })}
                        className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Non Cash +18% GST (₹): *
                      </label>
                      <input
                        type="number"
                        required
                        value={newProject.liftNonCashAmount || ''}
                        onChange={(e) => setNewProject({ ...newProject, liftNonCashAmount: e.target.value })}
                        className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none font-bold"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Shaft Model: *
                      </label>
                      <select
                        required
                        value={newProject.shaftModel}
                        onChange={(e) => setNewProject({ ...newProject, shaftModel: e.target.value })}
                        className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none"
                      >
                        <option value="">-- Select Shaft Model --</option>
                        <option value="Customer Scope">Customer Scope</option>
                        <option value="Aluminium Shaft">Aluminium Shaft</option>
                        <option value="Glass Shaft">Glass Shaft</option>
                        <option value="No Shaft">No Shaft (Civil)</option>
                      </select>
                    </div>
                    {newProject.shaftModel !== 'Customer Scope' && (
                      <>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Base Amount (Non GST) (₹):
                          </label>
                          <input
                            type="number"
                            value={newProject.shaftBaseAmount || ''}
                            onChange={(e) => setNewProject({ ...newProject, shaftBaseAmount: e.target.value })}
                            className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none font-bold"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Shaft Cash (₹):
                          </label>
                          <input
                            type="number"
                            required={newProject.shaftModel !== 'Customer Scope' && newProject.shaftModel !== ''}
                            value={newProject.shaftCashAmount || ''}
                            onChange={(e) => setNewProject({ ...newProject, shaftCashAmount: e.target.value })}
                            className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none font-bold"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Shaft Non Cash + GST (₹):
                          </label>
                          <input
                            type="number"
                            required={newProject.shaftModel !== 'Customer Scope' && newProject.shaftModel !== ''}
                            value={newProject.shaftNonCashAmount || ''}
                            onChange={(e) => setNewProject({ ...newProject, shaftNonCashAmount: e.target.value })}
                            className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none font-bold"
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Financial Summary & Delivery */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Total Amount (Inc. GST) (₹):
                    </label>
                    <input
                      type="number"
                      readOnly
                      value={
                        Number(newProject.liftCashAmount || 0) + 
                        (Number(newProject.liftNonCashAmount || 0) * 1.18) +
                        (newProject.shaftModel === 'Customer Scope' ? 0 : 
                          Number(newProject.shaftCashAmount || 0) + 
                          (Number(newProject.shaftNonCashAmount || 0) * 1.18))
                      }
                      className="w-full p-2.5 text-xs border border-slate-300 rounded-xl bg-slate-50 text-slate-500 font-bold cursor-not-allowed"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Expected Delivery Date: *
                    </label>
                    <input
                      type="date"
                      required
                      value={newProject.expectedDeliveryDate}
                      onChange={(e) => setNewProject({ ...newProject, expectedDeliveryDate: e.target.value })}
                      className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Payment Schedule */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <h4 className="text-[11px] font-bold text-slate-700 mb-3 uppercase tracking-wider">Payment Schedule (%)</h4>
                <div className={`grid gap-3 ${isCrm ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-2 md:grid-cols-5'}`}>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1 truncate" title="Booking Advance">
                      Advance: *
                    </label>
                    <input
                      type="number"
                      required
                      value={newProject.advancePercentage}
                      onChange={(e) => setNewProject({ ...newProject, advancePercentage: e.target.value })}
                      className="w-full p-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1 truncate" title="Production Payment">
                      Production: *
                    </label>
                    <input
                      type="number"
                      required
                      value={newProject.productionPaymentPercent}
                      onChange={(e) => setNewProject({ ...newProject, productionPaymentPercent: e.target.value })}
                      className="w-full p-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1 truncate" title="Readiness Notification">
                      Readiness: *
                    </label>
                    <input
                      type="number"
                      required
                      value={newProject.readinessNotificationPercent}
                      onChange={(e) => setNewProject({ ...newProject, readinessNotificationPercent: e.target.value })}
                      className="w-full p-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:outline-none"
                    />
                  </div>
                  {!isCrm && (
                    <>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1 truncate" title="Dispatch Materials">
                          Dispatch: *
                        </label>
                        <input
                          type="number"
                          required
                          value={newProject.dispatchMaterialsPercent}
                          onChange={(e) => setNewProject({ ...newProject, dispatchMaterialsPercent: e.target.value })}
                          className="w-full p-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1 truncate" title="After Installation">
                          Installation: *
                        </label>
                        <input
                          type="number"
                          required
                          value={newProject.afterInstallationPercent}
                          onChange={(e) => setNewProject({ ...newProject, afterInstallationPercent: e.target.value })}
                          className="w-full p-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:outline-none"
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* WhatsApp Automation */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    WhatsApp Group ID:
                  </label>
                  <input
                    type="text"
                    value={newProject.whatsappGroupId}
                    onChange={(e) => setNewProject({ ...newProject, whatsappGroupId: e.target.value })}
                    placeholder="e.g. GROUP_TEST_001"
                    className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    WhatsApp Update Cadence:
                  </label>
                  <select
                    value={newProject.updateFrequencyDays}
                    onChange={(e) => setNewProject({ ...newProject, updateFrequencyDays: e.target.value })}
                    className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  >
                    <option value="10">Every 10 Days</option>
                    <option value="15">Every 15 Days</option>
                    <option value="20">Every 20 Days (Standard)</option>
                    <option value="30">Every 30 Days</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end space-x-2.5 border-t border-slate-100 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
