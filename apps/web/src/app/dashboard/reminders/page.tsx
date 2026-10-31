'use client';

import React, { useState } from 'react';
import {
  CalendarCheck,
  Plus,
  Clock,
  Repeat,
  CheckCircle2,
  Circle,
  Trash2,
  AlertCircle,
  Users,
  Sparkles,
  Calendar,
} from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { playChime } from '@ourspace/shared';
import confetti from 'canvas-confetti';
import {
  subscribeToFirestoreReminders,
  addReminderToFirestore,
  toggleReminderCompleteInFirestore,
} from '@/lib/firebase/firestore';

interface ReminderItem {
  id: string;
  title: string;
  description?: string;
  dueDate: string;
  recurrence: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  isCompleted: boolean;
  isShared: boolean;
  assignedToName?: string;
}

const INITIAL_REMINDERS: ReminderItem[] = [
  {
    id: 'rem-1',
    title: 'Reserve table at Italian restaurant',
    description: 'Booking by the window for cozy dinner',
    dueDate: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 16),
    recurrence: 'none',
    priority: 'high',
    isCompleted: false,
    isShared: true,
    assignedToName: 'Both of us',
  },
];

export default function RemindersPage() {
  const { user, space, partner } = useAuthStore();
  const [reminders, setReminders] = useState<ReminderItem[]>(INITIAL_REMINDERS);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');

  // New Reminder Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState(() => new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 16));
  const [recurrence, setRecurrence] = useState<'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'>('none');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [isShared, setIsShared] = useState(true);

  // Sync with Firestore
  React.useEffect(() => {
    if (!space?.id) return;
    const unsub = subscribeToFirestoreReminders(space.id, (firestoreReminders) => {
      if (firestoreReminders.length > 0) {
        setReminders(
          firestoreReminders.map((r) => ({
            id: r.id,
            title: r.title,
            description: r.description || undefined,
            dueDate: r.due_date,
            recurrence: r.recurrence as any,
            priority: r.priority as any,
            isCompleted: r.is_completed,
            isShared: Boolean(r.assigned_to === null || r.assigned_to === 'both'),
            assignedToName: r.assigned_to === partner?.id ? partner?.display_name : 'Both of us',
          }))
        );
      }
    });
    return () => unsub();
  }, [space?.id, partner?.id, partner?.display_name]);

  const toggleComplete = async (id: string) => {
    const target = reminders.find((r) => r.id === id);
    const nextState = !target?.isCompleted;

    if (nextState) {
      playChime('modern-ping');
      confetti({ particleCount: 50, spread: 50, origin: { y: 0.6 } });
    }

    setReminders((prev) =>
      prev.map((r) => (r.id === id ? { ...r, isCompleted: nextState } : r))
    );

    if (space?.id && user?.id) {
      try {
        await toggleReminderCompleteInFirestore(space.id, id, nextState, user.id);
      } catch (err) {
        console.error('Failed to sync reminder completion to Firestore:', err);
      }
    }
  };

  const deleteReminder = (id: string) => {
    setReminders((prev) => prev.filter((r) => r.id !== id));
  };

  const handleCreateReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const newReminderItem: ReminderItem = {
      id: 'rem-' + Date.now(),
      title: title.trim(),
      description: description.trim() || undefined,
      dueDate,
      recurrence,
      priority,
      isCompleted: false,
      isShared,
      assignedToName: isShared ? 'Both of us' : user?.display_name || 'Me',
    };

    setReminders((prev) => [newReminderItem, ...prev]);
    playChime('soft-bell');
    setIsModalOpen(false);

    // Reset Form
    setTitle('');
    setDescription('');

    if (space?.id && user?.id) {
      try {
        await addReminderToFirestore(space.id, {
          title: newReminderItem.title,
          description: newReminderItem.description,
          due_date: newReminderItem.dueDate,
          recurrence: newReminderItem.recurrence,
          priority: newReminderItem.priority,
          assigned_to: isShared ? null : user.id,
          created_by: user.id,
        });
      } catch (err) {
        console.error('Failed to save reminder to Firestore:', err);
      }
    }
  };

  const filteredReminders = reminders.filter((r) => {
    if (filter === 'pending') return !r.isCompleted;
    if (filter === 'completed') return r.isCompleted;
    return true;
  });

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6">
      {/* Header and Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-stone-900 dark:text-zinc-100 flex items-center gap-2">
            <span>Reminders & Shared Tasks</span>
            <Sparkles className="w-5 h-5 text-rose-500" />
          </h2>
          <p className="text-xs text-stone-500 dark:text-zinc-400 mt-0.5">
            Never miss an anniversary, date night, or thoughtful errand together.
          </p>
        </div>

        <Button
          onClick={() => setIsModalOpen(true)}
          className="gap-2 text-xs py-2.5 rounded-full shadow-rose-500/20"
        >
          <Plus className="w-4 h-4" />
          <span>New Reminder</span>
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2">
        {(['all', 'pending', 'completed'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-4 py-1.5 rounded-2xl text-xs font-bold capitalize transition-all ${
              filter === tab
                ? 'bg-rose-500 text-white shadow-sm'
                : 'glass-card hover:bg-rose-50 text-stone-600 dark:text-zinc-300'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Reminders List */}
      <div className="flex flex-col gap-3">
        {filteredReminders.map((item) => (
          <div
            key={item.id}
            className={`p-4 rounded-3xl glass-panel border transition-all flex items-start justify-between gap-4 ${
              item.isCompleted
                ? 'opacity-60 bg-stone-50/50 dark:bg-zinc-900/40 border-stone-200'
                : 'border-rose-200/50 hover:shadow-md'
            }`}
          >
            {/* Checkbox & Content */}
            <div className="flex items-start gap-3.5 flex-1 min-w-0">
              <button
                onClick={() => toggleComplete(item.id)}
                className="mt-0.5 text-rose-500 hover:scale-110 transition-transform"
              >
                {item.isCompleted ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 fill-emerald-100" />
                ) : (
                  <Circle className="w-5 h-5" />
                )}
              </button>

              <div className="flex flex-col gap-1 min-w-0">
                <h4
                  className={`text-sm font-bold text-stone-800 dark:text-zinc-100 ${
                    item.isCompleted ? 'line-through text-stone-400' : ''
                  }`}
                >
                  {item.title}
                </h4>

                {item.description && (
                  <p className="text-xs text-stone-500 dark:text-zinc-400">
                    {item.description}
                  </p>
                )}

                {/* Meta Tags: Due date, priority, recurrence, assigned */}
                <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[11px]">
                  <span className="flex items-center gap-1 text-stone-500">
                    <Clock className="w-3 h-3" />
                    <span>{new Date(item.dueDate).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  </span>

                  {item.recurrence !== 'none' && (
                    <span className="flex items-center gap-1 text-purple-600 bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 rounded-full font-semibold">
                      <Repeat className="w-3 h-3" />
                      <span className="capitalize">{item.recurrence}</span>
                    </span>
                  )}

                  {item.isShared && (
                    <span className="flex items-center gap-1 text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-full font-semibold">
                      <Users className="w-3 h-3" />
                      <span>{item.assignedToName}</span>
                    </span>
                  )}

                  <span
                    className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase ${
                      item.priority === 'urgent'
                        ? 'bg-red-100 text-red-600'
                        : item.priority === 'high'
                        ? 'bg-amber-100 text-amber-600'
                        : 'bg-stone-100 text-stone-600'
                    }`}
                  >
                    {item.priority}
                  </span>
                </div>
              </div>
            </div>

            {/* Delete Action */}
            <button
              onClick={() => deleteReminder(item.id)}
              className="p-2 rounded-xl text-stone-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
              title="Delete reminder"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Add Reminder Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create New Reminder"
        description="Add a personal or shared reminder for both of you"
      >
        <form onSubmit={handleCreateReminder} className="flex flex-col gap-4">
          <Input
            label="Reminder Title"
            placeholder="e.g. Plan weekend road trip"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-stone-600 dark:text-zinc-300">
              Details / Notes (Optional)
            </label>
            <textarea
              placeholder="e.g. Don't forget sunscreen and packing the camera"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="glass-input rounded-2xl p-3 text-sm resize-none focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Date & Time"
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              required
            />

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-stone-600 dark:text-zinc-300">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as ReminderItem['priority'])}
                className="glass-input rounded-2xl p-2.5 text-sm focus:outline-none"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-stone-600 dark:text-zinc-300">
                Recurrence
              </label>
              <select
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value as ReminderItem['recurrence'])}
                className="glass-input rounded-2xl p-2.5 text-sm focus:outline-none"
              >
                <option value="none">Does not repeat</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>

            <div className="flex items-center gap-2 pt-6">
              <input
                type="checkbox"
                id="isShared"
                checked={isShared}
                onChange={(e) => setIsShared(e.target.checked)}
                className="w-4 h-4 rounded text-rose-500 focus:ring-rose-400"
              />
              <label htmlFor="isShared" className="text-xs font-semibold text-stone-700 dark:text-zinc-200">
                Share with Partner
              </label>
            </div>
          </div>

          <Button type="submit" className="w-full mt-2 py-3 rounded-2xl">
            Save Reminder
          </Button>
        </form>
      </Modal>
    </div>
  );
}
