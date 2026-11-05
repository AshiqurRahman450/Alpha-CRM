'use client';

import React, { useState, useEffect } from 'react';
import {
  QuotationData,
  QUOTATION_PRESETS,
  DEFAULT_QUOTATION_DATA,
  buildWarrantyText,
  parseWarrantyText,
  parseDeliveryDays,
  getPresetAccessoriesFeatures,
} from '../../types/quotation';
import {
  User,
  Building,
  Wrench,
  Layers,
  IndianRupee,
  ShieldCheck,
  Sparkles,
  RotateCcw,
  Plus,
  Trash2,
  Calendar,
  FileText,
  CheckCircle,
  Mail,
  MapPin,
  Truck,
  Receipt,
} from 'lucide-react';

interface QuotationFormProps {
  data: QuotationData;
  onChange: (data: QuotationData) => void;
  customers?: any[];
  onSelectCustomer?: (customer: any) => void;
}

export default function QuotationForm({
  data,
  onChange,
  customers = [],
  onSelectCustomer,
}: QuotationFormProps) {
  const [activeTab, setActiveTab] = useState<
    'client' | 'civil' | 'elevator' | 'shaft' | 'pricing' | 'signatures' | 'billing'
  >('client');
  const isCircle = data.templateType === 'circle';

  useEffect(() => {
    if (isCircle && (activeTab === 'shaft' || activeTab === 'billing')) {
      setActiveTab('client');
    }
  }, [isCircle, activeTab]);

  const formTabs = isCircle
    ? [
        { id: 'client', label: '1. Client & Offer (Pgs 1 & 2)', icon: User },
        { id: 'civil', label: '2. Lift Specs & Dimensions (Pg 3)', icon: Building },
        { id: 'elevator', label: '3. Technical & Cabin Specs (Pg 4)', icon: Wrench },
        { id: 'pricing', label: '4. Pricing & Payment Terms (Pg 4)', icon: IndianRupee },
        { id: 'signatures', label: '5. Terms & Acceptance (Pg 5)', icon: ShieldCheck },
      ]
    : [
        { id: 'client', label: '1. Client & Offer', icon: User },
        { id: 'civil', label: '2. Civil & Cabin (Page 3)', icon: Building },
        { id: 'elevator', label: '3. Elevator & Doors (Page 4)', icon: Wrench },
        { id: 'shaft', label: '4. Shaft & Features (Page 5)', icon: Layers },
        { id: 'pricing', label: '5. Pricing & Terms (Page 6)', icon: IndianRupee },
        { id: 'signatures', label: '6. Signatures (Page 9)', icon: ShieldCheck },
        { id: 'billing', label: '7. Billing & Shipping (Page 10)', icon: Truck },
      ];
  const [newFeatureText, setNewFeatureText] = useState('');
  const [doorAccessAlert, setDoorAccessAlert] = useState<string | null>(null);

  // Helper to get active list of floors from floorNumbering or noOfStops
  const getFloorsList = (): string[] => {
    if (data.floorNumbering && data.floorNumbering.trim()) {
      const parts = data.floorNumbering.split(',').map((s) => s.trim()).filter(Boolean);
      if (parts.length > 0) return parts;
    }
    const match = (data.noOfStops || '').match(/G\+(\d+)/i);
    if (match) {
      const k = parseInt(match[1], 10);
      return ['G', ...Array.from({ length: k }, (_, i) => String(i + 1))];
    }
    return ['G', '1', '2', '3']; // Default G+3
  };

  // Helper to get checked letters for a floor
  const getFloorLetters = (floor: string): string[] => {
    if (data.doorAccessFloors && data.doorAccessFloors[floor]) {
      return data.doorAccessFloors[floor];
    }
    if (
      data.doorAccess &&
      !['inline', 'adjacent', 'Opposite Side', 'inline and adjacent', 'Same Side'].includes(data.doorAccess)
    ) {
      const regex = new RegExp(`(?:^|,|\\|)\\s*${floor}\\s*[-:]\\s*([A-CG]+)`, 'i');
      const match = data.doorAccess.match(regex);
      if (match && match[1]) {
        return match[1].toUpperCase().split('').filter((c) => ['A', 'B', 'C', 'G'].includes(c));
      }
    }
    return ['A']; // Standard default
  };

  const handleToggleFloorLetter = (floor: string, letter: string) => {
    const currentFloors = getFloorsList();
    const currentSelected = getFloorLetters(floor);
    const letterOrder: Record<string, number> = { A: 1, B: 2, C: 3, G: 4 };
    const newSelected = currentSelected.includes(letter)
      ? currentSelected.filter((l) => l !== letter)
      : [...currentSelected, letter].sort((a, b) => (letterOrder[a] || 99) - (letterOrder[b] || 99));

    const updatedMap: Record<string, string[]> = { ...(data.doorAccessFloors || {}) };
    currentFloors.forEach((f) => {
      updatedMap[f] = f === floor ? newSelected : getFloorLetters(f);
    });

    const formattedStr = currentFloors
      .map((f) => {
        const letters = (updatedMap[f] || []).join('');
        return `${f} - ${letters || 'None'}`;
      })
      .join(', ');

    onChange({
      ...data,
      doorAccessFloors: updatedMap,
      doorAccess: formattedStr,
    });
  };

  const handleSetAllFloorsAbcg = () => {
    const currentFloors = getFloorsList();
    const updatedMap: Record<string, string[]> = {};
    currentFloors.forEach((f) => {
      updatedMap[f] = ['A', 'B', 'C', 'G'];
    });
    const formattedStr = currentFloors.map((f) => `${f} - ABCG`).join(', ');
    onChange({
      ...data,
      doorAccessFloors: updatedMap,
      doorAccess: formattedStr,
    });
  };

  const handleSetFloorAbcg = (floor: string) => {
    const currentFloors = getFloorsList();
    const updatedMap: Record<string, string[]> = { ...(data.doorAccessFloors || {}) };
    currentFloors.forEach((f) => {
      updatedMap[f] = f === floor ? ['A', 'B', 'C', 'G'] : getFloorLetters(f);
    });
    const formattedStr = currentFloors
      .map((f) => `${f} - ${(updatedMap[f] || []).join('') || 'None'}`)
      .join(', ');
    onChange({
      ...data,
      doorAccessFloors: updatedMap,
      doorAccess: formattedStr,
    });
  };

  const handleSetAllFloorsSideA = () => {
    const currentFloors = getFloorsList();
    const updatedMap: Record<string, string[]> = {};
    currentFloors.forEach((f) => {
      updatedMap[f] = ['A'];
    });
    const formattedStr = currentFloors.map((f) => `${f} - A`).join(', ');
    onChange({
      ...data,
      doorAccessFloors: updatedMap,
      doorAccess: formattedStr,
    });
  };

  const updateField = (field: keyof QuotationData, value: any) => {
    onChange({
      ...data,
      [field]: value,
    });
  };

  const updateNestedField = (parent: 'paymentTerms', key: string, value: string) => {
    onChange({
      ...data,
      [parent]: {
        ...data[parent],
        [key]: value,
      },
    });
  };

  const handlePresetSelect = (presetIndex: number) => {
    const preset = QUOTATION_PRESETS[presetIndex];
    if (preset) {
      const isEv = Boolean(
        (preset.data.model && /\bEV\b|home\s*EV|battery/i.test(preset.data.model)) ||
        (preset.data.battery && preset.data.battery.trim() !== '')
      );
      const motor = preset.data.motorWarranty || 'Lifetime';
      const mfg = preset.data.manufacturingWarranty || '5 years';
      const maint = preset.data.freeMaintenance || '1 Years';
      const warranty =
        preset.data.warranty ||
        buildWarrantyText({
          motorWarranty: motor,
          manufacturingWarranty: mfg,
          freeMaintenance: maint,
          isEv,
        });

      const features =
        preset.data.accessoriesFeatures || getPresetAccessoriesFeatures(preset.data.model);

      onChange({
        ...data,
        ...preset.data,
        accessoriesFeatures: features,
        speed: '.4 m/s',
        warranty,
      });
    }
  };

  const isEvModel = Boolean(
    (data.model && /\bEV\b|home\s*EV|battery/i.test(data.model)) ||
    (data.battery && data.battery.trim() !== '')
  );

  const parsedWarranty = parseWarrantyText(data.warranty);
  const currentMotorWarranty = data.motorWarranty || parsedWarranty.motorWarranty || 'Lifetime';
  const currentMfgWarranty = data.manufacturingWarranty || parsedWarranty.manufacturingWarranty || '5 years';
  const currentFreeMaint = data.freeMaintenance || parsedWarranty.freeMaintenance || '1 Years';
  const currentDeliveryDays = data.deliveryDays ? Number(data.deliveryDays) : parseDeliveryDays(data.deliveryTime);

  const updateWarrantyComponent = (updates: {
    motorWarranty?: string;
    manufacturingWarranty?: string;
    freeMaintenance?: string;
  }) => {
    const newMotor = updates.motorWarranty !== undefined ? updates.motorWarranty : currentMotorWarranty;
    const newMfg = updates.manufacturingWarranty !== undefined ? updates.manufacturingWarranty : currentMfgWarranty;
    const newMaint = updates.freeMaintenance !== undefined ? updates.freeMaintenance : currentFreeMaint;

    const newWarrantyText = buildWarrantyText({
      motorWarranty: newMotor,
      manufacturingWarranty: newMfg,
      freeMaintenance: newMaint,
      isEv: isEvModel,
    });

    onChange({
      ...data,
      motorWarranty: newMotor,
      manufacturingWarranty: newMfg,
      freeMaintenance: newMaint,
      warranty: newWarrantyText,
    });
  };

  const updateDeliveryDays = (days: number) => {
    onChange({
      ...data,
      deliveryDays: days,
      deliveryTime: `${days} days post confirmation on drawings and finishes.`,
    });
  };

  const handleGenerateOfferNo = () => {
    const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const rand = Math.floor(100 + Math.random() * 900);
    updateField('offerNo', `AE/QTN/AE-${dateStr}-${rand}`);
  };

  const handleAddFeature = () => {
    if (!newFeatureText.trim()) return;
    updateField('accessoriesFeatures', [...data.accessoriesFeatures, newFeatureText.trim()]);
    setNewFeatureText('');
  };

  const handleRemoveFeature = (index: number) => {
    const updated = data.accessoriesFeatures.filter((_, i) => i !== index);
    updateField('accessoriesFeatures', updated);
  };

  // Calculations
  // Formula: (Elevator Price (₹) - Discount Price) * 1.18
  const elevatorPrice = Number(data.elevatorPrice || 0);
  const elevatorDiscountPrice =
    data.elevatorDiscountPrice !== undefined &&
    data.elevatorDiscountPrice !== null &&
    Number(data.elevatorDiscountPrice) > 0
      ? Number(data.elevatorDiscountPrice)
      : 0;
  const netElevatorPrice = Math.max(0, elevatorPrice - elevatorDiscountPrice);
  const effectiveElevatorPrice = netElevatorPrice;

  // Shaft formula: (Shaft Price - Discount Price) * 1.18
  const shaftPrice = Number(data.shaftPrice || 0);
  const shaftDiscountPrice =
    data.shaftDiscountPrice !== undefined &&
    data.shaftDiscountPrice !== null &&
    Number(data.shaftDiscountPrice) > 0
      ? Number(data.shaftDiscountPrice)
      : 0;
  const netShaftPrice = Math.max(0, shaftPrice - shaftDiscountPrice);
  const effectiveShaftPrice = netShaftPrice;

  const gstRate = data.gstRate !== undefined ? Number(data.gstRate) : 18;
  const gstMultiplier = 1 + gstRate / 100;
  const elevatorTotalWithGst = Math.round(netElevatorPrice * gstMultiplier);
  const shaftTotalWithGst = Math.round(netShaftPrice * gstMultiplier);

  const subtotal = netElevatorPrice + netShaftPrice;
  const gstAmount = Math.round((subtotal * gstRate) / 100);
  const grandTotal = subtotal + gstAmount;

  const baseSubtotal = elevatorPrice + shaftPrice;
  const totalSavings = elevatorDiscountPrice + shaftDiscountPrice;
  const hasDiscounts = elevatorDiscountPrice > 0 || shaftDiscountPrice > 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
      {/* Top Presets & Quick Select Bar */}
      <div className="p-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white border-b border-slate-800 space-y-3 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-teal-400 font-mono">
              Quotation Editor
            </span>
            <h2 className="text-base font-black tracking-tight text-white flex items-center gap-2">
              <span>Proposal Customizer</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/40">
                Live 2-Way Sync
              </span>
            </h2>
          </div>

          {/* Preset Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onChange(DEFAULT_QUOTATION_DATA)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1 transition-colors border border-slate-700"
              title="Reset all fields to sample proposal defaults"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
              <span>Reset Defaults</span>
            </button>
          </div>
        </div>

        {/* Template Format Selector */}
        <div className="bg-slate-900/90 border border-teal-500/30 rounded-xl p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-md">
          <div>
            <div className="text-[11px] font-bold text-teal-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-teal-400" />
              <span>Quotation Layout Format</span>
            </div>
            <div className="text-[10px] text-slate-400">
              {data.templateType === 'circle'
                ? '5-Page Panoramic Presentation (Circle Lift Format)'
                : '11-Page Full Proposal (Standard Technical Contract)'}
            </div>
          </div>
          <div className="flex items-center gap-1.5 bg-slate-950/80 p-1 rounded-lg border border-slate-700/80">
            <button
              type="button"
              onClick={() => onChange({ ...data, templateType: 'standard' })}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                data.templateType !== 'circle'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Standard (11 Pgs)</span>
            </button>
            <button
              type="button"
              onClick={() => onChange({ ...data, templateType: 'circle' })}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                data.templateType === 'circle'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Circle Lift (5 Pgs)</span>
            </button>
          </div>
        </div>

        {/* Quick presets and customer selector */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center justify-between">
              <span>Select Preset Model Template:</span>
              <span className="text-[10px] text-teal-400 font-normal">7 Models Available</span>
            </label>
            <select
              value={(() => {
                const idx = QUOTATION_PRESETS.findIndex(
                  (p) => p.name === data.model || p.data.model === data.model
                );
                return idx >= 0 ? idx : 0;
              })()}
              onChange={(e) => handlePresetSelect(Number(e.target.value))}
              className="w-full text-xs bg-slate-800/90 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-teal-400 font-medium"
            >
              {QUOTATION_PRESETS.map((p, idx) => (
                <option key={idx} value={idx}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {customers.length > 0 && (
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Auto-fill from Existing Customer:
              </label>
              <select
                onChange={(e) => {
                  const cust = customers.find((c) => c._id === e.target.value || c.id === e.target.value);
                  if (cust && onSelectCustomer) {
                    onSelectCustomer(cust);
                  }
                }}
                defaultValue=""
                className="w-full text-xs bg-slate-800/90 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-teal-400 font-medium"
              >
                <option value="" disabled>
                  -- Choose Customer --
                </option>
                {customers.map((c) => (
                  <option key={c._id || c.id} value={c._id || c.id}>
                    {c.name} {c.city ? `(${c.city})` : ''} - {c.phone}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 bg-slate-50/80 overflow-x-auto p-1.5 gap-1 shrink-0 text-xs font-semibold">
        {formTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-2 rounded-xl flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-white text-teal-700 shadow-sm border border-slate-200/80 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Contents - Scrollable */}
      <div className="p-5 overflow-y-auto flex-1 space-y-4">

        {/* TAB 1: CLIENT & OFFER */}
        {activeTab === 'client' && (
          <div className="space-y-4 animate-fade-in">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Client Full Name: <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={data.clientName}
                  onChange={(e) => {
                    const newName = e.target.value;
                    const cleanName = newName.replace(/^Dear\s*/i, '').trim();
                    onChange({
                      ...data,
                      clientName: newName,
                      salutation: cleanName ? `Dear ${cleanName}` : '',
                      clientSignatoryName:
                        !data.clientSignatoryName || data.clientSignatoryName === data.clientName
                          ? newName
                          : data.clientSignatoryName,
                    });
                  }}
                  placeholder="e.g. Mr. Rathish Rajakumar"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 font-medium"
                />
                <p className="text-[11px] text-teal-600 font-semibold mt-1 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse"></span>
                  <span>
                    Reflects on Page 1 (Cover) & Page 2:{' '}
                    <strong className="text-slate-800">
                      Dear {data.clientName ? data.clientName.replace(/^Dear\s*/i, '') : 'Mr. Rathish Rajakumar'}
                    </strong>
                  </span>
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Project City: <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={data.projectCity}
                  onChange={(e) => updateField('projectCity', e.target.value)}
                  placeholder="e.g. Chennai"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 font-medium"
                />
              </div>
            </div>

            {/* Page 2 Letter Salutation */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Page 2 Letter Salutation:
              </label>
              <div className="flex">
                <span className="px-3 py-2 bg-slate-100 border border-r-0 border-slate-300 rounded-l-xl text-xs font-bold text-[#0e4b31] select-none flex items-center">
                  Dear
                </span>
                <input
                  type="text"
                  value={
                    data.salutation
                      ? data.salutation.replace(/^Dear\s*/i, '')
                      : (data.clientName ? data.clientName.replace(/^Dear\s*/i, '') : '')
                  }
                  onChange={(e) => {
                    const val = e.target.value.trim();
                    updateField('salutation', val ? `Dear ${val}` : '');
                  }}
                  placeholder="e.g. Mr. Rathish Rajakumar"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-r-xl focus:ring-2 focus:ring-teal-500 font-medium"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Synced automatically from Client Full Name. You can also customize it directly here.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Offer / Quotation Number: <span className="text-rose-500">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={data.offerNo}
                    onChange={(e) => updateField('offerNo', e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 font-mono font-bold text-slate-800"
                  />
                  <button
                    type="button"
                    onClick={handleGenerateOfferNo}
                    className="px-2.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors whitespace-nowrap"
                    title="Generate new offer code"
                  >
                    Auto
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Offer Date:</label>
                <input
                  type="text"
                  value={data.offerDate}
                  onChange={(e) => updateField('offerDate', e.target.value)}
                  placeholder="DD/MM/YYYY"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 font-medium"
                />
              </div>
            </div>

            {/* Client Email & Contact Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Client Email Address:
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={data.clientEmail || ''}
                    onChange={(e) => updateField('clientEmail', e.target.value)}
                    placeholder="e.g. client@example.com"
                    className="w-full text-xs px-3 py-2 pl-8 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 font-medium"
                  />
                  <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Reflects on Page 10 (Billing & Shipping Record)</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Client Contact Phone:
                </label>
                <input
                  type="text"
                  value={data.customerPhone || ''}
                  onChange={(e) => updateField('customerPhone', e.target.value)}
                  placeholder="e.g. +91 98200 11101"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 font-medium"
                />
              </div>
            </div>

            {/* GST Registration Section (Yes / No) */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Receipt className="w-3.5 h-3.5 text-teal-600" />
                    <span>GST Number (GSTIN) Registration:</span>
                  </label>
                  <p className="text-[10px] text-slate-500">
                    Does the client have a registered GST Number for commercial tax invoicing?
                  </p>
                </div>
                <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => updateField('hasGst', true)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      data.hasGst
                        ? 'bg-teal-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onChange({
                        ...data,
                        hasGst: false,
                        gstNumber: '',
                      });
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      !data.hasGst
                        ? 'bg-slate-700 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    No
                  </button>
                </div>
              </div>

              {data.hasGst && (
                <div className="animate-fade-in pt-2 border-t border-slate-200/80">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Client GST Number: <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={data.gstNumber || ''}
                    onChange={(e) => updateField('gstNumber', e.target.value.toUpperCase())}
                    placeholder="e.g. 33AAAAA0000A1Z5"
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 font-mono font-bold uppercase tracking-wider text-teal-900 bg-white"
                  />
                  <p className="text-[10px] text-teal-600 mt-1">
                    GSTIN will be printed inside the official box on Page 10 for commercial tax billing.
                  </p>
                </div>
              )}
            </div>

            {/* Billing & Shipping Addresses Card */}
            <div className="bg-gradient-to-br from-slate-50 to-teal-50/30 border border-slate-200 rounded-xl p-3.5 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-teal-600" />
                  <span>Billing & Shipping Addresses (Page 10)</span>
                </span>
                <span className="text-[10px] text-teal-700 font-semibold bg-teal-100/70 px-2 py-0.5 rounded-full">
                  Reflects in Box on Page 10
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Full Billing Address: <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  value={data.billingAddress || ''}
                  onChange={(e) => {
                    const newBilling = e.target.value;
                    onChange({
                      ...data,
                      billingAddress: newBilling,
                      shippingAddress: data.sameAsBilling !== false ? newBilling : data.shippingAddress,
                    });
                  }}
                  placeholder="Enter complete billing address with Door/Plot No, Street, Locality, City, State, and Pincode"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 font-medium bg-white"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700 flex items-center gap-1">
                    <Truck className="w-3.5 h-3.5 text-teal-600" />
                    <span>Shipping / Site Delivery Address:</span> <span className="text-rose-500">*</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-bold text-teal-700 bg-white hover:bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-300 select-none shadow-2xs">
                    <input
                      type="checkbox"
                      checked={data.sameAsBilling !== false}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        onChange({
                          ...data,
                          sameAsBilling: checked,
                          shippingAddress: checked ? (data.billingAddress || '') : data.shippingAddress,
                        });
                      }}
                      className="w-3.5 h-3.5 text-teal-600 rounded border-slate-300 focus:ring-teal-500"
                    />
                    <span>Same as Billing Address</span>
                  </label>
                </div>
                <textarea
                  rows={2}
                  value={data.sameAsBilling !== false ? (data.billingAddress || '') : (data.shippingAddress || '')}
                  disabled={data.sameAsBilling !== false}
                  onChange={(e) => updateField('shippingAddress', e.target.value)}
                  placeholder="Enter complete site shipping / delivery address"
                  className={`w-full text-xs px-3 py-2 border rounded-xl font-medium transition-colors ${
                    data.sameAsBilling !== false
                      ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed'
                      : 'bg-white border-slate-300 focus:ring-2 focus:ring-teal-500'
                  }`}
                />
                {data.sameAsBilling !== false ? (
                  <p className="text-[10px] text-teal-600 mt-1">
                    ✓ Shipping address is automatically synchronized to Billing Address. Uncheck to provide a separate site address.
                  </p>
                ) : (
                  <p className="text-[10px] text-slate-400 mt-1">
                    Separate shipping address will be printed in the delivery box on Page 10.
                  </p>
                )}
              </div>
            </div>

            {/* Quick jump banner */}
            <div className="bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-200 rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-black text-teal-900 uppercase tracking-wide flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                  <span>Specification Quick Jump</span>
                </span>
                <span className="text-[10px] text-teal-700 font-semibold">Click to open tab</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-1.5">
                {isCircle ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setActiveTab('civil')}
                      className="px-2 py-1.5 bg-white hover:bg-teal-100/70 border border-teal-200 rounded-lg text-left text-[11px] font-bold text-teal-800 transition-colors shadow-2xs cursor-pointer"
                    >
                      📄 Pg 3: Dimensions &rarr;
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('elevator')}
                      className="px-2 py-1.5 bg-white hover:bg-teal-100/70 border border-teal-200 rounded-lg text-left text-[11px] font-bold text-teal-800 transition-colors shadow-2xs cursor-pointer"
                    >
                      ⚙️ Pg 4: Tech Specs &rarr;
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('pricing')}
                      className="px-2 py-1.5 bg-white hover:bg-teal-100/70 border border-teal-200 rounded-lg text-left text-[11px] font-bold text-teal-800 transition-colors shadow-2xs cursor-pointer"
                    >
                      💰 Pg 4: Pricing &rarr;
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('signatures')}
                      className="px-2 py-1.5 bg-white hover:bg-teal-100/70 border border-teal-200 rounded-lg text-left text-[11px] font-bold text-teal-800 transition-colors shadow-2xs cursor-pointer"
                    >
                      ✍️ Pg 5: Acceptance &rarr;
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setActiveTab('civil')}
                      className="px-2 py-1.5 bg-white hover:bg-teal-100/70 border border-teal-200 rounded-lg text-left text-[11px] font-bold text-teal-800 transition-colors shadow-2xs cursor-pointer"
                    >
                      📄 Page 3: Civil &rarr;
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('elevator')}
                      className="px-2 py-1.5 bg-white hover:bg-teal-100/70 border border-teal-200 rounded-lg text-left text-[11px] font-bold text-teal-800 transition-colors shadow-2xs cursor-pointer"
                    >
                      ⚙️ Page 4: Doors &rarr;
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('shaft')}
                      className="px-2 py-1.5 bg-white hover:bg-teal-100/70 border border-teal-200 rounded-lg text-left text-[11px] font-bold text-teal-800 transition-colors shadow-2xs cursor-pointer"
                    >
                      🏗️ Page 5: Shaft &rarr;
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('pricing')}
                      className="px-2 py-1.5 bg-white hover:bg-teal-100/70 border border-teal-200 rounded-lg text-left text-[11px] font-bold text-teal-800 transition-colors shadow-2xs cursor-pointer"
                    >
                      🛡️ Page 6: AMC &rarr;
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('billing')}
                      className="px-2 py-1.5 bg-white hover:bg-teal-100/70 border border-teal-200 rounded-lg text-left text-[11px] font-bold text-teal-800 transition-colors shadow-2xs cursor-pointer"
                    >
                      📦 Page 10: Dispatch &rarr;
                    </button>
                  </>
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700">Elevator Model Name:</label>
                <span className="text-[10px] text-teal-600 font-semibold">Choose from 7 presets or enter custom</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <select
                  value={(() => {
                    const idx = QUOTATION_PRESETS.findIndex(
                      (p) => p.name === data.model || p.data.model === data.model
                    );
                    return idx >= 0 ? idx : -1;
                  })()}
                  onChange={(e) => {
                    const idx = Number(e.target.value);
                    if (idx >= 0) handlePresetSelect(idx);
                  }}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 font-bold bg-white text-slate-800"
                >
                  <option value={-1}>-- Select Model Preset Dropdown --</option>
                  {QUOTATION_PRESETS.map((p, idx) => (
                    <option key={idx} value={idx}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={data.model}
                  onChange={(e) => updateField('model', e.target.value)}
                  placeholder="e.g. AE 03 Gearless Belt Home series EV"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 font-semibold"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Series Title (Page 3 Header):</label>
              <input
                type="text"
                value={data.seriesTitle}
                onChange={(e) => updateField('seriesTitle', e.target.value)}
                placeholder="e.g. Alpha Home Series: AE 03 Gearless Belt Home Series EV"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Proposal Subject Line:</label>
              <input
                type="text"
                value={data.subject}
                onChange={(e) => updateField('subject', e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 font-medium"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">BDM / Alpha Representative:</label>
                <input
                  type="text"
                  value={data.representativeName}
                  onChange={(e) => updateField('representativeName', e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Representative Contact:</label>
                <input
                  type="text"
                  value={data.representativePhone}
                  onChange={(e) => updateField('representativePhone', e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 font-medium"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: CIVIL & CABIN SPECIFICATIONS / LIFT OVERVIEW & DIMENSIONS */}
        {activeTab === 'civil' && (
          isCircle ? (
            <div className="space-y-4 animate-fade-in">
              <div className="bg-gradient-to-r from-teal-900/40 to-slate-900/60 p-3.5 rounded-xl border border-teal-500/40 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-black text-teal-300 uppercase tracking-wide flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Circle Lift Overview & Dimensions (Page 3)</span>
                  </h3>
                  <p className="text-[11px] text-teal-200/80 mt-0.5">
                    Live parameters reflected in the Page 3 Lift Overview and Cylinder Dimensions tables.
                  </p>
                </div>
                <span className="text-[10px] bg-teal-500/20 text-teal-300 border border-teal-500/30 font-bold px-2 py-0.5 rounded-md">
                  Page 3
                </span>
              </div>

              {/* Lift Overview Grid */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
                <h4 className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-teal-600" />
                  <span>General Lift Parameters</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Model Name:</label>
                    <input
                      type="text"
                      value={data.model}
                      onChange={(e) => updateField('model', e.target.value)}
                      placeholder="e.g. Alpha Circle Lift"
                      className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Installation Environment:</label>
                    <input
                      type="text"
                      value={data.shaftType || 'Indoor'}
                      onChange={(e) => updateField('shaftType', e.target.value)}
                      placeholder="e.g. Indoor or Outdoor"
                      className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Cabin Type / Finish:</label>
                    <input
                      type="text"
                      value={data.cabinWalls || 'Standard Cabin'}
                      onChange={(e) => updateField('cabinWalls', e.target.value)}
                      placeholder="e.g. Standard Cabin"
                      className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Operating System:</label>
                    <input
                      type="text"
                      value={data.machine || 'Hydraulic'}
                      onChange={(e) => updateField('machine', e.target.value)}
                      placeholder="e.g. Hydraulic"
                      className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Operation Control Mode:</label>
                    <input
                      type="text"
                      value={data.doorAccess || 'Automatic(One –Touch) with call reservation'}
                      onChange={(e) => updateField('doorAccess', e.target.value)}
                      placeholder="e.g. Automatic(One –Touch) with call reservation"
                      className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Capacity / Rated Load:</label>
                    <input
                      type="text"
                      value={data.ratedLoad || 'Upto 180 Kgs (2 passengers)'}
                      onChange={(e) => updateField('ratedLoad', e.target.value)}
                      placeholder="e.g. Upto 180 Kgs (2 passengers)"
                      className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Power Requirement:</label>
                    <input
                      type="text"
                      value={data.powerSupply || 'Single Phase'}
                      onChange={(e) => updateField('powerSupply', e.target.value)}
                      placeholder="e.g. Single Phase"
                      className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Speed:</label>
                    <input
                      type="text"
                      value={data.speed || 'Upto 0.5 m/s'}
                      onChange={(e) => updateField('speed', e.target.value)}
                      placeholder="e.g. Upto 0.5 m/s"
                      className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Stops / Floor Numbering:</label>
                    <input
                      type="text"
                      value={data.noOfStops || '2 Stops/G+1'}
                      onChange={(e) => updateField('noOfStops', e.target.value)}
                      placeholder="e.g. 2 Stops/G+1"
                      className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Product Warranty:</label>
                    <input
                      type="text"
                      value={data.manufacturingWarranty || '60 Months'}
                      onChange={(e) => updateField('manufacturingWarranty', e.target.value)}
                      placeholder="e.g. 60 Months"
                      className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* Dimensions Grid */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
                <h4 className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-teal-600" />
                  <span>Cylinder Dimensions (Page 3 Table)</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      External Cylinder Diameter:
                    </label>
                    <input
                      type="text"
                      value={data.hoistWayShaftSize || '1150 mm'}
                      onChange={(e) => updateField('hoistWayShaftSize', e.target.value)}
                      placeholder="e.g. 1150 mm"
                      className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Minimum Headroom:
                    </label>
                    <input
                      type="text"
                      value={data.finalStop || '2850 mm'}
                      onChange={(e) => {
                        updateField('finalStop', e.target.value);
                        updateField('minFloorHeight', e.target.value);
                      }}
                      placeholder="e.g. 2850 mm"
                      className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Minimum Required Pit Depth:
                    </label>
                    <select
                      value={data.pitDepth || 'None'}
                      onChange={(e) => updateField('pitDepth', e.target.value)}
                      className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 font-semibold bg-white text-slate-800"
                    >
                      <option value="None">None</option>
                      <option value="200mm">200mm</option>
                      {data.pitDepth && !['None', '200mm'].includes(data.pitDepth) && (
                        <option value={data.pitDepth}>{data.pitDepth}</option>
                      )}
                    </select>
                  </div>
                </div>
              </div>

              {/* Signatories Info Banner */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-slate-700">
                  <ShieldCheck className="w-4 h-4 text-teal-600" />
                  <span>
                    Signatures on Page 3: BDM (<strong>{data.representativeName || 'Alpha BDM'}</strong>) &amp; Customer (<strong>{data.clientName || 'Client'}</strong>)
                  </span>
                </div>
                <span className="text-[10px] text-slate-400">Reflected at bottom of Page 3</span>
              </div>
            </div>
          ) : (
            <div className="space-y-4 animate-fade-in">
            <div className="bg-teal-50/50 p-3 rounded-xl border border-teal-200">
              <h3 className="text-xs font-black text-teal-900 uppercase tracking-wide mb-1">
                Civil Specifications (Page 3)
              </h3>
              <p className="text-[11px] text-teal-700">
                Shaft dimensions, pit depth, floor heights and storage space requirements.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Clear Hoist Way / Shaft Size:</label>
                <input
                  type="text"
                  value={data.hoistWayShaftSize}
                  onChange={(e) => updateField('hoistWayShaftSize', e.target.value)}
                  placeholder="e.g. 1450mm X 1800mm"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Pit Depth:</label>
                <select
                  value={data.pitDepth || '200mm'}
                  onChange={(e) => updateField('pitDepth', e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 font-semibold bg-white text-slate-800"
                >
                  <option value="None">None</option>
                  <option value="200mm">200mm</option>
                  {data.pitDepth && !['None', '200mm'].includes(data.pitDepth) && (
                    <option value={data.pitDepth}>{data.pitDepth}</option>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Min Floor Height:</label>
                <input
                  type="text"
                  value={data.minFloorHeight}
                  onChange={(e) => updateField('minFloorHeight', e.target.value)}
                  placeholder="e.g. 3000mm"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Final Stop (Headroom):</label>
                <input
                  type="text"
                  value={data.finalStop}
                  onChange={(e) => updateField('finalStop', e.target.value)}
                  placeholder="e.g. 3300mm"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Shaft:</label>
                <select
                  value={
                    data.shaftScope === 'Customer scope' || data.shaftType === 'Customer scope'
                      ? 'Customer scope'
                      : 'Alpha Elevators scope'
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    updateField('shaftScope', val);
                    if (data.shaftType === 'Customer scope') {
                      updateField('shaftType', 'Glass Shaft');
                    }
                  }}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 font-semibold bg-white text-slate-800"
                >
                  <option value="Customer scope">Customer scope</option>
                  <option value="Alpha Elevators scope">Alpha Elevators scope</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Shaft Specifications:
                </label>
                <select
                  value={
                    data.shaftType && data.shaftType !== 'Customer scope'
                      ? data.shaftType.replace(/^(Customer scope|Alpha Elevators [sS]cope)\s*[-–—:]\s*/i, '')
                      : 'Glass Shaft'
                  }
                  onChange={(e) => updateField('shaftType', e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 font-semibold bg-white text-slate-800"
                >
                  <option value="Glass Shaft">Glass Shaft</option>
                  <option value="ACP Shaft">ACP Shaft</option>
                  <option value="Welding Shaft">Welding Shaft</option>
                  <option value="Civil Shaft">Civil Shaft</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Lockable Storage Room (Page 3 Dropdown):
              </label>
              <select
                value={data.lockableStorageRoom}
                onChange={(e) => updateField('lockableStorageRoom', e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 font-semibold bg-white text-slate-800"
              >
                <option value="To be Located In the Top Floor">
                  To be Located In the Top Floor- For all models
                </option>
                <option value="To be Located In the Ground Floor">
                  To be Located In the Ground Floor- AE01 Hydraulic Home series
                </option>
              </select>
            </div>

            <div className="bg-sky-50/50 p-3 rounded-xl border border-sky-200 mt-6">
              <h3 className="text-xs font-black text-sky-900 uppercase tracking-wide mb-1">
                Cabin Specifications (Page 3)
              </h3>
              <p className="text-[11px] text-sky-700">
                Cabin interior finishes, walls, flooring, ceiling and operating panels.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Cabin Walls (Page 3 Dropdown):
                </label>
                <select
                  value={data.cabinWalls}
                  onChange={(e) => updateField('cabinWalls', e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 font-semibold bg-white text-slate-800"
                >
                  <option value="Premium Glass Cabin - SS Finish">Premium Glass Cabin - SS Finish</option>
                  <option value="Standared Cabin- SS Finish">Standared Cabin- SS Finish</option>
                  <option value="MS">MS</option>
                  <option value="MS-Glass">MS-Glass</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Cabin Floor:</label>
                <input
                  type="text"
                  value={data.cabinFloor}
                  onChange={(e) => updateField('cabinFloor', e.target.value)}
                  placeholder="e.g. Vinyl or Client's own Flooring"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Ceiling:</label>
                <input
                  type="text"
                  value={data.ceiling}
                  onChange={(e) => updateField('ceiling', e.target.value)}
                  placeholder="e.g. As per cabin design"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  COP & LOP (Operating Panels) (Page 3 Dropdown):
                </label>
                <select
                  value={data.copAndLop}
                  onChange={(e) => updateField('copAndLop', e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 font-semibold bg-white text-slate-800"
                >
                  <option value="Touch ( TFT Display)">Touch ( TFT Display)</option>
                  <option value="Feather Touch">Feather Touch</option>
                  <option value="Button">Button</option>
                </select>
              </div>
            </div>
          </div>
          )
        )}

        {/* TAB 3: ELEVATOR & DOORS / TECHNICAL & CABIN SPECS */}
        {activeTab === 'elevator' && (
          isCircle ? (
            <div className="space-y-4 animate-fade-in">
              <div className="bg-gradient-to-r from-teal-900/40 to-slate-900/60 p-3.5 rounded-xl border border-teal-500/40 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-black text-teal-300 uppercase tracking-wide flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5 text-amber-400" />
                    <span>Technical & Cabin Specifications (Page 4)</span>
                  </h3>
                  <p className="text-[11px] text-teal-200/80 mt-0.5">
                    Detailed cabin dimensions, door openings, electrical controls and safety brakes on Page 4.
                  </p>
                </div>
                <span className="text-[10px] bg-teal-500/20 text-teal-300 border border-teal-500/30 font-bold px-2 py-0.5 rounded-md">
                  Page 4 Specs
                </span>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
                <h4 className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-teal-600" />
                  <span>Cabin Dimensions & Clearances</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Entrance Width Opening:</label>
                    <input
                      type="text"
                      value={data.clearOpening || '600 mm'}
                      onChange={(e) => updateField('clearOpening', e.target.value)}
                      placeholder="e.g. 600 mm"
                      className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Internal Cabin Height:</label>
                    <input
                      type="text"
                      value={data.minFloorHeight || '2010 mm'}
                      onChange={(e) => updateField('minFloorHeight', e.target.value)}
                      placeholder="e.g. 2010 mm"
                      className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Internal Cabin Diameter:</label>
                    <input
                      type="text"
                      value={data.carSize || '750 mm'}
                      onChange={(e) => updateField('carSize', e.target.value)}
                      placeholder="e.g. 750 mm"
                      className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 font-medium"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
                <h4 className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-1.5">
                  <Wrench className="w-3.5 h-3.5 text-teal-600" />
                  <span>Doors, Controls & Safety Systems</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Door Opening Configuration:</label>
                    <input
                      type="text"
                      value={data.doorOpening || 'Same side (in-line) and walk through (180°), 90° right or left'}
                      onChange={(e) => updateField('doorOpening', e.target.value)}
                      placeholder="e.g. Same side (in-line) and walk through (180°)"
                      className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Door Hinges & Swing:</label>
                    <input
                      type="text"
                      value={data.doorSpecifications || 'Hinged on top left, door swings to the left (from inside the cabin)'}
                      onChange={(e) => updateField('doorSpecifications', e.target.value)}
                      placeholder="e.g. Hinged on top left, door swings to the left"
                      className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Lighting & Ventilation:</label>
                    <input
                      type="text"
                      value={data.ceiling || 'Automatic LED lighting and cabin fan'}
                      onChange={(e) => updateField('ceiling', e.target.value)}
                      placeholder="e.g. Automatic LED lighting and cabin fan"
                      className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Cabin Controls:</label>
                    <input
                      type="text"
                      value={data.copAndLop || 'Push button call with precise leveling at each landing'}
                      onChange={(e) => updateField('copAndLop', e.target.value)}
                      placeholder="e.g. Push button call with precise leveling at each landing"
                      className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Power Failure Response (ARD):</label>
                    <input
                      type="text"
                      value={data.battery || 'Automatic descent to ground level at safety speed'}
                      onChange={(e) => updateField('battery', e.target.value)}
                      placeholder="e.g. Automatic descent to ground level at safety speed"
                      className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Safety Features (Included):</label>
                    <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-600 space-y-0.5">
                      <div>✓ Mechanical emergency brakes within 5 cm</div>
                      <div>✓ Electro-mechanical landing interlocks</div>
                      <div>✓ Built-in alarm and self-diagnostic controls</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 animate-fade-in">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wide mb-1">
                Elevator Technical Specifications (Page 4)
              </h3>
              <p className="text-[11px] text-slate-600">
                Load ratings, stops, openings, drive mechanics, controller and travel metrics.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Rated Load:</label>
                <input
                  type="text"
                  value={data.ratedLoad}
                  onChange={(e) => updateField('ratedLoad', e.target.value)}
                  placeholder="e.g. Upto 5 Passengers /408 kgs"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  No of Stops (Page 4 Dropdown):
                </label>
                <select
                  value={data.noOfStops}
                  onChange={(e) => {
                    const stopsVal = e.target.value;
                    const match = stopsVal.match(/G\+(\d+)/);
                    if (match) {
                      const k = parseInt(match[1], 10);
                      const travelHeight = `${k * 3500}mm`;
                      const openings = `${k + 1} Openings`;
                      const floorsList = ['G', ...Array.from({ length: k }, (_, i) => String(i + 1))];
                      const floors = floorsList.join(',');

                      const newDoorAccessFloors: Record<string, string[]> = {};
                      floorsList.forEach((f) => {
                        newDoorAccessFloors[f] = data.doorAccessFloors?.[f] || ['A'];
                      });
                      const newDoorAccessStr = floorsList
                        .map((f) => `${f} - ${(newDoorAccessFloors[f] || ['A']).join('')}`)
                        .join(', ');

                      onChange({
                        ...data,
                        noOfStops: stopsVal,
                        totalTravelHeight: travelHeight,
                        noOfOpenings: openings,
                        floorNumbering: floors,
                        doorAccessFloors: newDoorAccessFloors,
                        doorAccess: newDoorAccessStr,
                      });
                    } else {
                      updateField('noOfStops', stopsVal);
                    }
                  }}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 font-semibold bg-white text-slate-800"
                >
                  {Array.from({ length: 10 }, (_, i) => `G+${i + 1}`).map((stop) => {
                    const k = parseInt(stop.slice(2), 10);
                    return (
                      <option key={stop} value={stop}>
                        {stop} (Travel Height: {k * 3500}mm | {k + 1} Openings)
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">No Of Openings:</label>
                <input
                  type="text"
                  value={data.noOfOpenings}
                  onChange={(e) => updateField('noOfOpenings', e.target.value)}
                  placeholder="e.g. 3 Openings"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Floor Numbering:</label>
                <input
                  type="text"
                  value={data.floorNumbering}
                  onChange={(e) => {
                    const val = e.target.value;
                    const parts = val.split(',').map((s) => s.trim()).filter(Boolean);
                    if (parts.length > 0) {
                      const newMap: Record<string, string[]> = {};
                      parts.forEach((f) => {
                        newMap[f] = data.doorAccessFloors?.[f] || ['A'];
                      });
                      const newStr = parts.map((f) => `${f} - ${(newMap[f] || ['A']).join('')}`).join(', ');
                      onChange({
                        ...data,
                        floorNumbering: val,
                        doorAccessFloors: newMap,
                        doorAccess: newStr,
                      });
                    } else {
                      updateField('floorNumbering', val);
                    }
                  }}
                  placeholder="e.g. G,1,2,3"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Door Opening (Page 4 Dropdown):
                </label>
                <select
                  value={
                    data.doorOpening ||
                    (['inline', 'adjacent', 'Opposite Side', 'inline and adjacent', 'Same Side'].includes(data.doorAccess)
                      ? data.doorAccess
                      : 'inline')
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    updateField('doorOpening', val);
                    if (val === 'adjacent' || val === 'inline and adjacent') {
                      setDoorAccessAlert(
                        `Door Opening "${val}" selected! Please note: An extra ₹50,000 per extra opening door will be applicable.`
                      );
                    }
                  }}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 font-semibold bg-white text-slate-800"
                >
                  <option value="inline">inline</option>
                  <option value="adjacent">adjacent (Notice: ₹50,000 extra per opening)</option>
                  <option value="Opposite Side">Opposite Side</option>
                  <option value="inline and adjacent">inline and adjacent (Notice: ₹50,000 extra per opening)</option>
                </select>
              </div>

              {/* Floor-wise Door Access (G, 1, 2, 3 with A, B, C, D checkboxes) */}
              <div className="col-span-full bg-slate-100/90 p-3.5 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-teal-500"></span>
                    <label className="text-xs font-black text-slate-800 tracking-wide uppercase">
                      Door Access (Floor-wise: A, B, C, G)
                    </label>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleSetAllFloorsAbcg}
                      className="px-2.5 py-1 text-[11px] font-bold bg-teal-600 hover:bg-teal-700 text-white rounded-lg shadow-xs transition-colors cursor-pointer"
                      title="Set all floors to ABCG"
                    >
                      All ABCG
                    </button>
                    <button
                      type="button"
                      onClick={handleSetAllFloorsSideA}
                      className="px-2.5 py-1 text-[11px] font-bold bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg shadow-xs transition-colors cursor-pointer"
                      title="Reset all floors to Side A"
                    >
                      Default (A)
                    </button>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 leading-tight">
                  Tick the checkbox before each letter (A, B, C, G) to clearly specify door access per floor (e.g. G - ABCG, 1 - ABCG, 2 - ABCG, 3 - ABCG):
                </p>

                <div className="space-y-2">
                  {getFloorsList().map((floor) => {
                    const letters = getFloorLetters(floor);
                    return (
                      <div
                        key={floor}
                        className="flex flex-wrap items-center justify-between gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="w-9 h-7 flex items-center justify-center font-mono font-black text-xs bg-slate-800 text-white rounded-lg">
                            {floor}
                          </span>
                          <span className="text-xs font-bold text-slate-400">-</span>

                          {/* 4 Checkboxes with tick box before each letter */}
                          <div className="flex items-center gap-2.5">
                            {(['A', 'B', 'C', 'G'] as const).map((letter) => {
                              const checked = letters.includes(letter);
                              return (
                                <label
                                  key={letter}
                                  className={`flex items-center gap-1.5 text-xs font-black px-2.5 py-1 rounded-lg border cursor-pointer select-none transition-all ${
                                    checked
                                      ? 'bg-teal-50 border-teal-500 text-teal-800 shadow-xs'
                                      : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => handleToggleFloorLetter(floor, letter)}
                                    className="w-4 h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500 cursor-pointer accent-teal-600"
                                  />
                                  <span>{letter}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>

                        {/* Quick floor actions */}
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleSetFloorAbcg(floor)}
                            className="px-2 py-0.5 text-[10px] font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-md transition-colors cursor-pointer"
                          >
                            ABCG
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Formatted live string */}
                <div className="flex items-center justify-between bg-teal-950 text-white px-3 py-2 rounded-xl text-xs font-mono">
                  <span className="text-teal-300 font-bold">Door Access Output:</span>
                  <span className="font-black text-amber-300">{data.doorAccess || getFloorsList().map((f) => `${f} - A`).join(', ')}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Total Travel Height:</label>
                <input
                  type="text"
                  value={data.totalTravelHeight}
                  onChange={(e) => updateField('totalTravelHeight', e.target.value)}
                  placeholder="e.g. 7000mm"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Controller (Page 4 Dropdown):
                </label>
                <select
                  value={data.controller || 'Imported'}
                  onChange={(e) => updateField('controller', e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 font-semibold bg-white text-slate-800"
                >
                  <option value="Imported">Imported (Default for all models)</option>
                  <option value="Italian Integrated Controller">Italian Integrated Controller</option>
                  <option value="Microprocessor VVVF Controller">Microprocessor VVVF Controller</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Speed:</label>
                <input
                  type="text"
                  value={data.speed}
                  onChange={(e) => updateField('speed', e.target.value)}
                  placeholder="e.g. upto 1 m/s"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Machine / Motor (Page 4 Dropdown):
                </label>
                <select
                  value={data.machine || 'Imported'}
                  onChange={(e) => updateField('machine', e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 font-semibold bg-white text-slate-800"
                >
                  <option value="Imported">Imported (Default for all models)</option>
                  <option value="Imported Motor">Imported Motor</option>
                  <option value="PMSM Gearless Motor">PMSM Gearless Motor</option>
                  <option value="Hydraulic Power Unit">Hydraulic Power Unit</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Power Supply (Page 4 Dropdown):
                </label>
                <select
                  value={data.powerSupply || 'Single Phase'}
                  onChange={(e) => updateField('powerSupply', e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 font-semibold bg-white text-slate-800"
                >
                  <option value="Single Phase">Single Phase</option>
                  <option value="Single phase">Single phase (EV series)</option>
                  <option value="Third Phase">Third Phase</option>
                </select>
                {data.model === 'Semi Home Lift' && (
                  <p className="text-[10px] text-teal-700 font-bold mt-1">
                    ℹ️ Semi Home Lift: Dropdown provides Single Phase & Third Phase options
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Car Size:</label>
                <input
                  type="text"
                  value={data.carSize}
                  onChange={(e) => updateField('carSize', e.target.value)}
                  placeholder="e.g. TBC*"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 font-medium"
                />
              </div>

              {((data.model && /\bEV\b|home\s*EV|battery/i.test(data.model)) || Boolean(data.battery?.trim())) && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700">
                      Battery:
                    </label>
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-700 font-bold px-1.5 py-0.5 rounded border border-emerald-500/20">
                      EV Model
                    </span>
                  </div>
                  <input
                    type="text"
                    value={data.battery || ''}
                    onChange={(e) => updateField('battery', e.target.value)}
                    placeholder="e.g. Lithium-ion"
                    className="w-full text-xs px-3 py-2 border border-emerald-300 bg-emerald-50/30 rounded-xl focus:ring-2 focus:ring-teal-500 font-medium text-slate-800"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Clear Opening:</label>
                <input
                  type="text"
                  value={data.clearOpening}
                  onChange={(e) => updateField('clearOpening', e.target.value)}
                  placeholder="e.g. TBC*"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Customer Specific requirements:</label>
                <input
                  type="text"
                  value={data.customerSpecificRequirements ?? 'Nil'}
                  onChange={(e) => updateField('customerSpecificRequirements', e.target.value)}
                  placeholder="e.g. Nil"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 font-medium"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                DOOR Specifications (Page 4 Dropdown):
              </label>
              <select
                value={data.doorSpecifications}
                onChange={(e) => updateField('doorSpecifications', e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 font-semibold bg-white text-slate-800"
              >
                <option value="Auto Swing Doors- SS 304 Grade">Auto Swing Doors- SS 304 Grade</option>
                <option value="Center Door Opening - SS 304 Grade">Center Door Opening - SS 304 Grade</option>
                <option value="Telescopic Doors- SS 304 Grade">Telescopic Doors- SS 304 Grade</option>
                <option value="Manual Doors-- SS 304 Grade">Manual Doors-- SS 304 Grade</option>
              </select>
            </div>
          </div>
          )
        )}

        {/* TAB 4: SHAFT & FEATURES */}
        {activeTab === 'shaft' && (
          <div className="space-y-4 animate-fade-in">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Shaft:
              </label>
              <select
                value={
                  data.shaftScope === 'Customer scope' || data.shaftType === 'Customer scope'
                    ? 'Customer scope'
                    : 'Alpha Elevators scope'
                }
                onChange={(e) => {
                  const val = e.target.value;
                  updateField('shaftScope', val);
                  if (data.shaftType === 'Customer scope') {
                    updateField('shaftType', 'Glass Shaft');
                  }
                }}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 font-semibold bg-white text-slate-800"
              >
                <option value="Customer scope">Customer scope</option>
                <option value="Alpha Elevators scope">Alpha Elevators scope</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Shaft Specifications Box (Page 5 Dropdown):
              </label>
              <select
                value={
                  data.shaftType && data.shaftType !== 'Customer scope'
                    ? data.shaftType.replace(/^(Customer scope|Alpha Elevators [sS]cope)\s*[-–—:]\s*/i, '')
                    : 'Glass Shaft'
                }
                onChange={(e) => updateField('shaftType', e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 font-semibold bg-white text-slate-800"
              >
                <option value="Glass Shaft">Glass Shaft</option>
                <option value="ACP Shaft">ACP Shaft</option>
                <option value="Welding Shaft">Welding Shaft</option>
                <option value="Civil Shaft">Civil Shaft</option>
              </select>
              <p className="text-[11px] text-teal-700 mt-1">
                Reflected on Page 5 as: <strong>{(data.shaftScope === 'Customer scope' || data.shaftType === 'Customer scope') ? 'Customer scope' : 'Alpha Elevators Scope'} - {data.shaftType && data.shaftType !== 'Customer scope' ? data.shaftType.replace(/^(Customer scope|Alpha Elevators [sS]cope)\s*[-–—:]\s*/i, '') : 'Glass Shaft'}</strong>
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-800">
                  Accessories + Features List ({data.accessoriesFeatures.length}):
                </label>
              </div>

              {/* Add New Feature Input */}
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={newFeatureText}
                  onChange={(e) => setNewFeatureText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddFeature()}
                  placeholder="Type new feature & click Add..."
                  className="flex-1 text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500"
                />
                <button
                  type="button"
                  onClick={handleAddFeature}
                  className="px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </div>

              {/* Existing Features List */}
              <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                {data.accessoriesFeatures.map((feature, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200 text-xs hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center gap-2 flex-1 mr-2">
                      <span className="text-teal-600 font-bold">➢</span>
                      <input
                        type="text"
                        value={feature}
                        onChange={(e) => {
                          const updated = [...data.accessoriesFeatures];
                          updated[idx] = e.target.value;
                          updateField('accessoriesFeatures', updated);
                        }}
                        className="bg-transparent border-0 p-0 text-xs text-slate-800 font-medium w-full focus:ring-0 focus:outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveFeature(idx)}
                      className="text-slate-400 hover:text-rose-600 p-1 rounded transition-colors"
                      title="Remove feature"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: PRICING & TERMS OF SALE */}
        {activeTab === 'pricing' && (
          isCircle ? (
            <div className="space-y-4 animate-fade-in">
              <div className="bg-gradient-to-r from-teal-900/40 to-slate-900/60 p-3.5 rounded-xl border border-teal-500/40 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-black text-teal-300 uppercase tracking-wide flex items-center gap-1.5">
                    <IndianRupee className="w-3.5 h-3.5 text-amber-400" />
                    <span>Circle Lift Pricing & Payment Terms (Page 4)</span>
                  </h3>
                  <p className="text-[11px] text-teal-200/80 mt-0.5">
                    Commercial pricing, delivery timeframe, and milestone payment split reflected on Page 4.
                  </p>
                </div>
                <span className="text-[10px] bg-teal-500/20 text-teal-300 border border-teal-500/30 font-bold px-2 py-0.5 rounded-md">
                  Page 4 Commercials
                </span>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
                <h4 className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-1.5">
                  <IndianRupee className="w-3.5 h-3.5 text-teal-600" />
                  <span>Commercial Proposal Values</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Final Agreed Price (₹):</label>
                    <input
                      type="number"
                      value={data.elevatorPrice || 1100000}
                      onChange={(e) => updateField('elevatorPrice', Number(e.target.value))}
                      placeholder="e.g. 1100000"
                      className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 font-bold text-teal-800"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">
                      Base / MRP Price
                    </span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center justify-between">
                      <span>Discount Price (₹):</span>
                      {elevatorDiscountPrice > 0 && (
                        <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100 px-1 py-0.2 rounded">
                          -₹{elevatorDiscountPrice.toLocaleString('en-IN')}
                        </span>
                      )}
                    </label>
                    <input
                      type="number"
                      value={data.elevatorDiscountPrice ?? ''}
                      onChange={(e) => updateField('elevatorDiscountPrice', e.target.value === '' ? undefined : Number(e.target.value))}
                      placeholder="Optional discount amount (e.g. 100000)"
                      className="w-full text-xs px-2.5 py-1.5 border border-emerald-300 rounded-lg focus:ring-2 focus:ring-emerald-500 font-bold text-emerald-900 bg-emerald-50/30 placeholder:text-slate-400 placeholder:font-normal"
                    />
                    <span className="text-[10px] text-slate-500 mt-0.5 block">
                      {elevatorDiscountPrice > 0
                        ? `(₹${elevatorPrice.toLocaleString('en-IN')} - ₹${elevatorDiscountPrice.toLocaleString('en-IN')}) × ${gstMultiplier.toFixed(2)} = ₹${elevatorTotalWithGst.toLocaleString('en-IN')} (Inc. ${gstRate}% GST)`
                        : `Total with GST: ₹${elevatorTotalWithGst.toLocaleString('en-IN')} (Inc. ${gstRate}% GST)`}
                    </span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">GST Percentage (%):</label>
                    <input
                      type="number"
                      value={data.gstRate !== undefined ? data.gstRate : 18}
                      onChange={(e) => updateField('gstRate', Number(e.target.value))}
                      placeholder="18"
                      className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Delivery Timeframe:</label>
                    <input
                      type="text"
                      value={data.deliveryTime || '120 days post confirmation on drawings and finishes'}
                      onChange={(e) => updateField('deliveryTime', e.target.value)}
                      placeholder="e.g. 120 days post confirmation on drawings and finishes"
                      className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Warranty Statement:</label>
                  <input
                    type="text"
                    value={data.warranty || '05 years - manufacturing warranty + 1 Year Free Maintenance'}
                    onChange={(e) => updateField('warranty', e.target.value)}
                    placeholder="e.g. 05 years - manufacturing warranty + 1 Year Free Maintenance"
                    className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 font-medium"
                  />
                </div>
              </div>

              {/* Milestone Payment Terms */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
                <h4 className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                  <span>Milestone Payment Terms (Page 4 Bullet Points)</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Booking Amount (%):</label>
                    <input
                      type="text"
                      value={data.paymentTerms?.booking || '30%'}
                      onChange={(e) => updateNestedField('paymentTerms', 'booking', e.target.value)}
                      placeholder="e.g. 30%"
                      className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 font-medium"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Booking amount - {data.paymentTerms?.booking || '30%'}</span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Production Amount (%):</label>
                    <input
                      type="text"
                      value={data.paymentTerms?.production || '40%'}
                      onChange={(e) => updateNestedField('paymentTerms', 'production', e.target.value)}
                      placeholder="e.g. 40%"
                      className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 font-medium"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Production amount - {data.paymentTerms?.production || '40%'}</span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Readiness Notification (%):</label>
                    <input
                      type="text"
                      value={data.paymentTerms?.readiness || '30%'}
                      onChange={(e) => updateNestedField('paymentTerms', 'readiness', e.target.value)}
                      placeholder="e.g. 30%"
                      className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 font-medium"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Readiness notification- {data.paymentTerms?.readiness || '30%'}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 animate-fade-in">
            {/* Price Breakdown Banner */}
            <div className="bg-gradient-to-r from-teal-900 to-slate-900 text-white p-4 rounded-2xl shadow-sm space-y-2">
              <div className="flex items-center justify-between text-xs text-teal-300 font-mono">
                <span className="flex items-center gap-1.5 font-bold">
                  <span>COMMERCIAL SUMMARY</span>
                  {hasDiscounts && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-slate-900">
                      Discount Applied
                    </span>
                  )}
                </span>
                <span>GST @ {data.gstRate || 18}%</span>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-1 border-t border-white/10 text-center">
                <div>
                  <div className="text-[10px] text-slate-400">Elevator Total</div>
                  {elevatorDiscountPrice > 0 ? (
                    <div>
                      <div className="text-[11px] text-slate-400 line-through">₹{Math.round(elevatorPrice * gstMultiplier).toLocaleString('en-IN')}</div>
                      <div className="text-sm font-bold text-emerald-400">₹{elevatorTotalWithGst.toLocaleString('en-IN')}</div>
                      <div className="text-[10px] text-slate-300 font-normal">Base: ₹{netElevatorPrice.toLocaleString('en-IN')}</div>
                    </div>
                  ) : (
                    <div>
                      <div className="text-sm font-bold">₹{elevatorTotalWithGst.toLocaleString('en-IN')}</div>
                      <div className="text-[10px] text-slate-300 font-normal">Base: ₹{netElevatorPrice.toLocaleString('en-IN')}</div>
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-[10px] text-slate-400">Shaft Package</div>
                  {shaftDiscountPrice > 0 ? (
                    <div>
                      <div className="text-[11px] text-slate-400 line-through">₹{Math.round(shaftPrice * gstMultiplier).toLocaleString('en-IN')}</div>
                      <div className="text-sm font-bold text-emerald-400">₹{shaftTotalWithGst.toLocaleString('en-IN')}</div>
                      <div className="text-[10px] text-slate-300 font-normal">Base: ₹{netShaftPrice.toLocaleString('en-IN')}</div>
                    </div>
                  ) : (
                    <div>
                      <div className="text-sm font-bold">₹{shaftTotalWithGst.toLocaleString('en-IN')}</div>
                      <div className="text-[10px] text-slate-300 font-normal">Base: ₹{netShaftPrice.toLocaleString('en-IN')}</div>
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-[10px] text-teal-400 font-bold">Total (Inc. GST)</div>
                  <div className="text-sm font-black text-amber-300">₹{grandTotal.toLocaleString('en-IN')}</div>
                  {totalSavings > 0 && (
                    <div className="text-[10px] text-emerald-400 font-bold">Save ₹{Math.round(totalSavings * gstMultiplier).toLocaleString('en-IN')}</div>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Elevator Pricing Card */}
              <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                    <IndianRupee className="w-3.5 h-3.5 text-teal-600" />
                    Elevator Pricing
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">Base & Discount</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Elevator Price (₹): <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-slate-400 text-xs">₹</span>
                    <input
                      type="number"
                      value={data.elevatorPrice}
                      onChange={(e) => updateField('elevatorPrice', Number(e.target.value))}
                      placeholder="e.g. 1600000"
                      className="w-full text-xs pl-7 pr-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 font-bold text-slate-800 bg-white"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Standard MRP / Base Elevator Price
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                    <span>Discount Price (₹):</span>
                    {elevatorDiscountPrice > 0 && (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                        -₹{elevatorDiscountPrice.toLocaleString('en-IN')}
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-slate-400 text-xs">₹</span>
                    <input
                      type="number"
                      value={data.elevatorDiscountPrice ?? ''}
                      onChange={(e) => updateField('elevatorDiscountPrice', e.target.value === '' ? undefined : Number(e.target.value))}
                      placeholder="Optional discount amount (e.g. 100000)"
                      className="w-full text-xs pl-7 pr-3 py-2 border border-emerald-300 rounded-xl focus:ring-2 focus:ring-emerald-500 font-bold text-emerald-900 bg-white placeholder:text-slate-400 placeholder:font-normal"
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    {elevatorDiscountPrice > 0
                      ? `Net: (₹${elevatorPrice.toLocaleString('en-IN')} - ₹${elevatorDiscountPrice.toLocaleString('en-IN')}) × ${gstMultiplier.toFixed(2)} = ₹${elevatorTotalWithGst.toLocaleString('en-IN')} (Inc. ${gstRate}% GST)`
                      : `Total with GST: ₹${elevatorTotalWithGst.toLocaleString('en-IN')} (Inc. ${gstRate}% GST)`}
                  </span>
                </div>
              </div>

              {/* Shaft Pricing Card */}
              <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                    <IndianRupee className="w-3.5 h-3.5 text-teal-600" />
                    Shaft Pricing
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">Base & Discount</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Shaft Price (₹): <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-slate-400 text-xs">₹</span>
                    <input
                      type="number"
                      value={data.shaftPrice}
                      onChange={(e) => updateField('shaftPrice', Number(e.target.value))}
                      placeholder="e.g. 400000"
                      className="w-full text-xs pl-7 pr-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 font-bold text-slate-800 bg-white"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Standard MRP / Base Shaft Price
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                    <span>Discount Price (₹):</span>
                    {shaftDiscountPrice > 0 && (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                        -₹{shaftDiscountPrice.toLocaleString('en-IN')}
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-slate-400 text-xs">₹</span>
                    <input
                      type="number"
                      value={data.shaftDiscountPrice ?? ''}
                      onChange={(e) => updateField('shaftDiscountPrice', e.target.value === '' ? undefined : Number(e.target.value))}
                      placeholder="Optional discount amount (e.g. 50000)"
                      className="w-full text-xs pl-7 pr-3 py-2 border border-emerald-300 rounded-xl focus:ring-2 focus:ring-emerald-500 font-bold text-emerald-900 bg-white placeholder:text-slate-400 placeholder:font-normal"
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    {shaftDiscountPrice > 0
                      ? `Net: (₹${shaftPrice.toLocaleString('en-IN')} - ₹${shaftDiscountPrice.toLocaleString('en-IN')}) × ${gstMultiplier.toFixed(2)} = ₹${shaftTotalWithGst.toLocaleString('en-IN')} (Inc. ${gstRate}% GST)`
                      : `Total with GST: ₹${shaftTotalWithGst.toLocaleString('en-IN')} (Inc. ${gstRate}% GST)`}
                  </span>
                </div>
              </div>
            </div>

            {/* Warranty Term Section */}
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="block text-xs font-black text-slate-800 tracking-wide uppercase">
                  Warranty Term Text:
                </label>
                {isEvModel ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    <CheckCircle className="w-3 h-3 text-emerald-600" /> EV Model: Battery Warranty Included
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
                    Non-EV Model: No Battery Warranty
                  </span>
                )}
              </div>

              {/* 3 Dropdown Selectors */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Motor Warranty:
                  </label>
                  <select
                    value={currentMotorWarranty}
                    onChange={(e) => updateWarrantyComponent({ motorWarranty: e.target.value })}
                    className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-teal-500 font-semibold text-slate-800"
                  >
                    <option value="Lifetime">Lifetime (Lifetime- MOTOR WARRANTY)</option>
                    <option value="1years">1years (1years- MOTOR WARRANTY)</option>
                    <option value="2years">2years (2years- MOTOR WARRANTY)</option>
                    <option value="3years">3years (3years- MOTOR WARRANTY)</option>
                    <option value="4years">4years (4years- MOTOR WARRANTY)</option>
                    <option value="5years">5years (5years- MOTOR WARRANTY)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Manufacturing Warranty:
                  </label>
                  <select
                    value={currentMfgWarranty}
                    onChange={(e) => updateWarrantyComponent({ manufacturingWarranty: e.target.value })}
                    className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-teal-500 font-semibold text-slate-800"
                  >
                    <option value="1 years">1 years</option>
                    <option value="2 years">2 years</option>
                    <option value="3 years">3 years</option>
                    <option value="4 years">4 years</option>
                    <option value="5 years">5 years</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Free Maintenance:
                  </label>
                  <select
                    value={currentFreeMaint}
                    onChange={(e) => updateWarrantyComponent({ freeMaintenance: e.target.value })}
                    className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-teal-500 font-semibold text-slate-800"
                  >
                    <option value="1 Years">1 Years</option>
                    <option value="2 Years">2 Years</option>
                    <option value="3 Years">3 Years</option>
                    <option value="4 Years">4 Years</option>
                    <option value="5 Years">5 Years</option>
                  </select>
                </div>
              </div>

              {/* Full Warranty Text Display & Editable Textarea */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">
                  Full Warranty Term Preview (Editable):
                </label>
                <textarea
                  rows={2}
                  value={data.warranty}
                  onChange={(e) => updateField('warranty', e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 font-medium bg-white"
                />
              </div>
            </div>

            {/* Time of Material Delivery Section */}
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="block text-xs font-black text-slate-800 tracking-wide uppercase">
                  Time of Material Delivery:
                </label>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-slate-500">Quick Select:</span>
                  {[60, 90, 120].map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => updateDeliveryDays(days)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                        currentDeliveryDays === days
                          ? 'bg-teal-600 text-white shadow-sm ring-2 ring-teal-400'
                          : 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-300'
                      }`}
                    >
                      {days} Days
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-center">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Days Option:
                  </label>
                  <select
                    value={currentDeliveryDays}
                    onChange={(e) => updateDeliveryDays(Number(e.target.value))}
                    className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-teal-500 font-bold text-slate-800"
                  >
                    <option value={60}>60 Days</option>
                    <option value={90}>90 Days</option>
                    <option value={120}>120 Days</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Full Delivery Text:
                  </label>
                  <input
                    type="text"
                    value={data.deliveryTime}
                    onChange={(e) => {
                      const val = e.target.value;
                      const d = parseDeliveryDays(val);
                      onChange({
                        ...data,
                        deliveryTime: val,
                        deliveryDays: d,
                      });
                    }}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 font-medium bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Payment Terms */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-wide">Payment Terms Stages:</h4>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Stage 1 (Booking):</label>
                <input
                  type="text"
                  value={data.paymentTerms?.booking}
                  onChange={(e) => updateNestedField('paymentTerms', 'booking', e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg font-medium"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Stage 2 (Production):</label>
                <input
                  type="text"
                  value={data.paymentTerms?.production}
                  onChange={(e) => updateNestedField('paymentTerms', 'production', e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg font-medium"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Stage 3 (Readiness):</label>
                <input
                  type="text"
                  value={data.paymentTerms?.readiness}
                  onChange={(e) => updateNestedField('paymentTerms', 'readiness', e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg font-medium"
                />
              </div>
            </div>

            {/* Bank Details */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-wide">
                Bank Account Details (Page 5):
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Company Name:</label>
                  <input
                    type="text"
                    value={data.companyName}
                    onChange={(e) => updateField('companyName', e.target.value)}
                    className="w-full px-2 py-1 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Bank Name:</label>
                  <input
                    type="text"
                    value={data.bankName}
                    onChange={(e) => updateField('bankName', e.target.value)}
                    className="w-full px-2 py-1 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Account Number:</label>
                  <input
                    type="text"
                    value={data.accountNumber}
                    onChange={(e) => updateField('accountNumber', e.target.value)}
                    className="w-full px-2 py-1 border border-slate-300 rounded-lg font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">IFSC Code:</label>
                  <input
                    type="text"
                    value={data.ifsc}
                    onChange={(e) => updateField('ifsc', e.target.value)}
                    className="w-full px-2 py-1 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Swift Code:</label>
                  <input
                    type="text"
                    value={data.swiftCode}
                    onChange={(e) => updateField('swiftCode', e.target.value)}
                    className="w-full px-2 py-1 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Branch:</label>
                  <input
                    type="text"
                    value={data.branch}
                    onChange={(e) => updateField('branch', e.target.value)}
                    className="w-full px-2 py-1 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
            </div>
          </div>
          )
        )}

        {/* TAB 6: SIGNATURES */}
        {activeTab === 'signatures' && (
          isCircle ? (
            <div className="space-y-4 animate-fade-in">
              <div className="bg-gradient-to-r from-teal-900/40 to-slate-900/60 p-3.5 rounded-xl border border-teal-500/40 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-black text-teal-300 uppercase tracking-wide flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                    <span>Terms & Acceptance Signatures (Page 5)</span>
                  </h3>
                  <p className="text-[11px] text-teal-200/80 mt-0.5">
                    Delivery timeline, authorized execution signatories, and statutory bank credentials on Page 5.
                  </p>
                </div>
                <span className="text-[10px] bg-teal-500/20 text-teal-300 border border-teal-500/30 font-bold px-2 py-0.5 rounded-md">
                  Page 5 Acceptance
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Client Acceptance */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
                  <h4 className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-teal-600" />
                    <span>Accepted by Client</span>
                  </h4>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Client Full Name / Signatory:</label>
                    <input
                      type="text"
                      value={data.clientSignatoryName || data.clientName}
                      onChange={(e) => {
                        updateField('clientSignatoryName', e.target.value);
                        updateField('clientName', e.target.value);
                      }}
                      placeholder="e.g. Mr. Mohan George"
                      className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Acceptance Date:</label>
                    <input
                      type="text"
                      value={data.clientSignDate || data.offerDate}
                      onChange={(e) => {
                        updateField('clientSignDate', e.target.value);
                        updateField('offerDate', e.target.value);
                      }}
                      placeholder="e.g. 13/05/2026"
                      className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 font-medium"
                    />
                  </div>
                </div>

                {/* Alpha Acceptance */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
                  <h4 className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
                    <span>Accepted by Alpha Elevators</span>
                  </h4>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Authorized Representative / BDM:</label>
                    <input
                      type="text"
                      value={data.alphaSignatoryName || data.representativeName}
                      onChange={(e) => {
                        updateField('alphaSignatoryName', e.target.value);
                        updateField('representativeName', e.target.value);
                      }}
                      placeholder="e.g. Thirunavukarasu"
                      className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Execution Date:</label>
                    <input
                      type="text"
                      value={data.alphaSignDate || data.offerDate}
                      onChange={(e) => {
                        updateField('alphaSignDate', e.target.value);
                        updateField('offerDate', e.target.value);
                      }}
                      placeholder="e.g. 13/05/2026"
                      className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* Material Readiness Timeline in Days */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2">
                <label className="block text-[11px] font-bold text-slate-700">
                  Timeline for Material Readiness (Clause 2 on Page 5):
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={data.deliveryDays || 120}
                    onChange={(e) => updateField('deliveryDays', Number(e.target.value))}
                    placeholder="120"
                    className="w-32 text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 font-bold"
                  />
                  <span className="text-xs text-slate-600">days from receiving confirmation on finishes and final measurements.</span>
                </div>
              </div>

              {/* Official Bank Details Display */}
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-4 rounded-xl border border-slate-700 shadow-md">
                <div className="flex items-center justify-between border-b border-slate-700/80 pb-2 mb-3">
                  <div className="text-xs font-bold text-teal-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Official Statutory Bank Details (Page 5 Footer)</span>
                  </div>
                  <span className="text-[10px] bg-teal-500/20 text-teal-300 px-2 py-0.5 rounded font-mono">
                    IDFC Bank
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div>
                    <div className="text-[10px] text-slate-400">Account Name</div>
                    <div className="font-semibold text-slate-100">RANALPHA ELEVATORS PVT LTD</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">Bank</div>
                    <div className="font-semibold text-slate-100">IDFC Bank</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">Account Number</div>
                    <div className="font-mono font-bold text-amber-300">70070070031</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">IFSC &amp; Branch</div>
                    <div className="font-mono text-slate-100">IDFB0080106 / ANNA NAGAR</div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 animate-fade-in">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wide mb-1">
                Acceptance & Execution Signatures (Page 9)
              </h3>
              <p className="text-[11px] text-slate-600">
                Signatory names and execution dates that appear on the legal agreement page.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 space-y-3">
              <h4 className="text-xs font-black text-teal-800 uppercase">Client Acceptance</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Signatory Name:</label>
                  <input
                    type="text"
                    value={data.clientSignatoryName}
                    onChange={(e) => updateField('clientSignatoryName', e.target.value)}
                    placeholder="Client Authorized Signatory"
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Signing Date:</label>
                  <input
                    type="text"
                    value={data.clientSignDate}
                    onChange={(e) => updateField('clientSignDate', e.target.value)}
                    placeholder="DD/MM/YYYY"
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 font-medium"
                  />
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 space-y-3 bg-slate-50/50">
              <h4 className="text-xs font-black text-teal-800 uppercase">Alpha Elevators Acceptance</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Alpha Representative Name:</label>
                  <input
                    type="text"
                    value={data.alphaSignatoryName}
                    onChange={(e) => updateField('alphaSignatoryName', e.target.value)}
                    placeholder="For Alpha Elevators"
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Signing Date:</label>
                  <input
                    type="text"
                    value={data.alphaSignDate}
                    onChange={(e) => updateField('alphaSignDate', e.target.value)}
                    placeholder="DD/MM/YYYY"
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 font-medium"
                  />
                </div>
              </div>
            </div>
          </div>
          )
        )}

        {/* TAB 7: BILLING & SHIPPING DETAILS (PAGE 10) */}
        {activeTab === 'billing' && (
          <div className="space-y-4 animate-fade-in">
            <div className="bg-teal-50/70 p-3.5 rounded-xl border border-teal-200">
              <h3 className="text-xs font-black text-teal-900 uppercase tracking-wide mb-1 flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-teal-700" />
                <span>Client Billing, Shipping & GST Details (Page 10)</span>
              </h3>
              <p className="text-[11px] text-teal-700">
                These addresses, tax identification numbers, and contact details appear inside the official box on Page 10 of the quotation proposal.
              </p>
            </div>

            {/* Email & Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Client Email Address:
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={data.clientEmail || ''}
                    onChange={(e) => updateField('clientEmail', e.target.value)}
                    placeholder="e.g. client@example.com"
                    className="w-full text-xs px-3 py-2 pl-8 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 font-medium bg-white"
                  />
                  <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Client Contact Phone:
                </label>
                <input
                  type="text"
                  value={data.customerPhone || ''}
                  onChange={(e) => updateField('customerPhone', e.target.value)}
                  placeholder="e.g. +91 98200 11101"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 font-medium bg-white"
                />
              </div>
            </div>

            {/* GST Section */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Receipt className="w-3.5 h-3.5 text-teal-600" />
                    <span>GST Number (GSTIN) Registration:</span>
                  </label>
                  <p className="text-[10px] text-slate-500">
                    Does the client have a registered GST Number for commercial tax invoicing?
                  </p>
                </div>
                <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => updateField('hasGst', true)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      data.hasGst
                        ? 'bg-teal-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onChange({
                        ...data,
                        hasGst: false,
                        gstNumber: '',
                      });
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      !data.hasGst
                        ? 'bg-slate-700 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    No
                  </button>
                </div>
              </div>

              {data.hasGst && (
                <div className="animate-fade-in pt-2 border-t border-slate-200/80">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Client GST Number: <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={data.gstNumber || ''}
                    onChange={(e) => updateField('gstNumber', e.target.value.toUpperCase())}
                    placeholder="e.g. 33AAAAA0000A1Z5"
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 font-mono font-bold uppercase tracking-wider text-teal-900 bg-white"
                  />
                  <p className="text-[10px] text-teal-600 mt-1">
                    Printed on Page 10 for commercial tax billing and e-Way bill issuance.
                  </p>
                </div>
              )}
            </div>

            {/* Addresses */}
            <div className="p-4 rounded-xl border border-slate-200 space-y-4 bg-white">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-teal-600" />
                  <span>Full Billing Address:</span> <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={data.billingAddress || ''}
                  onChange={(e) => {
                    const newBilling = e.target.value;
                    onChange({
                      ...data,
                      billingAddress: newBilling,
                      shippingAddress: data.sameAsBilling !== false ? newBilling : data.shippingAddress,
                    });
                  }}
                  placeholder="Enter complete billing address with Door/Plot No, Street, Locality, City, State, and Pincode"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 font-medium"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-teal-600" />
                    <span>Shipping / Site Delivery Address:</span> <span className="text-rose-500">*</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 px-2.5 py-1 rounded-lg border border-teal-200 select-none shadow-2xs">
                    <input
                      type="checkbox"
                      checked={data.sameAsBilling !== false}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        onChange({
                          ...data,
                          sameAsBilling: checked,
                          shippingAddress: checked ? (data.billingAddress || '') : data.shippingAddress,
                        });
                      }}
                      className="w-3.5 h-3.5 text-teal-600 rounded border-slate-300 focus:ring-teal-500"
                    />
                    <span>Same as Billing Address</span>
                  </label>
                </div>
                <textarea
                  rows={3}
                  value={data.sameAsBilling !== false ? (data.billingAddress || '') : (data.shippingAddress || '')}
                  disabled={data.sameAsBilling !== false}
                  onChange={(e) => updateField('shippingAddress', e.target.value)}
                  placeholder="Enter complete site shipping / delivery address"
                  className={`w-full text-xs px-3 py-2 border rounded-xl font-medium transition-colors ${
                    data.sameAsBilling !== false
                      ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed'
                      : 'bg-white border-slate-300 focus:ring-2 focus:ring-teal-500'
                  }`}
                />
                {data.sameAsBilling !== false ? (
                  <p className="text-[10px] text-teal-600 mt-1">
                    ✓ Shipping address is automatically synchronized to Billing Address. Uncheck to enter a distinct site address.
                  </p>
                ) : (
                  <p className="text-[10px] text-slate-400 mt-1">
                    Separate shipping address will be printed in the delivery box on Page 10.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}


      </div>

      {/* Footer Info */}
      <div className="p-3 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-500 flex items-center justify-between shrink-0">
        <span className="flex items-center gap-1.5 font-medium text-emerald-700">
          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
          <span>All edits reflect instantly on the PDF preview</span>
        </span>
        <span className="font-mono text-slate-400">Offer: {data.offerNo}</span>
      </div>

      {/* Door Opening Alert Popup */}
      {doorAccessAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-amber-300 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-600 font-black text-2xl shadow-inner">
                ⚠️
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-900">Door Opening Configuration Notice</h4>
                <p className="text-xs text-amber-600 font-semibold">Special Door Opening Charges</p>
              </div>
            </div>
            <div className="bg-amber-50/90 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-950 leading-relaxed font-medium">
              <p className="mb-2">{doorAccessAlert}</p>
              <div className="p-2.5 bg-white/80 rounded-lg border border-amber-200 flex items-center justify-between">
                <span className="font-bold text-slate-700">Extra per opening Door:</span>
                <span className="font-extrabold text-rose-600 text-sm">₹50,000</span>
              </div>
            </div>
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setDoorAccessAlert(null)}
                className="px-5 py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white rounded-xl text-xs font-bold shadow-md transition-all active:scale-95"
              >
                I Understand & Proceed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
