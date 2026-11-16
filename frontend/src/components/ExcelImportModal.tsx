'use client';

import React, { useState, useRef } from 'react';
import {
  X,
  FileSpreadsheet,
  Upload,
  Download,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Building2,
  UserCheck,
  RefreshCw,
  FileText,
  HelpCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { api } from '../lib/api';
import { generateClientExcelTemplateBlob } from '../lib/excelTemplate';

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  title?: string;
}

export default function ExcelImportModal({
  isOpen,
  onClose,
  onSuccess,
  title = 'Import Customers & Elevator Projects',
}: ExcelImportModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [showGuide, setShowGuide] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      validateAndSetFile(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (file: File) => {
    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const lowerName = file.name.toLowerCase();
    const isValid = validExtensions.some((ext) => lowerName.endsWith(ext));

    if (!isValid) {
      toast.error('Please upload an Excel spreadsheet (.xlsx, .xls) or CSV file');
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      toast.error('File size must be under 25MB');
      return;
    }

    setSelectedFile(file);
    setResult(null);
  };

  const handleDownloadTemplate = async () => {
    try {
      setDownloadingTemplate(true);
      let blob: Blob;
      try {
        blob = await api.downloadImportTemplate();
      } catch (backendErr) {
        console.warn('Backend download failed, generating client-side template:', backendErr);
        blob = generateClientExcelTemplateBlob();
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Alpha_CRM_Import_Template.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Sample import template downloaded successfully');
    } catch (err: any) {
      // Direct fail-safe fallback in case of any unexpected browser error
      try {
        const fallbackBlob = generateClientExcelTemplateBlob();
        const url = window.URL.createObjectURL(fallbackBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'Alpha_CRM_Import_Template.xlsx';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success('Sample import template downloaded successfully');
      } catch (finalErr: any) {
        toast.error(finalErr.message || 'Failed to download template');
      }
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Please select an Excel file to import');
      return;
    }

    try {
      setUploading(true);
      const res = await api.importExcel(selectedFile);
      if (res && res.data) {
        setResult(res.data);
        const { summary } = res.data;
        toast.success(
          `Import complete! ${summary.customersCreated} new customers, ${summary.projectsCreated} new projects added.`,
          { duration: 6000 }
        );
        onSuccess();
      } else {
        toast.success('Spreadsheet data processed successfully');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error importing spreadsheet data');
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    if (uploading) return;
    const hasImported = result !== null;
    setSelectedFile(null);
    setResult(null);
    onClose();
    if (hasImported) {
      onSuccess();
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col my-auto max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center text-white border border-white/20 shadow-inner">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base tracking-tight leading-tight">{title}</h3>
              <p className="text-emerald-100 text-[11px] font-medium mt-0.5">
                Bulk create customers and elevator projects from Excel spreadsheet (.xlsx, .xls)
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={uploading}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Result View if import finished */}
          {result ? (
            <div className="space-y-5 animate-fade-in">
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-emerald-900 text-sm">Import Completed Successfully</h4>
                  <p className="text-emerald-700 text-xs mt-1">{result.message}</p>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-center">
                  <div className="text-xl font-black text-slate-800">{result.summary.totalRows}</div>
                  <div className="text-[11px] text-slate-500 font-medium">Rows Processed</div>
                </div>
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-center">
                  <div className="text-xl font-black text-emerald-700">+{result.summary.customersCreated}</div>
                  <div className="text-[11px] text-emerald-600 font-medium">New Customers</div>
                </div>
                <div className="p-3.5 rounded-2xl bg-sky-50 border border-sky-200 text-center">
                  <div className="text-xl font-black text-sky-700">+{result.summary.projectsCreated}</div>
                  <div className="text-[11px] text-sky-600 font-medium">New Projects</div>
                </div>
                <div className="p-3.5 rounded-2xl bg-indigo-50 border border-indigo-200 text-center">
                  <div className="text-xl font-black text-indigo-700">
                    {result.summary.customersUpdated + result.summary.projectsUpdated}
                  </div>
                  <div className="text-[11px] text-indigo-600 font-medium">Updated Records</div>
                </div>
              </div>

              {/* Errors section if any */}
              {result.errors && result.errors.length > 0 && (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200">
                  <div className="flex items-center gap-2 text-amber-900 font-bold text-xs mb-2">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    <span>Row Warnings or Skipped Items ({result.errors.length})</span>
                  </div>
                  <div className="max-h-36 overflow-y-auto space-y-1.5 text-[11px]">
                    {result.errors.map((err: any, idx: number) => (
                      <div key={idx} className="p-2 bg-white rounded-lg border border-amber-200 text-amber-900 flex items-start gap-2">
                        <span className="font-bold text-amber-700">Row {err.rowNumber}:</span>
                        <span>{err.customerName || err.projectName} — {err.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Imported Items Table Preview */}
              {result.items && result.items.length > 0 && (
                <div className="border border-slate-200 rounded-2xl overflow-hidden">
                  <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-700">
                    <span>Imported Records Preview ({result.items.length})</span>
                    <span className="text-[10px] text-slate-400">All added to CRM lists</span>
                  </div>
                  <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 text-xs">
                    {result.items.map((item: any, idx: number) => (
                      <div key={idx} className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-50/60">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[10px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded">
                              {item.customerCode}
                            </span>
                            <span className="font-bold text-slate-800 truncate">{item.customerName}</span>
                            {item.isNewCustomer && (
                              <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1 rounded border border-emerald-200">
                                New Cust
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                            <span>{item.phone}</span>
                            {item.projectName && (
                              <>
                                <span>•</span>
                                <span className="font-medium text-slate-700 truncate">{item.projectName}</span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0 text-right">
                          {item.projectCode && (
                            <span className="font-mono text-[10px] font-bold text-sky-800 bg-sky-100 px-1.5 py-0.5 rounded">
                              {item.projectCode}
                            </span>
                          )}
                          {item.orderValue && (
                            <span className="font-bold text-slate-700 text-xs">
                              ₹{Number(item.orderValue).toLocaleString('en-IN')}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Template Download & Instruction Card */}
              <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-200/90 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-700 flex-shrink-0 mt-0.5">
                    <Download className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs">Download Standard Excel Template</h4>
                    <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                      Pre-formatted template with ready sample rows, column headers (Customer Name, Phone, Address, Lift Model, Shaft Model, Order Value, Stage, Executive) and reference guide.
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleDownloadTemplate}
                  disabled={downloadingTemplate}
                  className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 active:scale-95 flex-shrink-0 cursor-pointer disabled:opacity-50"
                >
                  {downloadingTemplate ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  <span>{downloadingTemplate ? 'Downloading...' : 'Get Template (.xlsx)'}</span>
                </button>
              </div>

              {/* Drag and Drop Upload Area */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-3xl p-8 text-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-emerald-500 bg-emerald-50/60 scale-[0.99]'
                    : selectedFile
                    ? 'border-emerald-400 bg-emerald-50/20'
                    : 'border-slate-300 hover:border-emerald-400 hover:bg-slate-50/80'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel, text/csv"
                  className="hidden"
                  onChange={handleFileChange}
                />

                {selectedFile ? (
                  <div className="flex flex-col items-center gap-2 animate-fade-in">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center border border-emerald-200 shadow-sm">
                      <FileSpreadsheet className="w-7 h-7" />
                    </div>
                    <div className="font-extrabold text-slate-800 text-sm">{selectedFile.name}</div>
                    <div className="text-xs text-slate-500">{formatFileSize(selectedFile.size)}</div>
                    <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Ready to import</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">Click to select a different file</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center border border-slate-200 shadow-inner">
                      <Upload className="w-7 h-7" />
                    </div>
                    <div className="font-bold text-slate-800 text-sm">
                      Drop your Excel spreadsheet here, or <span className="text-emerald-700 underline">browse</span>
                    </div>
                    <p className="text-xs text-slate-500">Supports .xlsx, .xls and .csv files up to 25MB</p>
                  </div>
                )}
              </div>

              {/* Explanatory Collapsible Guide */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/50">
                <button
                  type="button"
                  onClick={() => setShowGuide(!showGuide)}
                  className="w-full px-4 py-3 text-left flex items-center justify-between text-xs font-bold text-slate-700 hover:bg-slate-100/60 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-emerald-600" />
                    <span>How does Excel data map to Customers and Projects?</span>
                  </div>
                  {showGuide ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {showGuide && (
                  <div className="px-4 pb-4 pt-1 text-xs text-slate-600 space-y-2 border-t border-slate-200 bg-white">
                    <p className="leading-relaxed">
                      Each row in your Excel file seamlessly links a customer and their elevator project:
                    </p>
                    <ul className="list-disc pl-5 space-y-1 text-[11px] text-slate-600">
                      <li>
                        <strong>Add Customer Record Fields:</strong> Customer Code (optional), Full Name, Phone Number, WhatsApp Number, Email, Door No, Street Name, Landmark, Address, Google Maps Link, City, State, Pincode, Customer Type (Residential/Villa/Commercial/Builder), Lead Source, WhatsApp Opt-In, Old Customer, and Customer Notes.
                      </li>
                      <li>
                        <strong>Create Elevator Project Fields:</strong> Project Code (optional), Project Name, Site Address, Site Google Maps Link, Lift Model, Lift Type, Floors, Shaft Model, Drawing URL, Order Value, Lift & Shaft Base & Discount Amounts, Advance %, Advance Amount, Total Paid, Balance Amount, Payment Status, and Stage Payment Percentages (Production 40%, Readiness 30%, Dispatch 0%, Installation 0%).
                      </li>
                      <li>
                        <strong>Lifecycle, Dates & Team:</strong> Current Stage (Site Visit, Material in transit, Material Delivered, etc.), Order Date, Expected/Actual Delivery Date, Installation Date, Assigned Executive, Project Manager, Project Executive, BDM Phone, VRL LR Tracking Number, WhatsApp Group ID & Name, WhatsApp Automation Enabled, Update Frequency, and Project Notes.
                      </li>
                      <li>
                        <strong>Auto-Deduplication & Synchronization:</strong> If a customer or project already exists (matched by Phone, Email, Customer Code, or Project Code), all fields will be automatically updated with latest spreadsheet values rather than duplicated.
                      </li>
                    </ul>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between flex-shrink-0">
          {result ? (
            <div className="flex items-center justify-between w-full">
              <button
                type="button"
                onClick={() => {
                  setSelectedFile(null);
                  setResult(null);
                }}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Import Another File</span>
              </button>

              <button
                type="button"
                onClick={handleClose}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Done & View List</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-end gap-2 w-full">
              <button
                type="button"
                onClick={handleClose}
                disabled={uploading}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpload}
                disabled={!selectedFile || uploading}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-950/20 active:scale-95 flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing & Importing...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>Import Excel Data</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
