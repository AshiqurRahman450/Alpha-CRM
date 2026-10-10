'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  MessageSquare,
  Send,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
  Users,
  Search,
  Filter,
} from 'lucide-react';
import { api } from '../../lib/api';

export default function WhatsAppHubPage() {
  const [channels, setChannels] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'channels' | 'messages'>('channels');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [channelsRes, messagesRes] = await Promise.all([
        api.getChannels(),
        api.getWhatsAppMessages({ limit: 100 }),
      ]);
      setChannels(channelsRes.data || []);
      setMessages(messagesRes.data || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">WhatsApp Communication Hub</h2>
          <p className="text-xs text-slate-500">
            Real-time Meta WhatsApp Business Cloud API communication stream & active group channels
          </p>
        </div>

        {/* Tab switch */}
        <div className="bg-slate-200/80 p-1 rounded-xl flex items-center self-start text-xs font-bold">
          <button
            onClick={() => setActiveTab('channels')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'channels' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Active Groups ({channels.length})
          </button>
          <button
            onClick={() => setActiveTab('messages')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'messages' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Global Message Stream ({messages.length})
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-xs text-slate-500">Loading WhatsApp communication hub...</div>
      ) : activeTab === 'channels' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {channels.map((ch: any) => (
            <div
              key={ch._id}
              className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-3 hover:border-sky-300 transition-all"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-mono font-bold text-slate-400">{ch.projectCode}</span>
                  <h4 className="text-sm font-extrabold text-slate-900">{ch.groupName}</h4>
                  <span className="text-xs text-slate-500">Client: {ch.customerName}</span>
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                    ch.groupStatus === 'ACTIVE'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {ch.groupStatus}
                </span>
              </div>

              <div className="bg-slate-50 p-3 rounded-2xl text-xs space-y-1.5 border border-slate-200/80">
                <div className="flex justify-between text-slate-600">
                  <span>Meta Group ID:</span>
                  <strong className="font-mono text-slate-900">{ch.whatsappGroupId}</strong>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Cadence:</span>
                  <strong className="text-slate-900">Every {ch.updateFrequencyDays} Days</strong>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Next Update:</span>
                  <strong className="text-sky-700">
                    {ch.nextUpdateDate ? new Date(ch.nextUpdateDate).toLocaleDateString('en-GB') : 'Immediate'}
                  </strong>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <Link
                  href={`/projects/${ch.projectId?._id || ch.projectId}`}
                  className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  <span>Open WhatsApp Group</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-400 uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4 font-bold">Time</th>
                  <th className="py-3 px-4 font-bold">Direction</th>
                  <th className="py-3 px-4 font-bold">Project / Customer</th>
                  <th className="py-3 px-4 font-bold">Message Content</th>
                  <th className="py-3 px-4 font-bold">Template</th>
                  <th className="py-3 px-4 font-bold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {messages.map((m: any) => {
                  const isIncoming = m.direction === 'INCOMING';
                  return (
                    <tr key={m._id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">
                        {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isIncoming
                              ? 'bg-sky-50 text-sky-800 border border-sky-200'
                              : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          }`}
                        >
                          {m.direction}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-slate-800 block">{m.customerName}</span>
                        <span className="text-[10px] text-slate-400">{m.projectCode}</span>
                      </td>
                      <td className="py-3.5 px-4 max-w-md">
                        <p className="line-clamp-2 text-slate-700 text-[11px] leading-relaxed">
                          {m.messageContent}
                        </p>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[10px] text-slate-500 font-bold">
                        {m.templateName || '—'}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            m.status === 'READ'
                              ? 'bg-sky-100 text-sky-800'
                              : m.status === 'DELIVERED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : m.status === 'SENT'
                              ? 'bg-slate-200 text-slate-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {m.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
