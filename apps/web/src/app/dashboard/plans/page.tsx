'use client';

import React, { useState } from 'react';
import {
  Compass,
  CheckSquare,
  Sparkles,
  Plane,
  Gift,
  DollarSign,
  Plus,
  Trash2,
  Calendar,
  Shuffle,
  ShoppingBag,
  Target,
  Check,
} from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/utils';
import confetti from 'canvas-confetti';

const DATE_IDEAS = [
  { title: 'Candlelit Stargazing & Hot Cocoa', category: 'Romantic', budget: '$10 - Cozy' },
  { title: 'Homemade Pasta & Wine Tasting Night', category: 'Foodie', budget: '$35 - Fun' },
  { title: 'Sunset Drive to Scenic Lookout Point', category: 'Adventurous', budget: '$15 - Gas' },
  { title: 'Living Room Blanket Fort & Classic Movie Marathon', category: 'Cozy', budget: '$5 - Popcorn' },
  { title: 'Visit Local Farmers Market & Cook Lunch Together', category: 'Foodie', budget: '$25 - Fresh' },
  { title: 'Paint & Sip Evening at Home with Mini Canvases', category: 'Creative', budget: '$20 - Supplies' },
  { title: 'Arcade & Mini-Golf Friendly Competition', category: 'Adventurous', budget: '$30 - Fun' },
  { title: 'Early Morning Sunrise Walk & Bakery Pastries', category: 'Romantic', budget: '$12 - Sweet' },
];

