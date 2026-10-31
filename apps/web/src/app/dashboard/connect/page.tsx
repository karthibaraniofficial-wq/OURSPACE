'use client';

import React, { useState, useEffect } from 'react';
import {
  Heart,
  Smile,
  Sparkles,
  MessageCircle,
  BookOpen,
  Calendar,
  Send,
  Plus,
  Lock,
  Mail,
  ShieldAlert,
  MapPin,
  Check,
  Star,
  Quote,
  Lightbulb,
  Compass,
} from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import type { MoodType, DailyCoupleQuestion, LoveNote, ScheduledRomanticLetter } from '@ourspace/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/utils';
import confetti from 'canvas-confetti';

const MOODS: { type: MoodType; label: string; emoji: string; color: string }[] = [
  { type: 'loving', label: 'Loving', emoji: '🥰', color: 'bg-rose-100 text-rose-700 border-rose-300' },
  { type: 'joyful', label: 'Joyful', emoji: '✨', color: 'bg-amber-100 text-amber-700 border-amber-300' },
  { type: 'cozy', label: 'Cozy', emoji: '☕', color: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
  { type: 'excited', label: 'Excited', emoji: '🎉', color: 'bg-purple-100 text-purple-700 border-purple-300' },
  { type: 'tired', label: 'Tired', emoji: '😴', color: 'bg-blue-100 text-blue-700 border-blue-300' },
  { type: 'stressed', label: 'Stressed', emoji: '🥺', color: 'bg-stone-100 text-stone-700 border-stone-300' },
];

const CURATED_QUESTIONS = [
  'What was the moment you first knew you had special feelings for me?',
  'What is your favorite memory of us from this past month?',
  'If we could pack our bags tonight and travel anywhere, where would we wake up?',
  'What small everyday thing do I do that makes you smile secretly?',
  'What is one dream you want us to accomplish together in the next year?',
  'What song reminds you of us every time it plays?',
];

const CONVERSATION_STARTERS = [
  'If we had a whole weekend with no phones or plans, how would we spend it?',
  'What is something you learned about yourself since being together?',
  'What is the kindest thing anyone has ever said to you?',
  'Which fictional couple reminds you the most of our dynamic?',
  'What is one place in our town that will always belong to us?',
];

export default function ConnectHubPage() {
  const { user, space, partner } = useAuthStore();

  // Active Tab
  const [activeTab, setActiveTab] = useState<'daily' | 'notes' | 'letters' | 'journal' | 'safety'>('daily');

  // Daily Mood Tracker
  const [myMood, setMyMood] = useState<MoodType>('loving');
  const [moodNote, setMoodNote] = useState('');
  const [hasSharedMood, setHasSharedMood] = useState(false);

  // Daily Couple Question
  const [todaysQuestionIdx, setTodaysQuestionIdx] = useState(0);
  const [myAnswer, setMyAnswer] = useState('');
  const [answersSubmitted, setAnswersSubmitted] = useState<Record<string, string>>({});

  // Love Notes
  const [loveNotes, setLoveNotes] = useState<{ id: string; sender: string; text: string; date: string; color: string }[]>([]);
  const [newNoteText, setNewNoteText] = useState('');
  const [noteColor, setNoteColor] = useState('bg-rose-100 text-rose-900 border-rose-300');

  // Romantic Letters
  const [letters, setLetters] = useState<{ id: string; title: string; text: string; unlockDate: string; isUnlocked: boolean }[]>([]);
  const [isLetterModalOpen, setIsLetterModalOpen] = useState(false);
  const [letterTitle, setLetterTitle] = useState('');
  const [letterBody, setLetterBody] = useState('');
  const [letterUnlockDate, setLetterUnlockDate] = useState('2026-12-31');

  // Safety & Emergency Check-in
  const [safeStatusSent, setSafeStatusSent] = useState(false);
  const [locationSharingActive, setLocationSharingActive] = useState(false);

  useEffect(() => {
    // Select daily question based on day of year
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
    setTodaysQuestionIdx(dayOfYear % CURATED_QUESTIONS.length);

    // Load local stored notes if any
    const savedNotes = localStorage.getItem('ourspace_love_notes');
    if (savedNotes) {
      try {
        setLoveNotes(JSON.parse(savedNotes));
      } catch {}
    }
  }, []);

  const handleShareMood = () => {
    setHasSharedMood(true);
    confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
  };

  const handleSubmitAnswer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!myAnswer.trim()) return;
    setAnswersSubmitted((prev) => ({
      ...prev,
      [user?.id || 'me']: myAnswer.trim(),
    }));
    confetti({ particleCount: 40, spread: 50, origin: { y: 0.7 } });
  };

  const handleSendLoveNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim()) return;

    const note = {
      id: 'note-' + Date.now(),
      sender: user?.display_name || 'My Love',
      text: newNoteText.trim(),
      date: new Date().toLocaleDateString(),
      color: noteColor,
    };

    const updated = [note, ...loveNotes];
    setLoveNotes(updated);
    localStorage.setItem('ourspace_love_notes', JSON.stringify(updated));
    setNewNoteText('');
    confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
  };

  const handleCreateLetter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!letterTitle.trim() || !letterBody.trim()) return;

    const isUnlocked = new Date(letterUnlockDate).getTime() <= Date.now();
    const newL = {
      id: 'let-' + Date.now(),
      title: letterTitle.trim(),
      text: letterBody.trim(),
      unlockDate: letterUnlockDate,
      isUnlocked,
    };

    setLetters([newL, ...letters]);
    setLetterTitle('');
    setLetterBody('');
    setIsLetterModalOpen(false);
  };

  const handleSendSafeCheckIn = () => {
    setSafeStatusSent(true);
    setTimeout(() => setSafeStatusSent(false), 5000);
  };

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-6">
      {/* Hero Connection Header */}
      <div className="p-6 rounded-3xl glass-card border border-rose-200/60 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-rose-50/70 via-pink-50/50 to-purple-50/50 dark:from-rose-950/20 dark:to-purple-950/20">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-100 text-rose-700 text-xs font-semibold">
            <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />
            <span>Relationship & Connection Hub</span>
          </span>
          <h2 className="text-2xl font-extrabold text-stone-900 dark:text-zinc-100 mt-1">
            COUPLE CONNECTION
          </h2>
          <p className="text-xs text-stone-500 dark:text-zinc-400">
            Daily emotional check-ins, intimacy questions, love notes, letters, and gratitude.
          </p>
        </div>

        {/* Quick Emergency Safe Check-in */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleSendSafeCheckIn}
            className="px-4 py-2 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow-md shadow-emerald-500/20 active:scale-95 transition-all flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            <span>{safeStatusSent ? 'Check-in Sent! ❤️' : 'Quick Safe Check-in'}</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {[
          { id: 'daily', label: 'Daily Intimacy & Moods', icon: Smile },
          { id: 'notes', label: 'Virtual Love Notes', icon: Heart },
          { id: 'letters', label: 'Time-Locked Letters', icon: Mail },
          { id: 'safety', label: 'Safety & Location Sharing', icon: ShieldAlert },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all shrink-0',
                isActive
                  ? 'bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-md'
                  : 'glass-card hover:bg-rose-50 text-stone-600 dark:text-zinc-300'
              )}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ========================================================================
          TAB 1: DAILY INTIMACY & MOOD TRACKER
          ======================================================================== */}
      {activeTab === 'daily' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Daily Mood Check-in Card */}
          <div className="p-6 rounded-3xl glass-panel border border-rose-200/50 flex flex-col gap-4">
            <div className="flex items-center justify-between pb-2 border-b border-rose-100/60 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <Smile className="w-5 h-5 text-rose-500" />
                <h3 className="text-base font-bold text-stone-900 dark:text-zinc-100">
                  Daily Emotional Check-in
                </h3>
              </div>
              <span className="text-[10px] text-stone-400 font-semibold">Today</span>
            </div>

            <p className="text-xs text-stone-500 dark:text-zinc-400">
              How are you feeling right now? Your partner will see your mood indicator.
            </p>

            <div className="grid grid-cols-3 gap-2">
              {MOODS.map((m) => {
                const isSelected = myMood === m.type;
                return (
                  <button
                    key={m.type}
                    onClick={() => {
                      setMyMood(m.type);
                      setHasSharedMood(false);
                    }}
                    className={cn(
                      'flex flex-col items-center justify-center p-3 rounded-2xl border transition-all',
                      isSelected
                        ? `${m.color} ring-2 ring-rose-400/50 shadow-sm scale-105 font-bold`
                        : 'glass-card hover:bg-rose-50/50 text-stone-600'
                    )}
                  >
                    <span className="text-2xl mb-1">{m.emoji}</span>
                    <span className="text-xs">{m.label}</span>
                  </button>
                );
              })}
            </div>

            <Input
              placeholder="Add a sweet note or why you feel this way..."
              value={moodNote}
              onChange={(e) => setMoodNote(e.target.value)}
            />

            <Button
              variant="primary"
              size="sm"
              onClick={handleShareMood}
              className="w-full"
            >
              {hasSharedMood ? 'Mood Shared with Partner! ✨' : 'Share Mood with Partner'}
            </Button>
          </div>

          {/* Daily Couple Question Card */}
          <div className="p-6 rounded-3xl glass-panel border border-rose-200/50 flex flex-col justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 pb-2 border-b border-rose-100/60 dark:border-zinc-800">
                <Sparkles className="w-5 h-5 text-amber-500" />
                <h3 className="text-base font-bold text-stone-900 dark:text-zinc-100">
                  Daily Question of the Day
                </h3>
              </div>

              <div className="my-4 p-4 rounded-2xl bg-gradient-to-tr from-rose-50 to-pink-50 dark:from-rose-950/30 dark:to-purple-950/30 border border-rose-200/60">
                <Quote className="w-6 h-6 text-rose-400 mb-2" />
                <p className="text-sm font-bold text-stone-800 dark:text-zinc-100 leading-relaxed">
                  &ldquo;{CURATED_QUESTIONS[todaysQuestionIdx]}&rdquo;
                </p>
              </div>

              {answersSubmitted[user?.id || 'me'] ? (
                <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 text-xs text-emerald-800 dark:text-emerald-200 flex flex-col gap-1">
                  <span className="font-bold">Your Answer:</span>
                  <p className="italic">{answersSubmitted[user?.id || 'me']}</p>
                </div>
              ) : (
                <form onSubmit={handleSubmitAnswer} className="flex flex-col gap-3">
                  <textarea
                    rows={3}
                    value={myAnswer}
                    onChange={(e) => setMyAnswer(e.target.value)}
                    placeholder="Write your honest, loving answer..."
                    className="w-full rounded-2xl glass-input p-3 text-xs text-stone-800 dark:text-zinc-100 focus:outline-none"
                    required
                  />
                  <Button variant="primary" size="sm" type="submit">
                    Submit Answer
                  </Button>
                </form>
              )}
            </div>

            {/* Conversation Starter Helper */}
            <div className="p-3.5 rounded-2xl glass-card border border-rose-200/40 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-amber-500 shrink-0" />
                <span className="text-stone-600 dark:text-zinc-300 font-medium truncate">
                  {CONVERSATION_STARTERS[todaysQuestionIdx % CONVERSATION_STARTERS.length]}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================
          TAB 2: VIRTUAL LOVE NOTES
          ======================================================================== */}
      {activeTab === 'notes' && (
        <div className="flex flex-col gap-6">
          {/* Note Composer */}
          <div className="p-6 rounded-3xl glass-panel border border-rose-200/50">
            <h3 className="text-base font-bold text-stone-900 dark:text-zinc-100 mb-1">
              Leave a Cute Love Sticky Note
            </h3>
            <p className="text-xs text-stone-500 mb-4">
              Write a sweet message that will stay posted on your shared sanctuary board.
            </p>

            <form onSubmit={handleSendLoveNote} className="flex flex-col gap-3">
              <textarea
                rows={2}
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
                placeholder="I love you because... or Just wanted to remind you..."
                className="w-full rounded-2xl glass-input p-3 text-xs text-stone-800 dark:text-zinc-100 focus:outline-none"
                required
              />

              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-stone-500">Color:</span>
                  {[
                    'bg-rose-100 text-rose-900 border-rose-300',
                    'bg-amber-100 text-amber-900 border-amber-300',
                    'bg-purple-100 text-purple-900 border-purple-300',
                    'bg-emerald-100 text-emerald-900 border-emerald-300',
                  ].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNoteColor(c)}
                      className={cn(
                        'w-5 h-5 rounded-full border shadow-sm transition-transform',
                        c.split(' ')[0],
                        noteColor === c && 'scale-125 ring-2 ring-rose-400'
                      )}
                    />
                  ))}
                </div>

                <Button variant="primary" size="sm" type="submit">
                  <Heart className="w-3.5 h-3.5 mr-1 fill-white" /> Post Love Note
                </Button>
              </div>
            </form>
          </div>

          {/* Notes Corkboard */}
          {loveNotes.length === 0 ? (
            <div className="p-16 text-center rounded-3xl glass-card border border-rose-200/50 flex flex-col items-center justify-center">
              <Heart className="w-10 h-10 text-rose-300 mb-2" />
              <h4 className="text-sm font-bold text-stone-800 dark:text-zinc-200">
                No love notes posted yet
              </h4>
              <p className="text-xs text-stone-400 max-w-xs mt-1">
                Post your first romantic sticky note above to surprise your partner.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {loveNotes.map((note) => (
                <div
                  key={note.id}
                  className={cn(
                    'p-5 rounded-3xl border shadow-sm hover:shadow-md transition-shadow relative transform -rotate-1 hover:rotate-0 transition-transform duration-200',
                    note.color
                  )}
                >
                  <div className="flex items-center justify-between text-[10px] font-bold opacity-75 mb-2">
                    <span>{note.sender}</span>
                    <span>{note.date}</span>
                  </div>
                  <p className="text-xs leading-relaxed whitespace-pre-wrap font-medium">
                    {note.text}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================
          TAB 3: TIME-LOCKED LETTERS
          ======================================================================== */}
      {activeTab === 'letters' && (
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-stone-900 dark:text-zinc-100">
                Scheduled Romantic Letters
              </h3>
              <p className="text-xs text-stone-500">
                Write heartfelt letters that remain locked until a future anniversary or milestone date.
              </p>
            </div>

            <Button variant="primary" size="sm" onClick={() => setIsLetterModalOpen(true)}>
              <Plus className="w-4 h-4 mr-1" /> Write Future Letter
            </Button>
          </div>

          {letters.length === 0 ? (
            <div className="p-16 text-center rounded-3xl glass-card border border-rose-200/50 flex flex-col items-center justify-center">
              <Mail className="w-10 h-10 text-rose-300 mb-2" />
              <h4 className="text-sm font-bold text-stone-800 dark:text-zinc-200">
                No scheduled letters yet
              </h4>
              <p className="text-xs text-stone-400 max-w-xs mt-1">
                Write a letter for &ldquo;Open on our next anniversary&rdquo; or &ldquo;Open when you miss me&rdquo;.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {letters.map((letObj) => (
                <div
                  key={letObj.id}
                  className="p-5 rounded-3xl glass-card border border-rose-200/60 shadow-sm flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-bold text-stone-900 dark:text-zinc-100">
                      {letObj.title}
                    </h4>
                    {letObj.isUnlocked ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                        Unlocked
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Locks until {new Date(letObj.unlockDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  {letObj.isUnlocked ? (
                    <p className="text-xs text-stone-600 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed mt-2">
                      {letObj.text}
                    </p>
                  ) : (
                    <div className="py-6 text-center text-xs text-stone-400 flex flex-col items-center justify-center bg-black/5 dark:bg-white/5 rounded-2xl mt-2">
                      <Lock className="w-6 h-6 text-rose-400 mb-1" />
                      <span>This letter is sealed until {letObj.unlockDate}.</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* New Letter Modal */}
          <Modal
            isOpen={isLetterModalOpen}
            onClose={() => setIsLetterModalOpen(false)}
            title="Write Time-Locked Letter"
          >
            <form onSubmit={handleCreateLetter} className="flex flex-col gap-4 text-xs">
              <Input
                label="Letter Title"
                placeholder="e.g. Open on Our 5th Anniversary, Open When Feeling Down"
                value={letterTitle}
                onChange={(e) => setLetterTitle(e.target.value)}
                required
                autoFocus
              />

              <Input
                label="Unlock Date"
                type="date"
                value={letterUnlockDate}
                onChange={(e) => setLetterUnlockDate(e.target.value)}
                required
              />

              <div>
                <label className="block font-semibold mb-1 text-stone-700 dark:text-zinc-200">
                  Letter Message
                </label>
                <textarea
                  rows={5}
                  value={letterBody}
                  onChange={(e) => setLetterBody(e.target.value)}
                  placeholder="Pour your heart out into this letter..."
                  className="w-full rounded-2xl glass-input p-3 text-xs text-stone-800 dark:text-zinc-100 focus:outline-none"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button variant="ghost" type="button" onClick={() => setIsLetterModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit">
                  Seal Letter
                </Button>
              </div>
            </form>
          </Modal>
        </div>
      )}

      {/* ========================================================================
          TAB 4: SAFETY & LOCATION SHARING
          ======================================================================== */}
      {activeTab === 'safety' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Temporary Consent Location Sharing Card */}
          <div className="p-6 rounded-3xl glass-panel border border-rose-200/50 flex flex-col gap-4">
            <div className="flex items-center gap-2 pb-2 border-b border-rose-100/60 dark:border-zinc-800">
              <MapPin className="w-5 h-5 text-rose-500" />
              <h3 className="text-base font-bold text-stone-900 dark:text-zinc-100">
                Consent-Based Live Location
              </h3>
            </div>

            <p className="text-xs text-stone-500 dark:text-zinc-400">
              Strict privacy rule: Live location is 100% opt-in, visible, time-limited, and instantly revocable. Never tracked silently.
            </p>

            <div className="p-4 rounded-2xl glass-card border border-rose-200/60 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-stone-800 dark:text-zinc-100">
                  {locationSharingActive ? 'Active: Sharing for 60 mins' : 'Sharing is currently OFF'}
                </p>
                <p className="text-[10px] text-stone-400">
                  {locationSharingActive ? 'Partner can see your vicinity pin' : 'Your coordinates are private'}
                </p>
              </div>

              <Button
                variant={locationSharingActive ? 'danger' : 'primary'}
                size="sm"
                onClick={() => setLocationSharingActive(!locationSharingActive)}
              >
                {locationSharingActive ? 'Stop Sharing' : 'Share for 1 Hour'}
              </Button>
            </div>
          </div>

          {/* Emergency Contact Card */}
          <div className="p-6 rounded-3xl glass-panel border border-rose-200/50 flex flex-col gap-4">
            <div className="flex items-center gap-2 pb-2 border-b border-rose-100/60 dark:border-zinc-800">
              <ShieldAlert className="w-5 h-5 text-rose-500" />
              <h3 className="text-base font-bold text-stone-900 dark:text-zinc-100">
                Shared Emergency Contact
              </h3>
            </div>

            <p className="text-xs text-stone-500 dark:text-zinc-400">
              Trusted emergency contact available at all times to both partners.
            </p>

            <div className="p-4 rounded-2xl glass-card border border-rose-200/60 flex flex-col gap-1.5 text-xs">
              <span className="font-bold text-stone-800 dark:text-zinc-100">Primary Contact</span>
              <p className="text-stone-600 dark:text-zinc-300">Name: Immediate Family / Guardian</p>
              <p className="text-stone-600 dark:text-zinc-300 font-mono">Emergency Phone: +1 (555) 019-2831</p>
              <p className="text-[10px] text-stone-400 mt-1">Medical notes: No known severe allergies.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
