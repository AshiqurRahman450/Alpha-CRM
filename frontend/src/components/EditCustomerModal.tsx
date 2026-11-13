'use client';

import React, { useEffect, useState } from 'react';
import {
  Users,
  X,
  Phone,
  Mail,
  MapPin,
  ExternalLink,
  Copy,
  AlertCircle,
  Save,
  Loader2,
  Building2,
  Sparkles,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { api } from '../lib/api';
import { DEFAULT_BDMS } from '../lib/constants';

interface EditCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: any;
  onCustomerUpdated: (updatedCustomer: any) => void;
  bdms?: any[];
  currentUser?: any;
}

export default function EditCustomerModal({
  isOpen,
  onClose,
  customer,
  onCustomerUpdated,
  bdms = DEFAULT_BDMS,
  currentUser,
}: EditCustomerModalProps) {
  const [formData, setFormData] = useState({
    fullName: '',
    phoneNumber: '',
    whatsappNumber: '',
    email: '',
    customerType: 'Residential',
    leadSource: 'Architect Referral',
    address: '',
    googleMapsLink: '',
    doorNo: '',
    streetName: '',
    landmark: '',
    city: 'Chennai',
    state: 'Tamil Nadu',
    pincode: '',
    bdmId: '',
    bdmPhone: '',
    whatsappOptIn: true,
    notes: '',
  });

  const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (customer && isOpen) {
      setFormData({
        fullName: customer.fullName || '',
        phoneNumber: customer.phoneNumber || '',
        whatsappNumber: customer.whatsappNumber || customer.phoneNumber || '',
        email: customer.email || '',
        customerType: customer.customerType || 'Residential',
        leadSource: customer.leadSource || 'Architect Referral',
        address: customer.address || customer.googleMapsLink || '',
        googleMapsLink: customer.googleMapsLink || customer.address || '',
        doorNo: customer.doorNo || '',
        streetName: customer.streetName || '',
        landmark: customer.landmark || '',
        city: customer.city || 'Chennai',
        state: customer.state || 'Tamil Nadu',
        pincode: customer.pincode || '',
        bdmId: typeof customer.bdmId === 'object' && customer.bdmId !== null ? customer.bdmId._id : (customer.bdmId || ''),
        bdmPhone: customer.bdmPhone || (typeof customer.bdmId === 'object' && customer.bdmId !== null ? customer.bdmId.phone : ''),
        whatsappOptIn: customer.whatsappOptIn !== undefined ? customer.whatsappOptIn : true,
        notes: customer.notes || '',
      });
      setFieldErrors({});
    }
  }, [customer, isOpen]);

  if (!isOpen || !customer) return null;

  const updateField = (key: string, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    if (fieldErrors[key]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const copyPhoneToWhatsApp = () => {
    if (formData.phoneNumber.trim()) {
      updateField('whatsappNumber', formData.phoneNumber.trim());
      toast.success('Copied phone number to WhatsApp');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: { [key: string]: string } = {};

    if (!formData.fullName.trim()) {
      errors.fullName = 'Full Name is required';
    }
    if (!formData.phoneNumber.trim()) {
      errors.phoneNumber = 'Phone Number is required';
    } else if (formData.phoneNumber.replace(/\D/g, '').length < 8) {
      errors.phoneNumber = 'Enter a valid phone number (min 8 digits)';
    }
    if (!formData.whatsappNumber.trim()) {
      errors.whatsappNumber = 'WhatsApp Number is required';
    } else if (formData.whatsappNumber.replace(/\D/g, '').length < 8) {
      errors.whatsappNumber = 'Enter a valid WhatsApp number (min 8 digits)';
    }
    if (!formData.address.trim()) {
      errors.address = 'Address or Google Maps link is required';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      toast.error('Please complete all required fields');
      return;
    }

    try {
      setSubmitting(true);
      const payload: any = {
        fullName: formData.fullName.trim(),
        phoneNumber: formData.phoneNumber.trim(),
        whatsappNumber: formData.whatsappNumber.trim(),
        email: formData.email.trim(),
        customerType: formData.customerType,
        leadSource: formData.leadSource,
        address: formData.address.trim(),
        googleMapsLink: formData.address.trim(),
        doorNo: formData.doorNo.trim(),
        streetName: formData.streetName.trim(),
        landmark: formData.landmark.trim(),
        city: formData.city.trim() || 'Chennai',
        state: formData.state.trim() || 'Tamil Nadu',
        pincode: formData.pincode.trim(),
        bdmId: formData.bdmId || undefined,
        bdmPhone: formData.bdmPhone ? formData.bdmPhone.trim() : undefined,
        whatsappOptIn: formData.whatsappOptIn,
        notes: formData.notes.trim(),
      };

      const res = await api.updateCustomer(customer._id, payload);
      toast.success(`Customer ${customer.customerId || ''} updated successfully!`);
      onCustomerUpdated(res?.data || { ...customer, ...payload });
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update customer');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden my-6 flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-[#0F2744] text-white p-5 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold tracking-tight">Edit Customer</h3>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-400/30">
                  {customer.customerId}
                </span>
              </div>
              <p className="text-[11px] text-slate-300">
                Update client contact details, site address, and BDM assignment
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
        <form onSubmit={handleSubmit} noValidate className="p-6 space-y-4 text-xs overflow-y-auto flex-1">
          {/* Full Name */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11px] font-bold text-slate-700">
                Full Name <span className="text-rose-500 font-black">*</span>
              </label>
              <span className="text-[10px] text-slate-400">Client / Property Owner</span>
            </div>
            <input
              type="text"
              value={formData.fullName}
              onChange={(e) => updateField('fullName', e.target.value)}
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
                <label className="block text-[11px] font-bold text-slate-700">
                  Phone Number <span className="text-rose-500 font-black">*</span>
                </label>
              </div>
              <input
                type="text"
                value={formData.phoneNumber}
                onChange={(e) => updateField('phoneNumber', e.target.value)}
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
                <label className="block text-[11px] font-bold text-slate-700">
                  WhatsApp Number <span className="text-rose-500 font-black">*</span>
                </label>
                {formData.phoneNumber && formData.phoneNumber !== formData.whatsappNumber && (
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
                type="text"
                value={formData.whatsappNumber}
                onChange={(e) => updateField('whatsappNumber', e.target.value)}
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
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Email Address
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => updateField('email', e.target.value)}
              placeholder="kumar@example.com"
              className="w-full p-2.5 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          {/* BDM Assignment */}
          <div className="p-3.5 bg-slate-50 border border-slate-200/90 rounded-2xl space-y-2.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-800 mb-1">
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
                    value={formData.bdmId}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      updateField('bdmId', selectedId);
                      const bdmObj = bdms.find(
                        (b) =>
                          (b._id && b._id === selectedId) ||
                          (b.id && b.id === selectedId) ||
                          b.email === selectedId ||
                          b.name === selectedId
                      );
                      if (bdmObj?.phone) {
                        updateField('bdmPhone', bdmObj.phone);
                      }
                    }}
                    className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none bg-white font-medium text-slate-800"
                  >
                    <option value="">-- Choose Assigned BDM --</option>
                    {bdms.map((b) => {
                      const val = b._id || b.id || b.email;
                      return (
                        <option key={val} value={val}>
                          {b.name} ({b.email}) {b.phone ? `• ${b.phone}` : ''}
                        </option>
                      );
                    })}
                  </select>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-bold text-slate-800">
                    BDM WhatsApp Number:
                  </label>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                    1:1 WATI Alert
                  </span>
                </div>
                <input
                  type="text"
                  value={formData.bdmPhone}
                  onChange={(e) => updateField('bdmPhone', e.target.value)}
                  placeholder="+91 98200 12345"
                  className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none bg-white font-mono text-slate-800"
                />
              </div>
            </div>
          </div>

          {/* Customer Type & Lead Source */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Customer / Building Type
              </label>
              <select
                value={formData.customerType}
                onChange={(e) => updateField('customerType', e.target.value)}
                className="w-full p-2.5 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="Residential">Residential Elevator</option>
                <option value="Villa">Luxury Villa Elevator</option>
                <option value="Commercial">Commercial Elevator</option>
                <option value="Builder">Builder / Multi-Floor Development</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Lead Source
              </label>
              <select
                value={formData.leadSource}
                onChange={(e) => updateField('leadSource', e.target.value)}
                className="w-full p-2.5 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="Architect Referral">Architect Referral</option>
                <option value="Direct Inquiry">Direct Inquiry</option>
                <option value="Builder Tie-up">Builder Tie-up</option>
                <option value="Website">Website / Digital</option>
                <option value="Exhibition">Exhibition / Expo</option>
                <option value="Referral">Client Referral</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          {/* Google Maps Address Link */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-800 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-rose-500" />
                <span>Google Maps Address Link / Site Location <span className="text-rose-500 font-black">*</span></span>
              </label>
              {formData.address.trim() && (formData.address.startsWith('http') || formData.address.includes('maps')) && (
                <a
                  href={formData.address.trim()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] font-bold text-sky-600 hover:text-sky-800 inline-flex items-center gap-1 bg-sky-50 px-2.5 py-0.5 rounded-md border border-sky-200 transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Test / Open in Maps</span>
                </a>
              )}
            </div>

            <input
              type="text"
              value={formData.address}
              onChange={(e) => updateField('address', e.target.value)}
              placeholder="Paste Google Maps link (e.g. https://maps.app.goo.gl/...)"
              className={`w-full p-2.5 text-xs rounded-xl border transition-all focus:outline-none focus:ring-2 font-mono ${
                fieldErrors.address
                  ? 'border-rose-400 bg-rose-50/20 focus:ring-rose-300 text-rose-950 font-medium'
                  : 'border-slate-300 bg-white focus:ring-sky-500 text-slate-800'
              }`}
            />
            {fieldErrors.address && (
              <p className="mt-1 text-[11px] text-rose-600 font-semibold flex items-center gap-1.5 animate-in fade-in">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {fieldErrors.address}
              </p>
            )}

            {/* Structured Address Details */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">Door / Flat No:</label>
                <input
                  type="text"
                  value={formData.doorNo}
                  onChange={(e) => updateField('doorNo', e.target.value)}
                  placeholder="e.g. 4B / Flat 302"
                  className="w-full p-2 text-xs border border-slate-300 rounded-lg bg-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">Street / Area:</label>
                <input
                  type="text"
                  value={formData.streetName}
                  onChange={(e) => updateField('streetName', e.target.value)}
                  placeholder="e.g. Anna Nagar East"
                  className="w-full p-2 text-xs border border-slate-300 rounded-lg bg-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">Landmark:</label>
                <input
                  type="text"
                  value={formData.landmark}
                  onChange={(e) => updateField('landmark', e.target.value)}
                  placeholder="e.g. Near Metro Station"
                  className="w-full p-2 text-xs border border-slate-300 rounded-lg bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">City:</label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => updateField('city', e.target.value)}
                  placeholder="Chennai"
                  className="w-full p-2 text-xs border border-slate-300 rounded-lg bg-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">State:</label>
                <input
                  type="text"
                  value={formData.state}
                  onChange={(e) => updateField('state', e.target.value)}
                  placeholder="Tamil Nadu"
                  className="w-full p-2 text-xs border border-slate-300 rounded-lg bg-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">Pincode:</label>
                <input
                  type="text"
                  value={formData.pincode}
                  onChange={(e) => updateField('pincode', e.target.value)}
                  placeholder="600102"
                  className="w-full p-2 text-xs border border-slate-300 rounded-lg bg-white"
                />
              </div>
            </div>
          </div>

          {/* Opt-In Checkbox */}
          <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-start gap-2.5">
            <input
              type="checkbox"
              id="edit_optin"
              checked={formData.whatsappOptIn}
              onChange={(e) => updateField('whatsappOptIn', e.target.checked)}
              className="w-4 h-4 mt-0.5 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer"
            />
            <label htmlFor="edit_optin" className="text-xs font-semibold text-emerald-950 cursor-pointer">
              <span>WhatsApp Project Updates Opt-In Active</span>
              <p className="text-[11px] font-normal text-emerald-700 mt-0.5">
                Client receives automated project milestone broadcasts and elevator fabrication updates.
              </p>
            </label>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Internal Notes / Special Requirements
            </label>
            <textarea
              rows={2}
              value={formData.notes}
              onChange={(e) => updateField('notes', e.target.value)}
              placeholder="e.g. VIP client, preferred time for calls, architectural constraints..."
              className="w-full p-2.5 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
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
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