export default function PlansHubPage() {
  const { user, space } = useAuthStore();

  const [activeTab, setActiveTab] = useState<'bucket' | 'date_ideas' | 'travel' | 'shopping' | 'goals' | 'expenses'>('bucket');

  // 1. Bucket List State
  const [bucketItems, setBucketItems] = useState<{ id: string; title: string; category: string; done: boolean }[]>([
    { id: 'b1', title: 'See the Northern Lights in Norway together', category: 'Travel', done: false },
    { id: 'b2', title: 'Learn to cook traditional paella from scratch', category: 'Food', done: true },
    { id: 'b3', title: 'Take a hot air balloon flight at sunrise', category: 'Adventure', done: false },
    { id: 'b4', title: 'Adopt our dream pet puppy together', category: 'Home', done: false },
  ]);
  const [newBucketTitle, setNewBucketTitle] = useState('');

  // 2. Date Idea Generator State
  const [randomDateIdea, setRandomDateIdea] = useState(DATE_IDEAS[0]);

  // 3. Travel & Packing Checklist State
  const [packingItems, setPackingItems] = useState<{ id: string; name: string; packed: boolean }[]>([
    { id: 'p1', name: 'Passports & Flight Tickets', packed: true },
    { id: 'p2', name: 'Camera & Charger Batteries', packed: false },
    { id: 'p3', name: 'Cozy Sweaters & Jackets', packed: true },
    { id: 'p4', name: 'Travel First Aid & Sunscreen', packed: false },
  ]);
  const [newPackingName, setNewPackingName] = useState('');

  // 4. Shopping List State
  const [shoppingItems, setShoppingItems] = useState<{ id: string; name: string; done: boolean }[]>([
    { id: 's1', name: 'Strawberries & Dark Chocolate', done: true },
    { id: 's2', name: 'Artisan Sourdough Loaf', done: false },
    { id: 's3', name: 'Lavender Bath Salts for Date Night', done: false },
  ]);
  const [newShopName, setNewShopName] = useState('');

  // 5. Couple Goals State
  const [goals, setGoals] = useState<{ id: string; title: string; progress: number; category: string }[]>([
    { id: 'g1', title: 'Save for Dream Summer Trip to Japan', progress: 65, category: 'Travel' },
    { id: 'g2', title: 'Read 12 books together this year', progress: 40, category: 'Personal' },
    { id: 'g3', title: 'Cook dinner at home 5 nights a week', progress: 85, category: 'Healthy' },
  ]);

  // 6. Date Expenses State
  const [expenses, setExpenses] = useState<{ id: string; title: string; amount: number; paidBy: string; date: string }[]>([
    { id: 'e1', title: 'Italian Bistro Dinner & Wine', amount: 84.5, paidBy: user?.display_name || 'Alex', date: 'Oct 28' },
    { id: 'e2', title: 'Cinema Tickets & Gourmet Popcorn', amount: 32.0, paidBy: 'Partner', date: 'Oct 22' },
    { id: 'e3', title: 'Farmers Market Flowers & Honey', amount: 18.0, paidBy: user?.display_name || 'Alex', date: 'Oct 15' },
  ]);
  const [newExpenseTitle, setNewExpenseTitle] = useState('');
  const [newExpenseAmount, setNewExpenseAmount] = useState('');

  const toggleBucket = (id: string) => {
    setBucketItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          if (!item.done) confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
          return { ...item, done: !item.done };
        }
        return item;
      })
    );
  };

  const addBucketItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBucketTitle.trim()) return;
    setBucketItems([
      ...bucketItems,
      { id: 'b-' + Date.now(), title: newBucketTitle.trim(), category: 'Romantic', done: false },
    ]);
    setNewBucketTitle('');
  };

  const spinDateIdea = () => {
    const nextIdx = Math.floor(Math.random() * DATE_IDEAS.length);
    setRandomDateIdea(DATE_IDEAS[nextIdx]);
    confetti({ particleCount: 30, spread: 50, origin: { y: 0.7 } });
  };

  const addPackingItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPackingName.trim()) return;
    setPackingItems([...packingItems, { id: 'p-' + Date.now(), name: newPackingName.trim(), packed: false }]);
    setNewPackingName('');
  };

  const addShoppingItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShopName.trim()) return;
    setShoppingItems([...shoppingItems, { id: 's-' + Date.now(), name: newShopName.trim(), done: false }]);
    setNewShopName('');
  };

  const addExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(newExpenseAmount);
    if (!newExpenseTitle.trim() || isNaN(amt)) return;
    setExpenses([
      {
        id: 'e-' + Date.now(),
        title: newExpenseTitle.trim(),
        amount: amt,
        paidBy: user?.display_name || 'Alex',
        date: 'Today',
      },
      ...expenses,
    ]);
    setNewExpenseTitle('');
    setNewExpenseAmount('');
  };

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-6">
      {/* Header Banner */}
      <div className="p-6 rounded-3xl glass-card border border-rose-200/60 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-rose-50/70 via-pink-50/50 to-purple-50/50 dark:from-rose-950/20 dark:to-purple-950/20">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-100 text-rose-700 text-xs font-semibold">
            <Compass className="w-3.5 h-3.5" />
            <span>Planning & Couple Life Hub</span>
          </span>
          <h2 className="text-2xl font-extrabold text-stone-900 dark:text-zinc-100 mt-1">
            SHARED DREAMS & PLANS
          </h2>
          <p className="text-xs text-stone-500 dark:text-zinc-400">
            Bucket list, date night ideas, packing checklists, shopping lists, couple goals, and date expenses.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {[
          { id: 'bucket', label: 'Bucket List', icon: CheckSquare },
          { id: 'date_ideas', label: 'Date Idea Generator', icon: Sparkles },
          { id: 'travel', label: 'Trip Packing', icon: Plane },
          { id: 'shopping', label: 'Shopping List', icon: ShoppingBag },
          { id: 'goals', label: 'Couple Goals', icon: Target },
          { id: 'expenses', label: 'Date Expenses', icon: DollarSign },
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

      {/* 1. BUCKET LIST */}
      {activeTab === 'bucket' && (
        <div className="flex flex-col gap-6">
          <form onSubmit={addBucketItem} className="flex gap-2">
            <input
              type="text"
              placeholder="Add a new dream or bucket list experience..."
              value={newBucketTitle}
              onChange={(e) => setNewBucketTitle(e.target.value)}
              className="flex-1 rounded-2xl glass-input px-4 py-2.5 text-xs text-stone-800 dark:text-zinc-100 focus:outline-none"
            />
            <Button variant="primary" size="sm" type="submit">
              <Plus className="w-4 h-4 mr-1" /> Add to Bucket List
            </Button>
          </form>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {bucketItems.map((item) => (
              <div
                key={item.id}
                onClick={() => toggleBucket(item.id)}
                className={cn(
                  'p-4 rounded-3xl glass-card border transition-all cursor-pointer flex items-center justify-between gap-3 shadow-sm',
                  item.done
                    ? 'border-emerald-300 bg-emerald-50/40 dark:bg-emerald-950/20'
                    : 'border-rose-200/60 hover:shadow-md'
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={cn(
                      'w-6 h-6 rounded-xl flex items-center justify-center shrink-0 border transition-colors',
                      item.done ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-stone-300'
                    )}
                  >
                    {item.done && <Check className="w-4 h-4" />}
                  </div>
                  <span
                    className={cn(
                      'text-xs font-semibold text-stone-800 dark:text-zinc-100 truncate',
                      item.done && 'line-through text-stone-400'
                    )}
                  >
                    {item.title}
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 shrink-0">
                  {item.category}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. DATE IDEA GENERATOR */}
      {activeTab === 'date_ideas' && (
        <div className="max-w-xl mx-auto w-full flex flex-col items-center text-center p-8 rounded-3xl glass-card border border-rose-200/60 shadow-xl my-4">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-rose-500 to-amber-500 text-white flex items-center justify-center shadow-lg shadow-rose-500/25 mb-4">
            <Sparkles className="w-8 h-8" />
          </div>
          <span className="text-[10px] uppercase font-bold tracking-widest text-rose-500">
            {randomDateIdea.category} Date Night
          </span>
          <h3 className="text-xl font-extrabold text-stone-900 dark:text-zinc-100 mt-2 mb-3">
            {randomDateIdea.title}
          </h3>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 mb-6">
            Estimated Cost: {randomDateIdea.budget}
          </span>

          <Button variant="primary" onClick={spinDateIdea} className="gap-2">
            <Shuffle className="w-4 h-4" />
            <span>Spin for Another Romantic Idea</span>
          </Button>
        </div>
      )}

      {/* 3. TRIP PACKING */}
      {activeTab === 'travel' && (
        <div className="flex flex-col gap-6">
          <form onSubmit={addPackingItem} className="flex gap-2">
            <input
              type="text"
              placeholder="Add packing checklist item (e.g. Swimsuits, Passports)..."
              value={newPackingName}
              onChange={(e) => setNewPackingName(e.target.value)}
              className="flex-1 rounded-2xl glass-input px-4 py-2.5 text-xs text-stone-800 dark:text-zinc-100 focus:outline-none"
            />
            <Button variant="primary" size="sm" type="submit">
              <Plus className="w-4 h-4 mr-1" /> Add Packing Item
            </Button>
          </form>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {packingItems.map((p) => (
              <div
                key={p.id}
                onClick={() =>
                  setPackingItems((prev) =>
                    prev.map((item) => (item.id === p.id ? { ...item, packed: !item.packed } : item))
                  )
                }
                className={cn(
                  'p-3.5 rounded-2xl glass-card border flex items-center justify-between cursor-pointer transition-all',
                  p.packed ? 'border-emerald-300 bg-emerald-50/30' : 'border-rose-100/60'
                )}
              >
                <span
                  className={cn('text-xs font-semibold text-stone-800 dark:text-zinc-100', p.packed && 'line-through text-stone-400')}
                >
                  {p.name}
                </span>
                <span
                  className={cn(
                    'px-2 py-0.5 rounded-full text-[10px] font-bold',
                    p.packed ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-500'
                  )}
                >
                  {p.packed ? 'Packed ✓' : 'To Pack'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. SHOPPING LIST */}
      {activeTab === 'shopping' && (
        <div className="flex flex-col gap-6">
          <form onSubmit={addShoppingItem} className="flex gap-2">
            <input
              type="text"
              placeholder="Add item to shared couple shopping list..."
              value={newShopName}
              onChange={(e) => setNewShopName(e.target.value)}
              className="flex-1 rounded-2xl glass-input px-4 py-2.5 text-xs text-stone-800 dark:text-zinc-100 focus:outline-none"
            />
            <Button variant="primary" size="sm" type="submit">
              <Plus className="w-4 h-4 mr-1" /> Add Item
            </Button>
          </form>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {shoppingItems.map((s) => (
              <div
                key={s.id}
                onClick={() =>
                  setShoppingItems((prev) =>
                    prev.map((item) => (item.id === s.id ? { ...item, done: !item.done } : item))
                  )
                }
                className={cn(
                  'p-3.5 rounded-2xl glass-card border flex items-center justify-between cursor-pointer transition-all',
                  s.done ? 'border-emerald-300 bg-emerald-50/30' : 'border-rose-100/60'
                )}
              >
                <span
                  className={cn('text-xs font-semibold text-stone-800 dark:text-zinc-100', s.done && 'line-through text-stone-400')}
                >
                  {s.name}
                </span>
                <span
                  className={cn(
                    'px-2 py-0.5 rounded-full text-[10px] font-bold',
                    s.done ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-500'
                  )}
                >
                  {s.done ? 'Bought ✓' : 'Needed'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. COUPLE GOALS */}
      {activeTab === 'goals' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {goals.map((g) => (
            <div key={g.id} className="p-5 rounded-3xl glass-card border border-rose-200/60 shadow-sm flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">
                  {g.category}
                </span>
                <span className="text-xs font-bold text-rose-600">{g.progress}%</span>
              </div>
              <h4 className="text-sm font-bold text-stone-900 dark:text-zinc-100">{g.title}</h4>
              <div className="w-full bg-stone-200 dark:bg-zinc-700 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-rose-500 to-pink-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${g.progress}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 6. DATE EXPENSES */}
      {activeTab === 'expenses' && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-5 rounded-3xl glass-card border border-rose-200/60 gap-4">
            <div>
              <span className="text-[10px] uppercase font-bold text-rose-500">Shared Date Budget</span>
              <h3 className="text-2xl font-extrabold text-stone-900 dark:text-zinc-100">
                ${totalExpenses.toFixed(2)} Total Spent
              </h3>
            </div>
            <form onSubmit={addExpense} className="flex flex-wrap gap-2 w-full sm:w-auto">
              <input
                type="text"
                placeholder="Date description..."
                value={newExpenseTitle}
                onChange={(e) => setNewExpenseTitle(e.target.value)}
                className="rounded-2xl glass-input px-3 py-2 text-xs text-stone-800 dark:text-zinc-100 focus:outline-none"
              />
              <input
                type="number"
                step="0.01"
                placeholder="Amount $"
                value={newExpenseAmount}
                onChange={(e) => setNewExpenseAmount(e.target.value)}
                className="w-24 rounded-2xl glass-input px-3 py-2 text-xs text-stone-800 dark:text-zinc-100 focus:outline-none"
              />
              <Button variant="primary" size="sm" type="submit">
                <Plus className="w-4 h-4 mr-1" /> Log Expense
              </Button>
            </form>
          </div>

          <div className="flex flex-col gap-2">
            {expenses.map((exp) => (
              <div
                key={exp.id}
                className="p-4 rounded-2xl glass-card border border-rose-100/60 flex items-center justify-between text-xs"
              >
                <div>
                  <p className="font-bold text-stone-800 dark:text-zinc-100">{exp.title}</p>
                  <p className="text-[10px] text-stone-400">
                    Paid by {exp.paidBy} • {exp.date}
                  </p>
                </div>
                <span className="text-sm font-extrabold text-rose-600">${exp.amount.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
