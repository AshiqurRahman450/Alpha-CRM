'use client';

import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Bell, Check, Clock, CalendarDays, Plus } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';

export default function RemindersPage() {
  const router = useRouter();
  const [reminders, setReminders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // New reminder modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [newDueAt, setNewDueAt] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const fetchReminders = async () => {
    try {
      setLoading(true);
      const res = await api.getReminders();
      setReminders(res.data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch reminders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReminders();
  }, []);

  const handleDismiss = async (id: string) => {
    try {
      await api.dismissReminder(id);
      toast.success('Reminder dismissed');
      fetchReminders();
    } catch (err: any) {
      toast.error('Failed to dismiss reminder');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || !newDueAt) return;
    
    try {
      setIsCreating(true);
      await api.createReminder({
        title: newTitle,
        notes: newNotes,
        dueAt: new Date(newDueAt).toISOString(),
      });
      toast.success('Reminder created!');
      setIsModalOpen(false);
      setNewTitle('');
      setNewNotes('');
      setNewDueAt('');
      fetchReminders();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create reminder');
    } finally {
      setIsCreating(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading reminders...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Your Reminders</h1>
          <p className="text-sm text-slate-500 mt-1">Manage all your scheduled notifications here.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-slate-800 transition-colors shadow-sm"
        >
          <Plus className="w-5 h-5" />
          <span>Add Reminder</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 text-rose-700 rounded-xl font-medium border border-rose-100">
          {error}
        </div>
      )}

      {reminders.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-sm">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Bell className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">No Reminders Found</h3>
          <p className="text-slate-500 mt-1">You don't have any scheduled reminders.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reminders.map((reminder) => {
            const isDue = new Date(reminder.dueAt) <= new Date();
            const isDismissed = reminder.status === 'DISMISSED';

            return (
              <div 
                key={reminder._id} 
                className={`bg-white rounded-3xl p-6 border shadow-sm transition-all relative overflow-hidden ${
                  isDismissed ? 'border-slate-200 opacity-60' : isDue ? 'border-amber-300 ring-4 ring-amber-50' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {isDue && !isDismissed && (
                  <div className="absolute top-0 right-0 bg-amber-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl">
                    DUE NOW
                  </div>
                )}
                
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className={`text-base font-bold ${isDismissed ? 'text-slate-500 line-through' : 'text-slate-900'} truncate`}>
                      {reminder.title}
                    </h3>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-2 font-medium">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{new Date(reminder.dueAt).toLocaleString('en-IN')}</span>
                    </div>
                    {reminder.notes && (
                      <p className="text-sm text-slate-600 mt-3 line-clamp-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                        {reminder.notes}
                      </p>
                    )}
                    {reminder.relatedProjectId && (
                      <button 
                        onClick={() => router.push(`/projects/${reminder.relatedProjectId._id}`)}
                        className="mt-4 text-xs font-bold text-sky-600 hover:text-sky-700 bg-sky-50 px-3 py-1.5 rounded-lg transition-colors inline-flex items-center gap-1.5"
                      >
                        <CalendarDays className="w-3.5 h-3.5" />
                        View Project
                      </button>
                    )}
                  </div>
                </div>

                {!isDismissed && (
                  <div className="mt-5 pt-4 border-t border-slate-100 flex justify-end">
                    <button
                      onClick={() => handleDismiss(reminder._id)}
                      className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-4 py-2 rounded-xl transition-colors"
                    >
                      <Check className="w-4 h-4" />
                      <span>Mark as Done</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE REMINDER MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200">
            <h3 className="text-xl font-black text-slate-900 mb-6">Create New Reminder</h3>
            
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Reminder Title *
                </label>
                <input 
                  type="text" 
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 outline-none transition-all font-medium text-slate-900"
                  placeholder="e.g. Call client regarding design approval"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Date & Time *
                </label>
                <input 
                  type="datetime-local" 
                  required
                  value={newDueAt}
                  onChange={(e) => setNewDueAt(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 outline-none transition-all font-medium text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Notes (Optional)
                </label>
                <textarea 
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 outline-none transition-all font-medium text-slate-900 resize-none h-24"
                  placeholder="Additional context for this reminder..."
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-5 py-2.5 rounded-xl font-bold text-white bg-slate-900 hover:bg-slate-800 transition-colors disabled:opacity-50"
                >
                  {isCreating ? 'Saving...' : 'Save Reminder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
