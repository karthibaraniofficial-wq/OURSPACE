import React, { useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  StatusBar,
  Image,
  TextInput,
} from 'react-native';
import {
  calculateDaysTogether,
  getCountdown,
  ACCENT_PRESETS,
  type ChimeProfile,
} from '@ourspace/shared';
import type { Message, PrivateSpace, Profile } from '@ourspace/types';

// Demo initial couple data
const DEMO_USER_1: Profile = {
  id: '00000000-0000-0000-0000-000000000001',
  display_name: 'Alex Rivera',
  avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
  bio: 'Forever grateful for every moment with you ❤️',
  status_message: 'Listening to our playlist 🎶',
  anniversary_date: '2023-06-15',
  accent_color: '#f43f5e',
  theme_mode: 'light',
  created_at: '2023-06-15T00:00:00Z',
  updated_at: '2023-06-15T00:00:00Z',
};

const DEMO_USER_2: Profile = {
  id: '00000000-0000-0000-0000-000000000002',
  display_name: 'Jordan Taylor',
  avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80',
  bio: 'Exploring the world with my favorite person ✨',
  status_message: 'Working from home today ☕',
  anniversary_date: '2023-06-15',
  accent_color: '#8b5cf6',
  theme_mode: 'light',
  created_at: '2023-06-15T00:00:00Z',
  updated_at: '2023-06-15T00:00:00Z',
};

