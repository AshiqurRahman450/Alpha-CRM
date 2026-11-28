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
  Phone,
  MessageSquare,
  UserCheck,
  Handshake,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api, getStoredUser } from '../lib/api';
import { PROBLEM_ASSIGNEES, getProblemAssigneeForUser } from '../lib/constants';

export const COMMON_LIFT_ISSUES = [
  'Door sensor / auto-door closing issue after handover',
  'Cabin floor leveling adjustment required',
  'COP / LOP push button or display issue',
  'Unusual noise or vibration during lift travel',
  'Nut / bracket fitting alignment check at shaft',
  'Power failure backup / ARD / battery check',
  'Routine post-handover customer callback service visit',
];

export interface AssignCallbackProblemModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCustomer?: any;
  initialProject?: any;
  onSuccess?: () => void;
}

export function AssignCallbackProblemModal({
  isOpen,
  onClose,
  initialCustomer,
  initialProject,
  onSuccess,
}: AssignCallbackProblemModalProps) {
  const [customers, setCustomers] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customerNameInput, setCustomerNameInput] = useState<string>('');
  const [customerPhoneInput, setCustomerPhoneInput] = useState<string>('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [customerSearch, setCustomerSearch] = useState<string>('');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState<boolean>(false);
  const [assignedTo, setAssignedTo] = useState<string>('Srinivasan (TL)');
  const [problemDescription, setProblemDescription] = useState<string>('');
  const [images, setImages] = useState<string[]>([]);
  const [processingImages, setProcessingImages] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    Promise.all([
      api.getCustomers().catch(() => ({ data: [] })),
      api.getProjects().catch(() => ({ data: [] })),
    ]).then(([cRes, pRes]) => {
      setCustomers(cRes?.data || []);
      setProjects(pRes?.data || []);
    });
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (initialCustomer) {
      const cId = initialCustomer._id || initialCustomer.id || '';
      setSelectedCustomerId(cId);
      setCustomerNameInput(initialCustomer.fullName || initialCustomer.name || '');
      setCustomerPhoneInput(initialCustomer.phoneNumber || initialCustomer.whatsappNumber || '');
      const defaultAssignee =
        PROBLEM_ASSIGNEES.find(
          (a) =>
            initialCustomer.assignedTl &&
            a.toLowerCase().includes(String(initialCustomer.assignedTl).toLowerCase().replace(/\s*\(tl\)/i, ''))
        ) || 'Srinivasan (TL)';
      setAssignedTo(defaultAssignee);
    } else {
      setSelectedCustomerId('');
      setCustomerNameInput('');
      setCustomerPhoneInput('');
    }
    if (initialProject) {
      setSelectedProjectId(initialProject._id || initialProject.id || '');
      if (!initialCustomer && initialProject.customerId) {
        const custObj = typeof initialProject.customerId === 'object' ? initialProject.customerId : null;
        if (custObj) {
          setSelectedCustomerId(custObj._id || '');
          setCustomerNameInput(custObj.fullName || initialProject.projectName || '');
          setCustomerPhoneInput(custObj.phoneNumber || custObj.whatsappNumber || '');
        }
      }
    } else {
      setSelectedProjectId('');
    }
  }, [isOpen, initialCustomer, initialProject]);

  const selectedCustomerObj = useMemo(
    () => customers.find((c) => String(c._id) === String(selectedCustomerId)),
    [customers, selectedCustomerId]
  );

  const filteredCustomers = useMemo(() => {
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

  const customerProjects = useMemo(() => {
    if (!selectedCustomerId) return [];
    return projects.filter((p) => {
      const pCustId = typeof p.customerId === 'object' ? p.customerId?._id : p.customerId;
      return String(pCustId) === String(selectedCustomerId);
    });
  }, [projects, selectedCustomerId]);

  if (!isOpen) return null;

  const activePhone =
    customerPhoneInput ||
    selectedCustomerObj?.phoneNumber ||
    selectedCustomerObj?.whatsappNumber ||
    '';
  const cleanPhone = activePhone.replace(/\D/g, '');

  const handleQuickIssueToggle = (issueText: string) => {
    setProblemDescription((prev) => {
      if (prev.includes(issueText)) {
        return prev
          .split('\n')
          .filter((l) => l.trim() !== `• ${issueText}` && l.trim() !== issueText)
          .join('\n')
          .trim();
      }
      return prev.trim() ? `${prev.trim()}\n• ${issueText}` : `• ${issueText}`;
    });
  };

  const handleImageFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setProcessingImages(true);
    try {
      const list: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        if (!f.type.startsWith('image/')) continue;
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (ev) => resolve(String(ev.target?.result || ''));
          reader.onerror = () => resolve('');
          reader.readAsDataURL(f);
        });
        if (dataUrl) list.push(dataUrl);
      }
      if (list.length > 0) setImages((prev) => [...prev, ...list]);
    } finally {
      setProcessingImages(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = (selectedCustomerObj?.fullName || customerNameInput || '').trim();
    if (!finalName) {
      toast.error('Please select or enter a customer name');
      return;
    }
    if (!problemDescription.trim()) {
      toast.error('Please enter or select the lift issue / callback problem');
      return;
    }

    try {
      setSubmitting(true);
      const matchedProject =
        customerProjects.find((p) => String(p._id) === String(selectedProjectId)) ||
        initialProject ||
        customerProjects[0];

      const res = await api.createSiteProblem({
        customerId: selectedCustomerId || undefined,
        customerName: finalName,
        customerPhone: activePhone || undefined,
        projectId: matchedProject?._id || undefined,
        projectName: matchedProject?.projectName || undefined,
        problemDescription: problemDescription.trim(),
        images,
        assignedTo,
        problemType: 'POST_HANDOVER_CALLBACK',
      });

      toast.success(res?.message || `Lift problem assigned to ${assignedTo}!`);
      setProblemDescription('');
      setImages([]);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to assign customer problem');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden my-8 animate-fade-in">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#0F2744] via-[#163861] to-[#1E497C] text-white p-5 sm:p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-400/20 border border-amber-400/40 text-amber-300 flex items-center justify-center">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black tracking-tight">
                Customer Callback &amp; Lift Problem Assignment
              </h3>
              <p className="text-xs text-slate-300">
                Call back any customer and assign post-handover lift issues to Srinivasan, Sundaram, Bala, or Maari
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 text-xs max-h-[82vh] overflow-y-auto">
          {/* Step 1: Select Any Customer & Callback Actions */}
          <div ref={dropdownRef} className="relative space-y-1.5">
            <label className="block text-xs font-bold text-slate-800">
              1. Select Customer for Callback / Issue <span className="text-rose-500">*</span>
            </label>
            <div
              onClick={() => setIsCustomerDropdownOpen((prev) => !prev)}
              className="w-full p-3 border border-slate-300 rounded-xl bg-slate-50 hover:bg-white flex items-center justify-between cursor-pointer hover:border-sky-400"
            >
              <span className={selectedCustomerObj || customerNameInput ? 'text-slate-900 font-bold' : 'text-slate-400'}>
                {selectedCustomerObj
                  ? `${selectedCustomerObj.fullName} (${selectedCustomerObj.customerId || 'Customer'})${
                      selectedCustomerObj.city ? ` — ${selectedCustomerObj.city}` : ''
                    }`
                  : customerNameInput
                  ? customerNameInput
                  : '-- Search & Select from All Customers --'}
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
                        if (!selectedCustomerId) setCustomerNameInput(e.target.value);
                      }}
                      placeholder="Search any customer by name, CUST ID, phone, or city..."
                      className="w-full pl-8 pr-8 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                </div>
                <div className="max-h-56 overflow-y-auto divide-y divide-slate-100">
                  {filteredCustomers.map((c) => (
                    <button
                      key={c._id}
                      type="button"
                      onClick={() => {
                        setSelectedCustomerId(c._id);
                        setCustomerNameInput(c.fullName);
                        setCustomerPhoneInput(c.phoneNumber || c.whatsappNumber || '');
                        setSelectedProjectId('');
                        setIsCustomerDropdownOpen(false);
                      }}
                      className="w-full text-left px-3.5 py-2.5 hover:bg-sky-50 transition-colors flex items-center justify-between"
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
                        </div>
                      </div>
                      {String(c._id) === String(selectedCustomerId) && (
                        <Check className="w-4 h-4 text-sky-600 shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Direct Callback Bar when a customer is selected */}
            {(selectedCustomerObj || cleanPhone) && (
              <div className="p-3 rounded-xl bg-sky-50 border border-sky-200 flex flex-wrap items-center justify-between gap-2 mt-2">
                <div className="space-y-0.5">
                  <div className="font-bold text-sky-950">
                    {selectedCustomerObj?.fullName || customerNameInput}
                  </div>
                  <div className="text-[11px] text-sky-800 font-mono">
                    Phone: {activePhone || 'Not available'}
                  </div>
                </div>
                {cleanPhone && (
                  <div className="flex items-center gap-2">
                    <a
                      href={`tel:${cleanPhone}`}
                      className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>Call Customer Now</span>
                    </a>
                    <a
                      href={`https://wa.me/${cleanPhone.startsWith('91') ? cleanPhone : '91' + cleanPhone}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Step 2: Select Role to Assign Problem To */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-800">
              2. Assign Lift Problem To Role <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {PROBLEM_ASSIGNEES.map((roleName) => {
                const isSelected = assignedTo === roleName;
                return (
                  <button
                    key={roleName}
                    type="button"
                    onClick={() => setAssignedTo(roleName)}
                    className={`p-3 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'border-sky-600 bg-sky-50/90 text-sky-950 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-sky-300 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <UserCheck className={`w-4 h-4 ${isSelected ? 'text-sky-600' : 'text-slate-400'}`} />
                      {isSelected && (
                        <span className="w-2 h-2 rounded-full bg-sky-600"></span>
                      )}
                    </div>
                    <div className="mt-2">
                      <div className="font-extrabold text-xs">{roleName}</div>
                      <div className="text-[10px] text-slate-500">
                        {roleName === 'Maari' ? 'Site Inspector Role' : 'Team Lead Role'}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 3: Quick Tick Common Lift Issues + Problem Description */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-800">
              3. Quick Select Common Post-Handover Lift Issues (or type below):
            </label>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_LIFT_ISSUES.map((issue) => {
                const active = problemDescription.includes(issue);
                return (
                  <button
                    key={issue}
                    type="button"
                    onClick={() => handleQuickIssueToggle(issue)}
                    className={`px-2.5 py-1.5 rounded-xl text-[11px] font-semibold border transition-all cursor-pointer ${
                      active
                        ? 'bg-amber-100 border-amber-400 text-amber-950 font-bold'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {active ? '✓ ' : '+ '}
                    {issue}
                  </button>
                );
              })}
            </div>

            <textarea
              rows={3}
              value={problemDescription}
              onChange={(e) => setProblemDescription(e.target.value)}
              placeholder="Describe the lift issue reported by the customer after handover / callback..."
              className="w-full p-3 border border-slate-300 rounded-2xl bg-white text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          {/* Step 4: Optional Photo Upload */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              4. Issue Photo / Attachment (Optional)
            </label>
            <div className="flex items-center gap-3 flex-wrap">
              <label className="px-3.5 py-2 border border-dashed border-sky-300 rounded-xl bg-sky-50/40 hover:bg-sky-50 text-sky-800 font-bold cursor-pointer flex items-center gap-2">
                <Upload className="w-4 h-4 text-sky-600" />
                <span>{processingImages ? 'Processing...' : 'Attach Issue Photo'}</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    handleImageFiles(e.target.files);
                    e.target.value = '';
                  }}
                  className="hidden"
                />
              </label>
              {images.map((img, i) => (
                <div key={i} className="relative w-14 h-14 rounded-xl overflow-hidden border border-sky-300">
                  <img src={img} alt="Issue" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                    className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-rose-600 text-white text-[10px] flex items-center justify-center"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Submit */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || processingImages}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-extrabold shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>{submitting ? 'Assigning...' : `Assign Problem to ${assignedTo}`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface SiteProblemsViewProps {
  mode?: 'inspector' | 'sundaram' | 'assignee' | 'crm';
  assigneeName?: string;
  onStatsChange?: (stats: { total: number; assigned: number; finished: number }) => void;
}

export default function SiteProblemsView({ mode = 'assignee', assigneeName, onStatsChange }: SiteProblemsViewProps) {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [problems, setProblems] = useState<any[]>([]);
  const [stats, setStats] = useState<{
    total: number;
    assigned: number;
    finished: number;
    byAssignee?: Record<string, { total: number; assigned: number; finished: number }>;
  }>({
    total: 0,
    assigned: 0,
    finished: 0,
    byAssignee: {},
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ASSIGNED' | 'FINISHED'>('ALL');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Form state for creating/assigning problems
  const [customers, setCustomers] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customerNameInput, setCustomerNameInput] = useState<string>('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [customerSearch, setCustomerSearch] = useState<string>('');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState<boolean>(false);
  const customerDropdownRef = useRef<HTMLDivElement>(null);

  const [targetAssignee, setTargetAssignee] = useState<string>('Sundaram');
  const [problemDescription, setProblemDescription] = useState<string>('');
  const [images, setImages] = useState<string[]>([]);
  const [processingImages, setProcessingImages] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Resolution state
  const [finishingId, setFinishingId] = useState<string | null>(null);
  const [resolutionNotesMap, setResolutionNotesMap] = useState<Record<string, string>>({});

  // Fullscreen image preview modal
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  useEffect(() => {
    setCurrentUser(getStoredUser());
  }, []);

  const detectedAssignee = useMemo(() => {
    if (assigneeName) return assigneeName;
    return getProblemAssigneeForUser(currentUser);
  }, [assigneeName, currentUser]);

  const isCrmOrAdmin = useMemo(() => {
    const role = String(currentUser?.role || '').toUpperCase();
    return mode === 'crm' || role === 'CRM' || role === 'ADMIN';
  }, [mode, currentUser]);

  const canCreateOrAssign = mode === 'inspector' || mode === 'crm' || isCrmOrAdmin;
  const activeRoleLabel = detectedAssignee || (mode === 'sundaram' ? 'Sundaram' : 'All Roles (Srinivasan, Sundaram, Bala & Maari)');

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
      console.warn('Could not load customers for problem selector:', err);
    }
  };

  useEffect(() => {
    fetchProblems(true);
    if (canCreateOrAssign) {
      fetchCustomersAndProjects();
    }
  }, [mode, canCreateOrAssign]);

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
      toast.error('Please enter the lift issue / site problem description');
      return;
    }
    if (mode === 'inspector' && images.length === 0) {
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
        customerPhone: selectedCustomerObj?.phoneNumber || selectedCustomerObj?.whatsappNumber || undefined,
        projectId: matchedProject?._id || undefined,
        projectName: matchedProject?.projectName || undefined,
        problemDescription: problemDescription.trim(),
        images,
        assignedTo: targetAssignee,
        problemType: mode === 'inspector' ? 'SITE_INSPECTION' : 'POST_HANDOVER_CALLBACK',
      });

      toast.success(res?.message || `Problem assigned to ${targetAssignee}!`);
      setProblemDescription('');
      setImages([]);
      setSelectedCustomerId('');
      setCustomerNameInput('');
      setSelectedProjectId('');
      setCustomerSearch('');
      await fetchProblems(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit problem');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReassignProblem = async (problem: any, newAssignee: string) => {
    try {
      const res = await api.assignSiteProblem(problem._id, newAssignee);
      toast.success(res?.message || `Assigned to ${newAssignee}`);
      await fetchProblems(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to reassign problem');
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
    if (!window.confirm(`Delete problem ${problem.problemId} for ${problem.customerName}?`)) return;
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
      if (assigneeFilter !== 'ALL') {
        const itemAssignee = String(item.assignedTo || 'Sundaram').toLowerCase();
        const target = assigneeFilter.toLowerCase().replace(/\s*\(tl\)/i, '');
        if (!itemAssignee.includes(target)) return false;
      }
      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;
      return (
        String(item.customerName || '').toLowerCase().includes(q) ||
        String(item.customerCode || '').toLowerCase().includes(q) ||
        String(item.customerPhone || '').toLowerCase().includes(q) ||
        String(item.projectName || '').toLowerCase().includes(q) ||
        String(item.projectCode || '').toLowerCase().includes(q) ||
        String(item.problemDescription || '').toLowerCase().includes(q) ||
        String(item.problemId || '').toLowerCase().includes(q) ||
        String(item.assignedTo || '').toLowerCase().includes(q)
      );
    });
  }, [problems, statusFilter, assigneeFilter, searchQuery]);

  const selectedCustomerPhone =
    selectedCustomerObj?.phoneNumber || selectedCustomerObj?.whatsappNumber || '';
  const cleanSelectedPhone = selectedCustomerPhone.replace(/\D/g, '');

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
                  ? 'Maari (Site Inspector) — Site Issue Upload & Assigned Problems'
                  : isCrmOrAdmin
                  ? 'CRM Post-Handover Customer Callback & Lift Issue Assignment'
                  : `${activeRoleLabel} — Assigned Customer Lift & Site Problems`}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight font-poppins">
              {mode === 'inspector'
                ? 'Maari — Site Problem & Post-Handover Lift Issues'
                : isCrmOrAdmin
                ? 'Customer Callback & Lift Problem Assignment Hub'
                : `Lift & Site Problems Assigned to ${activeRoleLabel}`}
            </h2>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              {mode === 'inspector'
                ? 'View customer lift problems assigned to Maari by CRM and mark them Finished, or upload site working-place issues with photos.'
                : isCrmOrAdmin
                ? 'Call back any handover or existing customer, record any lift issue reported after handover, and assign the problem to Srinivasan (TL), Sundaram, Bala, or Maari.'
                : `Review post-handover customer callback issues and site problems assigned to ${activeRoleLabel}. Mark problems as Finished once resolved.`}
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <Link
              href="/handover"
              className="px-4 py-2 bg-teal-500/20 hover:bg-teal-500/30 text-teal-200 border border-teal-400/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <Handshake className="w-4 h-4 text-teal-300" />
              <span>Handover Customers</span>
            </Link>
            <Link
              href="/customers"
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <Users className="w-4 h-4 text-sky-300" />
              <span>All Customers</span>
            </Link>
            <button
              type="button"
              onClick={() => fetchProblems(true)}
              className="p-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl transition-all cursor-pointer"
              title="Refresh Problems"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* 3 KPI Summary Cards */}
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
            <span>
              {detectedAssignee ? `Problems Assigned to ${detectedAssignee}` : 'Assigned Lift & Site Problems'}
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-amber-700 mt-2 font-poppins">{stats.assigned}</div>
          <div className="text-[11px] text-amber-700/80 mt-1 font-medium">
            Active customer lift issues awaiting resolution
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
            <span>
              {detectedAssignee ? `Problems Finished by ${detectedAssignee}` : 'Problems Resolved & Finished'}
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-emerald-700 mt-2 font-poppins">{stats.finished}</div>
          <div className="text-[11px] text-emerald-700/80 mt-1 font-medium">
            Customer lift problems resolved &amp; completed
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
            <span>Total Problems Tracked</span>
            <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-slate-900 mt-2 font-poppins">{stats.total}</div>
          <div className="text-[11px] text-slate-500 mt-1 font-medium">
            All customer problems ({stats.assigned} assigned • {stats.finished} finished)
          </div>
        </div>
      </div>

      {/* Role Breakdown Bar for CRM / Admin */}
      {isCrmOrAdmin && stats.byAssignee && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {PROBLEM_ASSIGNEES.map((roleName) => {
            const roleStat = stats.byAssignee?.[roleName] || { total: 0, assigned: 0, finished: 0 };
            const isFiltered = assigneeFilter === roleName;
            return (
              <button
                key={roleName}
                type="button"
                onClick={() => setAssigneeFilter(isFiltered ? 'ALL' : roleName)}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                  isFiltered
                    ? 'bg-sky-900 text-white border-sky-700 shadow-md'
                    : 'bg-white border-slate-200 hover:border-sky-300 text-slate-800'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-extrabold">
                  <span>{roleName}</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                      isFiltered ? 'bg-amber-400 text-slate-950' : 'bg-amber-100 text-amber-900'
                    }`}
                  >
                    {roleStat.assigned} Active
                  </span>
                </div>
                <div className={`text-[11px] mt-1.5 ${isFiltered ? 'text-sky-200' : 'text-slate-500'}`}>
                  {roleStat.finished} Finished • {roleStat.total} Total
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* ============================================================== */}
      {/* FORM: CRM Callback & Problem Assignment OR Maari Site Issue Upload */}
      {/* ============================================================== */}
      {canCreateOrAssign && (
        <div className="bg-white rounded-3xl p-6 border-2 border-sky-200 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-sky-600 text-white flex items-center justify-center shadow-sm">
                {mode === 'inspector' ? <Camera className="w-5 h-5" /> : <Phone className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  {mode === 'inspector'
                    ? 'Report Site Problem & Assign to Team Lead / Maari'
                    : 'Customer Callback — Assign Post-Handover Lift Problem'}
                </h3>
                <p className="text-xs text-slate-500">
                  Select any customer from CRM, call back to check their lift, describe the issue, and assign to Srinivasan, Sundaram, Bala, or Maari
                </p>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300 self-start sm:self-auto">
              Assigning to: {targetAssignee}
            </span>
          </div>

          <form onSubmit={handleSubmitProblem} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Customer Searchable Dropdown */}
              <div ref={customerDropdownRef} className="relative space-y-1.5">
                <label className="block text-xs font-bold text-slate-800">
                  Select Customer (All Customers Callback List) <span className="text-rose-500">*</span>
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
                      : '-- Search & Select Any Customer --'}
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

                {selectedCustomerObj && cleanSelectedPhone && (
                  <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-sky-50 border border-sky-200 mt-1.5">
                    <span className="text-[11px] font-bold text-sky-900 font-mono">
                      📞 {selectedCustomerPhone}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <a
                        href={`tel:${cleanSelectedPhone}`}
                        className="px-2.5 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1"
                      >
                        <Phone className="w-3 h-3" />
                        <span>Call Back</span>
                      </a>
                      <a
                        href={`https://wa.me/${cleanSelectedPhone.startsWith('91') ? cleanSelectedPhone : '91' + cleanSelectedPhone}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1"
                      >
                        <MessageSquare className="w-3 h-3" />
                        <span>WhatsApp</span>
                      </a>
                    </div>
                  </div>
                )}
              </div>

              {/* Assign To Role Selector (Srinivasan, Sundaram, Bala, Maari) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800">
                  Assign Lift Problem To <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {PROBLEM_ASSIGNEES.map((roleName) => {
                    const isSelected = targetAssignee === roleName;
                    return (
                      <button
                        key={roleName}
                        type="button"
                        onClick={() => setTargetAssignee(roleName)}
                        className={`p-2.5 rounded-xl border-2 text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'border-sky-600 bg-sky-50 text-sky-950 font-extrabold shadow-2xs'
                            : 'border-slate-200 bg-white hover:border-sky-300 text-slate-700 font-semibold'
                        }`}
                      >
                        <div className="text-xs truncate">{roleName}</div>
                        <div className="text-[10px] text-slate-500 font-normal">
                          {roleName === 'Maari' ? 'Site Inspector' : 'Team Lead'}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Quick Select Common Lift Issues */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-700">
                Quick Tick Common Lift Issues (or type problem details below):
              </label>
              <div className="flex flex-wrap gap-1.5">
                {COMMON_LIFT_ISSUES.map((issue) => {
                  const active = problemDescription.includes(issue);
                  return (
                    <button
                      key={issue}
                      type="button"
                      onClick={() =>
                        setProblemDescription((prev) =>
                          prev.includes(issue)
                            ? prev
                                .split('\n')
                                .filter((l) => l.trim() !== `• ${issue}` && l.trim() !== issue)
                                .join('\n')
                                .trim()
                            : prev.trim()
                            ? `${prev.trim()}\n• ${issue}`
                            : `• ${issue}`
                        )
                      }
                      className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold border transition-all cursor-pointer ${
                        active
                          ? 'bg-amber-100 border-amber-400 text-amber-950 font-bold'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {active ? '✓ ' : '+ '}
                      {issue}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Problem Description */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-800">
                Lift Issue / Site Problem Description <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                value={problemDescription}
                onChange={(e) => setProblemDescription(e.target.value)}
                placeholder="Enter the lift issue reported by the customer after handover or during site inspection..."
                className="w-full p-3 border border-slate-300 rounded-2xl bg-white text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            {/* Upload Issue Image(s) */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-800">
                Upload Issue Image(s) {mode === 'inspector' ? <span className="text-rose-500">*</span> : <span className="text-slate-400 font-normal">(Optional)</span>}
              </label>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <label className="flex-1 flex flex-col items-center justify-center p-4 border-2 border-dashed border-sky-300 rounded-2xl bg-sky-50/40 hover:bg-sky-50 hover:border-sky-500 transition-all cursor-pointer text-center">
                  <Upload className="w-5 h-5 text-sky-600 mb-1" />
                  <span className="text-xs font-extrabold text-sky-900">
                    {processingImages ? 'Processing photo(s)...' : 'Click to Upload Issue Photo'}
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
                        className="relative w-20 h-20 rounded-xl overflow-hidden border-2 border-sky-400 shadow-sm group bg-slate-900"
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
                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center text-[10px] font-bold shadow-md hover:bg-rose-700"
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
                <span>{submitting ? `Assigning to ${targetAssignee}...` : `Assign Problem to ${targetAssignee}`}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ============================================================== */}
      {/* PROBLEMS LIST */}
      {/* ============================================================== */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <span>
                {detectedAssignee
                  ? `Problems Assigned to ${detectedAssignee}`
                  : 'Assigned Customer Callback & Site Problems'}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-slate-100 text-slate-800">
                {displayedProblems.length}
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Showing customer name, phone callback actions, problem description, assigned role, and resolution status
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
                placeholder="Search customer, role, or problem..."
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
                  : `Finished (${stats.finished})`}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500">Loading assigned problems...</div>
        ) : displayedProblems.length === 0 ? (
          <div className="p-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
            <p className="text-sm font-bold text-slate-800">No assigned problems found</p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {canCreateOrAssign
                ? 'Use the form above to call back a customer and assign a lift problem to Srinivasan (TL), Sundaram, Bala, or Maari.'
                : `No customer lift problems are currently assigned to ${activeRoleLabel} in this filter.`}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {displayedProblems.map((item) => {
              const isFinished = item.status === 'FINISHED';
              const isBusy = finishingId === item._id;
              const itemAssignee = item.assignedTo || 'Sundaram';
              const cleanPhone = String(item.customerPhone || '').replace(/\D/g, '');

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
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-indigo-100 text-indigo-900 border border-indigo-300">
                            Assigned to: {itemAssignee}
                          </span>
                          {item.customerCode && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-sky-50 text-sky-700 border border-sky-200">
                              {item.customerCode}
                            </span>
                          )}
                          {item.projectCode && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
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

                        {item.customerPhone && (
                          <div className="flex items-center gap-2 pt-0.5 flex-wrap">
                            <span className="text-xs font-mono text-slate-600 flex items-center gap-1">
                              <Phone className="w-3 h-3 text-slate-400" />
                              {item.customerPhone}
                            </span>
                            {cleanPhone && (
                              <>
                                <a
                                  href={`tel:${cleanPhone}`}
                                  className="px-2 py-0.5 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-lg text-[10px] font-bold flex items-center gap-1"
                                >
                                  <Phone className="w-2.5 h-2.5" />
                                  <span>Call</span>
                                </a>
                                <a
                                  href={`https://wa.me/${cleanPhone.startsWith('91') ? cleanPhone : '91' + cleanPhone}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-2 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-[10px] font-bold flex items-center gap-1"
                                >
                                  <MessageSquare className="w-2.5 h-2.5" />
                                  <span>WhatsApp</span>
                                </a>
                              </>
                            )}
                          </div>
                        )}

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
                            <span>Finished ({item.finishedByName || itemAssignee})</span>
                          </span>
                        ) : (
                          <span className="px-3 py-1 rounded-full text-[11px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            <span>Assigned to {itemAssignee}</span>
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
                        Lift Issue / Problem Reported:
                      </span>
                      <p className="text-xs sm:text-sm font-bold text-slate-900 whitespace-pre-line leading-relaxed">
                        {item.problemDescription}
                      </p>
                    </div>

                    {/* Uploaded Issue Images */}
                    {Array.isArray(item.images) && item.images.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                          Attached Issue Photo ({item.images.length}):
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {item.images.map((imgUrl: string, idx: number) => (
                            <div
                              key={idx}
                              onClick={() => setPreviewImage(imgUrl)}
                              className="rounded-xl overflow-hidden border-2 border-sky-400 bg-slate-900 h-44 relative group cursor-pointer"
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

                    {/* Reassign Dropdown for CRM / Admin */}
                    {isCrmOrAdmin && (
                      <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                        <span className="font-bold text-slate-700">Assigned Role:</span>
                        <select
                          value={
                            PROBLEM_ASSIGNEES.find((a) =>
                              String(item.assignedTo || '')
                                .toLowerCase()
                                .includes(a.toLowerCase().replace(/\s*\(tl\)/i, ''))
                            ) || 'Sundaram'
                          }
                          onChange={(e) => handleReassignProblem(item, e.target.value)}
                          className="px-2.5 py-1 border border-slate-300 rounded-lg bg-white font-bold text-slate-900 cursor-pointer"
                        >
                          {PROBLEM_ASSIGNEES.map((a) => (
                            <option key={a} value={a}>
                              {a}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Resolution info if finished */}
                    {isFinished && (
                      <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs space-y-1">
                        <div className="font-bold text-emerald-900 flex items-center justify-between">
                          <span>✓ Completed by {item.finishedByName || itemAssignee}</span>
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
                      Assigned by: <strong>{item.reportedByName || 'CRM'}</strong>
                    </span>

                    <div className="flex items-center gap-2 flex-wrap">
                      {!isFinished && (
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

                      {isFinished && (
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
                        title="Delete problem"
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
