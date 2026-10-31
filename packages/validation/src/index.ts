import { z } from 'zod';

// ========================================================================
// Authentication & Profile Schemas
// ========================================================================

export const registerSchema = z.object({
  email: z.string().trim().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must include an uppercase letter')
    .regex(/[a-z]/, 'Password must include a lowercase letter')
    .regex(/[0-9]/, 'Password must include a number'),
  displayName: z.string().trim().min(2, 'Name must be at least 2 characters').max(50),
});

export const loginSchema = z.object({
  email: z.string().trim().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const updateProfileSchema = z.object({
  display_name: z.string().trim().min(2).max(50).optional(),
  avatar_url: z.string().url().nullable().optional(),
  bio: z.string().max(250).nullable().optional(),
  status_message: z.string().max(100).optional(),
  anniversary_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format must be YYYY-MM-DD').nullable().optional(),
  accent_color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid hex color').optional(),
  theme_mode: z.enum(['light', 'dark', 'system']).optional(),
});

// ========================================================================
// Couple Pairing Schemas
// ========================================================================

export const createSpaceSchema = z.object({
  name: z.string().trim().min(2).max(50).default('Our Space'),
  couple_started_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  theme_accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#f43f5e'),
});

export const joinSpaceSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(6, 'Invite code must be at least 6 characters')
    .max(12, 'Invite code is too long'),
});

// ========================================================================
// Chat & Messaging Schemas
// ========================================================================

export const sendMessageSchema = z.object({
  space_id: z.string().min(1, 'Space ID is required'),
  conversation_id: z.string().min(1, 'Conversation ID is required'),
  content: z.string().trim().max(5000).nullable().optional(),
  type: z.enum(['text', 'image', 'video', 'document', 'audio', 'gif', 'system']).default('text'),
  reply_to_id: z.string().min(1).nullable().optional(),
});

export const editMessageSchema = z.object({
  content: z.string().trim().min(1, 'Message cannot be empty').max(5000),
});

export const addReactionSchema = z.object({
  message_id: z.string().min(1, 'Message ID is required'),
  space_id: z.string().min(1, 'Space ID is required'),
  emoji: z.string().min(1).max(10),
});

// ========================================================================
// Reminders & Events Schemas
// ========================================================================

export const createReminderSchema = z.object({
  space_id: z.string().min(1, 'Space ID is required'),
  title: z.string().trim().min(1, 'Title is required').max(150),
  description: z.string().max(1000).nullable().optional(),
  due_date: z.string().datetime(),
  recurrence: z.enum(['none', 'daily', 'weekly', 'monthly', 'yearly']).default('none'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  assigned_to: z.string().min(1).nullable().optional(),
});

export const createSharedEventSchema = z.object({
  space_id: z.string().min(1, 'Space ID is required'),
  title: z.string().trim().min(1, 'Event title is required').max(150),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  event_type: z.enum(['anniversary', 'birthday', 'trip', 'milestone', 'date_night', 'custom']).default('custom'),
  notes: z.string().max(1000).nullable().optional(),
  notify_days_before: z.number().int().min(0).max(30).default(3),
});

// ========================================================================
// Notification Preferences Schema
// ========================================================================

export const updateNotificationPreferencesSchema = z.object({
  messages_sound: z.string().default('soft-bell'),
  calls_ringtone: z.string().default('romantic-harp'),
  reminders_sound: z.string().default('marimba-chime'),
  custom_sound_url: z.string().url().nullable().optional(),
  vibration_enabled: z.boolean().default(true),
  dnd_enabled: z.boolean().default(false),
  dnd_start: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).default('22:00:00'),
  dnd_end: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).default('07:00:00'),
  preview_privacy: z.boolean().default(false),
  notify_messages: z.boolean().default(true),
  notify_calls: z.boolean().default(true),
  notify_reminders: z.boolean().default(true),
  notify_memories: z.boolean().default(true),
});

export const clientEnvSchema = z.object({
  NEXT_PUBLIC_FIREBASE_API_KEY: z.string().min(1, 'Firebase API key is required'),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().min(1, 'Firebase Auth Domain is required'),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().min(1, 'Firebase Project ID is required'),
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: z.string().min(1, 'Firebase Storage Bucket is required'),
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: z.string().min(1, 'Firebase Messaging Sender ID is required'),
  NEXT_PUBLIC_FIREBASE_APP_ID: z.string().min(1, 'Firebase App ID is required'),
  NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: z.string().optional(),
  NEXT_PUBLIC_FIREBASE_VAPID_KEY: z.string().optional(),
  NEXT_PUBLIC_LIVEKIT_URL: z.string().min(1, 'LiveKit URL is required'),
  NEXT_PUBLIC_GIPHY_API_KEY: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url('App URL must be a valid URL').default('https://ourspace.app'),
});

export const serverEnvSchema = clientEnvSchema.extend({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().email().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  LIVEKIT_API_KEY: z.string().min(1, 'LiveKit API Key is required for server token minting'),
  LIVEKIT_API_SECRET: z.string().min(1, 'LiveKit API Secret is required for server token minting'),
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function validateEnv(env: Record<string, string | undefined>, isServer = false) {
  const schema = isServer ? serverEnvSchema : clientEnvSchema;
  const result = schema.safeParse(env);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Environment validation failed:\n${issues}`);
  }
  return result.data;
}

export const createAlbumSchema = z.object({
  space_id: z.string().min(1, 'Space ID is required'),
  title: z.string().trim().min(1, 'Title is required').max(100),
  description: z.string().max(500).nullable().optional(),
  category: z.string().min(1).default('Everyday Moments'),
  album_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  visibility: z.enum(['personal', 'shared']).default('shared'),
  cover_url: z.string().nullable().optional(),
});

export const createLockerItemSchema = z.object({
  section: z.enum([
    'notes',
    'personal_details',
    'documents',
    'important_dates',
    'saved_info',
    'letters',
    'travel',
    'emergency',
    'photos',
    'custom',
  ]),
  folder_id: z.string().nullable().optional(),
  title_ciphertext: z.string().min(1),
  payload_ciphertext: z.string().min(1),
  iv: z.string().min(1),
  salt: z.string().min(1),
});

export const resetLockerSchema = z.object({
  confirmation_phrase: z.literal('DELETE MY LOCKER'),
});

export const createBucketListItemSchema = z.object({
  space_id: z.string().min(1),
  title: z.string().trim().min(1).max(200),
  category: z.enum(['travel', 'adventure', 'romantic', 'food', 'home', 'custom']).default('romantic'),
  target_date: z.string().nullable().optional(),
});

export const createDatePlanSchema = z.object({
  space_id: z.string().min(1),
  title: z.string().trim().min(1).max(150),
  idea_category: z.enum(['romantic', 'adventurous', 'cozy', 'budget', 'foodie']).default('romantic'),
  scheduled_for: z.string(),
  budget_estimate: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export type CreateAlbumInput = z.infer<typeof createAlbumSchema>;
export type CreateLockerItemInput = z.infer<typeof createLockerItemSchema>;
export type ResetLockerInput = z.infer<typeof resetLockerSchema>;
export type CreateBucketListItemInput = z.infer<typeof createBucketListItemSchema>;
export type CreateDatePlanInput = z.infer<typeof createDatePlanSchema>;