const DEMO_SPACE: PrivateSpace = {
  id: '11111111-1111-1111-1111-111111111111',
  name: 'Our Forever Space',
  created_by: DEMO_USER_1.id,
  couple_started_at: '2023-06-15',
  theme_accent: '#f43f5e',
  wallpaper_url: null,
  created_at: '2023-06-15T00:00:00Z',
  updated_at: '2023-06-15T00:00:00Z',
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'home' | 'chat' | 'gallery' | 'calls' | 'reminders' | 'memories' | 'settings'>('home');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'm1',
      conversation_id: 'c1',
      space_id: DEMO_SPACE.id,
      sender_id: DEMO_USER_2.id,
      content: 'Good morning my love! Hope you slept well ✨',
      type: 'text',
      reply_to_id: null,
      is_edited: false,
      edited_at: null,
      deleted_for_all: false,
      pinned: false,
      created_at: '10:00 AM',
      updated_at: '10:00 AM',
    },
    {
      id: 'm2',
      conversation_id: 'c1',
      space_id: DEMO_SPACE.id,
      sender_id: DEMO_USER_1.id,
      content: 'Morning sweetheart! Making coffee now ☕ Dinner at 7:30?',
      type: 'text',
      reply_to_id: null,
      is_edited: false,
      edited_at: null,
      deleted_for_all: false,
      pinned: false,
      created_at: '10:05 AM',
      updated_at: '10:05 AM',
    },
  ]);
  const [inputText, setInputText] = useState('');

  const daysTogether = calculateDaysTogether(DEMO_SPACE.couple_started_at);
  const nextTrip = getCountdown('2026-12-25T00:00:00Z');

  const sendMessage = () => {
    if (!inputText.trim()) return;
    const newMsg: Message = {
      id: 'm-' + Date.now(),
      conversation_id: 'c1',
      space_id: DEMO_SPACE.id,
      sender_id: DEMO_USER_1.id,
      content: inputText.trim(),
      type: 'text',
      reply_to_id: null,
      is_edited: false,
      edited_at: null,
      deleted_for_all: false,
      pinned: false,
      created_at: 'Just now',
      updated_at: 'Just now',
    };
    setMessages([...messages, newMsg]);
    setInputText('');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAF8F5" />

      {/* Top Mobile Bar */}
      <View style={styles.topBar}>
        <View style={styles.brandRow}>
          <Text style={styles.brandTitle}>OURSPACE</Text>
          <Text style={styles.partnerStatus}>Connected with Jordan • Online</Text>
        </View>
        <View style={styles.daysTogetherPill}>
          <Text style={styles.daysTogetherText}>{daysTogether} Days Together ❤️</Text>
        </View>
      </View>

      {/* Main Content Area */}
      <View style={styles.mainContent}>
        {activeTab === 'home' && (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            {/* Hero Card */}
            <View style={styles.heroCard}>
              <Text style={styles.heroGreeting}>Welcome back, Alex</Text>
              <Text style={styles.heroSubtitle}>Your private couple sanctuary is synchronized.</Text>
            </View>

            {/* Countdown Milestone */}
            <View style={styles.milestoneCard}>
              <Text style={styles.cardHeader}>Next Celebration</Text>
              <Text style={styles.milestoneTitle}>Christmas Holiday Trip ❄️</Text>
              <Text style={styles.countdownNumber}>{nextTrip.days} Days Left</Text>
            </View>

            {/* Quick Actions */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.primaryBtn]}
                onPress={() => setActiveTab('chat')}
              >
                <Text style={styles.primaryBtnText}>Open Chat</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.secondaryBtn]}
                onPress={() => setActiveTab('calls')}
              >
                <Text style={styles.secondaryBtnText}>Video Call</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}

        {activeTab === 'chat' && (
          <View style={styles.chatContainer}>
            <ScrollView contentContainerStyle={styles.chatScroll}>
              {messages.map((m) => {
                const isMine = m.sender_id === DEMO_USER_1.id;
                return (
                  <View
                    key={m.id}
                    style={[
                      styles.msgBubble,
                      isMine ? styles.msgMine : styles.msgTheirs,
                    ]}
                  >
                    <Text
                      style={[
                        styles.msgText,
                        isMine ? styles.msgTextMine : styles.msgTextTheirs,
                      ]}
                    >
                      {m.content}
                    </Text>
                    <Text style={styles.msgTime}>{m.created_at}</Text>
                  </View>
                );
              })}
            </ScrollView>

            {/* Chat Input */}
            <View style={styles.inputRow}>
              <TextInput
                style={styles.inputField}
                placeholder="Type a loving message..."
                placeholderTextColor="#A8A29E"
                value={inputText}
                onChangeText={setInputText}
              />
              <TouchableOpacity style={styles.sendBtn} onPress={sendMessage}>
                <Text style={styles.sendBtnText}>Send</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {activeTab === 'calls' && (
          <View style={styles.callsContainer}>
            <View style={styles.callHero}>
              <Text style={styles.callPartnerName}>Jordan Taylor</Text>
              <Text style={styles.callStatusText}>WebRTC Audio & Video</Text>
              <View style={styles.callButtonsRow}>
                <TouchableOpacity style={styles.audioCallBtn}>
                  <Text style={styles.callBtnText}>Audio Call</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.videoCallBtn}>
                  <Text style={styles.callBtnText}>Video Call</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {activeTab === 'gallery' && (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <Text style={styles.sectionTitle}>Shared Media Vault</Text>
            <Text style={styles.sectionSubtitle}>Photographs and videos saved securely.</Text>
            <View style={styles.galleryGrid}>
              <View style={styles.galleryPlaceholder}>
                <Text style={styles.galleryPlaceholderText}>📷 Beach Sunset</Text>
              </View>
              <View style={styles.galleryPlaceholder}>
                <Text style={styles.galleryPlaceholderText}>☕ Coffee Date</Text>
              </View>
              <View style={styles.galleryPlaceholder}>
                <Text style={styles.galleryPlaceholderText}>🌸 Kyoto Trip</Text>
              </View>
              <View style={styles.galleryPlaceholder}>
                <Text style={styles.galleryPlaceholderText}>✨ Stargazing</Text>
              </View>
            </View>
          </ScrollView>
        )}

        {activeTab === 'reminders' && (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <Text style={styles.sectionTitle}>Couple Tasks & Reminders</Text>
            <View style={styles.taskCard}>
              <Text style={styles.taskTitle}>Reserve table at Italian bistro</Text>
              <Text style={styles.taskMeta}>Nov 2, 7:30 PM • High Priority</Text>
            </View>
            <View style={styles.taskCard}>
              <Text style={styles.taskTitle}>Pack vacation luggage</Text>
              <Text style={styles.taskMeta}>Dec 23, 10:00 AM • Shared</Text>
            </View>
          </ScrollView>
        )}

        {activeTab === 'memories' && (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <Text style={styles.sectionTitle}>Days of Love</Text>
            <View style={styles.heroCard}>
              <Text style={styles.heroDaysNum}>{daysTogether}</Text>
              <Text style={styles.heroDaysLabel}>Days of togetherness and growth ❤️</Text>
            </View>
          </ScrollView>
        )}

        {activeTab === 'settings' && (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <Text style={styles.sectionTitle}>Preferences</Text>
            <View style={styles.settingCard}>
              <Text style={styles.settingLabel}>Couple Space Name</Text>
              <Text style={styles.settingValue}>{DEMO_SPACE.name}</Text>
            </View>
            <View style={styles.settingCard}>
              <Text style={styles.settingLabel}>Partner Connected</Text>
              <Text style={styles.settingValue}>Jordan Taylor</Text>
            </View>
            <View style={styles.settingCard}>
              <Text style={styles.settingLabel}>Notification Chimes</Text>
              <Text style={styles.settingValue}>Soft Bell Synthesizer (Active)</Text>
            </View>
          </ScrollView>
        )}
      </View>

      {/* Bottom Navigation Tabs */}
      <View style={styles.bottomNav}>
        {[
          { id: 'home', label: 'Home' },
          { id: 'chat', label: 'Chat' },
          { id: 'gallery', label: 'Vault' },
          { id: 'calls', label: 'Calls' },
          { id: 'reminders', label: 'Tasks' },
          { id: 'memories', label: 'Memories' },
          { id: 'settings', label: 'Settings' },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={styles.navItem}
              onPress={() => setActiveTab(tab.id as typeof activeTab)}
            >
              <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF8F5',
  },
  topBar: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#FFE4E6',
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
  },
  brandRow: {
    flexDirection: 'column',
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F43F5E',
    letterSpacing: 0.5,
  },
  partnerStatus: {
    fontSize: 10,
    color: '#78716C',
    marginTop: 2,
  },
  daysTogetherPill: {
    backgroundColor: '#FFF1F2',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECDD3',
  },
  daysTogetherText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F43F5E',
  },
  mainContent: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  heroCard: {
    backgroundColor: '#F43F5E',
    padding: 24,
    borderRadius: 24,
    marginBottom: 16,
  },
  heroGreeting: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  heroSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 4,
  },
  heroDaysNum: {
    fontSize: 48,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  heroDaysLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 4,
  },
  milestoneCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#EFE7DE',
    marginBottom: 16,
  },
  cardHeader: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: '#8B5CF6',
  },
  milestoneTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1917',
    marginTop: 4,
  },
  countdownNumber: {
    fontSize: 24,
    fontWeight: '800',
    color: '#8B5CF6',
    marginTop: 6,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
  },
  primaryBtn: {
    backgroundColor: '#F43F5E',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  secondaryBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FECDD3',
  },
  secondaryBtnText: {
    color: '#F43F5E',
    fontWeight: '700',
    fontSize: 13,
  },
  chatContainer: {
    flex: 1,
  },
  chatScroll: {
    padding: 16,
  },
  msgBubble: {
    padding: 12,
    borderRadius: 18,
    maxWidth: '80%',
    marginBottom: 10,
  },
  msgMine: {
    backgroundColor: '#F43F5E',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  msgTheirs: {
    backgroundColor: '#FFFFFF',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#FECDD3',
  },
  msgText: {
    fontSize: 14,
    lineHeight: 18,
  },
  msgTextMine: {
    color: '#FFFFFF',
  },
  msgTextTheirs: {
    color: '#1C1917',
  },
  msgTime: {
    fontSize: 9,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  inputRow: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EFE7DE',
    alignItems: 'center',
    gap: 8,
  },
  inputField: {
    flex: 1,
    backgroundColor: '#FAF8F5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1C1917',
  },
  sendBtn: {
    backgroundColor: '#F43F5E',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  sendBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  callsContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  callHero: {
    backgroundColor: '#FFFFFF',
    padding: 32,
    borderRadius: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FECDD3',
    width: '100%',
  },
  callPartnerName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1C1917',
  },
  callStatusText: {
    fontSize: 12,
    color: '#78716C',
    marginTop: 4,
  },
  callButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  audioCallBtn: {
    backgroundColor: '#10B981',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
  },
  videoCallBtn: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
  },
  callBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1C1917',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#78716C',
    marginBottom: 16,
  },
  galleryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  galleryPlaceholder: {
    width: '48%',
    aspectRatio: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#EFE7DE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryPlaceholderText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#78716C',
  },
  taskCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#EFE7DE',
    marginBottom: 10,
  },
  taskTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1C1917',
  },
  taskMeta: {
    fontSize: 11,
    color: '#F43F5E',
    marginTop: 4,
  },
  settingCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#EFE7DE',
    marginBottom: 10,
  },
  settingLabel: {
    fontSize: 11,
    color: '#78716C',
    fontWeight: '600',
  },
  settingValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1C1917',
    marginTop: 2,
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#FFE4E6',
    paddingVertical: 10,
    paddingHorizontal: 4,
    justifyContent: 'space-around',
  },
  navItem: {
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  navLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#78716C',
  },
  navLabelActive: {
    color: '#F43F5E',
    fontWeight: '800',
  },
});
