'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users,
  Search,
  Plus,
  Phone,
  MessageSquare,
  Building2,
  CheckCircle2,
  XCircle,
  X,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  ArrowRight,
  Sparkles,
  MapPin,
  Mail,
  User,
  Home,
  Tag,
  UserCheck,
  History,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { api } from '../../lib/api';
import { DEFAULT_BDMS } from '../../lib/constants';

interface MissingField {
  key: string;
  label: string;
  error: string;
  elementId: string;
}

export default function OldCustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [optInFilter, setOptInFilter] = useState('');
  const [bdmFilter, setBdmFilter] = useState('');

  // BDM assignment support
  const [bdms, setBdms] = useState<any[]>(DEFAULT_BDMS);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Add Customer modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newCust, setNewCust] = useState({
    fullName: '',
    phoneNumber: '',
    whatsappNumber: '',
    email: '',
    doorNo: '',
    streetName: '',
    landmark: '',
    address: '',
    city: 'Chennai',
    state: 'Tamil Nadu',
    pincode: '',
    customerType: 'Residential',
    leadSource: 'Direct / Manual Entry',
    bdmId: '',
    bdmPhone: '',
    whatsappOptIn: true,
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  // Validation Modal & Field Tracking
  const [validationModalOpen, setValidationModalOpen] = useState(false);
  const [missingFieldsList, setMissingFieldsList] = useState<MissingField[]>([]);
  const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});

  const updateCustField = (key: string, value: any) => {
    setNewCust((prev) => ({ ...prev, [key]: value }));
    if (fieldErrors[key]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const copyPhoneToWhatsApp = () => {
    if (newCust.phoneNumber.trim()) {
      updateCustField('whatsappNumber', newCust.phoneNumber.trim());
      toast.success('Copied phone number to WhatsApp');
    }
  };

  const validateCustomerForm = (): MissingField[] => {
    const missing: MissingField[] = [];

    if (!newCust.fullName.trim()) {
      missing.push({
        key: 'fullName',
        label: 'Full Name',
        error: 'Please enter the client / customer name.',
        elementId: 'cust-field-fullName',
      });
    }

    const cleanPhone = newCust.phoneNumber.replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      missing.push({
        key: 'phoneNumber',
        label: 'Primary Phone Number',
        error: 'A valid 10-digit mobile number is required.',
        elementId: 'cust-field-phoneNumber',
      });
    }

    const hasStructuredAddress = Boolean(newCust.doorNo.trim() || newCust.streetName.trim() || newCust.landmark.trim());
    const hasRawAddress = Boolean(newCust.address.trim());
    if (!hasStructuredAddress && !hasRawAddress) {
      missing.push({
        key: 'address',
        label: 'Site Address or Location',
        error: 'Provide either a structured address or a Google Maps link.',
        elementId: 'cust-field-doorNo',
      });
    }

    return missing;
  };

  const scrollToFirstMissingField = (elementId: string) => {
    setValidationModalOpen(false);
    setTimeout(() => {
      const el = document.getElementById(elementId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.focus();
      }
    }, 150);
  };

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const res = await api.getCustomers({
        search: search || undefined,
        optIn: optInFilter || undefined,
        bdmId: bdmFilter || undefined,
        isOldCustomer: 'true',
      });
      const list = (res.data || []).filter(
        (c: any) => c.isOldCustomer === true || String(c.customerId || '').trim().toUpperCase().startsWith('OLD')
      );
      setCustomers(list);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchInit = async () => {
      try {
        const userRes = await api.getCurrentUser();
        setCurrentUser(userRes?.user);
        if (userRes?.user?.role === 'BDM') {
          setNewCust((prev) => ({
            ...prev,
            bdmId: userRes.user.id || userRes.user._id,
            bdmPhone: userRes.user.phone || '',
          }));
        }
      } catch (err) {
        console.warn('Failed to load current user profile:', err);
      }

      try {
        const bdmRes = await api.getBDMs();
        if (bdmRes?.data && bdmRes.data.length > 0) {
          setBdms(bdmRes.data);
        } else {
          setBdms(DEFAULT_BDMS);
        }
      } catch (err) {
        console.warn('Failed to load BDMs from API, retaining default directory:', err);
        setBdms(DEFAULT_BDMS);
      }
    };
    fetchInit();
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [optInFilter, bdmFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCustomers();
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();

    const missing = validateCustomerForm();
    if (missing.length > 0) {
      const errMap: { [key: string]: string } = {};
      missing.forEach((item) => {
        errMap[item.key] = item.error;
      });
      setFieldErrors(errMap);
      setMissingFieldsList(missing);
      setValidationModalOpen(true);
      return;
    }

    try {
      setSubmitting(true);
      const created = await api.createCustomer({
        ...newCust,
        isOldCustomer: true,
        fullName: newCust.fullName.trim(),
        phoneNumber: newCust.phoneNumber.trim(),
        whatsappNumber: (newCust.whatsappNumber || newCust.phoneNumber).trim(),
        email: newCust.email.trim(),
        address: newCust.address.trim(),
        googleMapsLink: newCust.address.trim(),
        city: newCust.city?.trim() || 'Chennai',
        state: newCust.state?.trim() || 'Tamil Nadu',
        pincode: newCust.pincode?.trim() || '',
        bdmId: newCust.bdmId || undefined,
        bdmPhone: newCust.bdmPhone ? newCust.bdmPhone.trim() : undefined,
      });

      const custCode = created?.data?.customerId || '';
      toast.success(
        custCode
          ? `Old Customer ${custCode} registered successfully!`
          : 'Old Customer registered successfully!'
      );
      setIsAddOpen(false);
      setFieldErrors({});
      setMissingFieldsList([]);
      setNewCust({
        fullName: '',
        phoneNumber: '',
        whatsappNumber: '',
        email: '',
        address: '',
        doorNo: '',
        streetName: '',
        landmark: '',
        city: 'Chennai',
        state: 'Tamil Nadu',
        pincode: '',
        customerType: 'Residential',
        leadSource: 'Direct / Manual Entry',
        bdmId: '',
        bdmPhone: '',
        whatsappOptIn: true,
        notes: '',
      });
      fetchCustomers();
    } catch (err: any) {
      toast.error(err.message || 'Error creating old customer');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleOptIn = async (customer: any) => {
    try {
      const nextVal = !customer.whatsappOptIn;
      await api.toggleCustomerOptIn(customer._id, nextVal);
      toast.success(nextVal ? 'WhatsApp Opt-In enabled' : 'WhatsApp Opt-In disabled');
      fetchCustomers();
    } catch (err: any) {
      toast.error(`Failed to update opt-in: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-slate-900 tracking-tight">Old Customers Directory</h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-800 border border-indigo-200 uppercase">
              OLD-CUST-XXX
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Manually registered and historical elevator clients ({customers.length} total)
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <Link
            href="/customers"
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
          >
            <Users className="w-4 h-4 text-slate-500" />
            <span>Quotation Customers</span>
          </Link>
          <button
            onClick={() => setIsAddOpen(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-950/20 active:scale-95 flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Add Old Customer</span>
          </button>
        </div>
      </div>

      {/* Switch Banner */}
      <div className="bg-gradient-to-r from-indigo-50 via-purple-50 to-indigo-50 border border-indigo-200/80 rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700 flex-shrink-0">
            <History className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-800">Manually Entered Customer Records</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                Custom ID Sequence
              </span>
            </div>
            <p className="text-slate-500 text-[11px] mt-0.5">
              All clients manually entered are assigned the dedicated <code className="text-indigo-800 font-bold bg-indigo-100/70 px-1 py-0.5 rounded">OLD-CUST-XXX</code> ID format. Customers originating from approved quotations are in <strong>Customers</strong>.
            </p>
          </div>
        </div>
        <Link
          href="/customers"
          className="px-3.5 py-2 bg-white hover:bg-slate-50 text-indigo-700 border border-indigo-300 rounded-xl font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all whitespace-nowrap active:scale-95 flex-shrink-0"
        >
          <span>View Quotation Customers</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3">
        <form onSubmit={handleSearchSubmit} className="flex-1 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search by customer name, OLD-CUST ID, phone, city..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </form>

        <div className="flex items-center gap-2">
          {currentUser?.role !== 'BDM' && (
            <select
              value={bdmFilter}
              onChange={(e) => setBdmFilter(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none bg-white text-slate-700 font-semibold"
            >
              <option value="">All BDMs</option>
              {bdms.map((b) => (
                <option key={b.id || b._id} value={b.id || b._id}>
                  BDM: {b.name}
                </option>
              ))}
            </select>
          )}

          <select
            value={optInFilter}
            onChange={(e) => setOptInFilter(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none bg-white text-slate-700"
          >
            <option value="">All Consents</option>
            <option value="true">WhatsApp Opted-In</option>
            <option value="false">WhatsApp Opted-Out</option>
          </select>
        </div>
      </div>

      {/* Customers Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500">Loading old customers...</div>
        ) : customers.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <History className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs font-bold text-slate-700">No matching old customers found</p>
            <p className="text-[11px] text-slate-400">Click &quot;Add Old Customer&quot; above to register a legacy elevator client.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-400 uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4 font-bold">Old Customer ID</th>
                  <th className="py-3 px-4 font-bold">Client / Name</th>
                  <th className="py-3 px-4 font-bold">Contact Details</th>
                  <th className="py-3 px-4 font-bold">Location</th>
                  <th className="py-3 px-4 font-bold">Assigned BDM</th>
                  <th className="py-3 px-4 font-bold">Linked Project</th>
                  <th className="py-3 px-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customers.map((c) => (
                  <tr key={c._id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-4 px-4">
                      <span className="px-2.5 py-1 rounded-lg text-xs font-black font-mono bg-indigo-50 text-indigo-700 border border-indigo-200 inline-block">
                        {c.customerId}
                      </span>
                    </td>

                    <td className="py-4 px-4">
                      <Link href={`/customers/${c._id}`} className="group">
                        <span className="font-extrabold text-slate-900 group-hover:text-indigo-600 block text-xs">
                          {c.fullName}
                        </span>
                        <span className="text-[10px] text-slate-400">{c.customerType || 'Residential'}</span>
                      </Link>
                    </td>

                    <td className="py-4 px-4 space-y-1">
                      <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <span>{c.phoneNumber}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-emerald-700 font-semibold text-[11px]">
                        <MessageSquare className="w-3.5 h-3.5 text-emerald-500" />
                        <span>{c.whatsappNumber}</span>
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      <span className="font-semibold text-slate-800 block">{c.city || 'Chennai'}</span>
                      <span className="text-[10px] text-slate-400 line-clamp-1 max-w-[200px]" title={c.address}>
                        {c.address}
                      </span>
                    </td>

                    <td className="py-4 px-4">
                      {c.bdmId ? (
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                          <span className="font-bold text-slate-800 text-xs">{c.bdmId.name}</span>
                        </div>
                      ) : c.assignedEmployee ? (
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                          <span className="font-medium text-slate-700 text-xs">{c.assignedEmployee}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">Unassigned</span>
                      )}
                    </td>

                    <td className="py-4 px-4">
                      {c.activeProject ? (
                        <Link href={`/projects/${c.activeProject._id}`} className="group block">
                          <div className="flex items-center gap-1.5 font-bold text-sky-700 group-hover:text-sky-900 text-xs">
                            <Building2 className="w-3.5 h-3.5 text-sky-600" />
                            <span>{c.activeProject.projectName}</span>
                          </div>
                          <span className="text-[10px] text-slate-500 block">
                            {c.activeProject.projectId} • {c.activeProject.projectStatus}
                          </span>
                        </Link>
                      ) : (
                        <span className="text-slate-400 text-[11px]">No active project</span>
                      )}
                    </td>

                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={`/customers/${c._id}`}
                          className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1"
                        >
                          <span>Manage</span>
                          <ArrowRight className="w-3 h-3" />
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

      {/* Add Old Customer Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden my-6">
            <div className="bg-indigo-950 text-white p-5 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-indigo-400" />
                  <span>Register Old Customer</span>
                </h3>
                <p className="text-[11px] text-indigo-200 mt-0.5">
                  ID will be auto-generated in format: <strong className="text-white font-mono">OLD-CUST-XXX</strong>
                </p>
              </div>
              <button
                onClick={() => {
                  setIsAddOpen(false);
                  setFieldErrors({});
                  setMissingFieldsList([]);
                }}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Client / Customer Full Name *
                </label>
                <input
                  id="cust-field-fullName"
                  type="text"
                  required
                  placeholder="e.g. Mr. Rajesh Sharma"
                  value={newCust.fullName}
                  onChange={(e) => updateCustField('fullName', e.target.value)}
                  className={`w-full p-2.5 text-xs border rounded-xl focus:ring-2 focus:outline-none ${
                    fieldErrors.fullName ? 'border-rose-500 ring-2 ring-rose-200' : 'border-slate-300 focus:ring-indigo-500'
                  }`}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Primary Phone Number *
                  </label>
                  <input
                    id="cust-field-phoneNumber"
                    type="tel"
                    required
                    placeholder="e.g. 98401 22334"
                    value={newCust.phoneNumber}
                    onChange={(e) => updateCustField('phoneNumber', e.target.value)}
                    className={`w-full p-2.5 text-xs border rounded-xl focus:ring-2 focus:outline-none ${
                      fieldErrors.phoneNumber ? 'border-rose-500 ring-2 ring-rose-200' : 'border-slate-300 focus:ring-indigo-500'
                    }`}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold text-slate-700">WhatsApp Contact</label>
                    <button
                      type="button"
                      onClick={copyPhoneToWhatsApp}
                      className="text-[10px] text-indigo-600 hover:underline font-bold"
                    >
                      Copy Phone
                    </button>
                  </div>
                  <input
                    type="tel"
                    placeholder="Same as phone or enter separate"
                    value={newCust.whatsappNumber}
                    onChange={(e) => updateCustField('whatsappNumber', e.target.value)}
                    className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Address / Google Maps */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Site Address / Location Link *
                </label>
                <textarea
                  id="cust-field-doorNo"
                  rows={2}
                  required
                  placeholder="Plot/Door No, Street Name, Landmark, City or Google Maps Link"
                  value={newCust.address}
                  onChange={(e) => updateCustField('address', e.target.value)}
                  className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">City</label>
                  <input
                    type="text"
                    value={newCust.city}
                    onChange={(e) => updateCustField('city', e.target.value)}
                    className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Customer Type</label>
                  <select
                    value={newCust.customerType}
                    onChange={(e) => updateCustField('customerType', e.target.value)}
                    className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium bg-white"
                  >
                    <option value="Residential">Residential</option>
                    <option value="Villa">Villa</option>
                    <option value="Commercial">Commercial</option>
                    <option value="Builder">Builder</option>
                  </select>
                </div>
              </div>

              {/* BDM assignment */}
              {currentUser?.role !== 'BDM' && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Assigned BDM</label>
                  <select
                    value={newCust.bdmId}
                    onChange={(e) => {
                      const selectedBdm = bdms.find((b) => (b.id || b._id) === e.target.value);
                      setNewCust({
                        ...newCust,
                        bdmId: e.target.value,
                        bdmPhone: selectedBdm?.phone || '',
                      });
                    }}
                    className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none font-semibold text-slate-800 bg-white"
                  >
                    <option value="">-- Choose BDM --</option>
                    {bdms.map((b) => (
                      <option key={b.id || b._id} value={b.id || b._id}>
                        {b.name} ({b.phone || 'No Phone'})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Notes / Legacy Details</label>
                <textarea
                  rows={2}
                  placeholder="Optional notes about previous elevator models, specifications or history..."
                  value={newCust.notes}
                  onChange={(e) => updateCustField('notes', e.target.value)}
                  className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl font-bold transition-all text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl font-bold transition-all shadow-md shadow-indigo-950/20 active:scale-95 text-xs"
                >
                  {submitting ? 'Registering...' : 'Register Old Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Missing Fields Validation Modal */}
      {validationModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-rose-200 overflow-hidden">
            <div className="bg-rose-50 border-b border-rose-100 p-5 flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-500 text-white flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-black text-rose-950">Incomplete Customer Information</h4>
                <p className="text-[11px] text-rose-700 mt-0.5">
                  Please fix {missingFieldsList.length} required field(s) to register this old customer.
                </p>
              </div>
            </div>

            <div className="p-5 space-y-2.5 max-h-60 overflow-y-auto">
              {missingFieldsList.map((m) => (
                <div
                  key={m.key}
                  onClick={() => scrollToFirstMissingField(m.elementId)}
                  className="p-3 bg-slate-50 hover:bg-rose-50/60 border border-slate-200 hover:border-rose-200 rounded-xl cursor-pointer transition-all group flex items-start justify-between gap-2"
                >
                  <div>
                    <span className="font-bold text-slate-800 text-xs block group-hover:text-rose-900">{m.label}</span>
                    <span className="text-[11px] text-slate-500 group-hover:text-rose-700">{m.error}</span>
                  </div>
                  <span className="text-[10px] font-bold text-indigo-600 group-hover:text-rose-600 shrink-0 mt-0.5">
                    Fix →
                  </span>
                </div>
              ))}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  if (missingFieldsList[0]?.elementId) {
                    scrollToFirstMissingField(missingFieldsList[0].elementId);
                  } else {
                    setValidationModalOpen(false);
                  }
                }}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all"
              >
                Go to First Missing Field
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

