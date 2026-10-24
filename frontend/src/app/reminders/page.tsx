'use client';

import { useState, useEffect, useMemo } from 'react';
import { api } from '../../lib/api';
import {
  Bell,
  Check,
  Clock,
  CalendarDays,
  Plus,
  AlertCircle,
  CheckCircle2,
  Layers,
  Search,
  Filter,
  X,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';

export default function RemindersPage() {
  const router = useRouter();
  const [reminders, setReminders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state: ALL | DUE | UPCOMING | COMPLETED
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'DUE' | 'UPCOMING' | 'COMPLETED'>('ALL');
  const [search, setSearch] = useState('');

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
      setReminders(res.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch reminders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReminders();

    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      const qFilter = sp.get('filter');
      if (qFilter && ['DUE', 'UPCOMING', 'COMPLETED', 'ALL'].includes(qFilter.toUpperCase())) {
        setActiveFilter(qFilter.toUpperCase() as any);
      }
    }
  }, []);

  const handleDismiss = async (id: string) => {
    try {
      await api.dismissReminder(id);
      toast.success('Reminder marked as completed');
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

  // Metrics computation
  const metrics = useMemo(() => {
    const now = new Date();
    let dueCount = 0;
    let upcomingCount = 0;
    let completedCount = 0;

    for (const r of reminders) {
      const isDismissed = r.status === 'DISMISSED';
      const isDue = new Date(r.dueAt) <= now;

      if (isDismissed) {
        completedCount++;
      } else if (isDue) {
        dueCount++;
      } else {
        upcomingCount++;
      }
    }

    return {
      dueCount,
      upcomingCount,
      completedCount,
      totalCount: reminders.length,
    };
  }, [reminders]);

  // Filtered Reminders List
  const displayedReminders = useMemo(() => {
    const now = new Date();
    return reminders.filter((r) => {
      const isDismissed = r.status === 'DISMISSED';
      const isDue = new Date(r.dueAt) <= now && !isDismissed;
      const isUpcoming = new Date(r.dueAt) > now && !isDismissed;

      // Filter by category card
      if (activeFilter === 'DUE' && !isDue) return false;
      if (activeFilter === 'UPCOMING' && !isUpcoming) return false;
      if (activeFilter === 'COMPLETED' && !isDismissed) return false;

      // Filter by search query
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchTitle = r.title?.toLowerCase().includes(q);
        const matchNotes = r.notes?.toLowerCase().includes(q);
        const matchProject = r.relatedProjectId?.projectName?.toLowerCase().includes(q) ||
          r.relatedProjectId?.projectId?.toLowerCase().includes(q);
        return matchTitle || matchNotes || matchProject;
      }

      return true;
    });
  }, [reminders, activeFilter, search]);

  const toggleFilter = (selected: 'ALL' | 'DUE' | 'UPCOMING' | 'COMPLETED') => {
    if (activeFilter === selected) {
      setActiveFilter('ALL');
    } else {
      setActiveFilter(selected);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-sky-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs font-semibold text-slate-500">Loading your reminders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight font-poppins">
              Reminders & Notifications
            </h1>
            {metrics.dueCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
                {metrics.dueCount} Due Now
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Track site visit bookings, customer callbacks, and scheduled milestone actions.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-xl font-bold transition-all shadow-sm active:scale-95 text-xs self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add Reminder</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 text-rose-700 rounded-2xl text-xs font-medium border border-rose-100 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* TOP SUMMARY CARDS (Clicking filters list immediately) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Pending Due Now */}
        <div
          onClick={() => toggleFilter('DUE')}
          className={`p-5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden select-none ${
            activeFilter === 'DUE'
              ? 'bg-amber-500 text-white border-amber-600 shadow-lg shadow-amber-950/15 ring-2 ring-amber-400'
              : 'bg-gradient-to-br from-amber-50/70 via-white to-orange-50/40 border-amber-200 hover:border-amber-400 hover:shadow-md'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold">
            <span className={activeFilter === 'DUE' ? 'text-amber-100 uppercase tracking-wider text-[11px]' : 'text-amber-800'}>
              Pending Due
            </span>
            <div className="flex items-center gap-1.5">
              {metrics.dueCount > 0 && (
                <span className={`w-2 h-2 rounded-full ${activeFilter === 'DUE' ? 'bg-white' : 'bg-amber-500'} animate-ping`}></span>
              )}
              <div
                className={`w-7 h-7 rounded-xl flex items-center justify-center ${
                  activeFilter === 'DUE' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'
                }`}
              >
                <Bell className="w-4 h-4" />
              </div>
            </div>
          </div>
          <div className={`text-3xl font-black mt-2 font-mono ${activeFilter === 'DUE' ? 'text-white' : 'text-amber-700'}`}>
            {metrics.dueCount}
          </div>
          <div className="mt-2 pt-2 border-t border-amber-200/50 flex items-center justify-between text-[11px] font-semibold">
            <span className={activeFilter === 'DUE' ? 'text-amber-100' : 'text-amber-700'}>
              {activeFilter === 'DUE' ? '✓ Showing Due Only' : 'Click to show due only'}
            </span>
            <span className={activeFilter === 'DUE' ? 'text-white font-extrabold' : 'text-amber-600'}>
              {activeFilter === 'DUE' ? 'Filtered' : '→'}
            </span>
          </div>
        </div>

        {/* Card 2: Upcoming Scheduled */}
        <div
          onClick={() => toggleFilter('UPCOMING')}
          className={`p-5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden select-none ${
            activeFilter === 'UPCOMING'
              ? 'bg-sky-600 text-white border-sky-700 shadow-lg shadow-sky-950/15 ring-2 ring-sky-400'
              : 'bg-white border-slate-200 hover:border-sky-300 hover:shadow-md'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold">
            <span className={activeFilter === 'UPCOMING' ? 'text-sky-100 uppercase tracking-wider text-[11px]' : 'text-slate-600'}>
              Upcoming Scheduled
            </span>
            <div
              className={`w-7 h-7 rounded-xl flex items-center justify-center ${
                activeFilter === 'UPCOMING' ? 'bg-white/20 text-white' : 'bg-sky-50 text-sky-600'
              }`}
            >
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-3xl font-black mt-2 font-mono ${activeFilter === 'UPCOMING' ? 'text-white' : 'text-slate-900'}`}>
            {metrics.upcomingCount}
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-semibold">
            <span className={activeFilter === 'UPCOMING' ? 'text-sky-100' : 'text-slate-500'}>
              {activeFilter === 'UPCOMING' ? '✓ Showing Upcoming' : 'Click to filter'}
            </span>
            <span className={activeFilter === 'UPCOMING' ? 'text-white font-extrabold' : 'text-slate-400'}>
              {activeFilter === 'UPCOMING' ? 'Filtered' : '→'}
            </span>
          </div>
        </div>

        {/* Card 3: Completed / Done */}
        <div
          onClick={() => toggleFilter('COMPLETED')}
          className={`p-5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden select-none ${
            activeFilter === 'COMPLETED'
              ? 'bg-emerald-600 text-white border-emerald-700 shadow-lg shadow-emerald-950/15 ring-2 ring-emerald-400'
              : 'bg-white border-slate-200 hover:border-emerald-300 hover:shadow-md'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold">
            <span className={activeFilter === 'COMPLETED' ? 'text-emerald-100 uppercase tracking-wider text-[11px]' : 'text-slate-600'}>
              Completed
            </span>
            <div
              className={`w-7 h-7 rounded-xl flex items-center justify-center ${
                activeFilter === 'COMPLETED' ? 'bg-white/20 text-white' : 'bg-emerald-50 text-emerald-600'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-3xl font-black mt-2 font-mono ${activeFilter === 'COMPLETED' ? 'text-white' : 'text-slate-900'}`}>
            {metrics.completedCount}
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-semibold">
            <span className={activeFilter === 'COMPLETED' ? 'text-emerald-100' : 'text-slate-500'}>
              {activeFilter === 'COMPLETED' ? '✓ Showing Completed' : 'Click to filter'}
            </span>
            <span className={activeFilter === 'COMPLETED' ? 'text-white font-extrabold' : 'text-slate-400'}>
              {activeFilter === 'COMPLETED' ? 'Filtered' : '→'}
            </span>
          </div>
        </div>

        {/* Card 4: Total Reminders */}
        <div
          onClick={() => setActiveFilter('ALL')}
          className={`p-5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden select-none ${
            activeFilter === 'ALL'
              ? 'bg-slate-900 text-white border-slate-950 shadow-lg shadow-slate-950/15 ring-2 ring-slate-700'
              : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-md'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold">
            <span className={activeFilter === 'ALL' ? 'text-slate-300 uppercase tracking-wider text-[11px]' : 'text-slate-600'}>
              All Reminders
            </span>
            <div
              className={`w-7 h-7 rounded-xl flex items-center justify-center ${
                activeFilter === 'ALL' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-3xl font-black mt-2 font-mono ${activeFilter === 'ALL' ? 'text-white' : 'text-slate-900'}`}>
            {metrics.totalCount}
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-semibold">
            <span className={activeFilter === 'ALL' ? 'text-slate-300' : 'text-slate-500'}>
              {activeFilter === 'ALL' ? '✓ Showing All' : 'Click to show all'}
            </span>
            <span className={activeFilter === 'ALL' ? 'text-white font-extrabold' : 'text-slate-400'}>
              {activeFilter === 'ALL' ? 'All' : '→'}
            </span>
          </div>
        </div>
      </div>

      {/* Filter Toolbar & Search */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="w-full sm:flex-1 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search reminders by title, notes, or project name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-9 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 bg-slate-50/50 text-slate-800"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 text-xs font-bold"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto justify-between sm:justify-end text-xs">
          {activeFilter !== 'ALL' && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-900 border border-amber-200 rounded-xl font-bold">
              <span>Filter: {activeFilter === 'DUE' ? 'Pending Due Only' : activeFilter}</span>
              <button
                onClick={() => setActiveFilter('ALL')}
                className="hover:text-amber-700 ml-1 text-xs"
                title="Clear filter"
              >
                ✕
              </button>
            </div>
          )}

          <span className="text-slate-500 font-medium">
            Showing <strong className="text-slate-900">{displayedReminders.length}</strong> of{' '}
            <strong className="text-slate-900">{reminders.length}</strong>
          </span>
        </div>
      </div>

      {/* Reminders Grid */}
      {displayedReminders.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-sm space-y-3">
          <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto text-amber-600 border border-amber-200">
            {activeFilter === 'DUE' ? <CheckCircle2 className="w-7 h-7" /> : <Bell className="w-7 h-7 text-slate-400" />}
          </div>
          <h3 className="text-base font-bold text-slate-900">
            {activeFilter === 'DUE'
              ? 'No Pending Due Reminders!'
              : activeFilter === 'UPCOMING'
              ? 'No Upcoming Reminders'
              : activeFilter === 'COMPLETED'
              ? 'No Completed Reminders'
              : 'No Reminders Found'}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {activeFilter === 'DUE'
              ? 'All your scheduled reminder notifications are currently up to date.'
              : search
              ? `No reminders matched your search "${search}".`
              : 'You do not have any reminders in this category.'}
          </p>
          {(activeFilter !== 'ALL' || search) && (
            <button
              onClick={() => {
                setActiveFilter('ALL');
                setSearch('');
              }}
              className="mt-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-colors"
            >
              Show All Reminders
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {displayedReminders.map((reminder) => {
            const isDue = new Date(reminder.dueAt) <= new Date();
            const isDismissed = reminder.status === 'DISMISSED';

            return (
              <div
                key={reminder._id}
                className={`bg-white rounded-3xl p-6 border shadow-sm transition-all relative overflow-hidden flex flex-col justify-between ${
                  isDismissed
                    ? 'border-slate-200 opacity-60 bg-slate-50/40'
                    : isDue
                    ? 'border-amber-300 ring-4 ring-amber-50 hover:shadow-md'
                    : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
                }`}
              >
                {isDue && !isDismissed && (
                  <div className="absolute top-0 right-0 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-black px-3 py-1 rounded-bl-xl shadow-sm tracking-wider flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
                    <span>DUE NOW</span>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="pr-16">
                    <h3
                      className={`text-sm font-extrabold ${
                        isDismissed ? 'text-slate-500 line-through' : 'text-slate-900'
                      }`}
                    >
                      {reminder.title}
                    </h3>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>{new Date(reminder.dueAt).toLocaleString('en-IN')}</span>
                  </div>

                  {reminder.notes && (
                    <p className="text-xs text-slate-600 line-clamp-3 bg-slate-50 p-3 rounded-xl border border-slate-100 leading-relaxed">
                      {reminder.notes}
                    </p>
                  )}
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                  {reminder.relatedProjectId ? (
                    <button
                      onClick={() => router.push(`/projects/${reminder.relatedProjectId._id}`)}
                      className="text-xs font-bold text-sky-600 hover:text-sky-700 bg-sky-50 px-2.5 py-1.5 rounded-lg transition-colors inline-flex items-center gap-1.5 border border-sky-100"
                    >
                      <CalendarDays className="w-3.5 h-3.5" />
                      <span>{reminder.relatedProjectId.projectId || 'Project'}</span>
                    </button>
                  ) : (
                    <div />
                  )}

                  {!isDismissed && (
                    <button
                      onClick={() => handleDismiss(reminder._id)}
                      className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-3.5 py-1.5 rounded-xl transition-colors border border-emerald-200 active:scale-95"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Mark Done</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE REMINDER MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-black text-slate-900 font-poppins">Create New Reminder</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Reminder Title *
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 outline-none transition-all font-medium text-slate-900"
                  placeholder="e.g. Schedule Site Visit for Mr. Kumar"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Date & Time *
                </label>
                <input
                  type="datetime-local"
                  required
                  value={newDueAt}
                  onChange={(e) => setNewDueAt(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 outline-none transition-all font-medium text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Notes (Optional)
                </label>
                <textarea
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 outline-none transition-all font-medium text-slate-900 resize-none h-24"
                  placeholder="Additional context or phone number..."
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl font-bold text-xs text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-5 py-2 rounded-xl font-bold text-xs text-white bg-slate-900 hover:bg-slate-800 transition-colors disabled:opacity-50"
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
