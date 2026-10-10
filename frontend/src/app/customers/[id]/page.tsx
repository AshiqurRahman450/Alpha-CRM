'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Users,
  Building2,
  Phone,
  Mail,
  MapPin,
  MessageSquare,
  IndianRupee,
  Calendar,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ArrowRight,
  FileText,
  Upload,
  Trash2,
} from 'lucide-react';
import { api } from '../../../lib/api';
import { formatProjectStatus } from '../../../components/Timeline';

export default function CustomerDetailPage() {
  const params = useParams();
  const customerId = params.id as string;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  const [bdms, setBdms] = useState<any[]>([]);
  const [assigning, setAssigning] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  const fetchCustomer = async () => {
    try {
      setLoading(true);
      const res = await api.getCustomerById(customerId);
      setData(res.data);
      
      const userRes = await api.getCurrentUser();
      setCurrentUser(userRes.user);

      if (userRes.user?.role !== 'BDM') {
        const bdmRes = await api.getBDMs();
        setBdms(bdmRes.data || []);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load customer');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignBDM = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!data?.customer) return;
    const bdmId = e.target.value === '' ? null : e.target.value;
    try {
      setAssigning(true);
      await api.assignBDM(data.customer._id, bdmId);
      fetchCustomer();
    } catch (err: any) {
      alert(`Error assigning BDM: ${err.message}`);
    } finally {
      setAssigning(false);
    }
  };

  useEffect(() => {
    if (customerId) fetchCustomer();
  }, [customerId]);

  const handleToggleOptIn = async () => {
    if (!data?.customer) return;
    try {
      const nextOptIn = !data.customer.whatsappOptIn;
      await api.toggleCustomerOptIn(data.customer._id, nextOptIn);
      fetchCustomer();
    } catch (err: any) {
      alert(`Error toggling opt-in: ${err.message}`);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !data?.customer) return;

    try {
      setUploadingDoc(true);
      await api.uploadCustomerDocument(data.customer._id, file);
      fetchCustomer();
    } catch (err: any) {
      alert(`Error uploading document: ${err.message}`);
    } finally {
      setUploadingDoc(false);
      // Reset input
      e.target.value = '';
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!data?.customer) return;
    if (!confirm('Are you sure you want to remove this document?')) return;
    try {
      await api.deleteCustomerDocument(data.customer._id, docId);
      fetchCustomer();
    } catch (err: any) {
      alert(`Error deleting document: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-sky-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !data?.customer) {
    return (
      <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-sm">
        <p>{error || 'Customer not found'}</p>
        <Link href="/customers" className="text-xs text-sky-600 font-bold underline mt-2 block">
          &larr; Back to Customers
        </Link>
      </div>
    );
  }

  const { customer, projects = [], payments = [], messages = [] } = data;

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <Link
        href="/customers"
        className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        <span>Back to Customers Directory</span>
      </Link>

      {/* Customer Profile Header */}
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-600 to-blue-800 text-white flex items-center justify-center font-bold text-lg shadow-md">
              {customer.fullName.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-sky-600 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                  {customer.customerId}
                </span>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">{customer.fullName}</h2>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{customer.customerType} • Lead: {customer.leadSource}</p>
            </div>
          </div>

          {/* Opt-In Badge & Switch */}
          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-[11px] text-slate-400 block font-medium">WhatsApp Updates</span>
              <strong className={customer.whatsappOptIn ? 'text-emerald-700 text-xs' : 'text-rose-700 text-xs'}>
                {customer.whatsappOptIn ? 'Opt-In Active' : 'Opt-In Disabled'}
              </strong>
            </div>
            <button
              onClick={handleToggleOptIn}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                customer.whatsappOptIn
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                  : 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
              }`}
            >
              {customer.whatsappOptIn ? 'Disable' : 'Enable Opt-In'}
            </button>
          </div>
        </div>

        {/* Contact Info Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1">
            <span className="text-slate-400 block text-[11px] flex items-center gap-1">
              <Phone className="w-3.5 h-3.5 text-slate-400" /> Phone Numbers
            </span>
            <div className="font-bold text-slate-800">{customer.phoneNumber}</div>
            <div className="text-[11px] text-slate-500">WhatsApp: {customer.whatsappNumber}</div>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1">
            <span className="text-slate-400 block text-[11px] flex items-center gap-1">
              <Mail className="w-3.5 h-3.5 text-slate-400" /> Email & Representative
            </span>
            <div className="font-bold text-slate-800 truncate">{customer.email || 'None registered'}</div>
            <div className="text-[11px] text-slate-500">Assigned: {customer.assignedEmployee || 'Unassigned'}</div>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1">
            <span className="text-slate-400 block text-[11px] flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-slate-400" /> Address & Location
            </span>
            <div className="font-bold text-slate-800">{customer.address}</div>
            <div className="text-[11px] text-slate-500">{customer.city}, {customer.state} {customer.pincode}</div>
          </div>
        </div>

        {/* BDM Assignment (Admin/CRM only) */}
        {currentUser?.role !== 'BDM' && (
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-slate-800">Assigned BDM</div>
              <div className="text-[11px] text-slate-500">
                Select the Business Development Manager responsible for this customer and their projects.
              </div>
            </div>
            <select
              value={customer.bdmId || ''}
              onChange={handleAssignBDM}
              disabled={assigning}
              className="text-xs font-medium border border-slate-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-sky-500 outline-none"
            >
              <option value="">-- Unassigned --</option>
              {bdms.map(bdm => (
                <option key={bdm._id} value={bdm._id}>{bdm.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Documents Section */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <FileText className="w-4 h-4 text-sky-600" />
            <span>Customer Documents ({customer.documents?.length || 0})</span>
          </h3>
          
          <div className="relative">
            <input
              type="file"
              id="doc-upload"
              className="hidden"
              onChange={handleFileUpload}
              disabled={uploadingDoc}
            />
            <label
              htmlFor="doc-upload"
              className={`cursor-pointer px-3.5 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors border border-sky-200 ${uploadingDoc ? 'opacity-50 pointer-events-none' : ''}`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{uploadingDoc ? 'Uploading...' : 'Upload Doc'}</span>
            </label>
          </div>
        </div>

        {!customer.documents || customer.documents.length === 0 ? (
          <p className="text-xs text-slate-400">No documents uploaded.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {customer.documents.map((doc: any, idx: number) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white hover:border-sky-300 hover:shadow-sm transition-all group"
              >
                <a
                  href={`http://localhost:5000${doc.url}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 overflow-hidden flex-1"
                >
                  <div className="w-10 h-10 rounded-lg bg-sky-100 text-sky-600 flex items-center justify-center shrink-0 group-hover:bg-sky-600 group-hover:text-white transition-colors">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-xs font-bold text-slate-800 truncate group-hover:text-sky-700 transition-colors">{doc.name}</p>
                    <p className="text-[10px] text-slate-400">{new Date(doc.uploadedAt).toLocaleDateString()}</p>
                  </div>
                </a>
                <button
                  onClick={() => handleDeleteDocument(doc._id)}
                  className="ml-2 p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                  title="Remove Document"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Projects List */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <Building2 className="w-4 h-4 text-sky-600" />
          <span>Elevator Projects ({projects.length})</span>
        </h3>

        {projects.length === 0 ? (
          <p className="text-xs text-slate-400">No projects associated with this customer.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {projects.map((p: any) => (
              <div
                key={p._id}
                className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 hover:bg-white hover:border-sky-300 transition-all shadow-sm space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[11px] font-mono font-bold text-slate-400">{p.projectId}</span>
                    <h4 className="text-sm font-extrabold text-slate-900">{p.projectName}</h4>
                    <span className="text-xs text-slate-500">{p.liftModel} ({p.liftType})</span>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                    {formatProjectStatus(p.projectStatus)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs bg-white p-2.5 rounded-xl border border-slate-200/80">
                  <span>Order: <strong>₹{p.orderValue?.toLocaleString('en-IN')}</strong></span>
                  <span className="text-emerald-700 font-semibold">
                    Paid: ₹{p.totalPaid?.toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="flex justify-end">
                  <Link
                    href={`/projects/${p._id}`}
                    className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                  >
                    <span>View Project</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* WhatsApp Messages for this customer */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-emerald-600" />
          <span>Customer WhatsApp History ({messages.length})</span>
        </h3>

        {messages.length === 0 ? (
          <p className="text-xs text-slate-400">No WhatsApp messages recorded.</p>
        ) : (
          <div className="space-y-2.5 max-h-[320px] overflow-y-auto">
            {messages.map((m: any) => (
              <div
                key={m._id}
                className={`p-3 rounded-xl text-xs space-y-1 border ${
                  m.direction === 'INCOMING' ? 'bg-sky-50/60 border-sky-200' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-slate-800">
                    {m.direction === 'INCOMING' ? `Customer: ${m.senderName}` : 'Alpha Elevators Update'}
                  </span>
                  <span className="text-[10px] text-slate-400">{new Date(m.createdAt).toLocaleString('en-GB')}</span>
                </div>
                <p className="whitespace-pre-line text-slate-700 text-[11px]">{m.messageContent}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
