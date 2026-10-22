'use client';

import React, { useEffect, useState, useRef } from 'react';
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
  Copy,
  Check,
  MapPin,
  Mail,
  User,
  Home,
  Tag,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { api } from '../../lib/api';

interface MissingField {
  key: string;
  label: string;
  error: string;
  elementId: string;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [optInFilter, setOptInFilter] = useState('');

  // BDM assignment support
  const [bdms, setBdms] = useState<any[]>([]);
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
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '',
    customerType: 'Residential',
    leadSource: 'Architect Referral',
    bdmId: '',
    bdmPhone: '',
    whatsappOptIn: true,
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  // Professional Validation Modal & Field Tracking
  const [validationModalOpen, setValidationModalOpen] = useState(false);
  const [missingFieldsList, setMissingFieldsList] = useState<MissingField[]>([]);
  const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});

  const updateCustField = (key: string, value: any) => {
    setNewCust((prev) => ({ ...prev, [key]: value }));
    // Clear error for this field if it has one
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
        error: 'Please enter customer’s full legal or project contact name',
        elementId: 'cust_fullName',
      });
    }

    if (!newCust.phoneNumber.trim()) {
      missing.push({
        key: 'phoneNumber',
        label: 'Phone Number',
        error: 'Primary contact phone number is required',
        elementId: 'cust_phoneNumber',
      });
    } else if (newCust.phoneNumber.replace(/\D/g, '').length < 8) {
      missing.push({
        key: 'phoneNumber',
        label: 'Phone Number',
        error: 'Enter a valid phone number (at least 8-10 digits)',
        elementId: 'cust_phoneNumber',
      });
    }

    if (!newCust.whatsappNumber.trim()) {
      missing.push({
        key: 'whatsappNumber',
        label: 'WhatsApp Number',
        error: 'WhatsApp number is required for milestone group automation',
        elementId: 'cust_whatsappNumber',
      });
    } else if (newCust.whatsappNumber.replace(/\D/g, '').length < 8) {
      missing.push({
        key: 'whatsappNumber',
        label: 'WhatsApp Number',
        error: 'Enter a valid WhatsApp number (at least 8-10 digits)',
        elementId: 'cust_whatsappNumber',
      });
    }

    if (!newCust.email.trim()) {
      missing.push({
        key: 'email',
        label: 'Email Address',
        error: 'Email address is required for dispatching proposals & invoices',
        elementId: 'cust_email',
      });
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newCust.email.trim())) {
      missing.push({
        key: 'email',
        label: 'Email Address',
        error: 'Please enter a valid email format (e.g. name@domain.com)',
        elementId: 'cust_email',
      });
    }

    if (!newCust.customerType.trim()) {
      missing.push({
        key: 'customerType',
        label: 'Customer Type',
        error: 'Select customer building type (Residential, Villa, Commercial, Builder)',
        elementId: 'cust_customerType',
      });
    }

    if (!newCust.leadSource.trim()) {
      missing.push({
        key: 'leadSource',
        label: 'Lead Source',
        error: 'Select lead acquisition channel for CRM analytics',
        elementId: 'cust_leadSource',
      });
    }

    if (!newCust.doorNo.trim()) {
      missing.push({
        key: 'doorNo',
        label: 'Door / Flat No.',
        error: 'Door, flat, or plot number is required for site survey',
        elementId: 'cust_doorNo',
      });
    }

    if (!newCust.streetName.trim()) {
      missing.push({
        key: 'streetName',
        label: 'Street / Building Name',
        error: 'Street, road, or apartment complex name is required',
        elementId: 'cust_streetName',
      });
    }

    if (!newCust.landmark.trim()) {
      missing.push({
        key: 'landmark',
        label: 'Landmark',
        error: 'Prominent landmark is required for installation logistics',
        elementId: 'cust_landmark',
      });
    }

    if (!newCust.city.trim()) {
      missing.push({
        key: 'city',
        label: 'City',
        error: 'City location is required',
        elementId: 'cust_city',
      });
    }

    if (!newCust.state.trim()) {
      missing.push({
        key: 'state',
        label: 'State',
        error: 'State location is required',
        elementId: 'cust_state',
      });
    }

    if (!newCust.pincode.trim()) {
      missing.push({
        key: 'pincode',
        label: 'Pincode',
        error: 'Postal pincode is required for site delivery',
        elementId: 'cust_pincode',
      });
    } else if (!/^\d{4,6}$/.test(newCust.pincode.trim())) {
      missing.push({
        key: 'pincode',
        label: 'Pincode',
        error: 'Please enter a valid postal pincode',
        elementId: 'cust_pincode',
      });
    }

    return missing;
  };

  const focusMissingField = (elementId: string) => {
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
      });
      setCustomers(res.data || []);
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
        if (userRes?.user?.role !== 'BDM') {
          const bdmRes = await api.getBDMs();
          setBdms(bdmRes.data || []);
        } else {
          setNewCust((prev) => ({
            ...prev,
            bdmId: userRes.user.id || userRes.user._id,
            bdmPhone: userRes.user.phone || '',
          }));
        }
      } catch (err) {
        console.error('Failed to load user or BDMs', err);
      }
    };
    fetchInit();
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [optInFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCustomers();
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check all fields
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
      const combinedAddress = [
        newCust.doorNo?.trim(),
        newCust.streetName?.trim(),
        newCust.landmark?.trim(),
      ]
        .filter(Boolean)
        .join(', ');

      await api.createCustomer({
        ...newCust,
        fullName: newCust.fullName.trim(),
        phoneNumber: newCust.phoneNumber.trim(),
        whatsappNumber: (newCust.whatsappNumber || newCust.phoneNumber).trim(),
        email: newCust.email.trim(),
        city: newCust.city.trim(),
        state: newCust.state.trim(),
        pincode: newCust.pincode.trim(),
        address: combinedAddress || newCust.address,
        bdmId: newCust.bdmId || undefined,
        bdmPhone: newCust.bdmPhone ? newCust.bdmPhone.trim() : undefined,
      });

      toast.success('Customer record created successfully!');
      setIsAddOpen(false);
      setFieldErrors({});
      setMissingFieldsList([]);
      setNewCust({
        fullName: '',
        phoneNumber: '',
        whatsappNumber: '',
        email: '',
        doorNo: '',
        streetName: '',
        landmark: '',
        address: '',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '',
        customerType: 'Residential',
        leadSource: 'Architect Referral',
        bdmId: '',
        bdmPhone: '',
        whatsappOptIn: true,
        notes: '',
      });
      fetchCustomers();
    } catch (err: any) {
      toast.error(err.message || 'Error creating customer');
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">Customer Directory</h2>
          <p className="text-xs text-slate-500">
            Managing elevator buyers, contact records, and WhatsApp opt-in consents
          </p>
        </div>
        <button
          onClick={() => setIsAddOpen(true)}
          className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-sky-950/20 active:scale-95 flex items-center gap-1.5 self-start"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Customer</span>
        </button>
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3">
        <form onSubmit={handleSearchSubmit} className="flex-1 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search by customer name, phone, customer ID (CUST-001), city..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </form>

        <select
          value={optInFilter}
          onChange={(e) => setOptInFilter(e.target.value)}
          className="px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none bg-white text-slate-700"
        >
          <option value="">All Opt-In Statuses</option>
          <option value="true">WhatsApp Opt-In Enabled</option>
          <option value="false">WhatsApp Opt-In Disabled</option>
        </select>
      </div>

      {/* Customer List */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500">Loading customers...</div>
        ) : customers.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Users className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs font-bold text-slate-700">No customers found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-400 uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4 font-bold">Customer ID</th>
                  <th className="py-3 px-4 font-bold">Full Name</th>
                  <th className="py-3 px-4 font-bold">Phone / WhatsApp</th>
                  <th className="py-3 px-4 font-bold">Location</th>
                  <th className="py-3 px-4 font-bold">Type</th>
                  <th className="py-3 px-4 font-bold">WhatsApp Opt-In</th>
                  <th className="py-3 px-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customers.map((c) => (
                  <tr key={c._id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-4 px-4 font-mono font-bold text-sky-600">
                      {c.customerId}
                    </td>

                    <td className="py-4 px-4">
                      <Link href={`/customers/${c._id}`} className="font-extrabold text-slate-900 hover:text-sky-600 block">
                        {c.fullName}
                      </Link>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] text-slate-400">{c.email || 'No email'}</span>
                        {c.bdmId && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 bg-sky-50 text-sky-700 border border-sky-200 rounded-md">
                            BDM: {c.bdmId.name || 'Assigned'} {c.bdmPhone || c.bdmId.phone ? `(${c.bdmPhone || c.bdmId.phone})` : ''}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      <div className="font-medium text-slate-800">{c.phoneNumber}</div>
                      <span className="text-[10px] text-slate-400">WA: {c.whatsappNumber}</span>
                    </td>

                    <td className="py-4 px-4 text-slate-600">
                      <div>{c.city}, {c.state}</div>
                    </td>

                    <td className="py-4 px-4">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-700">
                        {c.customerType}
                      </span>
                    </td>

                    <td className="py-4 px-4">
                      <button
                        onClick={() => handleToggleOptIn(c)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-colors ${
                          c.whatsappOptIn
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                            : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                        }`}
                        title="Click to toggle opt-in"
                      >
                        {c.whatsappOptIn ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Opted In</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3 text-rose-600" />
                            <span>Opted Out</span>
                          </>
                        )}
                      </button>
                    </td>

                    <td className="py-4 px-4 text-right">
                      <Link
                        href={`/customers/${c._id}`}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1"
                      >
                        <span>View</span>
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Customer Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="bg-[#0F2744] text-white p-5 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-400">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold tracking-tight">Add Customer Record</h3>
                  <p className="text-[11px] text-slate-300">
                    Register new elevator client, project site address & WhatsApp consent
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsAddOpen(false);
                  setFieldErrors({});
                  setMissingFieldsList([]);
                }}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateCustomer} noValidate className="p-6 space-y-4 text-xs max-h-[80vh] overflow-y-auto">
              
              {/* Full Name */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="cust_fullName" className="block text-[11px] font-bold text-slate-700">
                    Full Name <span className="text-rose-500 font-black">*</span>
                  </label>
                  <span className="text-[10px] text-slate-400">Client / Property Owner</span>
                </div>
                <input
                  id="cust_fullName"
                  type="text"
                  value={newCust.fullName}
                  onChange={(e) => updateCustField('fullName', e.target.value)}
                  placeholder="e.g. Anand Kumar"
                  className={`w-full p-2.5 text-xs rounded-xl border transition-all focus:outline-none focus:ring-2 ${
                    fieldErrors.fullName
                      ? 'border-rose-400 bg-rose-50/20 focus:ring-rose-300 text-rose-950 font-medium'
                      : 'border-slate-300 bg-white focus:ring-sky-500'
                  }`}
                />
                {fieldErrors.fullName && (
                  <p className="mt-1 text-[11px] text-rose-600 font-semibold flex items-center gap-1.5 animate-in fade-in">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {fieldErrors.fullName}
                  </p>
                )}
              </div>

              {/* Phone & WhatsApp */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="cust_phoneNumber" className="block text-[11px] font-bold text-slate-700">
                      Phone Number <span className="text-rose-500 font-black">*</span>
                    </label>
                  </div>
                  <input
                    id="cust_phoneNumber"
                    type="text"
                    value={newCust.phoneNumber}
                    onChange={(e) => updateCustField('phoneNumber', e.target.value)}
                    placeholder="+91 98200 11101"
                    className={`w-full p-2.5 text-xs rounded-xl border transition-all focus:outline-none focus:ring-2 ${
                      fieldErrors.phoneNumber
                        ? 'border-rose-400 bg-rose-50/20 focus:ring-rose-300 text-rose-950 font-medium'
                        : 'border-slate-300 bg-white focus:ring-sky-500'
                    }`}
                  />
                  {fieldErrors.phoneNumber && (
                    <p className="mt-1 text-[11px] text-rose-600 font-semibold flex items-center gap-1.5 animate-in fade-in">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      {fieldErrors.phoneNumber}
                    </p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="cust_whatsappNumber" className="block text-[11px] font-bold text-slate-700">
                      WhatsApp Number <span className="text-rose-500 font-black">*</span>
                    </label>
                    {newCust.phoneNumber && newCust.phoneNumber !== newCust.whatsappNumber && (
                      <button
                        type="button"
                        onClick={copyPhoneToWhatsApp}
                        className="text-[10px] text-sky-600 hover:text-sky-700 font-bold hover:underline flex items-center gap-0.5"
                      >
                        <Copy className="w-2.5 h-2.5 inline" /> Same as Phone
                      </button>
                    )}
                  </div>
                  <input
                    id="cust_whatsappNumber"
                    type="text"
                    value={newCust.whatsappNumber}
                    onChange={(e) => updateCustField('whatsappNumber', e.target.value)}
                    placeholder="+91 98200 11101"
                    className={`w-full p-2.5 text-xs rounded-xl border transition-all focus:outline-none focus:ring-2 ${
                      fieldErrors.whatsappNumber
                        ? 'border-rose-400 bg-rose-50/20 focus:ring-rose-300 text-rose-950 font-medium'
                        : 'border-slate-300 bg-white focus:ring-sky-500'
                    }`}
                  />
                  {fieldErrors.whatsappNumber && (
                    <p className="mt-1 text-[11px] text-rose-600 font-semibold flex items-center gap-1.5 animate-in fade-in">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      {fieldErrors.whatsappNumber}
                    </p>
                  )}
                </div>
              </div>

              {/* Email Address */}
              <div>
                <label htmlFor="cust_email" className="block text-[11px] font-bold text-slate-700 mb-1">
                  Email Address <span className="text-rose-500 font-black">*</span>
                </label>
                <input
                  id="cust_email"
                  type="email"
                  value={newCust.email}
                  onChange={(e) => updateCustField('email', e.target.value)}
                  placeholder="kumar@example.com"
                  className={`w-full p-2.5 text-xs rounded-xl border transition-all focus:outline-none focus:ring-2 ${
                    fieldErrors.email
                      ? 'border-rose-400 bg-rose-50/20 focus:ring-rose-300 text-rose-950 font-medium'
                      : 'border-slate-300 bg-white focus:ring-sky-500'
                  }`}
                />
                {fieldErrors.email && (
                  <p className="mt-1 text-[11px] text-rose-600 font-semibold flex items-center gap-1.5 animate-in fade-in">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {fieldErrors.email}
                  </p>
                )}
              </div>

              {/* BDM Assignment & WhatsApp Number */}
              <div className="p-3.5 bg-slate-50 border border-slate-200/90 rounded-2xl space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="cust_bdmId" className="block text-[11px] font-bold text-slate-800 mb-1">
                      Assigned BDM:
                    </label>
                    {currentUser?.role === 'BDM' ? (
                      <input
                        id="cust_bdmId"
                        type="text"
                        disabled
                        value={`${currentUser?.name || 'Current User'} (You)`}
                        className="w-full p-2.5 text-xs border border-slate-200 bg-slate-100 rounded-xl text-slate-600 font-medium cursor-not-allowed"
                      />
                    ) : (
                      <select
                        id="cust_bdmId"
                        value={newCust.bdmId}
                        onChange={(e) => {
                          const selectedId = e.target.value;
                          updateCustField('bdmId', selectedId);
                          const bdmObj = bdms.find((b) => b._id === selectedId);
                          if (bdmObj?.phone) {
                            updateCustField('bdmPhone', bdmObj.phone);
                          }
                        }}
                        className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none bg-white font-medium"
                      >
                        <option value="">-- Unassigned --</option>
                        {bdms.map((b) => (
                          <option key={b._id} value={b._id}>
                            {b.name} {b.phone ? `(${b.phone})` : ''}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label htmlFor="cust_bdmPhone" className="block text-[11px] font-bold text-slate-800">
                        BDM WhatsApp Number:
                      </label>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                        1:1 WATI Alert
                      </span>
                    </div>
                    <input
                      id="cust_bdmPhone"
                      type="text"
                      value={newCust.bdmPhone}
                      onChange={(e) => updateCustField('bdmPhone', e.target.value)}
                      placeholder="+91 98200 12345"
                      className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none bg-white font-mono text-slate-800"
                    />
                  </div>
                </div>
                <p className="text-[10.5px] text-slate-500 leading-relaxed">
                  💡 If this customer&apos;s project stage is <strong>Drawing and Cabin Design Approval</strong>, a 1-to-1 WhatsApp notification will be sent automatically to this BDM for Approval.
                </p>
              </div>

              {/* Customer Type & Lead Source */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="cust_customerType" className="block text-[11px] font-bold text-slate-700 mb-1">
                    Customer / Building Type <span className="text-rose-500 font-black">*</span>
                  </label>
                  <select
                    id="cust_customerType"
                    value={newCust.customerType}
                    onChange={(e) => updateCustField('customerType', e.target.value)}
                    className={`w-full p-2.5 text-xs rounded-xl border transition-all focus:outline-none focus:ring-2 bg-white ${
                      fieldErrors.customerType
                        ? 'border-rose-400 bg-rose-50/20 focus:ring-rose-300 text-rose-950 font-medium'
                        : 'border-slate-300 focus:ring-sky-500'
                    }`}
                  >
                    <option value="Residential">Residential Elevator</option>
                    <option value="Villa">Luxury Villa Elevator</option>
                    <option value="Commercial">Commercial Elevator</option>
                    <option value="Builder">Builder / Multi-Floor Development</option>
                  </select>
                  {fieldErrors.customerType && (
                    <p className="mt-1 text-[11px] text-rose-600 font-semibold flex items-center gap-1.5 animate-in fade-in">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      {fieldErrors.customerType}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="cust_leadSource" className="block text-[11px] font-bold text-slate-700 mb-1">
                    Lead Source <span className="text-rose-500 font-black">*</span>
                  </label>
                  <select
                    id="cust_leadSource"
                    value={newCust.leadSource}
                    onChange={(e) => updateCustField('leadSource', e.target.value)}
                    className={`w-full p-2.5 text-xs rounded-xl border transition-all focus:outline-none focus:ring-2 bg-white ${
                      fieldErrors.leadSource
                        ? 'border-rose-400 bg-rose-50/20 focus:ring-rose-300 text-rose-950 font-medium'
                        : 'border-slate-300 focus:ring-sky-500'
                    }`}
                  >
                    <option value="Architect Referral">Architect Referral</option>
                    <option value="Direct Inquiry">Direct Inquiry</option>
                    <option value="Builder Tie-up">Builder Tie-up</option>
                    <option value="Website">Website / Digital</option>
                    <option value="Exhibition">Exhibition / Expo</option>
                    <option value="Referral">Client Referral</option>
                  </select>
                  {fieldErrors.leadSource && (
                    <p className="mt-1 text-[11px] text-rose-600 font-semibold flex items-center gap-1.5 animate-in fade-in">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      {fieldErrors.leadSource}
                    </p>
                  )}
                </div>
              </div>

              {/* Site / Residence Address */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-sky-600" />
                  <span className="text-[11px] font-bold text-slate-800">
                    Site / Residence Installation Address <span className="text-rose-500 font-black">*</span>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-1">
                    <label htmlFor="cust_doorNo" className="block text-[11px] font-bold text-slate-700 mb-1">
                      Door / Flat No. <span className="text-rose-500 font-black">*</span>
                    </label>
                    <input
                      id="cust_doorNo"
                      type="text"
                      value={newCust.doorNo}
                      onChange={(e) => updateCustField('doorNo', e.target.value)}
                      placeholder="e.g. Flat 402 / Plot 42"
                      className={`w-full p-2 text-xs rounded-xl border transition-all focus:outline-none focus:ring-2 ${
                        fieldErrors.doorNo
                          ? 'border-rose-400 bg-rose-50/20 focus:ring-rose-300 text-rose-950 font-medium'
                          : 'border-slate-300 bg-white focus:ring-sky-500'
                      }`}
                    />
                    {fieldErrors.doorNo && (
                      <p className="mt-1 text-[10px] text-rose-600 font-semibold flex items-center gap-1 animate-in fade-in">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        Required
                      </p>
                    )}
                  </div>

                  <div className="sm:col-span-2">
                    <label htmlFor="cust_streetName" className="block text-[11px] font-bold text-slate-700 mb-1">
                      Street / Building Name <span className="text-rose-500 font-black">*</span>
                    </label>
                    <input
                      id="cust_streetName"
                      type="text"
                      value={newCust.streetName}
                      onChange={(e) => updateCustField('streetName', e.target.value)}
                      placeholder="e.g. Palm Meadows, Whitefield"
                      className={`w-full p-2 text-xs rounded-xl border transition-all focus:outline-none focus:ring-2 ${
                        fieldErrors.streetName
                          ? 'border-rose-400 bg-rose-50/20 focus:ring-rose-300 text-rose-950 font-medium'
                          : 'border-slate-300 bg-white focus:ring-sky-500'
                      }`}
                    />
                    {fieldErrors.streetName && (
                      <p className="mt-1 text-[10px] text-rose-600 font-semibold flex items-center gap-1 animate-in fade-in">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        {fieldErrors.streetName}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label htmlFor="cust_landmark" className="block text-[11px] font-bold text-slate-700 mb-1">
                    Landmark <span className="text-rose-500 font-black">*</span>
                  </label>
                  <input
                    id="cust_landmark"
                    type="text"
                    value={newCust.landmark}
                    onChange={(e) => updateCustField('landmark', e.target.value)}
                    placeholder="e.g. Near Metro Station / Opp. Community Center"
                    className={`w-full p-2 text-xs rounded-xl border transition-all focus:outline-none focus:ring-2 ${
                      fieldErrors.landmark
                        ? 'border-rose-400 bg-rose-50/20 focus:ring-rose-300 text-rose-950 font-medium'
                        : 'border-slate-300 bg-white focus:ring-sky-500'
                    }`}
                  />
                  {fieldErrors.landmark && (
                    <p className="mt-1 text-[10px] text-rose-600 font-semibold flex items-center gap-1 animate-in fade-in">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      {fieldErrors.landmark}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1">
                  <div>
                    <label htmlFor="cust_city" className="block text-[11px] font-bold text-slate-700 mb-1">
                      City <span className="text-rose-500 font-black">*</span>
                    </label>
                    <input
                      id="cust_city"
                      type="text"
                      value={newCust.city}
                      onChange={(e) => updateCustField('city', e.target.value)}
                      className={`w-full p-2 text-xs rounded-xl border transition-all focus:outline-none focus:ring-2 ${
                        fieldErrors.city
                          ? 'border-rose-400 bg-rose-50/20 focus:ring-rose-300 text-rose-950 font-medium'
                          : 'border-slate-300 bg-white focus:ring-sky-500'
                      }`}
                    />
                    {fieldErrors.city && (
                      <p className="mt-1 text-[10px] text-rose-600 font-semibold">City required</p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="cust_state" className="block text-[11px] font-bold text-slate-700 mb-1">
                      State <span className="text-rose-500 font-black">*</span>
                    </label>
                    <input
                      id="cust_state"
                      type="text"
                      value={newCust.state}
                      onChange={(e) => updateCustField('state', e.target.value)}
                      className={`w-full p-2 text-xs rounded-xl border transition-all focus:outline-none focus:ring-2 ${
                        fieldErrors.state
                          ? 'border-rose-400 bg-rose-50/20 focus:ring-rose-300 text-rose-950 font-medium'
                          : 'border-slate-300 bg-white focus:ring-sky-500'
                      }`}
                    />
                    {fieldErrors.state && (
                      <p className="mt-1 text-[10px] text-rose-600 font-semibold">State required</p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="cust_pincode" className="block text-[11px] font-bold text-slate-700 mb-1">
                      Pincode <span className="text-rose-500 font-black">*</span>
                    </label>
                    <input
                      id="cust_pincode"
                      type="text"
                      value={newCust.pincode}
                      onChange={(e) => updateCustField('pincode', e.target.value)}
                      placeholder="e.g. 400001"
                      className={`w-full p-2 text-xs rounded-xl border transition-all focus:outline-none focus:ring-2 ${
                        fieldErrors.pincode
                          ? 'border-rose-400 bg-rose-50/20 focus:ring-rose-300 text-rose-950 font-medium'
                          : 'border-slate-300 bg-white focus:ring-sky-500'
                      }`}
                    />
                    {fieldErrors.pincode && (
                      <p className="mt-1 text-[10px] text-rose-600 font-semibold">PIN required</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Opt-In Checkbox */}
              <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-start gap-2.5">
                <input
                  type="checkbox"
                  id="optin"
                  checked={newCust.whatsappOptIn}
                  onChange={(e) => updateCustField('whatsappOptIn', e.target.checked)}
                  className="w-4 h-4 mt-0.5 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer"
                />
                <label htmlFor="optin" className="text-xs font-semibold text-emerald-950 cursor-pointer">
                  <span>WhatsApp Project Updates Opt-In Verified (Contract Sign-off)</span>
                  <p className="text-[11px] font-normal text-emerald-700 mt-0.5">
                    Customer consented to milestone broadcasts and automated elevator fabrication updates.
                  </p>
                </label>
              </div>

              {/* Notes */}
              <div>
                <label htmlFor="cust_notes" className="block text-[11px] font-bold text-slate-700 mb-1">
                  Special Notes / Site Requirements (Optional):
                </label>
                <textarea
                  id="cust_notes"
                  rows={2}
                  value={newCust.notes}
                  onChange={(e) => updateCustField('notes', e.target.value)}
                  placeholder="e.g. Pit depth 1200mm, machine-room-less (MRL) gearless traction configuration..."
                  className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none bg-white"
                />
              </div>

              {/* Actions */}
              <div className="pt-3 flex items-center justify-end space-x-2.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddOpen(false);
                    setFieldErrors({});
                    setMissingFieldsList([]);
                  }}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 bg-gradient-to-r from-sky-600 to-sky-700 hover:from-sky-500 hover:to-sky-600 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-sky-950/20 active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {submitting ? (
                    <span>Saving Customer...</span>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>Add Customer</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Professional Missing Fields Alert Popup Modal */}
      {validationModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden text-slate-800 animate-in zoom-in-95 duration-200">
            {/* Top decorative gradient bar */}
            <div className="h-2 w-full bg-gradient-to-r from-amber-500 via-rose-500 to-sky-600" />

            <div className="p-6">
              {/* Header with glowing badge */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="relative flex items-center justify-center w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200/90 text-amber-600 shadow-sm shrink-0">
                    <AlertTriangle className="w-6 h-6 text-amber-600 animate-pulse" />
                    <span className="absolute -top-1 -right-1 flex h-4 w-4">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-4 w-4 bg-rose-600 text-[9px] font-black text-white items-center justify-center shadow-xs">
                        {missingFieldsList.length}
                      </span>
                    </span>
                  </div>
                  <div>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-200 mb-1">
                      Action Required
                    </span>
                    <h3 className="text-base font-extrabold text-slate-900 tracking-tight leading-tight">
                      Incomplete Customer Record
                    </h3>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setValidationModalOpen(false)}
                  className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 transition-colors shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-slate-500 mt-3 leading-relaxed">
                Elevator engineering and Meta WhatsApp groups require verified contact and site address information. Please fill in the missing fields below:
              </p>

              {/* Missing Fields List Container */}
              <div className="mt-4 p-3 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 px-1">
                  <span>Required Fields ({missingFieldsList.length})</span>
                  <span className="text-[10px] font-semibold text-slate-400">Click to jump directly</span>
                </div>

                <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
                  {missingFieldsList.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => focusMissingField(item.elementId)}
                      className="w-full text-left p-2.5 rounded-xl bg-white hover:bg-amber-50/80 border border-slate-200/90 hover:border-amber-300 transition-all group flex items-start justify-between gap-2 shadow-xs"
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div className="w-2 h-2 rounded-full bg-rose-500 mt-1.5 shrink-0 group-hover:scale-125 transition-transform" />
                        <div>
                          <div className="text-xs font-bold text-slate-800 group-hover:text-amber-950">
                            {item.label}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">
                            {item.error}
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-sky-600 group-hover:text-amber-700 shrink-0 flex items-center gap-0.5 mt-0.5">
                        Fill <ArrowRight className="w-2.5 h-2.5" />
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Smart Shortcut if WhatsApp is missing but Phone is available */}
              {missingFieldsList.some((f) => f.key === 'whatsappNumber') && newCust.phoneNumber.trim() && (
                <div className="mt-3 p-3 rounded-2xl bg-sky-50 border border-sky-200/80 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs text-sky-950 font-semibold">
                    <Sparkles className="w-4 h-4 text-sky-600 shrink-0" />
                    <div>
                      <div className="text-[11px] font-bold">Use Phone for WhatsApp?</div>
                      <div className="text-[10px] text-sky-700 font-normal">{newCust.phoneNumber}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={copyPhoneToWhatsApp}
                    className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-[10px] font-bold transition-all shadow-xs shrink-0 active:scale-95"
                  >
                    Auto Fill
                  </button>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setValidationModalOpen(false)}
                className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold transition-all"
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={() => {
                  if (missingFieldsList.length > 0) {
                    focusMissingField(missingFieldsList[0].elementId);
                  } else {
                    setValidationModalOpen(false);
                  }
                }}
                className="px-5 py-2 bg-gradient-to-r from-sky-600 to-sky-700 hover:from-sky-500 hover:to-sky-600 text-white rounded-xl text-xs font-bold shadow-md shadow-sky-600/20 active:scale-95 flex items-center gap-1.5 transition-all"
              >
                <span>Review & Complete</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
