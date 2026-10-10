'use client';

import { useEffect, useRef } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { api } from '../lib/api';
import { Bell, Check, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function NotificationProvider() {
  const router = useRouter();
  const activeToasts = useRef<Set<string>>(new Set());

  useEffect(() => {
    const fetchReminders = async () => {
      try {
        const res = await api.getDueReminders();
        if (res.success && res.data) {
          res.data.forEach((reminder: any) => {
            if (!activeToasts.current.has(reminder._id)) {
              activeToasts.current.add(reminder._id);
              toast.custom((t) => (
                <div
                  className={`${
                    t.visible ? 'animate-enter' : 'animate-leave'
                  } max-w-md w-full bg-white shadow-xl rounded-2xl pointer-events-auto flex flex-col overflow-hidden border border-slate-100 ring-1 ring-black ring-opacity-5`}
                >
                  <div className="p-4 flex items-start gap-4">
                    <div className="flex-shrink-0 pt-1">
                      <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center">
                        <Bell className="w-5 h-5 animate-bounce" />
                      </div>
                    </div>
                    <div className="flex-1 w-0">
                      <p className="text-sm font-bold text-slate-900">
                        {reminder.title}
                      </p>
                      {reminder.notes && (
                        <p className="mt-1 text-sm text-slate-500 line-clamp-2">
                          {reminder.notes}
                        </p>
                      )}
                      {reminder.relatedProjectId && (
                        <button 
                          onClick={() => {
                            toast.dismiss(t.id);
                            router.push(`/projects/${reminder.relatedProjectId._id}`);
                          }}
                          className="mt-2 text-xs font-semibold text-sky-600 hover:text-sky-700"
                        >
                          View Project: {reminder.relatedProjectId.projectName}
                        </button>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 ml-4">
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
                        title="Dismiss"
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
              ), {
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
