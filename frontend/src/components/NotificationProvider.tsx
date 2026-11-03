'use client';

import { useEffect, useRef } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { api } from '../lib/api';
import { Bell, Check, X, MessageSquare } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function NotificationProvider() {
  const router = useRouter();
  const activeToasts = useRef<Set<string>>(new Set());

  useEffect(() => {
    const fetchReminders = async () => {
      try {
        const res = await api.getDueReminders();
        if (res.success && res.data) {
          const dueIds = new Set(res.data.map((r: any) => r._id));
          activeToasts.current.forEach((id) => {
            if (!dueIds.has(id)) {
              toast.dismiss(id);
              activeToasts.current.delete(id);
            }
          });

          res.data.forEach((reminder: any) => {
            if (!activeToasts.current.has(reminder._id)) {
              activeToasts.current.add(reminder._id);
              toast.custom((t) => {
                const isWhatsApp = reminder.type === 'WHATSAPP_MESSAGE';
                const cleanPhone = reminder.whatsappSenderPhone ? reminder.whatsappSenderPhone.replace(/\D/g, '') : '';

                return (
                  <div
                    className={`${
                      t.visible ? 'animate-enter' : 'animate-leave'
                    } max-w-md w-full bg-white shadow-2xl rounded-2xl pointer-events-auto flex flex-col overflow-hidden border ${
                      isWhatsApp
                        ? 'border-emerald-300 ring-2 ring-emerald-400'
                        : 'border-slate-100 ring-1 ring-black ring-opacity-5'
                    }`}
                  >
                    <div className="p-4 flex items-start gap-3">
                      <div className="flex-shrink-0 pt-1">
                        {isWhatsApp ? (
                          <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center animate-pulse">
                            <MessageSquare className="w-5 h-5" />
                          </div>
                        ) : (
                          <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center">
                            <Bell className="w-5 h-5 animate-bounce" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 w-0">
                        {isWhatsApp && (
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 mb-1 border border-emerald-200">
                            💬 Customer WhatsApp Message
                          </span>
                        )}
                        <p className="text-sm font-bold text-slate-900">
                          {reminder.title}
                        </p>
                        {reminder.notes && (
                          <p className="mt-1 text-xs text-slate-600 line-clamp-3 bg-slate-50 p-2 rounded-lg border border-slate-100 font-mono whitespace-pre-wrap">
                            {reminder.notes}
                          </p>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {reminder.relatedProjectId && (
                            <button 
                              onClick={() => {
                                toast.dismiss(t.id);
                                router.push(`/projects/${reminder.relatedProjectId._id || reminder.relatedProjectId}`);
                              }}
                              className="text-xs font-semibold text-sky-600 hover:text-sky-700 bg-sky-50 px-2 py-1 rounded"
                            >
                              View Project: {reminder.relatedProjectId.projectName || reminder.relatedProjectId.projectId || 'Project'}
                            </button>
                          )}
                          {cleanPhone && (
                            <a
                              href={`https://wa.me/${cleanPhone}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => toast.dismiss(t.id)}
                              className="text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded border border-emerald-200 inline-flex items-center gap-1"
                            >
                              <MessageSquare className="w-3 h-3 text-emerald-600" />
                              <span>Reply WhatsApp</span>
                            </a>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 ml-2">
                        <button
                          onClick={async () => {
                            try {
                              await api.dismissReminder(reminder._id);
                              toast.dismiss(t.id);
                              activeToasts.current.delete(reminder._id);
                              toast.success('Reminder dismissed');
                            } catch (err) {
                              console.error('Failed to dismiss reminder', err);
                            }
                          }}
                          className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors"
                          title="Mark Done"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            toast.dismiss(t.id);
                            activeToasts.current.delete(reminder._id);
                          }}
                          className="p-1.5 bg-slate-50 text-slate-400 rounded-lg hover:bg-slate-100 transition-colors"
                          title="Close Temporarily"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }, {
                duration: Infinity, // Keep open until dismissed
                id: reminder._id,
              });
            }
          });
        }
      } catch (err) {
        console.error('Failed to fetch due reminders', err);
      }
    };

    fetchReminders(); // Initial fetch
    const interval = setInterval(fetchReminders, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, [router]);

  return <Toaster position="top-right" />;
}
