'use client';

import React, { useRef } from 'react';
import { X, Printer, Download, Building2 } from 'lucide-react';

interface InvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: any;
  payment: any;
}

export default function InvoiceModal({ isOpen, onClose, project, payment }: InvoiceModalProps) {
  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !project || !payment) return null;

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const originalContents = document.body.innerHTML;
    document.body.innerHTML = printContent.innerHTML;
    window.print();
    document.body.innerHTML = originalContents;
    window.location.reload(); // Reload to restore React bindings
  };

  const customer = project.customerId || {};

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden my-4 flex flex-col">
        
        {/* Action Bar */}
        <div className="bg-slate-100 p-4 flex items-center justify-between border-b border-slate-200 shrink-0">
          <h3 className="font-bold text-slate-700">Payment Invoice / Receipt</h3>
          <div className="flex items-center gap-3">
            <button 
              onClick={handlePrint}
              className="flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors shadow-sm"
            >
              <Printer className="w-4 h-4" />
              Print Invoice
            </button>
            <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 rounded-full transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Area */}
        <div className="p-8 overflow-y-auto bg-white" ref={printRef}>
          {/* Header */}
          <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6 mb-6">
            <div>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-[#0F2744] text-white rounded-xl flex items-center justify-center shadow-lg">
                  <Building2 className="w-7 h-7" />
                </div>
                <div>
                  <h1 className="text-3xl font-black tracking-tighter text-[#0F2744]">ALPHA ELEVATORS</h1>
                  <p className="text-sm text-slate-500 font-medium mt-0.5">Premium Home Lifts & Solutions</p>
                </div>
              </div>
              <div className="mt-5 text-xs text-slate-600 space-y-1">
                <p>123, Alpha Tower, Industrial Estate</p>
                <p>Chennai, Tamil Nadu - 600001</p>
                <p>Email: info@alphaelevators.com | Phone: +91 98765 43210</p>
                <p>GSTIN: 33ABCDE1234F1Z5</p>
              </div>
            </div>
            <div className="text-right">
              <h2 className="text-2xl font-bold text-slate-300 uppercase tracking-widest">Receipt</h2>
              <div className="mt-4 space-y-2 text-sm">
                <p><span className="text-slate-500 font-medium">Receipt No:</span> <span className="font-bold text-slate-900">{payment.receiptNumber}</span></p>
                <p><span className="text-slate-500 font-medium">Date:</span> <span className="font-bold text-slate-900">{new Date(payment.paymentDate || new Date()).toLocaleDateString('en-IN')}</span></p>
                <p><span className="text-slate-500 font-medium">Project Code:</span> <span className="font-bold text-slate-900">{project.projectId}</span></p>
              </div>
            </div>
          </div>

          {/* Customer Details */}
          <div className="grid grid-cols-2 gap-8 mb-8">
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Billed To (Customer)</h4>
              <div className="text-sm text-slate-800 space-y-1">
                <p className="font-bold text-base">{customer.fullName || payment.customerName}</p>
                {customer.address && <p>{customer.address}</p>}
                {customer.city && <p>{customer.city}, {customer.state} - {customer.pincode}</p>}
                <p>Phone: {customer.phoneNumber}</p>
              </div>
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Project / Shipping Details</h4>
              <div className="text-sm text-slate-800 space-y-1">
                <p className="font-bold">{project.projectName}</p>
                <p>{project.siteAddress}</p>
                <p className="mt-2"><span className="text-slate-500">Lift Model:</span> {project.liftModel}</p>
                <p><span className="text-slate-500">Shaft Model:</span> {project.shaftModel || 'Customer Scope'}</p>
              </div>
            </div>
          </div>

          {/* Payment Details Table */}
          <table className="w-full mb-8">
            <thead className="bg-slate-50 border-y border-slate-200 text-xs text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 text-left font-bold">Description</th>
                <th className="px-4 py-3 text-right font-bold">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              <tr>
                <td className="px-4 py-4 text-slate-800">
                  <p className="font-bold">Total Order Value</p>
                  <p className="text-xs text-slate-500">Base Price + 18% GST for Lift & Shaft</p>
                </td>
                <td className="px-4 py-4 text-right font-bold text-slate-900">
                  ₹{project.orderValue?.toLocaleString('en-IN')}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-4 text-slate-800">
                  <p className="font-bold">Payment Received</p>
                  <p className="text-xs text-slate-500">
                    Payment Type: {payment.paymentType}
                  </p>
                  <p className="text-xs text-slate-500">
                    Method: {payment.paymentMethod} (Ref: {payment.transactionReference})
                  </p>
                  {payment.notes && (
                    <p className="text-xs text-slate-500 mt-1 italic">Note: {payment.notes}</p>
                  )}
                </td>
                <td className="px-4 py-4 text-right font-bold text-emerald-600 text-lg">
                  ₹{payment.amountPaid?.toLocaleString('en-IN')}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Summary Box */}
          <div className="flex justify-end mb-12">
            <div className="w-72 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-slate-500 font-medium">Total Paid So Far:</span>
                <span className="font-bold text-slate-800">
                  ₹{project.totalPaid?.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                <span className="text-sm text-slate-700 font-bold">Outstanding Balance:</span>
                <span className="font-black text-rose-600 text-lg">
                  ₹{payment.balanceAmount?.toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center text-[10px] text-slate-400 border-t border-slate-100 pt-6">
            <p>This is a computer-generated receipt and does not require a physical signature.</p>
            <p className="mt-1">Thank you for choosing Alpha Elevators!</p>
          </div>
        </div>
      </div>
    </div>
  );
}
