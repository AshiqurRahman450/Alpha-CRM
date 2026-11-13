'use client';

import React, { useEffect, useState } from 'react';
import {
  Building2,
  X,
  MapPin,
  Save,
  Loader2,
  IndianRupee,
  Layers,
  Truck,
  MessageSquare,
  Sparkles,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { api } from '../lib/api';
import { formatProjectStatus, STAGES_ORDER } from './Timeline';

interface EditProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: any;
  customers?: any[];
  onProjectUpdated: (updatedProject: any) => void;
  currentUser?: any;
}

export default function EditProjectModal({
  isOpen,
  onClose,
  project,
  customers = [],
  onProjectUpdated,
  currentUser,
}: EditProjectModalProps) {
  const [formData, setFormData] = useState({
    customerId: '',
    projectName: '',
    siteAddress: '',
    googleMapsLink: '',
    liftModel: 'AE 01 Home Series',
    liftType: 'Home Lift',
    numberOfFloors: 'G+1',
    shaftModel: '',
    liftBaseAmount: '0',
    liftDiscountAmount: '',
    liftNonCashAmount: '0',
    shaftBaseAmount: '0',
    shaftDiscountAmount: '',
    shaftNonCashAmount: '0',
    orderValue: 0,
    advanceAmount: '',
    advancePercentage: '',
    productionPaymentPercent: '40',
    readinessNotificationPercent: '20',
    dispatchMaterialsPercent: '5',
    afterInstallationPercent: '5',
    projectStatus: 'PAYMENT_RECEIVED',
    vrlLrNumber: '',
    trackingNumber: '',
    updateFrequencyDays: '20',
    whatsappGroupId: '',
    notes: '',
  });

  const [submitting, setSubmitting] = useState(false);

  const calcTotalAmount = (liftWithGst: string | number, shaftWithGst: string | number, shaftModel: string) => {
    const lift = Number(liftWithGst || 0);
    const shaft = shaftModel === 'Customer Scope' ? 0 : Number(shaftWithGst || 0);
    return Math.round(lift + shaft);
  };

  useEffect(() => {
    if (project && isOpen) {
      const cId = typeof project.customerId === 'object' && project.customerId !== null
        ? project.customerId._id
        : (project.customerId || '');

      const liftBase = project.liftBaseAmount ? String(project.liftBaseAmount) : (project.liftAmount ? String(Math.round(project.liftAmount / 1.18)) : '0');
      const liftWithGst = project.liftAmount ? String(project.liftAmount) : (project.liftNonCashAmount ? String(project.liftNonCashAmount) : '0');
      const liftDisc = project.liftDiscountAmount ? String(project.liftDiscountAmount) : '';

      const shaftBase = project.shaftBaseAmount ? String(project.shaftBaseAmount) : (project.shaftAmount ? String(Math.round(project.shaftAmount / 1.18)) : '0');
      const shaftWithGst = project.shaftAmount ? String(project.shaftAmount) : (project.shaftNonCashAmount ? String(project.shaftNonCashAmount) : '0');
      const shaftDisc = project.shaftDiscountAmount ? String(project.shaftDiscountAmount) : '';

      const ordVal = project.orderValue || calcTotalAmount(liftWithGst, shaftWithGst, project.shaftModel || '');

      setFormData({
        customerId: cId,
        projectName: project.projectName || '',
        siteAddress: project.siteAddress || '',
        googleMapsLink: project.googleMapsLink || '',
        liftModel: project.liftModel || 'AE 01 Home Series',
        liftType: project.liftType || 'Home Lift',
        numberOfFloors: project.numberOfFloors || 'G+1',
        shaftModel: project.shaftModel || '',
        liftBaseAmount: liftBase,
        liftDiscountAmount: liftDisc,
        liftNonCashAmount: liftWithGst,
        shaftBaseAmount: shaftBase,
        shaftDiscountAmount: shaftDisc,
        shaftNonCashAmount: shaftWithGst,
        orderValue: ordVal,
        advanceAmount: project.advanceAmount !== undefined ? String(project.advanceAmount) : '',
        advancePercentage: project.advancePercentage !== undefined ? String(project.advancePercentage) : '',
        productionPaymentPercent: project.productionPaymentPercent !== undefined ? String(project.productionPaymentPercent) : '40',
        readinessNotificationPercent: project.readinessNotificationPercent !== undefined ? String(project.readinessNotificationPercent) : '20',
        dispatchMaterialsPercent: project.dispatchMaterialsPercent !== undefined ? String(project.dispatchMaterialsPercent) : '5',
        afterInstallationPercent: project.afterInstallationPercent !== undefined ? String(project.afterInstallationPercent) : '5',
        projectStatus: project.projectStatus || 'PAYMENT_RECEIVED',
        vrlLrNumber: project.vrlLrNumber || project.trackingNumber || '',
        trackingNumber: project.trackingNumber || project.vrlLrNumber || '',
        updateFrequencyDays: String(project.updateFrequencyDays || 20),
        whatsappGroupId: project.whatsappGroupId || '',
        notes: project.notes || '',
      });
    }
  }, [project, isOpen]);

  if (!isOpen || !project) return null;

  const updateField = (key: string, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleAdvanceChange = (type: 'amount' | 'percent', val: string) => {
    const totalVal = calcTotalAmount(formData.liftNonCashAmount, formData.shaftNonCashAmount, formData.shaftModel);
    let newAmt = formData.advanceAmount;
    let newPct = formData.advancePercentage;

    if (type === 'amount') {
      newAmt = val;
      const numVal = Number(val) || 0;
      newPct = totalVal > 0 && val !== '' ? String(Math.round((numVal / totalVal) * 100)) : '';
    } else {
      newPct = val;
      const numPct = Number(val) || 0;
      newAmt = totalVal > 0 && val !== '' ? String(Math.round((totalVal * numPct) / 100)) : '';
    }

    const advNum = Number(newPct || 0);
    const prodNum = Number(formData.productionPaymentPercent || 0);
    const readyNum = Number(formData.readinessNotificationPercent || 0);
    const is100 = (advNum + prodNum + readyNum) >= 100;

    setFormData((prev) => ({
      ...prev,
      advanceAmount: newAmt,
      advancePercentage: newPct,
      dispatchMaterialsPercent: is100 ? '0' : prev.dispatchMaterialsPercent,
      afterInstallationPercent: is100 ? '0' : prev.afterInstallationPercent,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.projectName.trim()) {
      toast.error('Project Name is required');
      return;
    }
    if (!formData.siteAddress.trim()) {
      toast.error('Site Address is required');
      return;
    }

    try {
      setSubmitting(true);
      const computedLiftAmount = Number(formData.liftNonCashAmount || 0);
      const computedShaftAmount = formData.shaftModel === 'Customer Scope' ? 0 : Number(formData.shaftNonCashAmount || 0);
      const computedOrderValue = computedLiftAmount + computedShaftAmount;

      const payload: any = {
        customerId: formData.customerId || undefined,
        projectName: formData.projectName.trim(),
        siteAddress: formData.siteAddress.trim(),
        googleMapsLink: formData.googleMapsLink ? formData.googleMapsLink.trim() : formData.siteAddress.trim(),
        liftModel: formData.liftModel,
        liftType: formData.liftType,
        numberOfFloors: formData.numberOfFloors,
        shaftModel: formData.shaftModel,
        liftAmount: computedLiftAmount,
        liftBaseAmount: Number(formData.liftBaseAmount || 0),
        liftDiscountAmount: formData.liftDiscountAmount ? Number(formData.liftDiscountAmount) : undefined,
        liftNonCashAmount: computedLiftAmount,
        shaftAmount: computedShaftAmount,
        shaftBaseAmount: Number(formData.shaftBaseAmount || 0),
        shaftDiscountAmount: formData.shaftDiscountAmount ? Number(formData.shaftDiscountAmount) : undefined,
        shaftNonCashAmount: computedShaftAmount,
        orderValue: computedOrderValue,
        advanceAmount: Number(formData.advanceAmount || 0),
        advancePercentage: Number(formData.advancePercentage || 0),
        productionPaymentPercent: Number(formData.productionPaymentPercent || 0),
        readinessNotificationPercent: Number(formData.readinessNotificationPercent || 0),
        dispatchMaterialsPercent: Number(formData.dispatchMaterialsPercent || 0),
        afterInstallationPercent: Number(formData.afterInstallationPercent || 0),
        projectStatus: formData.projectStatus,
        vrlLrNumber: formData.vrlLrNumber ? formData.vrlLrNumber.trim() : undefined,
        trackingNumber: formData.vrlLrNumber ? formData.vrlLrNumber.trim() : undefined,
        updateFrequencyDays: Number(formData.updateFrequencyDays || 20),
        whatsappGroupId: formData.whatsappGroupId ? formData.whatsappGroupId.trim() : undefined,
        notes: formData.notes ? formData.notes.trim() : undefined,
      };

      const res = await api.updateProject(project._id, payload);
      toast.success(`Project ${project.projectId || ''} updated successfully!`);
      onProjectUpdated(res?.data || { ...project, ...payload });
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update project');
    } finally {
      setSubmitting(false);
    }
  };

  const totalCalculated = calcTotalAmount(formData.liftNonCashAmount, formData.shaftNonCashAmount, formData.shaftModel);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden my-6 flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-[#0F2744] text-white p-5 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-400">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold tracking-tight">Edit Elevator Project</h3>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-400/30">
                  {project.projectId}
                </span>
              </div>
              <p className="text-[11px] text-slate-300">
                Update project specifications, pricing, payment schedule & current stage
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 text-xs overflow-y-auto flex-1">
          {/* Customer & Project Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Associated Customer: *
              </label>
              <select
                required
                value={formData.customerId}
                onChange={(e) => {
                  const selectedId = e.target.value;
                  const selectedCustomer = customers.find((c) => c._id === selectedId);
                  setFormData((prev) => ({
                    ...prev,
                    customerId: selectedId,
                    siteAddress: selectedCustomer?.address || prev.siteAddress,
                  }));
                }}
                className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none bg-white font-medium"
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
                value={formData.projectName}
                onChange={(e) => updateField('projectName', e.target.value)}
                placeholder="e.g. Kumar Residence"
                className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Site Address */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center justify-between">
              <span>Site Address & Location: *</span>
              {formData.siteAddress && (formData.siteAddress.startsWith('http') || formData.siteAddress.includes('maps')) && (
                <a
                  href={formData.siteAddress}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-sky-600 hover:text-sky-800 font-bold hover:underline inline-flex items-center gap-1"
                >
                  <MapPin className="w-3 h-3 text-rose-500" />
                  <span>Open in Maps</span>
                </a>
              )}
            </label>
            <input
              type="text"
              required
              value={formData.siteAddress}
              onChange={(e) => updateField('siteAddress', e.target.value)}
              placeholder="e.g. Plot 42, Palm Meadows, Whitefield, Bengaluru or Google Maps link"
              className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none"
            />
          </div>

          {/* Lift & Shaft Info */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/90 space-y-4">
            <h4 className="text-[11px] font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-sky-600" />
              <span>Elevator & Shaft Specifications</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-700 mb-1">
                  Lift Model: *
                </label>
                <select
                  required
                  value={formData.liftModel}
                  onChange={(e) => updateField('liftModel', e.target.value)}
                  className="w-full p-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 bg-white"
                >
                  <option value="AE 01 Home Series">AE 01 Home Series</option>
                  <option value="AE 02 Gearless Rope Home Series">AE 02 Gearless Rope Home Series</option>
                  <option value="AE 03 Gearless Belt Home series">AE 03 Gearless Belt Home series</option>
                  <option value="AE 03 Gearless Belt Home series EV">AE 03 Gearless Belt Home series EV</option>
                  <option value="Semi Home Lift">Semi Home Lift</option>
                  <option value="Alpha Circle Lift">Alpha Circle Lift</option>
                  <option value="Alpha Circle Max Lift">Alpha Circle Max Lift</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-700 mb-1">
                  Floors: *
                </label>
                <select
                  required
                  value={formData.numberOfFloors}
                  onChange={(e) => updateField('numberOfFloors', e.target.value)}
                  className="w-full p-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 bg-white"
                >
                  <option value="G+1">G+1</option>
                  <option value="G+2">G+2</option>
                  <option value="G+3">G+3</option>
                  <option value="G+4">G+4</option>
                  <option value="G+5">G+5</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-700 mb-1">
                  Lift Non-GST (₹):
                </label>
                <input
                  type="number"
                  placeholder="e.g. 1600000"
                  value={formData.liftBaseAmount || ''}
                  onChange={(e) => {
                    const base = e.target.value;
                    const effectiveBase = formData.liftDiscountAmount && Number(formData.liftDiscountAmount) > 0
                      ? formData.liftDiscountAmount
                      : base;
                    const withGst = effectiveBase !== '' ? String(Math.round(Number(effectiveBase) * 1.18)) : '';
                    setFormData((prev) => ({
                      ...prev,
                      liftBaseAmount: base,
                      liftNonCashAmount: withGst,
                    }));
                  }}
                  className="w-full p-2 text-xs border border-slate-300 rounded-lg font-bold bg-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span>Lift Discount (₹):</span>
                </label>
                <input
                  type="number"
                  placeholder="Optional discount"
                  value={formData.liftDiscountAmount || ''}
                  onChange={(e) => {
                    const disc = e.target.value;
                    const effectiveBase = disc !== '' && Number(disc) > 0 ? disc : formData.liftBaseAmount;
                    const withGst = effectiveBase !== '' ? String(Math.round(Number(effectiveBase) * 1.18)) : '';
                    setFormData((prev) => ({
                      ...prev,
                      liftDiscountAmount: disc,
                      liftNonCashAmount: withGst,
                    }));
                  }}
                  className="w-full p-2 text-xs border border-emerald-300 rounded-lg font-bold text-emerald-900 bg-emerald-50/20"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-700 mb-1">
                  Lift + 18% GST (₹): *
                </label>
                <input
                  type="number"
                  required
                  value={formData.liftNonCashAmount || ''}
                  onChange={(e) => {
                    const withGst = e.target.value;
                    const base = withGst !== '' ? String(Math.round(Number(withGst) / 1.18)) : '';
                    setFormData((prev) => ({
                      ...prev,
                      liftNonCashAmount: withGst,
                      liftBaseAmount: prev.liftDiscountAmount ? prev.liftBaseAmount : base,
                    }));
                  }}
                  className="w-full p-2 text-xs border border-slate-300 rounded-lg font-bold bg-white"
                />
              </div>
            </div>

            {/* Shaft Model & Pricing */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-700 mb-1">
                  Shaft Model: *
                </label>
                <select
                  required
                  value={formData.shaftModel}
                  onChange={(e) => updateField('shaftModel', e.target.value)}
                  className="w-full p-2 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  <option value="">-- Select Shaft Model --</option>
                  <option value="Customer Scope">Customer Scope</option>
                  <option value="Aluminium Shaft">Aluminium Shaft</option>
                  <option value="Glass Shaft">Glass Shaft</option>
                  <option value="No Shaft">No Shaft (Civil)</option>
                </select>
              </div>

              {formData.shaftModel !== 'Customer Scope' && (
                <>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 mb-1">
                      Shaft Non-GST (₹):
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 400000"
                      value={formData.shaftBaseAmount || ''}
                      onChange={(e) => {
                        const base = e.target.value;
                        const effectiveBase = formData.shaftDiscountAmount && Number(formData.shaftDiscountAmount) > 0
                          ? formData.shaftDiscountAmount
                          : base;
                        const withGst = effectiveBase !== '' ? String(Math.round(Number(effectiveBase) * 1.18)) : '';
                        setFormData((prev) => ({
                          ...prev,
                          shaftBaseAmount: base,
                          shaftNonCashAmount: withGst,
                        }));
                      }}
                      className="w-full p-2 text-xs border border-slate-300 rounded-lg font-bold bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 mb-1">
                      Shaft Discount (₹):
                    </label>
                    <input
                      type="number"
                      placeholder="Optional discount"
                      value={formData.shaftDiscountAmount || ''}
                      onChange={(e) => {
                        const disc = e.target.value;
                        const effectiveBase = disc !== '' && Number(disc) > 0 ? disc : formData.shaftBaseAmount;
                        const withGst = effectiveBase !== '' ? String(Math.round(Number(effectiveBase) * 1.18)) : '';
                        setFormData((prev) => ({
                          ...prev,
                          shaftDiscountAmount: disc,
                          shaftNonCashAmount: withGst,
                        }));
                      }}
                      className="w-full p-2 text-xs border border-emerald-300 rounded-lg font-bold text-emerald-900 bg-emerald-50/20"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 mb-1">
                      Shaft + 18% GST (₹):
                    </label>
                    <input
                      type="number"
                      value={formData.shaftNonCashAmount || ''}
                      onChange={(e) => {
                        const withGst = e.target.value;
                        const base = withGst !== '' ? String(Math.round(Number(withGst) / 1.18)) : '';
                        setFormData((prev) => ({
                          ...prev,
                          shaftNonCashAmount: withGst,
                          shaftBaseAmount: prev.shaftDiscountAmount ? prev.shaftBaseAmount : base,
                        }));
                      }}
                      className="w-full p-2 text-xs border border-slate-300 rounded-lg font-bold bg-white"
                    />
                  </div>
                </>
              )}
            </div>

            {/* Total Value Banner */}
            <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200">
              <span className="text-[11px] font-bold text-slate-700">Total Project Value (Inc. GST):</span>
              <strong className="text-sm font-extrabold text-sky-700">
                ₹{totalCalculated.toLocaleString('en-IN')}
              </strong>
            </div>
          </div>

          {/* Payment Schedule */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/90 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Payment Schedule</h4>
              <span className="text-[10px] text-slate-500">Auto-calculated upon advance adjustment</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-700 mb-1 truncate">
                  Advance (₹): *
                </label>
                <input
                  type="number"
                  required
                  value={formData.advanceAmount}
                  onChange={(e) => handleAdvanceChange('amount', e.target.value)}
                  className="w-full p-2 text-xs border border-slate-300 rounded-lg font-bold bg-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1 truncate">
                  Advance (%):
                </label>
                <input
                  type="number"
                  value={formData.advancePercentage}
                  onChange={(e) => handleAdvanceChange('percent', e.target.value)}
                  className="w-full p-2 text-xs border border-slate-300 rounded-lg bg-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1 truncate">
                  Production (%):
                </label>
                <input
                  type="number"
                  value={formData.productionPaymentPercent}
                  onChange={(e) => {
                    const prod = e.target.value;
                    const is100 = (Number(formData.advancePercentage || 0) + Number(prod || 0) + Number(formData.readinessNotificationPercent || 0)) >= 100;
                    setFormData((prev) => ({
                      ...prev,
                      productionPaymentPercent: prod,
                      dispatchMaterialsPercent: is100 ? '0' : prev.dispatchMaterialsPercent,
                      afterInstallationPercent: is100 ? '0' : prev.afterInstallationPercent,
                    }));
                  }}
                  className="w-full p-2 text-xs border border-slate-300 rounded-lg bg-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1 truncate">
                  Readiness (%):
                </label>
                <input
                  type="number"
                  value={formData.readinessNotificationPercent}
                  onChange={(e) => {
                    const ready = e.target.value;
                    const is100 = (Number(formData.advancePercentage || 0) + Number(formData.productionPaymentPercent || 0) + Number(ready || 0)) >= 100;
                    setFormData((prev) => ({
                      ...prev,
                      readinessNotificationPercent: ready,
                      dispatchMaterialsPercent: is100 ? '0' : prev.dispatchMaterialsPercent,
                      afterInstallationPercent: is100 ? '0' : prev.afterInstallationPercent,
                    }));
                  }}
                  className="w-full p-2 text-xs border border-slate-300 rounded-lg bg-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1 truncate">
                  Dispatch (%):
                </label>
                <input
                  type="number"
                  value={formData.dispatchMaterialsPercent}
                  onChange={(e) => updateField('dispatchMaterialsPercent', e.target.value)}
                  className="w-full p-2 text-xs border border-slate-300 rounded-lg bg-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1 truncate">
                  Installation (%):
                </label>
                <input
                  type="number"
                  value={formData.afterInstallationPercent}
                  onChange={(e) => updateField('afterInstallationPercent', e.target.value)}
                  className="w-full p-2 text-xs border border-slate-300 rounded-lg bg-white"
                />
              </div>
            </div>
          </div>

          {/* Current Stage & Tracking Details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Current Pipeline Stage:
              </label>
              <select
                value={formData.projectStatus}
                onChange={(e) => updateField('projectStatus', e.target.value)}
                className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 bg-white font-semibold text-slate-800"
              >
                {STAGES_ORDER.map((stage) => (
                  <option key={stage.key} value={stage.key}>
                    {stage.label}
                  </option>
                ))}
                <option value="ON_HOLD">On Hold</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Truck className="w-3.5 h-3.5 text-sky-600" />
                <span>VRL LR / Tracking No:</span>
              </label>
              <input
                type="text"
                value={formData.vrlLrNumber}
                onChange={(e) => updateField('vrlLrNumber', e.target.value)}
                placeholder="e.g. VRL-9823412"
                className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                <span>WhatsApp Group ID:</span>
              </label>
              <input
                type="text"
                value={formData.whatsappGroupId}
                onChange={(e) => updateField('whatsappGroupId', e.target.value)}
                placeholder="e.g. 1203630283921@g.us"
                className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 font-mono"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Project Notes & Instructions:
            </label>
            <textarea
              rows={2}
              value={formData.notes}
              onChange={(e) => updateField('notes', e.target.value)}
              placeholder="e.g. Pit depth 1200mm, machine room at top..."
              className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2.5 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-sky-950/20 active:scale-95 flex items-center gap-2 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Project Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
