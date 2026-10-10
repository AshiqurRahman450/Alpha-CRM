'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../../lib/api';
import { Building2, Printer, ChevronLeft } from 'lucide-react';
import Link from 'next/link';

export default function InvoicePage() {
  const params = useParams();
  const projectId = params.id as string;
  const paymentId = params.paymentId as string;

  const [project, setProject] = useState<any>(null);
  const [payment, setPayment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [projectRes, paymentRes] = await Promise.all([
          api.getProjectById(projectId),
          api.getPaymentById(paymentId)
        ]);
        setProject(projectRes.data?.project || projectRes.data);
        setPayment(paymentRes.data);
      } catch (err: any) {
        setError(err.message || 'Failed to load invoice data');
      } finally {
        setLoading(false);
      }
    };
    if (projectId && paymentId) {
      fetchData();
    }
  }, [projectId, paymentId]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading invoice...</div>;
  }

  if (error || !project || !payment) {
    return <div className="p-8 text-center text-rose-500">{error || 'Invoice not found'}</div>;
  }

  const customer = project.customerId || {};

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-4xl mx-auto">
        {/* Navigation & Actions (Hidden during print) */}
        <div className="flex items-center justify-between mb-6 print:hidden">
          <Link
            href={`/projects/${projectId}`}
            className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Project
          </Link>
          <button 
            onClick={handlePrint}
            className="flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-colors shadow-sm"
          >
            <Printer className="w-4 h-4" />
            Print Invoice
          </button>
        </div>

        {/* Printable Invoice Container */}
        <div className="bg-white rounded-3xl shadow-xl p-8 md:p-12 relative overflow-hidden" ref={printRef}>
          
          {/* Watermark Background */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0">
            <div className="w-[80%] max-w-2xl opacity-[0.04]">
              <img src="/logo-black.png" alt="Watermark" className="w-full h-auto object-contain grayscale" />
            </div>
          </div>

          <div className="relative z-10">
            {/* Header */}
          <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6 mb-8">
            <div>
              <div className="flex flex-col items-start gap-1">
                <div className="w-56 md:w-64">
                  <img src="/logo-black.png" alt="Alpha Elevators Logo" className="w-full h-auto object-contain" />
                </div>
                <p className="text-sm text-slate-500 font-medium mt-1">Premium Home Lifts & Solutions</p>
              </div>
              <div className="mt-6 text-sm text-slate-600 space-y-1">
                <p>123, Alpha Tower, Industrial Estate</p>
                <p>Chennai, Tamil Nadu - 600001</p>
                <p>Email: info@alphaelevators.com | Phone: +91 98765 43210</p>
                <p>GSTIN: 33ABCDE1234F1Z5</p>
              </div>
            </div>
            <div className="text-right">
              <h2 className="text-3xl font-bold text-slate-200 uppercase tracking-widest">Receipt</h2>
              <div className="mt-6 space-y-2 text-base">
                <p><span className="text-slate-500 font-medium">Receipt No:</span> <span className="font-bold text-slate-900">{payment.receiptNumber || 'N/A'}</span></p>
                <p><span className="text-slate-500 font-medium">Date:</span> <span className="font-bold text-slate-900">{new Date(payment.paymentDate || new Date()).toLocaleDateString('en-IN')}</span></p>
                <p><span className="text-slate-500 font-medium">Project Code:</span> <span className="font-bold text-slate-900">{project.projectId}</span></p>
              </div>
            </div>
          </div>

          {/* Customer Details */}
          <div className="grid grid-cols-2 gap-12 mb-10">
            <div>
              <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Billed To (Customer)</h4>
              <div className="text-base text-slate-800 space-y-1.5">
                <p className="font-black text-lg">{customer.fullName || payment.customerName}</p>
                {customer.address && <p>{customer.address}</p>}
                {customer.city && <p>{customer.city}, {customer.state} - {customer.pincode}</p>}
                <p>Phone: {customer.phoneNumber}</p>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Project / Shipping Details</h4>
              <div className="text-base text-slate-800 space-y-1.5">
                <p className="font-bold">{project.projectName}</p>
                <p>{project.siteAddress}</p>
                <p className="mt-3"><span className="text-slate-500">Lift Model:</span> {project.liftModel}</p>
                <p><span className="text-slate-500">Shaft Model:</span> {project.shaftModel || 'Customer Scope'}</p>
              </div>
            </div>
          </div>

          {/* Payment Details Table */}
          <table className="w-full mb-10">
            <thead className="bg-slate-50 border-y border-slate-200 text-sm text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-4 text-left font-bold">Description</th>
                <th className="px-5 py-4 text-right font-bold">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-base">
              <tr>
                <td className="px-5 py-6 text-slate-800">
                  <p className="font-bold text-lg">Total Order Value</p>
                  <p className="text-sm text-slate-500 mt-1">Base Price + 18% GST for Lift & Shaft</p>
                </td>
                <td className="px-5 py-6 text-right font-bold text-slate-900 text-xl">
                  ₹{project.orderValue?.toLocaleString('en-IN')}
                </td>
              </tr>
              <tr>
                <td className="px-5 py-6 text-slate-800">
                  <p className="font-bold text-lg">Payment Received</p>
                  <div className="mt-2 text-sm text-slate-600 space-y-1">
                    <p><span className="font-semibold text-slate-500">Payment Type:</span> {payment.paymentType}</p>
                    <p><span className="font-semibold text-slate-500">Method:</span> {payment.paymentMethod} <span className="text-xs ml-1">(Ref: {payment.transactionReference})</span></p>
                    {payment.notes && (
                      <p className="italic text-slate-500 mt-2">Note: {payment.notes}</p>
                    )}
                  </div>
                </td>
                <td className="px-5 py-6 text-right font-black text-emerald-600 text-2xl">
                  ₹{payment.amountPaid?.toLocaleString('en-IN')}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Summary Box */}
          <div className="flex justify-end mb-16">
            <div className="w-80 bg-slate-50 p-5 rounded-2xl border border-slate-200">
              <div className="flex justify-between items-center mb-3 text-base">
                <span className="text-slate-500 font-medium">Total Paid So Far:</span>
                <span className="font-bold text-slate-800">
                  ₹{(project.totalPaid || payment.amountPaid)?.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex justify-between items-center pt-3 border-t border-slate-200">
                <span className="text-slate-700 font-bold">Outstanding Balance:</span>
                <span className="font-black text-rose-600 text-xl">
                  ₹{payment.balanceAmount?.toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center text-xs text-slate-400 border-t border-slate-100 pt-8 font-medium">
            <p>This is a computer-generated receipt and does not require a physical signature.</p>
            <p className="mt-1.5 text-slate-500">Thank you for choosing Alpha Elevators!</p>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}
