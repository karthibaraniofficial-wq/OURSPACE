'use client';

import React from 'react';
import Link from 'next/link';
import {
  Heart,
  Phone,
  Video,
  MessageCircleHeart,
  Sparkles,
  Calendar,
  Clock,
  ArrowRight,
  Radio,
  Image as ImageIcon,
  CheckCircle2,
} from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { useChatStore } from '@/store/useChatStore';
import { useCallStore } from '@/store/useCallStore';
import { calculateDaysTogether, getCountdown, formatChatTimestamp, isUserOnline, formatPresenceStatus } from '@ourspace/shared';
import { subscribeToFirestoreReminders } from '@/lib/firebase/firestore';
import type { Reminder } from '@ourspace/types';
import { Button } from '@/components/ui/Button';


export default function DashboardPage() {
  const { user, space, partner } = useAuthStore();
  const { messages } = useChatStore();
  const { initiateCall } = useCallStore();

  const [reminders, setReminders] = React.useState<Reminder[]>([]);

  React.useEffect(() => {
    if (!space?.id) return;
    const unsub = subscribeToFirestoreReminders(space.id, (list) => {
      setReminders(list);
    });
    return () => unsub();
  }, [space?.id]);

  const upcomingReminders = reminders
    .filter((r) => !r.is_completed && new Date(r.due_date).getTime() > Date.now())
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
  const nextEvent = upcomingReminders[0];
  const nextEventCountdown = nextEvent ? getCountdown(nextEvent.due_date) : null;

  const isPartnerOnline = React.useMemo(() => {
    return isUserOnline(partner?.last_seen_at || partner?.updated_at, partner?.is_online);
  }, [partner?.last_seen_at, partner?.updated_at, partner?.is_online]);


  const daysTogether = calculateDaysTogether(space?.couple_started_at);

  const recentMessages = messages.slice(-3);
  const recentPhotos = messages
    .flatMap((m) => m.attachments || [])
    .filter((a) => a.media_category === 'image')
    .slice(-4);

  const handleStartCall = (type: 'audio' | 'video') => {
    if (!space || !user || !partner) return;
    initiateCall({
      spaceId: space.id,
      caller: user,
      receiver: partner,
      type,
    });
  };

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-6">
      {/* Hero Welcome Card */}
      <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8 bg-gradient-to-r from-rose-500 via-pink-500 to-purple-600 text-white shadow-xl shadow-rose-500/20">
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex flex-col gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-semibold w-fit">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Private Sanctuary</span>
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Welcome back, {user?.display_name || 'My Love'}
            </h2>
            <p className="text-sm text-white/90 max-w-md">
              {partner
                ? `You and ${partner.display_name} have been building beautiful memories together.`
                : 'Share your invitation link to connect with your partner.'}
            </p>
          </div>

          {/* Quick Call Actions */}
          {partner && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleStartCall('audio')}
                className="px-4 py-3 rounded-2xl bg-white/15 hover:bg-white/25 backdrop-blur-md text-white font-semibold text-xs flex items-center gap-2 transition-all hover:scale-105 active:scale-95 border border-white/20"
              >
                <Phone className="w-4 h-4 fill-white/20" />
                <span>Call {partner.display_name}</span>
              </button>
              <button
                onClick={() => handleStartCall('video')}
                className="px-4 py-3 rounded-2xl bg-white text-rose-600 font-bold text-xs flex items-center gap-2 shadow-lg hover:brightness-105 active:scale-95 transition-all hover:scale-105"
              >
                <Video className="w-4 h-4" />
                <span>Video Call</span>
              </button>
            </div>
          )}
        </div>

        {/* Ambient floating heart illustration */}
        <div className="absolute -right-8 -bottom-10 opacity-15 pointer-events-none">
          <Heart className="w-64 h-64 fill-white" />
        </div>
      </div>

      {/* Top 3 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {/* Partner Status Card */}
        <div className="rounded-3xl glass-panel p-5 border border-rose-200/50 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">
              Partner Status
            </span>
            {isPartnerOnline ? (
              <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/60">
                <Radio className="w-2.5 h-2.5 animate-pulse" />
                Active now
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-[11px] text-stone-500 dark:text-zinc-400 font-medium bg-stone-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full border border-stone-200/60 dark:border-zinc-700">
                <span className="w-1.5 h-1.5 rounded-full bg-stone-400 dark:bg-zinc-500" />
                {partner
                  ? formatPresenceStatus(partner.last_seen_at || partner.updated_at, partner.is_online).label
                  : 'Not paired'}
              </span>
            )}
          </div>

          {partner ? (
            <div className="flex items-center gap-3">
              {partner.avatar_url ? (
                <img
                  key={partner.avatar_url}
                  src={partner.avatar_url}
                  alt={partner.display_name}
                  className="w-12 h-12 rounded-2xl object-cover ring-2 ring-rose-400"
                />
              ) : (
                <div className="w-12 h-12 rounded-2xl bg-rose-200 text-rose-700 font-bold flex items-center justify-center">
                  {partner.display_name.charAt(0)}
                </div>
              )}
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-stone-800 dark:text-zinc-100 truncate">
                  {partner.display_name}
                </h4>
                <p className="text-xs text-stone-500 truncate mt-0.5 flex items-center gap-1">
                  {partner.status_emoji && <span>{partner.status_emoji}</span>}
                  <span className="truncate">&ldquo;{partner.status_message || 'In our sanctuary'}&rdquo;</span>
                </p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-stone-400">Share your invite code to link accounts.</p>
          )}


          <div className="mt-4 pt-3 border-t border-rose-100/60 dark:border-zinc-800 flex justify-end">
            <Link
              href="/dashboard/chat"
              className="text-xs font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1"
            >
              <span>Open Chat</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Days Together Card */}
        <div className="rounded-3xl glass-panel p-5 border border-rose-200/50 flex flex-col justify-between bg-gradient-to-br from-rose-50/50 to-pink-50/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-rose-500 uppercase tracking-wider">
              Days Together
            </span>
            <Heart className="w-4 h-4 fill-rose-500 text-rose-500 animate-pulse" />
          </div>

          <div>
            <p className="text-3xl font-black text-stone-900 dark:text-zinc-100 tracking-tight">
              {daysTogether}{' '}
              <span className="text-sm font-semibold text-rose-500">Days</span>
            </p>
            <p className="text-xs text-stone-500 mt-1">
              {space?.couple_started_at
                ? `Since ${new Date(space.couple_started_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
                : 'Configure anniversary in settings'}
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-rose-100/60 dark:border-zinc-800 flex justify-end">
            <Link
              href="/dashboard/memories"
              className="text-xs font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1"
            >
              <span>View Milestones</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Next Milestone Countdown */}
        <div className="rounded-3xl glass-panel p-5 border border-rose-200/50 flex flex-col justify-between bg-gradient-to-br from-purple-50/50 to-indigo-50/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-purple-600 uppercase tracking-wider">
              Next Celebration
            </span>
            <Calendar className="w-4 h-4 text-purple-600" />
          </div>

          <div>
            {nextEvent ? (
              <>
                <h4 className="text-sm font-bold text-stone-800 dark:text-zinc-100 truncate">
                  {nextEvent.title}
                </h4>
                <p className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1">
                  {nextEventCountdown?.days ?? 0}{' '}
                  <span className="text-xs font-semibold text-stone-500">days left</span>
                </p>
              </>
            ) : (
              <>
                <h4 className="text-sm font-bold text-stone-800 dark:text-zinc-100">
                  Shared Celebrations
                </h4>
                <p className="text-xs text-stone-500 dark:text-zinc-400 mt-1">
                  Plan your next special couple milestone
                </p>
              </>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-purple-100/60 dark:border-zinc-800 flex justify-end">
            <Link
              href="/dashboard/reminders"
              className="text-xs font-bold text-purple-600 hover:text-purple-700 flex items-center gap-1"
            >
              <span>{nextEvent ? 'Open Calendar' : 'Add Milestone'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Main Grid: Recent Chat Activity & Gallery Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Messages Card (2 Cols) */}
        <div className="lg:col-span-2 rounded-3xl glass-panel p-6 border border-rose-200/50 flex flex-col justify-between">
          <div className="flex items-center justify-between pb-4 border-b border-rose-100/60 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <MessageCircleHeart className="w-5 h-5 text-rose-500" />
              <h3 className="text-base font-bold text-stone-800 dark:text-zinc-100">
                Recent Conversations
              </h3>
            </div>
            <Link
              href="/dashboard/chat"
              className="text-xs font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1"
            >
              <span>Open Full Chat</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Messages Snippets */}
          <div className="flex flex-col gap-3 py-4">
            {recentMessages.map((msg) => {
              const isSender = msg.sender_id === user?.id;
              return (
                <div
                  key={msg.id}
                  className="flex items-start justify-between p-3 rounded-2xl glass-card hover:bg-rose-50/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                        isSender ? 'bg-rose-500 text-white' : 'bg-purple-100 text-purple-700'
                      }`}
                    >
                      {isSender ? 'You' : partner?.display_name?.charAt(0) || 'P'}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-stone-800 dark:text-zinc-100">
                        {isSender ? 'You' : partner?.display_name}
                      </p>
                      <p className="text-xs text-stone-500 truncate max-w-sm">
                        {msg.content || (msg.attachments?.length ? '📷 Photo attachment' : 'Message')}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] text-stone-400 whitespace-nowrap">
                    {formatChatTimestamp(msg.created_at)}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="pt-2">
            <Link href="/dashboard/chat">
              <Button className="w-full py-2.5 text-xs rounded-2xl">
                Send a Loving Message to {partner?.display_name || 'Partner'}
                <MessageCircleHeart className="w-4 h-4 ml-1.5" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Recent Shared Photos (1 Col) */}
        <div className="rounded-3xl glass-panel p-6 border border-rose-200/50 flex flex-col justify-between">
          <div className="flex items-center justify-between pb-4 border-b border-rose-100/60 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-rose-500" />
              <h3 className="text-base font-bold text-stone-800 dark:text-zinc-100">
                Shared Moments
              </h3>
            </div>
            <Link
              href="/dashboard/gallery"
              className="text-xs font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1"
            >
              <span>Gallery</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Photos Grid */}
          <div className="grid grid-cols-2 gap-2.5 py-4">
            <img
              src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&auto=format&fit=crop&q=80"
              alt="Beach sunrise"
              className="w-full h-24 object-cover rounded-2xl hover:scale-105 transition-transform cursor-pointer"
            />
            <img
              src="https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=600&auto=format&fit=crop&q=80"
              alt="Romantic sunset"
              className="w-full h-24 object-cover rounded-2xl hover:scale-105 transition-transform cursor-pointer"
            />
            <img
              src="https://images.unsplash.com/photo-1529636798458-92182e662485?w=600&auto=format&fit=crop&q=80"
              alt="Coffee date"
              className="w-full h-24 object-cover rounded-2xl hover:scale-105 transition-transform cursor-pointer"
            />
            <img
              src="https://images.unsplash.com/photo-1494774157365-9e04c6720e47?w=600&auto=format&fit=crop&q=80"
              alt="Stargazing"
              className="w-full h-24 object-cover rounded-2xl hover:scale-105 transition-transform cursor-pointer"
            />
          </div>

          <div className="pt-2">
            <Link href="/dashboard/gallery">
              <Button variant="secondary" className="w-full py-2 text-xs rounded-2xl border-rose-200">
                View All Photographs
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
