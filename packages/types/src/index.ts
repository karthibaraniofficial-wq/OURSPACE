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

export interface Album {
  id: UUID;
  space_id: UUID;
  created_by: UUID;
  title: string;
  description: string | null;
  cover_file_path: string | null;
  created_at: string;
  item_count?: number;
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
