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
} from 'lucide-react';
import { api } from '../../lib/api';

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
    whatsappOptIn: true,
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);

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
        address: combinedAddress || newCust.address,
        bdmId: newCust.bdmId || undefined,
      });
      setIsAddOpen(false);
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
        whatsappOptIn: true,
        notes: '',
      });
      fetchCustomers();
    } catch (err: any) {
      alert(`Error creating customer: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleOptIn = async (customer: any) => {
    try {
      const nextVal = !customer.whatsappOptIn;
      await api.toggleCustomerOptIn(customer._id, nextVal);
      fetchCustomers();
    } catch (err: any) {
      alert(`Failed to update opt-in: ${err.message}`);
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
                            BDM: {c.bdmId.name || 'Assigned'}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden my-8">
            <div className="bg-[#0F2744] text-white p-5 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">Add Customer Record</h3>
                <p className="text-[11px] text-slate-300">New elevator client and WhatsApp opt-in profile</p>
              </div>
              <button onClick={() => setIsAddOpen(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="p-6 space-y-3.5 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Full Name: *
                </label>
                <input
                  type="text"
                  required
                  value={newCust.fullName}
                  onChange={(e) => setNewCust({ ...newCust, fullName: e.target.value })}
                  placeholder="e.g. Anand Kumar"
                  className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Phone Number: *
                  </label>
                  <input
                    type="text"
                    required
                    value={newCust.phoneNumber}
                    onChange={(e) => setNewCust({ ...newCust, phoneNumber: e.target.value })}
                    placeholder="+91 98200 11101"
                    className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    WhatsApp Number:
                  </label>
                  <input
                    type="text"
                    value={newCust.whatsappNumber}
                    onChange={(e) => setNewCust({ ...newCust, whatsappNumber: e.target.value })}
                    placeholder="+91 98200 11101"
                    className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Email Address:
                  </label>
                  <input
                    type="email"
                    value={newCust.email}
                    onChange={(e) => setNewCust({ ...newCust, email: e.target.value })}
                    placeholder="kumar@example.com"
                    className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Assigned BDM:
                  </label>
                  {currentUser?.role === 'BDM' ? (
                    <input
                      type="text"
                      disabled
                      value={`${currentUser?.name || 'Current User'} (You)`}
                      className="w-full p-2.5 text-xs border border-slate-200 bg-slate-100 rounded-xl text-slate-600 font-medium cursor-not-allowed"
                    />
                  ) : (
                    <select
                      value={newCust.bdmId}
                      onChange={(e) => setNewCust({ ...newCust, bdmId: e.target.value })}
                      className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none bg-white font-medium"
                    >
                      <option value="">-- Unassigned --</option>
                      {bdms.map((b) => (
                        <option key={b._id} value={b._id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* Site / Residence Address */}
              <div className="space-y-2.5">
                <span className="block text-[11px] font-bold text-slate-700">
                  Site / Residence Address:
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-1">
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Door No.: *
                    </label>
                    <input
                      type="text"
                      required
                      value={newCust.doorNo}
                      onChange={(e) => setNewCust({ ...newCust, doorNo: e.target.value })}
                      placeholder="e.g. Flat 402 / Plot 42"
                      className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Street Name: *
                    </label>
                    <input
                      type="text"
                      required
                      value={newCust.streetName}
                      onChange={(e) => setNewCust({ ...newCust, streetName: e.target.value })}
                      placeholder="e.g. Palm Meadows, Whitefield"
                      className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Landmark: *
                  </label>
                  <input
                    type="text"
                    required
                    value={newCust.landmark}
                    onChange={(e) => setNewCust({ ...newCust, landmark: e.target.value })}
                    placeholder="e.g. Near Metro Station / Opp. Community Center"
                    className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">City:</label>
                  <input
                    type="text"
                    value={newCust.city}
                    onChange={(e) => setNewCust({ ...newCust, city: e.target.value })}
                    className="w-full p-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">State:</label>
                  <input
                    type="text"
                    value={newCust.state}
                    onChange={(e) => setNewCust({ ...newCust, state: e.target.value })}
                    className="w-full p-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Pincode:</label>
                  <input
                    type="text"
                    value={newCust.pincode}
                    onChange={(e) => setNewCust({ ...newCust, pincode: e.target.value })}
                    className="w-full p-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Opt-In Checkbox */}
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="optin"
                  checked={newCust.whatsappOptIn}
                  onChange={(e) => setNewCust({ ...newCust, whatsappOptIn: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                />
                <label htmlFor="optin" className="text-xs font-semibold text-emerald-900 cursor-pointer">
                  WhatsApp Project Updates Opt-In Verified (Contract Sign-off)
                </label>
              </div>

              <div className="pt-3 flex items-center justify-end space-x-2.5 border-t border-slate-100">
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
                  {submitting ? 'Saving...' : 'Add Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
