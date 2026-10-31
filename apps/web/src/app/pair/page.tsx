'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Heart, QrCode, Copy, Check, Sparkles, ArrowRight, ShieldCheck, Calendar } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import confetti from 'canvas-confetti';

export default function PairPage() {
  const router = useRouter();
  const { user, space, pendingInvitation, createSpace, joinSpace, isLoading } = useAuthStore();

  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');
  const [spaceName, setSpaceName] = useState('Our Forever Sanctuary');
  const [anniversaryDate, setAnniversaryDate] = useState('2023-06-15');
  const [joinCode, setJoinCode] = useState('');
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [hasCopied, setHasCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    const res = await createSpace(spaceName, anniversaryDate);
    if (res.success && res.code) {
      setGeneratedCode(res.code);
      confetti({
        particleCount: 60,
        spread: 60,
        origin: { y: 0.6 },
      });
    } else {
      setErrorMsg(res.error || 'Failed to create space.');
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!joinCode.trim()) {
      setErrorMsg('Please enter the invitation code.');
      return;
    }
    const res = await joinSpace(joinCode.trim());
    if (res.success) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
      setTimeout(() => {
        router.replace('/dashboard');
      }, 1200);
    } else {
      setErrorMsg(res.error || 'Could not join space.');
    }
  };

  const handleCopyCode = () => {
    if (!generatedCode) return;
    navigator.clipboard.writeText(generatedCode);
    setHasCopied(true);
    setTimeout(() => setHasCopied(false), 2000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-rose-50 via-cream-50 to-purple-50 dark:from-[#0F0E13] dark:via-zinc-950 dark:to-purple-950/20">
      <div className="w-full max-w-lg rounded-3xl glass-panel p-8 shadow-2xl border border-rose-200/60 dark:border-purple-900/30">
        {/* Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 rounded-3xl bg-gradient-to-tr from-rose-500 via-pink-500 to-rose-400 flex items-center justify-center text-white shadow-lg shadow-rose-500/25 mb-3">
            <Heart className="w-7 h-7 fill-white" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-rose-600 to-pink-600 bg-clip-text text-transparent">
            Private Space Pairing
          </h1>
          <p className="text-xs text-stone-500 dark:text-zinc-400 mt-1 max-w-xs">
            A sacred encrypted space strictly for you and your partner.
          </p>
        </div>

        {/* Tab Switcher */}
        {!generatedCode && (
          <div className="flex rounded-2xl bg-rose-50/80 dark:bg-zinc-800/80 p-1 mb-6 border border-rose-200/40">
            <button
              onClick={() => {
                setActiveTab('create');
                setErrorMsg('');
              }}
              className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all ${
                activeTab === 'create'
                  ? 'bg-white dark:bg-zinc-700 text-rose-600 dark:text-rose-400 shadow-sm'
                  : 'text-stone-500 hover:text-stone-700'
              }`}
            >
              1. Create Private Space
            </button>
            <button
              onClick={() => {
                setActiveTab('join');
                setErrorMsg('');
              }}
              className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all ${
                activeTab === 'join'
                  ? 'bg-white dark:bg-zinc-700 text-rose-600 dark:text-rose-400 shadow-sm'
                  : 'text-stone-500 hover:text-stone-700'
              }`}
            >
              2. Join Partner&apos;s Space
            </button>
          </div>
        )}

        {/* Generated Code View */}
        {generatedCode ? (
          <div className="flex flex-col items-center gap-6 text-center animate-in fade-in zoom-in-95">
            <div className="p-4 rounded-3xl bg-white dark:bg-zinc-800 border-2 border-rose-400/40 shadow-xl flex flex-col items-center gap-3">
              <div className="w-48 h-48 rounded-2xl bg-gradient-to-br from-rose-100 to-pink-50 flex items-center justify-center p-3 border border-rose-200">
                <QrCode className="w-36 h-36 text-rose-600" />
              </div>
              <div className="w-full flex items-center justify-between px-4 py-2 rounded-xl bg-rose-50 dark:bg-zinc-700">
                <span className="font-mono text-xl font-extrabold tracking-widest text-rose-600 dark:text-rose-400">
                  {generatedCode}
                </span>
                <button
                  onClick={handleCopyCode}
                  className="p-1.5 rounded-lg hover:bg-rose-200/50 text-rose-600 transition-colors"
                  title="Copy code"
                >
                  {hasCopied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1 text-xs text-stone-500">
              <p className="font-semibold text-stone-800 dark:text-zinc-200">
                Share this invitation code or QR with your partner!
              </p>
              <p>Valid for 48 hours. Only one person can join.</p>
            </div>

            <Button
              onClick={() => router.replace('/dashboard')}
              className="w-full py-3 rounded-2xl"
            >
              Proceed to Dashboard
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        ) : activeTab === 'create' ? (
          /* Create Space Form */
          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            <Input
              label="Space Title"
              value={spaceName}
              onChange={(e) => setSpaceName(e.target.value)}
              placeholder="e.g. Our Sanctuary"
              required
            />

            <Input
              label="Anniversary / Relationship Start Date"
              type="date"
              value={anniversaryDate}
              onChange={(e) => setAnniversaryDate(e.target.value)}
              icon={<Calendar className="w-4 h-4" />}
            />

            <div className="p-3 rounded-2xl bg-rose-50/60 dark:bg-zinc-800/60 text-xs text-stone-600 dark:text-zinc-300 border border-rose-200/40 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-rose-500 shrink-0" />
              <span>
                Strict 2-person cryptographic ceiling: no third party will ever be allowed to join.
              </span>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-2xl bg-red-50 text-red-600 text-xs font-medium border border-red-200">
                {errorMsg}
              </div>
            )}

            <Button
              type="submit"
              isLoading={isLoading}
              className="w-full mt-2 py-3 rounded-2xl"
            >
              Generate Couple Invitation
              <Sparkles className="w-4 h-4 ml-2" />
            </Button>
          </form>
        ) : (
          /* Join Space Form */
          <form onSubmit={handleJoin} className="flex flex-col gap-4">
            <Input
              label="Partner's Invitation Code"
              placeholder="e.g. LOVE-ABCD"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              required
            />

            <div className="p-3 rounded-2xl bg-purple-50/60 dark:bg-zinc-800/60 text-xs text-stone-600 dark:text-zinc-300 border border-purple-200/40 flex items-center gap-2">
              <Heart className="w-4 h-4 text-purple-500 shrink-0" />
              <span>
                Enter the code your partner shared with you to connect your private space.
              </span>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-2xl bg-red-50 text-red-600 text-xs font-medium border border-red-200">
                {errorMsg}
              </div>
            )}

            <Button
              type="submit"
              isLoading={isLoading}
              className="w-full mt-2 py-3 rounded-2xl bg-gradient-to-r from-purple-500 to-indigo-500"
            >
              Connect with Partner
              <Heart className="w-4 h-4 ml-2 fill-white" />
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
