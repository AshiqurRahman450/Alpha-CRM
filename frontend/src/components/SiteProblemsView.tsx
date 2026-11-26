'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Clock,
  Send,
  User,
  Users,
  Building2,
  MapPin,
  Search,
  Upload,
  X,
  ChevronDown,
  Check,
  RefreshCw,
  Trash2,
  Wrench,
  Eye,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../lib/api';

interface SiteProblemsViewProps {
  mode: 'inspector' | 'sundaram';
  onStatsChange?: (stats: { total: number; assigned: number; finished: number }) => void;
}

export default function SiteProblemsView({ mode, onStatsChange }: SiteProblemsViewProps) {
  const [problems, setProblems] = useState<any[]>([]);
  const [stats, setStats] = useState<{ total: number; assigned: number; finished: number }>({
    total: 0,
    assigned: 0,
    finished: 0,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ASSIGNED' | 'FINISHED'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Form state for Site Inspector role
  const [customers, setCustomers] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customerNameInput, setCustomerNameInput] = useState<string>('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [customerSearch, setCustomerSearch] = useState<string>('');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState<boolean>(false);
  const customerDropdownRef = useRef<HTMLDivElement>(null);

  const [problemDescription, setProblemDescription] = useState<string>('');
  const [images, setImages] = useState<string[]>([]);
  const [processingImages, setProcessingImages] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Sundaram resolution state
  const [finishingId, setFinishingId] = useState<string | null>(null);
  const [resolutionNotesMap, setResolutionNotesMap] = useState<Record<string, string>>({});

  // Fullscreen image preview modal
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const fetchProblems = async (showSpinner = false) => {
    try {
      if (showSpinner) setLoading(true);
      const res = await api.getSiteProblems();
      const list = res?.data || [];
      const newStats = res?.stats || {
        total: list.length,
        assigned: list.filter((p: any) => p.status === 'ASSIGNED').length,
        finished: list.filter((p: any) => p.status === 'FINISHED').length,
      };
      setProblems(list);
      setStats(newStats);
      if (onStatsChange) {
        onStatsChange(newStats);
      }
    } catch (err: any) {
      console.warn('Error loading site problems:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomersAndProjects = async () => {
    try {
      const [custRes, projRes] = await Promise.all([
        api.getCustomers().catch(() => ({ data: [] })),
        api.getProjects().catch(() => ({ data: [] })),
      ]);
      setCustomers(custRes?.data || []);
      setProjects(projRes?.data || []);
    } catch (err) {
      console.warn('Could not load customers for site problem selector:', err);
    }
  };

  useEffect(() => {
    fetchProblems(true);
    if (mode === 'inspector') {
      fetchCustomersAndProjects();
    }
  }, [mode]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(e.target as Node)) {
        setIsCustomerDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredDropdownCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) => {
      const name = String(c.fullName || c.name || '').toLowerCase();
      const code = String(c.customerId || '').toLowerCase();
      const phone = String(c.phoneNumber || c.whatsappNumber || '').toLowerCase();
      const city = String(c.city || c.address || '').toLowerCase();
      return name.includes(q) || code.includes(q) || phone.includes(q) || city.includes(q);
    });
  }, [customers, customerSearch]);

  const selectedCustomerObj = useMemo(
    () => customers.find((c) => String(c._id) === String(selectedCustomerId)),
    [customers, selectedCustomerId]
  );

  const customerProjects = useMemo(() => {
    if (!selectedCustomerId) return [];
    return projects.filter((p) => {
      const pCustId = typeof p.customerId === 'object' ? p.customerId?._id : p.customerId;
      return String(pCustId) === String(selectedCustomerId);
    });
  }, [projects, selectedCustomerId]);

  const compressImageFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_DIM = 1280;
          let width = img.width;
          let height = img.height;
          if (width > height && width > MAX_DIM) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else if (height > MAX_DIM) {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.82));
          } else {
            resolve(String(e.target?.result || ''));
          }
        };
        img.onerror = () => resolve(String(e.target?.result || ''));
        img.src = String(e.target?.result || '');
      };
      reader.onerror = () => reject(new Error('Failed to read image file'));
      reader.readAsDataURL(file);
    });
  };

  const handleImageUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    try {
      setProcessingImages(true);
      const uploaded: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith('image/')) continue;
        const dataUrl = await compressImageFile(file);
        if (dataUrl) uploaded.push(dataUrl);
      }
      if (uploaded.length > 0) {
        setImages((prev) => [...prev, ...uploaded]);
        toast.success(`${uploaded.length} issue photo(s) attached`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to process image');
    } finally {
      setProcessingImages(false);
    }
  };

  const handleRemoveImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmitProblem = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalCustomerName = (selectedCustomerObj?.fullName || customerNameInput || '').trim();
    if (!finalCustomerName) {
      toast.error('Please select or enter a customer name');
      return;
    }
    if (!problemDescription.trim()) {
      toast.error('Please enter the site problem / mistake description');
      return;
    }
    if (images.length === 0) {
      toast.error('Please upload at least one image of the site problem');
      return;
    }

    try {
      setSubmitting(true);
      const matchedProject =
        customerProjects.find((p) => String(p._id) === String(selectedProjectId)) || customerProjects[0];

      const res = await api.createSiteProblem({
        customerId: selectedCustomerId || undefined,
        customerName: finalCustomerName,
        projectId: matchedProject?._id || undefined,
        projectName: matchedProject?.projectName || undefined,
        problemDescription: problemDescription.trim(),
        images,
      });

      toast.success(res?.message || 'Site problem sent to Sundaram!');
      setProblemDescription('');
      setImages([]);
      setSelectedCustomerId('');
      setCustomerNameInput('');
      setSelectedProjectId('');
      setCustomerSearch('');
      await fetchProblems(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit site problem');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkFinished = async (problem: any, nextStatus: 'FINISHED' | 'ASSIGNED' = 'FINISHED') => {
    try {
      setFinishingId(problem._id);
      const notes = resolutionNotesMap[problem._id] || '';
      const res = await api.finishSiteProblem(problem._id, {
        status: nextStatus,
        resolutionNotes: notes,
      });
      toast.success(
        res?.message ||
          (nextStatus === 'FINISHED'
            ? `Problem ${problem.problemId} marked as Finished!`
            : `Problem ${problem.problemId} reopened`)
      );
      await fetchProblems(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update problem status');
    } finally {
      setFinishingId(null);
    }
  };

  const handleDeleteProblem = async (problem: any) => {
    if (!window.confirm(`Delete site problem ${problem.problemId} for ${problem.customerName}?`)) return;
    try {
      await api.deleteSiteProblem(problem._id);
      toast.success(`Deleted ${problem.problemId}`);
      await fetchProblems(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete site problem');
    }
  };

  const displayedProblems = useMemo(() => {
    return problems.filter((item) => {
      if (statusFilter !== 'ALL' && item.status !== statusFilter) return false;
      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;
      return (
        String(item.customerName || '').toLowerCase().includes(q) ||
        String(item.customerCode || '').toLowerCase().includes(q) ||
        String(item.projectName || '').toLowerCase().includes(q) ||
        String(item.projectCode || '').toLowerCase().includes(q) ||
        String(item.problemDescription || '').toLowerCase().includes(q) ||
        String(item.problemId || '').toLowerCase().includes(q)
      );
    });
  }, [problems, statusFilter, searchQuery]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#0F2744] via-[#163861] to-[#1E497C] text-white p-6 rounded-3xl shadow-lg border border-sky-800/40">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-400/20 text-amber-300 border border-amber-400/30 rounded-full text-xs font-bold">
              <Wrench className="w-3.5 h-3.5" />
              <span>
                {mode === 'inspector'
                  ? 'Site Working Place Inspection & Issue Reporting'
                  : 'Sundaram Role — Assigned Site Problems & Issue Resolution'}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight font-poppins">
              {mode === 'inspector'
                ? 'Site Problem & Issue Upload Dashboard'
                : 'Site Problems Reported from Working Place'}
            </h2>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              {mode === 'inspector'
                ? 'Report site mistakes (e.g. nut fitting, bracket alignment, shaft issues) with photo evidence and customer details directly to Sundaram, and track how many problems are assigned and finished by Sundaram.'
                : 'Review site mistakes and uploaded photos sent by the Site Inspector for each customer. Mark issues as Finished once resolved at the site.'}
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <Link
              href="/customers"
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <Users className="w-4 h-4 text-sky-300" />
              <span>Customers</span>
            </Link>
            <Link
              href="/projects"
              className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
            >
              <Building2 className="w-4 h-4" />
              <span>Projects</span>
            </Link>
            <button
              type="button"
              onClick={() => fetchProblems(true)}
              className="p-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl transition-all cursor-pointer"
              title="Refresh Site Problems"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* 3 KPI Summary Cards: Assigned & Finished by Sundaram */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div
          onClick={() => setStatusFilter('ASSIGNED')}
          className={`p-5 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === 'ASSIGNED'
              ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-400/30 shadow-md'
              : 'bg-white border-amber-200 hover:border-amber-400 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold text-amber-800">
            <span>Problems Assigned to Sundaram</span>
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-amber-700 mt-2 font-poppins">{stats.assigned}</div>
          <div className="text-[11px] text-amber-700/80 mt-1 font-medium">
            Pending site problems awaiting Sundaram resolution
          </div>
        </div>

        <div
          onClick={() => setStatusFilter('FINISHED')}
          className={`p-5 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === 'FINISHED'
              ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-400/30 shadow-md'
              : 'bg-white border-emerald-200 hover:border-emerald-400 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold text-emerald-800">
            <span>Problems Finished by Sundaram</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-emerald-700 mt-2 font-poppins">{stats.finished}</div>
          <div className="text-[11px] text-emerald-700/80 mt-1 font-medium">
            Mistakes resolved & completed by Sundaram
          </div>
        </div>

        <div
          onClick={() => setStatusFilter('ALL')}
          className={`p-5 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === 'ALL'
              ? 'bg-sky-50 border-sky-400 ring-2 ring-sky-400/30 shadow-md'
              : 'bg-white border-slate-200 hover:border-sky-300 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold text-slate-700">
            <span>Total Problems Reported</span>
            <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-slate-900 mt-2 font-poppins">{stats.total}</div>
          <div className="text-[11px] text-slate-500 mt-1 font-medium">
            All site problem reports ({stats.assigned} assigned • {stats.finished} finished)
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* SITE INSPECTOR FORM: Upload Issue Image + Problem + Customer */}
      {/* ============================================================== */}
      {mode === 'inspector' && (
        <div className="bg-white rounded-3xl p-6 border-2 border-sky-200 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-sky-600 text-white flex items-center justify-center shadow-sm">
                <Camera className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Report Site Mistake & Send Issue Image to Sundaram
                </h3>
                <p className="text-xs text-slate-500">
                  Select the customer, describe the site mistake (e.g., nut is not correctly fit), upload photo(s), and send to Sundaram
                </p>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
              Receives on: Sundaram Role Only
            </span>
          </div>

          <form onSubmit={handleSubmitProblem} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Customer Searchable Dropdown */}
              <div ref={customerDropdownRef} className="relative space-y-1.5">
                <label className="block text-xs font-bold text-slate-800">
                  Select Customer <span className="text-rose-500">*</span>
                </label>
                <div
                  onClick={() => setIsCustomerDropdownOpen((prev) => !prev)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl bg-white flex items-center justify-between cursor-pointer hover:border-sky-400 focus-within:ring-2 focus-within:ring-sky-500"
                >
                  <span className={selectedCustomerObj || customerNameInput ? 'text-slate-900 font-bold' : 'text-slate-400'}>
                    {selectedCustomerObj
                      ? `${selectedCustomerObj.fullName} (${selectedCustomerObj.customerId || 'Customer'})${
                          selectedCustomerObj.city ? ` — ${selectedCustomerObj.city}` : ''
                        }`
                      : customerNameInput
                      ? customerNameInput
                      : '-- Search & Select Customer --'}
                  </span>
                  <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                </div>

                {isCustomerDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden">
                    <div className="p-2.5 bg-slate-50 border-b border-slate-200">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          autoFocus
                          value={customerSearch}
                          onChange={(e) => {
                            setCustomerSearch(e.target.value);
                            if (!selectedCustomerId) {
                              setCustomerNameInput(e.target.value);
                            }
                          }}
                          placeholder="Type customer name, CUST ID, phone, or city..."
                          className="w-full pl-8 pr-8 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
                        />
                        {customerSearch && (
                          <button
                            type="button"
                            onClick={() => setCustomerSearch('')}
                            className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="max-h-60 overflow-y-auto divide-y divide-slate-100">
                      {filteredDropdownCustomers.length === 0 ? (
                        <div className="p-4 text-center space-y-2">
                          <p className="text-xs text-slate-500">No existing customer matches &ldquo;{customerSearch}&rdquo;</p>
                          {customerSearch.trim() && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedCustomerId('');
                                setCustomerNameInput(customerSearch.trim());
                                setIsCustomerDropdownOpen(false);
                              }}
                              className="px-3 py-1.5 bg-sky-600 text-white rounded-xl text-xs font-bold"
                            >
                              Use &ldquo;{customerSearch.trim()}&rdquo; as Customer Name
                            </button>
                          )}
                        </div>
                      ) : (
                        filteredDropdownCustomers.map((c) => {
                          const isSelected = String(c._id) === String(selectedCustomerId);
                          return (
                            <button
                              key={c._id}
                              type="button"
                              onClick={() => {
                                setSelectedCustomerId(c._id);
                                setCustomerNameInput(c.fullName);
                                setSelectedProjectId('');
                                setIsCustomerDropdownOpen(false);
                              }}
                              className={`w-full text-left px-3.5 py-2.5 hover:bg-sky-50 transition-colors flex items-center justify-between ${
                                isSelected ? 'bg-sky-50/80 font-bold' : ''
                              }`}
                            >
                              <div>
                                <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                                  <span>{c.fullName}</span>
                                  {c.customerId && (
                                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-sky-700 border border-slate-200">
                                      {c.customerId}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-500">
                                  {c.phoneNumber || c.whatsappNumber || 'No phone'} • {c.city || 'Chennai'}
                                  {c.activeProject ? ` • Project: ${c.activeProject.projectName} (${c.activeProject.projectId})` : ''}
                                </div>
                              </div>
                              {isSelected && <Check className="w-4 h-4 text-sky-600 shrink-0" />}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Linked Project (auto-selected or selectable if customer has projects) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800">
                  Customer Project (Optional / Auto-Linked)
                </label>
                {customerProjects.length > 0 ? (
                  <select
                    value={selectedProjectId || customerProjects[0]?._id || ''}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl bg-white text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    {customerProjects.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.projectName} ({p.projectId}) — {p.liftModel || 'Elevator'}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    disabled
                    value={
                      selectedCustomerObj
                        ? 'Auto-linked to customer record'
                        : 'Select a customer first to link project'
                    }
                    className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 text-slate-400"
                  />
                )}
              </div>
            </div>

            {/* Problem Description */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-800">
                Enter Site Problem / Mistake Details <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                value={problemDescription}
                onChange={(e) => setProblemDescription(e.target.value)}
                placeholder="e.g. Nut is not correctly fit on guide rail bracket at 1st floor shaft..."
                className="w-full p-3 border border-slate-300 rounded-2xl bg-white text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            {/* Upload Issue Image(s) */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-800">
                Upload Issue Image(s) <span className="text-rose-500">*</span>
              </label>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <label className="flex-1 flex flex-col items-center justify-center p-5 border-2 border-dashed border-sky-300 rounded-2xl bg-sky-50/40 hover:bg-sky-50 hover:border-sky-500 transition-all cursor-pointer text-center">
                  <Upload className="w-6 h-6 text-sky-600 mb-1.5" />
                  <span className="text-xs font-extrabold text-sky-900">
                    {processingImages ? 'Processing photo(s)...' : 'Click to Upload or Take Site Issue Photo'}
                  </span>
                  <span className="text-[11px] text-slate-500 mt-0.5">
                    Supports JPG, PNG, WEBP camera or gallery photos
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => {
                      handleImageUpload(e.target.files);
                      e.target.value = '';
                    }}
                    className="hidden"
                  />
                </label>

                {images.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2.5 p-2 bg-slate-50 rounded-2xl border border-slate-200">
                    {images.map((imgUrl, idx) => (
                      <div
                        key={idx}
                        className="relative w-24 h-24 rounded-xl overflow-hidden border-2 border-sky-400 shadow-sm group bg-slate-900"
                      >
                        <img
                          src={imgUrl}
                          alt={`Issue ${idx + 1}`}
                          onClick={() => setPreviewImage(imgUrl)}
                          className="w-full h-full object-cover cursor-pointer"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(idx)}
                          className="absolute top-1 right-1 w-6 h-6 rounded-full bg-rose-600 text-white flex items-center justify-center text-xs font-bold shadow-md hover:bg-rose-700"
                          title="Remove image"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex items-center justify-end pt-2">
              <button
                type="submit"
                disabled={submitting || processingImages}
                className="px-6 py-3 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white rounded-xl text-xs sm:text-sm font-extrabold shadow-lg shadow-sky-900/20 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>{submitting ? 'Sending to Sundaram...' : 'Send Problem & Image to Sundaram'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ============================================================== */}
      {/* SITE PROBLEMS LIST (For both Sundaram & Site Inspector) */}
      {/* ============================================================== */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <span>
                {mode === 'sundaram'
                  ? 'Assigned Site Problems (Sundaram Role Only)'
                  : 'Submitted Site Problems & Sundaram Status'}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-slate-100 text-slate-800">
                {displayedProblems.length}
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Showing site problem description, uploaded issue photo(s), and customer name
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search customer or problem..."
                className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            {/* Filter Pills */}
            {(['ALL', 'ASSIGNED', 'FINISHED'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  statusFilter === st
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {st === 'ALL'
                  ? `All (${stats.total})`
                  : st === 'ASSIGNED'
                  ? `Assigned (${stats.assigned})`
                  : `Finished by Sundaram (${stats.finished})`}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500">Loading site problems...</div>
        ) : displayedProblems.length === 0 ? (
          <div className="p-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
            <p className="text-sm font-bold text-slate-800">No site problems found</p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {mode === 'inspector'
                ? 'Use the form above to upload an issue photo, enter the site mistake, and select the customer to send it to Sundaram.'
                : 'No site problems are currently pending in this filter.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {displayedProblems.map((item) => {
              const isFinished = item.status === 'FINISHED';
              const isBusy = finishingId === item._id;

              return (
                <div
                  key={item._id}
                  className={`p-5 rounded-2xl border-2 transition-all flex flex-col justify-between gap-4 ${
                    isFinished
                      ? 'border-emerald-200 bg-emerald-50/20'
                      : 'border-amber-300 bg-white shadow-sm'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Top Row: ID, Customer Name, Status Badge */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-black bg-slate-900 text-white">
                            {item.problemId}
                          </span>
                          {item.customerCode && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-sky-50 text-sky-700 border border-sky-200">
                              {item.customerCode}
                            </span>
                          )}
                          {item.projectCode && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              Project: {item.projectCode}
                            </span>
                          )}
                        </div>

                        {/* Customer Name prominently shown */}
                        <div className="flex items-center gap-1.5 pt-0.5">
                          <User className="w-4 h-4 text-sky-600 shrink-0" />
                          <span className="text-sm sm:text-base font-black text-slate-900">
                            Customer: {item.customerName}
                          </span>
                        </div>

                        {item.projectName && (
                          <div className="text-xs text-slate-600 font-semibold flex items-center gap-1">
                            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{item.projectName}</span>
                          </div>
                        )}
                        {item.siteAddress && (
                          <div className="text-[11px] text-slate-500 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-rose-500 shrink-0" />
                            <span className="line-clamp-1">{item.siteAddress}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {isFinished ? (
                          <span className="px-3 py-1 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Finished by Sundaram</span>
                          </span>
                        ) : (
                          <span className="px-3 py-1 rounded-full text-[11px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            <span>Assigned to Sundaram</span>
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400">
                          {item.createdAt ? new Date(item.createdAt).toLocaleString('en-GB') : ''}
                        </span>
                      </div>
                    </div>

                    {/* Problem Description Box */}
                    <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/90 space-y-1">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-900 block">
                        Site Problem / Mistake Reported:
                      </span>
                      <p className="text-xs sm:text-sm font-bold text-slate-900 whitespace-pre-line leading-relaxed">
                        {item.problemDescription}
                      </p>
                    </div>

                    {/* Uploaded Issue Images */}
                    {Array.isArray(item.images) && item.images.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                          Uploaded Issue Photo ({item.images.length}):
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {item.images.map((imgUrl: string, idx: number) => (
                            <div
                              key={idx}
                              onClick={() => setPreviewImage(imgUrl)}
                              className="rounded-xl overflow-hidden border-2 border-sky-400 bg-slate-900 h-48 relative group cursor-pointer"
                            >
                              <img
                                src={imgUrl}
                                alt={`Site problem ${idx + 1}`}
                                className="w-full h-full object-contain group-hover:scale-105 transition-transform"
                              />
                              <span className="absolute bottom-2 right-2 bg-slate-900/85 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1">
                                <Eye className="w-3 h-3" />
                                <span>View Full Photo</span>
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Resolution info if finished */}
                    {isFinished && (
                      <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs space-y-1">
                        <div className="font-bold text-emerald-900 flex items-center justify-between">
                          <span>✓ Completed by {item.finishedByName || 'Sundaram'}</span>
                          {item.finishedAt && (
                            <span className="text-[10px] text-emerald-700">
                              {new Date(item.finishedAt).toLocaleString('en-GB')}
                            </span>
                          )}
                        </div>
                        {item.resolutionNotes && (
                          <p className="text-emerald-800 text-[11px]">Note: {item.resolutionNotes}</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Footer Actions */}
                  <div className="pt-3 border-t border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-500">
                      Reported by: <strong>{item.reportedByName || 'Site Inspector'}</strong>
                    </span>

                    <div className="flex items-center gap-2 flex-wrap">
                      {mode === 'sundaram' && !isFinished && (
                        <>
                          <input
                            type="text"
                            value={resolutionNotesMap[item._id] || ''}
                            onChange={(e) =>
                              setResolutionNotesMap((prev) => ({
                                ...prev,
                                [item._id]: e.target.value,
                              }))
                            }
                            placeholder="Optional resolution note..."
                            className="px-2.5 py-1.5 border border-slate-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleMarkFinished(item, 'FINISHED')}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold shadow-sm active:scale-95 transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>{isBusy ? 'Saving...' : 'Mark Problem Finished'}</span>
                          </button>
                        </>
                      )}

                      {mode === 'sundaram' && isFinished && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleMarkFinished(item, 'ASSIGNED')}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                        >
                          Reopen as Assigned
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleDeleteProblem(item)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Delete site problem"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Fullscreen Image Lightbox Modal */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-[99999] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="relative max-w-4xl w-full max-h-[90vh] flex flex-col items-center">
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="absolute -top-10 right-0 px-3 py-1.5 bg-white/15 hover:bg-white/25 text-white rounded-xl text-xs font-bold flex items-center gap-1"
            >
              <X className="w-4 h-4" />
              <span>Close Preview</span>
            </button>
            <img
              src={previewImage}
              alt="Site problem full preview"
              className="max-w-full max-h-[85vh] object-contain rounded-2xl border-2 border-white/20 shadow-2xl bg-slate-900"
            />
          </div>
        </div>
      )}
    </div>
  );
}
