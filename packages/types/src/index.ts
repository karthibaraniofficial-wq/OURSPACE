// ========================================================================
// OURSPACE: Central TypeScript Domain & Database Types
// ========================================================================

export type UUID = string;

export interface Profile {
  id: UUID;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  status_message: string;
  anniversary_date: string | null;
  accent_color: string;
  theme_mode: 'light' | 'dark' | 'system';
  created_at: string;
  updated_at: string;
}

export interface PrivateSpace {
  id: UUID;
  name: string;
  created_by: UUID;
  couple_started_at: string | null;
  theme_accent: string;
  wallpaper_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface SpaceMember {
  space_id: UUID;
  user_id: UUID;
  role: 'creator' | 'partner';
  joined_at: string;
  profile?: Profile;
}

export interface Invitation {
  id: UUID;
  space_id: UUID;
  code: string;
  created_by: UUID;
  expires_at: string;
  accepted_at: string | null;
  accepted_by: UUID | null;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  created_at: string;
}

export interface Conversation {
  id: UUID;
  space_id: UUID;
  title: string;
  created_at: string;
}

export type MessageType =
  | 'text'
  | 'image'
  | 'video'
  | 'document'
  | 'audio'
  | 'gif'
  | 'system';

export interface MessageReaction {
  id: UUID;
  message_id: UUID;
  space_id: UUID;
  user_id: UUID;
  emoji: string;
  created_at: string;
  user?: Profile;
}

export interface MessageAttachment {
  id: UUID;
  message_id: UUID;
  space_id: UUID;
  file_path: string;
  file_name: string;
  file_size: number;
  file_type: string;
  media_category: 'image' | 'video' | 'document' | 'audio';
  thumbnail_path: string | null;
  duration_seconds: number | null;
  width: number | null;
  height: number | null;
  created_at: string;
  signed_url?: string;
}

export interface MessageReceipt {
  id: UUID;
  message_id: UUID;
  space_id: UUID;
  user_id: UUID;
  delivered_at: string | null;
  read_at: string | null;
}

export interface Message {
  id: UUID;
  conversation_id: UUID;
  space_id: UUID;
  sender_id: UUID;
  content: string | null;
  type: MessageType;
  reply_to_id: UUID | null;
  reply_to?: Message | null;
  is_edited: boolean;
  edited_at: string | null;
  deleted_for_all: boolean;
  pinned: boolean;
  created_at: string;
  updated_at: string;
  sender?: Profile;
  reactions?: MessageReaction[];
  attachments?: MessageAttachment[];
  receipts?: MessageReceipt[];
}

export interface TypingState {
  space_id: UUID;
  user_id: UUID;
  is_typing: boolean;
  updated_at: string;
}

export interface UserDevice {
  id: UUID;
  user_id: UUID;
  device_name: string | null;
  device_type: 'web' | 'android' | 'ios' | 'windows' | 'macos';
  push_token: string | null;
  last_seen_at: string;
  created_at: string;
}

export interface NotificationPreferences {
  user_id: UUID;
  messages_sound: string;
  calls_ringtone: string;
  reminders_sound: string;
  custom_sound_url: string | null;
  vibration_enabled: boolean;
  dnd_enabled: boolean;
  dnd_start: string;
  dnd_end: string;
  preview_privacy: boolean;
  notify_messages: boolean;
  notify_calls: boolean;
  notify_reminders: boolean;
  notify_memories: boolean;
  updated_at: string;
}

export type ReminderRecurrence = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
export type ReminderPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Reminder {
  id: UUID;
  space_id: UUID;
  created_by: UUID;
  assigned_to: UUID | null;
  title: string;
  description: string | null;
  due_date: string;
  recurrence: ReminderRecurrence;
  priority: ReminderPriority;
  is_completed: boolean;
  completed_at: string | null;
  completed_by: UUID | null;
  created_at: string;
  updated_at: string;
  creator?: Profile;
}

export type SharedEventType = 'anniversary' | 'birthday' | 'trip' | 'milestone' | 'date_night' | 'custom';

export interface SharedEvent {
  id: UUID;
  space_id: UUID;
  created_by: UUID;
  title: string;
  event_date: string;
  event_type: SharedEventType;
  notes: string | null;
  notify_days_before: number;
  created_at: string;
}

export interface MediaFile {
  id: UUID;
  space_id: UUID;
  uploaded_by: UUID;
  file_path: string;
  file_name: string;
  file_size: number;
  file_type: string;
  category: 'image' | 'video' | 'document' | 'audio';
  caption: string | null;
  is_favourite: boolean;
  album_id: UUID | null;
  created_at: string;
  signed_url?: string;
  uploader?: Profile;
}

export type AlbumCategory =
  | 'Our Beginning'
  | 'First Meeting'
  | 'First Date'
  | 'Special Days'
  | 'Birthdays'
  | 'Anniversaries'
  | 'Trips'
  | 'Festivals'
  | 'Celebrations'
  | 'Everyday Moments'
  | 'Future Memories'
  | 'Custom';

export type AlbumVisibility = 'personal' | 'shared';

export interface Album {
  id: UUID;
  space_id: UUID;
  created_by: UUID;
  title: string;
  description: string | null;
  cover_file_path: string | null;
  cover_url?: string | null;
  category: AlbumCategory | string;
  album_date: string | null;
  visibility: AlbumVisibility;
  is_favourite: boolean;
  is_archived: boolean;
  sort_order: number;
  memory_count: number;
  created_at: string;
  updated_at: string;
}

export interface AlbumItem {
  id: UUID;
  album_id: UUID;
  space_id: UUID;
  file_id?: string;
  storage_path: string;
  media_url: string;
  media_type: 'image' | 'video';
  caption: string | null;
  description?: string | null;
  uploaded_by: UUID;
  original_date: string | null;
  sort_order: number;
  is_favourite: boolean;
  tags?: string[];
  created_at: string;
}

// ========================================================================
// PHASE 2: OUR LOCKER (PRIVATE ENCRYPTED VAULT)
// ========================================================================

export type LockerDeletionState =
  | 'ACTIVE'
  | 'LOCKED_FOR_DELETION'
  | 'WIPE_PENDING'
  | 'PURGING_FILES'
  | 'FIREBASE_PURGING'
  | 'DRIVE_PURGING'
  | 'PURGING_METADATA'
  | 'METADATA_PURGING'
  | 'VERIFYING_DELETION'
  | 'VERIFYING_ALL_LOCATIONS'
  | 'OLD_KEYS_DESTROYED'
  | 'READY_FOR_NEW_KEY'
  | 'READY_FOR_NEW_LOCKER'
  | 'ACTIVE_WITH_NEW_KEY';

export type LockerSection =
  | 'notes'
  | 'personal_details'
  | 'documents'
  | 'important_dates'
  | 'saved_info'
  | 'letters'
  | 'travel'
  | 'emergency'
  | 'photos'
  | 'custom';

export interface EncryptedLockerItem {
  id: UUID;
  user_id: UUID;
  section: LockerSection;
  folder_id: UUID | null;
  title_ciphertext: string;
  payload_ciphertext: string;
  iv: string;
  salt: string;
  is_favourite: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface LockerFolder {
  id: UUID;
  user_id: UUID;
  section: LockerSection;
  name_ciphertext: string;
  created_at: string;
}

export type LockerBackupStatus =
  | 'IDLE'
  | 'BACKING_UP'
  | 'VERIFIED'
  | 'FAILED'
  | 'RESTORING';

export interface LockerMasterKeyEnvelope {
  wrapped_master_key: string;
  iv: string;
  salt: string;
  recovery_wrapped_master_key?: string;
  recovery_iv?: string;
  recovery_salt?: string;
}

export interface LockerBackupManifest {
  vault_id: UUID;
  user_id: UUID;
  backup_id: string;
  timestamp: string;
  encrypted_items_count: number;
  ciphertext_hash_sha256: string;
  key_version: number;
  status: 'VERIFIED' | 'PENDING' | 'FAILED';
  encrypted_manifest_payload: string;
  iv: string;
}

export interface LockerMetadata {
  vault_id: UUID;
  user_id: UUID;
  key_version: number;
  salt: string;
  iv: string;
  verifier_hash: string;
  deletion_state: LockerDeletionState;
  failed_attempts: number;
  lockout_until: string | null;
  auto_lock_timeout_minutes: number;
  key_envelope?: LockerMasterKeyEnvelope;
  last_backup_at?: string | null;
  backup_status?: LockerBackupStatus;
  backup_verified?: boolean;
  drive_folder_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DecryptedLockerItem {
  id: UUID;
  section: LockerSection;
  folder_id: UUID | null;
  title: string;
  payload: Record<string, any>;
  is_favourite: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

// ========================================================================
// PHASE 3: VOICE MESSAGING & TRANSCRIPTION
// ========================================================================

export interface VoiceNoteMeta {
  duration_seconds: number;
  sample_rate?: number;
  waveform_peaks?: number[];
  storage_path: string;
  audio_url: string;
  transcript_status: 'none' | 'pending' | 'completed' | 'failed';
  transcript_text?: string;
  language?: string;
}

// ========================================================================
// PHASE 5: 50 NEW COUPLE FEATURES DOMAIN MODELS
// ========================================================================

// 1. Connection & Daily Check-in
export type MoodType = 'joyful' | 'loving' | 'cozy' | 'stressed' | 'tired' | 'excited';

export interface DailyMood {
  id: UUID;
  space_id: UUID;
  user_id: UUID;
  mood: MoodType;
  note: string | null;
  created_at: string;
}

export interface DailyCoupleQuestion {
  id: string;
  prompt: string;
  date: string;
  answers: Record<UUID, { answer: string; answered_at: string }>;
}

export interface GratitudeEntry {
  id: UUID;
  space_id: UUID;
  user_id: UUID;
  content: string;
  created_at: string;
}

export interface LoveNote {
  id: UUID;
  space_id: UUID;
  sender_id: UUID;
  recipient_id: UUID;
  content: string;
  color_preset: string;
  read_at: string | null;
  created_at: string;
}

export interface ScheduledRomanticLetter {
  id: UUID;
  space_id: UUID;
  sender_id: UUID;
  title: string;
  content: string;
  unlock_date: string;
  is_unlocked: boolean;
  created_at: string;
}

// 2. Planning & Daily Life
export interface BucketListItem {
  id: UUID;
  space_id: UUID;
  created_by: UUID;
  title: string;
  category: 'travel' | 'adventure' | 'romantic' | 'food' | 'home' | 'custom';
  target_date: string | null;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
}

export interface DatePlan {
  id: UUID;
  space_id: UUID;
  created_by: UUID;
  title: string;
  idea_category: 'romantic' | 'adventurous' | 'cozy' | 'budget' | 'foodie';
  scheduled_for: string;
  budget_estimate: number | null;
  status: 'planned' | 'completed' | 'cancelled';
  notes: string | null;
  created_at: string;
}

export interface TravelItinerary {
  id: UUID;
  space_id: UUID;
  created_by: UUID;
  destination: string;
  start_date: string;
  end_date: string;
  notes: string | null;
  packing_checklist: { id: string; name: string; assigned_to: UUID | null; packed: boolean }[];
  itinerary_days: { day: number; date: string; activities: string[] }[];
  created_at: string;
}

export interface SharedShoppingItem {
  id: UUID;
  space_id: UUID;
  created_by: UUID;
  name: string;
  category: 'groceries' | 'home' | 'date_supplies' | 'gifts' | 'other';
  quantity: string | null;
  checked: boolean;
  created_at: string;
}

export interface CoupleGoal {
  id: UUID;
  space_id: UUID;
  created_by: UUID;
  title: string;
  description: string | null;
  target_date: string | null;
  progress_percent: number;
  category: 'financial' | 'relationship' | 'health' | 'travel' | 'home';
  completed: boolean;
  created_at: string;
}

export interface GiftWishItem {
  id: UUID;
  space_id: UUID;
  for_user_id: UUID;
  title: string;
  link_url: string | null;
  notes: string | null;
  occasion: string | null;
  price_estimate: number | null;
  is_secret_purchased: boolean;
  purchased_by: UUID | null;
  created_at: string;
}

export interface DateExpense {
  id: UUID;
  space_id: UUID;
  paid_by: UUID;
  title: string;
  amount: number;
  currency: string;
  category: 'dinner' | 'activity' | 'travel' | 'movies' | 'gifts' | 'other';
  split_type: 'equally' | 'paid_in_full' | 'custom';
  date: string;
  created_at: string;
}

// 3. Shared Experience & Safety
export interface SharedEmergencyContact {
  id: UUID;
  user_id: UUID;
  space_id: UUID;
  name: string;
  relationship: string;
  phone_number: string;
  notes: string | null;
  created_at: string;
}

export interface ConsentLocationShare {
  id: UUID;
  space_id: UUID;
  user_id: UUID;
  latitude: number;
  longitude: number;
  accuracy: number;
  is_active: boolean;
  expires_at: string;
  updated_at: string;
}

export interface RelationshipJournalEntry {
  id: UUID;
  space_id: UUID;
  author_id: UUID;
  title: string;
  content: string;
  mood: MoodType;
  media_urls?: string[];
  entry_date: string;
  created_at: string;
}

export interface ScheduledChatMessage {
  id: UUID;
  space_id: UUID;
  sender_id: UUID;
  content: string;
  scheduled_at: string;
  status: 'pending' | 'sent' | 'cancelled';
  created_at: string;
}

export interface SavedChatMessage {
  id: UUID;
  space_id: UUID;
  user_id: UUID;
  message_id: UUID;
  content: string;
  sender_display_name: string;
  saved_at: string;
}

export type CallType = 'audio' | 'video';
export type CallStatus = 'ringing' | 'active' | 'declined' | 'missed' | 'ended';

export interface CallSession {
  id: UUID;
  space_id: UUID;
  caller_id: UUID;
  receiver_id: UUID;
  call_type: CallType;
  status: CallStatus;
  room_name: string;
  started_at: string;
  answered_at: string | null;
  ended_at: string | null;
  duration_seconds: number;
  created_at: string;
  caller?: Profile;
  receiver?: Profile;
}

// Realtime WebSocket Broadcast Payloads
export interface RealtimeTypingPayload {
  space_id: UUID;
  user_id: UUID;
  is_typing: boolean;
}

export interface RealtimeCallPayload {
  call_session: CallSession;
  action: 'incoming' | 'accepted' | 'declined' | 'ended';
}

export interface LiveKitTokenResponse {
  token: string;
  room_name: string;
  server_url: string;
}
