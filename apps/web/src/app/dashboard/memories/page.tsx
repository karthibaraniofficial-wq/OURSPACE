'use client';

import React, { useState } from 'react';
import {
  Heart,
  Sparkles,
  Calendar as CalendarIcon,
  Plus,
  Clock,
  Gift,
  Plane,
  Wine,
  Star,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { calculateDaysTogether, getCountdown } from '@ourspace/shared';
import confetti from 'canvas-confetti';

interface MilestoneEvent {
  id: string;
  title: string;
  date: string;
  type: 'anniversary' | 'birthday' | 'trip' | 'date_night' | 'milestone';
  notes?: string;
}

const INITIAL_EVENTS: MilestoneEvent[] = [
  {
    id: 'evt-1',
    title: 'Our 4th Anniversary',
    date: '2027-06-15',
    type: 'anniversary',
    notes: 'Four incredible years of unconditional love and adventures ❤️',
  },
  {
    id: 'evt-2',
    title: 'Jordan’s Birthday 🎂',
    date: '2026-12-14',
    type: 'birthday',
    notes: 'Surprise weekend staycation planned!',
  },
  {
    id: 'evt-3',
    title: 'Christmas Getaway Trip ❄️',
    date: '2026-12-24',
    type: 'trip',
    notes: 'Cabin in the mountains with a fireplace.',
  },
  {
    id: 'evt-4',
    title: 'First Date Anniversary',
    date: '2027-03-20',
    type: 'date_night',
    notes: 'Visiting that tiny coffee shop where we talked for 5 hours.',
  },
];

export default function MemoriesPage() {
  const { user, space, partner } = useAuthStore();
  const [events, setEvents] = useState<MilestoneEvent[]>(INITIAL_EVENTS);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // New Event Form State
  const [title, setTitle] = useState('');
  const [eventDate, setEventDate] = useState('2026-12-25');
  const [eventType, setEventType] = useState<MilestoneEvent['type']>('anniversary');
  const [notes, setNotes] = useState('');

  const daysTogether = calculateDaysTogether(space?.couple_started_at);
  const yearsTogether = (daysTogether / 365.25).toFixed(1);

  const handleCreateEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const newEvt: MilestoneEvent = {
      id: 'evt-' + Date.now(),
      title: title.trim(),
      date: eventDate,
      type: eventType,
      notes: notes.trim() || undefined,
    };

    setEvents([newEvt, ...events]);
    confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
    setIsModalOpen(false);

    setTitle('');
    setNotes('');
  };

  const getTypeIcon = (type: MilestoneEvent['type']) => {
    switch (type) {
      case 'anniversary':
        return <Heart className="w-5 h-5 text-rose-500 fill-rose-500" />;
      case 'birthday':
        return <Gift className="w-5 h-5 text-purple-500" />;
      case 'trip':
        return <Plane className="w-5 h-5 text-sky-500" />;
      case 'date_night':
        return <Wine className="w-5 h-5 text-amber-500" />;
      default:
        return <Star className="w-5 h-5 text-emerald-500" />;
    }
  };

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-6">
      {/* Hero Days Together Milestone Card */}
      <div className="rounded-3xl p-8 glass-panel border border-rose-200/50 bg-gradient-to-r from-rose-500 via-pink-500 to-rose-400 text-white shadow-xl shadow-rose-500/20 text-center relative overflow-hidden">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-bold uppercase tracking-wider mb-2">
          <Heart className="w-3.5 h-3.5 fill-white" />
          <span>Our Journey in Love</span>
        </span>

        <h2 className="text-5xl sm:text-6xl font-black tracking-tight my-2">
          {daysTogether}
        </h2>
        <p className="text-lg font-semibold text-white/90">
          Days of pure happiness and growth together
        </p>
        <p className="text-xs text-white/75 mt-1">
          Approximately {yearsTogether} years since your love story began on{' '}
          {space?.couple_started_at || 'June 15, 2023'}.
        </p>

        {/* Ambient background sparkle */}
        <div className="absolute -left-10 -bottom-10 opacity-15 pointer-events-none">
          <Sparkles className="w-48 h-48 fill-white" />
        </div>
      </div>

      {/* Header and Add Milestone Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-stone-900 dark:text-zinc-100 flex items-center gap-2">
            <span>Upcoming Milestones & Countdowns</span>
            <Sparkles className="w-5 h-5 text-rose-500" />
          </h3>
          <p className="text-xs text-stone-500 dark:text-zinc-400">
            Keep track of special dates, upcoming vacations, and anniversaries.
          </p>
        </div>

        <Button
          onClick={() => setIsModalOpen(true)}
          className="gap-2 text-xs py-2.5 rounded-full shadow-rose-500/20"
        >
          <Plus className="w-4 h-4" />
          <span>Add Special Date</span>
        </Button>
      </div>

      {/* Milestones Countdowns Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {events.map((evt) => {
          const countdown = getCountdown(evt.date);
          return (
            <div
              key={evt.id}
              className="p-5 rounded-3xl glass-panel border border-rose-200/50 hover:shadow-lg transition-all flex flex-col justify-between"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-zinc-800 flex items-center justify-center shadow-sm">
                    {getTypeIcon(evt.type)}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-stone-900 dark:text-zinc-100">
                      {evt.title}
                    </h4>
                    <p className="text-xs text-stone-400 mt-0.5">
                      {new Date(evt.date).toLocaleDateString([], {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                </div>

                {/* Days Badge */}
                <div className="text-right">
                  <span className="text-2xl font-black text-rose-600 dark:text-rose-400">
                    {countdown.days}
                  </span>
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-stone-400">
                    Days left
                  </span>
                </div>
              </div>

              {evt.notes && (
                <p className="text-xs text-stone-600 dark:text-zinc-300 mt-3 pt-3 border-t border-rose-100/60 dark:border-zinc-800">
                  {evt.notes}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Shared Interactive Calendar Widget */}
      <div className="p-6 rounded-3xl glass-panel border border-rose-200/50 flex flex-col gap-4">
        <div className="flex items-center justify-between pb-3 border-b border-rose-100/60 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-rose-500" />
            <h4 className="text-base font-bold text-stone-900 dark:text-zinc-100">
              Shared Couple Calendar
            </h4>
          </div>
          <span className="text-xs font-semibold text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-3 py-1 rounded-full">
            November 2026
          </span>
        </div>

        {/* Calendar Grid Representation */}
        <div className="grid grid-cols-7 gap-2 text-center text-xs">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <span key={day} className="font-bold text-stone-400 py-1">
              {day}
            </span>
          ))}

          {/* Days */}
          {Array.from({ length: 30 }).map((_, i) => {
            const dayNum = i + 1;
            const isMilestone = dayNum === 2 || dayNum === 8 || dayNum === 15;
            return (
              <div
                key={dayNum}
                className={`py-3 px-1 rounded-2xl flex flex-col items-center justify-center transition-all ${
                  isMilestone
                    ? 'bg-rose-500 text-white font-extrabold shadow-md shadow-rose-500/25 scale-105'
                    : 'glass-card hover:bg-rose-50 dark:hover:bg-zinc-800 text-stone-700 dark:text-zinc-200'
                }`}
              >
                <span>{dayNum}</span>
                {isMilestone && <Heart className="w-2.5 h-2.5 fill-white mt-0.5" />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Add Special Date Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add Special Date or Countdown"
        description="Celebrate your milestones, anniversaries, and holidays together"
      >
        <form onSubmit={handleCreateEvent} className="flex flex-col gap-4">
          <Input
            label="Milestone Title"
            placeholder="e.g. Weekend Trip to Kyoto 🌸"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Event Date"
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              required
            />

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-stone-600 dark:text-zinc-300">
                Milestone Type
              </label>
              <select
                value={eventType}
                onChange={(e) => setEventType(e.target.value as MilestoneEvent['type'])}
                className="glass-input rounded-2xl p-2.5 text-sm focus:outline-none"
              >
                <option value="anniversary">Anniversary ❤️</option>
                <option value="birthday">Birthday 🎂</option>
                <option value="trip">Vacation / Trip ✈️</option>
                <option value="date_night">Date Night 🍷</option>
                <option value="milestone">Personal Milestone ⭐</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-stone-600 dark:text-zinc-300">
              Personal Notes
            </label>
            <textarea
              placeholder="What makes this date extra special?"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="glass-input rounded-2xl p-3 text-sm resize-none focus:outline-none"
            />
          </div>

          <Button type="submit" className="w-full mt-2 py-3 rounded-2xl">
            Save Milestone Countdown
          </Button>
        </form>
      </Modal>
    </div>
  );
}
