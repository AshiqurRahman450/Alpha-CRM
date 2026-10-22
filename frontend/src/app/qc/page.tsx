'use client';

import React, { useState, useEffect } from 'react';
import QCInspectionForm from '../../components/QCInspectionForm';
import { api, getStoredUser } from '../../lib/api';
import {
  ClipboardCheck,
  History,
  Download,
  Calendar,
  User,
  MapPin,
  Search,
  ExternalLink,
  ShieldCheck,
  FileCheck2,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function QCPage() {
  const [activeTab, setActiveTab] = useState<'form' | 'history'>('form');
  const [pastReports, setPastReports] = useState<any[]>([]);
  const [loadingReports, setLoadingReports] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    setCurrentUser(getStoredUser());
  }, []);

  const fetchReports = async () => {
    try {
      setLoadingReports(true);
      const res = await api.getQCReports({ search: searchQuery });
      setPastReports(res.data || []);
    } catch (err: any) {
      console.warn('Failed to load past reports:', err.message);
    } finally {
      setLoadingReports(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'history') {
      fetchReports();
    }
  }, [activeTab, searchQuery]);

  const handleDownloadPdf = async (report: any) => {
    try {
      toast.loading(`Generating PDF for ${report.jobNo}...`, { id: 'pdf-dl' });
      const blob = await api.generateQCPdf(report);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Alpha-Elevators-SiteReport-${report.jobNo}-${report.clientName}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success('Downloaded report PDF!', { id: 'pdf-dl' });
    } catch (err: any) {
      toast.error('Download error: ' + err.message, { id: 'pdf-dl' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Subnav Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-3">
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setActiveTab('form')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${
              activeTab === 'form'
                ? 'bg-sky-600 text-white shadow-md shadow-sky-900/30'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <ClipboardCheck className="w-4 h-4" />
            <span>Digital Site Inspection Form</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${
              activeTab === 'history'
                ? 'bg-sky-600 text-white shadow-md shadow-sky-900/30'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Past Inspection Reports ({pastReports.length})</span>
          </button>
        </div>

        <div className="text-xs text-slate-500 flex items-center gap-1.5 font-medium">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Logged in as: </span>
          <strong className="text-slate-800">{currentUser?.name || 'QC Inspector'}</strong>
          <span className="text-[10px] bg-slate-200 px-2 py-0.5 rounded-full font-mono text-slate-700">
            {currentUser?.role || 'QC'}
          </span>
        </div>
      </div>

      {activeTab === 'form' ? (
        <QCInspectionForm
          onSaved={() => {
            fetchReports();
          }}
        />
      ) : (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Submitted Site Inspection Reports</h2>
              <p className="text-xs text-slate-500">Historical elevator pre-production inspections and downloadable PDF reports</p>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search by job no, client, or city..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>

          {loadingReports ? (
            <div className="p-8 text-center text-xs text-slate-500">Loading reports...</div>
          ) : pastReports.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <FileCheck2 className="w-12 h-12 text-slate-300 mx-auto" />
              <div className="text-sm font-bold text-slate-700">No Inspection Reports Found</div>
              <p className="text-xs text-slate-400">Fill and submit a report from the "Digital Site Inspection Form" tab above.</p>
              <button
                type="button"
                onClick={() => setActiveTab('form')}
                className="mt-2 px-4 py-2 bg-sky-600 text-white rounded-xl text-xs font-bold hover:bg-sky-500 transition-colors"
              >
                Create New Report
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                    <th className="p-3">Report ID / Job No</th>
                    <th className="p-3">Client Details</th>
                    <th className="p-3">Region / Location</th>
                    <th className="p-3">Inspection Date</th>
                    <th className="p-3">Product / Stops</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pastReports.map((report) => (
                    <tr key={report._id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="p-3 font-semibold text-slate-900">
                        <div className="font-mono text-sky-700 font-bold">{report.jobNo}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{report.reportId}</div>
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-slate-800">{report.clientName}</div>
                        <div className="text-[11px] text-slate-500">{report.clientPhone}</div>
                      </td>
                      <td className="p-3 text-slate-600">{report.region}</td>
                      <td className="p-3 text-slate-600 font-mono">{report.reportDate}</td>
                      <td className="p-3">
                        <div className="font-medium text-slate-800">{report.product}</div>
                        <div className="text-[10px] text-slate-500">{report.floorConfig} Stops</div>
                      </td>
                      <td className="p-3">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          {report.status || 'SUBMITTED'}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleDownloadPdf(report)}
                          className="px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 font-bold rounded-lg border border-sky-200 transition-colors inline-flex items-center gap-1.5"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download PDF</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
