import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  type Unsubscribe,
} from 'firebase/firestore';
import { getFirebaseFirestore } from './firebase';
import type { Message, PrivateSpace, Profile, Reminder, SharedEvent, CallSession } from '@ourspace/types';

// ========================================================================
// Couple Space & Pairing Operations
// ========================================================================

export async function createPrivateSpaceInFirestore(
  creator: Profile,
  name: string,
  startedAt?: string
): Promise<{ success: boolean; spaceId?: string; inviteCode?: string; error?: string }> {
  try {
    const db = getFirebaseFirestore();
    const spaceRef = doc(collection(db, 'privateSpaces'));
    const spaceId = spaceRef.id;
    const inviteCode = 'LOVE-' + Math.random().toString(36).substring(2, 6).toUpperCase();

    // 1. Create space document
    await setDoc(spaceRef, {
      id: spaceId,
      name,
      createdBy: creator.id,
      coupleStartedAt: startedAt || null,
      themeAccent: '#f43f5e',
      wallpaperUrl: null,
      memberCount: 1,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // 2. Add creator to members subcollection
    const memberRef = doc(db, `privateSpaces/${spaceId}/members`, creator.id);
    await setDoc(memberRef, {
      userId: creator.id,
      role: 'creator',
      displayName: creator.display_name,
      joinedAt: serverTimestamp(),
    });

    // 3. Create default conversation
    const convRef = doc(db, `privateSpaces/${spaceId}/conversations`, 'main');
    await setDoc(convRef, {
      title: 'Main Sanctuary',
      createdAt: serverTimestamp(),
    });

    // 4. Create pairing invitation document
    const inviteRef = doc(db, 'invitations', inviteCode);
    await setDoc(inviteRef, {
      code: inviteCode,
      spaceId,
      createdBy: creator.id,
      expiresAt: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
      acceptedAt: null,
      acceptedBy: null,
      status: 'pending',
      createdAt: serverTimestamp(),
    });

    // Update user's activeSpaceId
    await updateDoc(doc(db, 'users', creator.id), { activeSpaceId: spaceId });

    return { success: true, spaceId, inviteCode };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create space';
    return { success: false, error: message };
  }
}

export async function joinPrivateSpaceInFirestore(
  partner: Profile,
  inviteCode: string
): Promise<{ success: boolean; spaceId?: string; error?: string }> {
  try {
    const db = getFirebaseFirestore();
    const cleanCode = inviteCode.trim().toUpperCase();
    const inviteRef = doc(db, 'invitations', cleanCode);

    const result = await runTransaction(db, async (transaction) => {
      const inviteSnap = await transaction.get(inviteRef);
      if (!inviteSnap.exists()) {
        throw new Error('Invalid invitation code.');
      }

      const inviteData = inviteSnap.data();
      if (inviteData.status !== 'pending') {
        throw new Error('This invitation has already been redeemed or expired.');
      }

      const expiresDate = new Date(inviteData.expiresAt);
      if (expiresDate.getTime() < Date.now()) {
        throw new Error('This invitation has expired.');
      }

      const spaceId = inviteData.spaceId;
      const spaceRef = doc(db, 'privateSpaces', spaceId);
      const spaceSnap = await transaction.get(spaceRef);

      if (!spaceSnap.exists()) {
        throw new Error('Private space not found.');
      }

      const spaceData = spaceSnap.data();
      if (spaceData.memberCount >= 2) {
        throw new Error('Space membership limit reached: OURSPACE strictly permits a maximum of 2 members.');
      }

      // Add partner to members subcollection
      const partnerMemberRef = doc(db, `privateSpaces/${spaceId}/members`, partner.id);
      transaction.set(partnerMemberRef, {
        userId: partner.id,
        role: 'partner',
        displayName: partner.display_name,
        joinedAt: new Date().toISOString(),
      });

      // Increment memberCount atomically
      transaction.update(spaceRef, {
        memberCount: spaceData.memberCount + 1,
        updatedAt: new Date().toISOString(),
      });

      // Mark invitation accepted
      transaction.update(inviteRef, {
        status: 'accepted',
        acceptedAt: new Date().toISOString(),
        acceptedBy: partner.id,
      });

      // Update partner activeSpaceId
      const userRef = doc(db, 'users', partner.id);
      transaction.update(userRef, { activeSpaceId: spaceId });

      return { spaceId };
    });

    return { success: true, spaceId: result.spaceId };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Could not join space';
    return { success: false, error: message };
  }
}

// ========================================================================
// Real-time Chat Operations
// ========================================================================

export function subscribeToFirestoreMessages(
  spaceId: string,
  callback: (messages: Message[]) => void,
  messageLimit = 50
): Unsubscribe {
  const db = getFirebaseFirestore();
  const msgsRef = collection(db, `privateSpaces/${spaceId}/conversations/main/messages`);
  const q = query(msgsRef, orderBy('createdAt', 'desc'), limit(messageLimit));

  return onSnapshot(q, (snapshot) => {
    const list: Message[] = snapshot.docs
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          conversation_id: 'main',
          space_id: spaceId,
          sender_id: data.senderId,
          content: data.content,
          type: data.type || 'text',
          reply_to_id: data.replyToId || null,
          is_edited: data.isEdited || false,
          edited_at: data.editedAt || null,
          deleted_for_all: data.deletedForAll || false,
          pinned: data.pinned || false,
          created_at: data.createdAt?.toDate?.()?.toISOString() || data.createdAt || new Date().toISOString(),
          updated_at: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt || new Date().toISOString(),
          attachments: data.attachments || [],
          reactions: data.reactions || [],
        };
      })
      .reverse();
    callback(list);
  });
}

export async function sendMessageToFirestore(
  spaceId: string,
  message: Message | (Omit<Message, 'id'> & { id?: string })
): Promise<string> {
  const db = getFirebaseFirestore();
  const messageId = message.id || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const docRef = doc(db, `privateSpaces/${spaceId}/conversations/main/messages`, messageId);

  await setDoc(docRef, {
    senderId: message.sender_id,
    content: message.content,
    type: message.type,
    replyToId: message.reply_to_id,
    isEdited: false,
    deletedForAll: false,
    pinned: false,
    attachments: message.attachments || [],
    reactions: message.reactions || [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return messageId;
}

export async function updateMessageInFirestore(
  spaceId: string,
  messageId: string,
  updates: Partial<Message>
): Promise<void> {
  const db = getFirebaseFirestore();
  const msgRef = doc(db, `privateSpaces/${spaceId}/conversations/main/messages`, messageId);
  const data: Record<string, unknown> = { updatedAt: serverTimestamp() };

  if (updates.content !== undefined) data.content = updates.content;
  if (updates.is_edited !== undefined) data.isEdited = updates.is_edited;
  if (updates.pinned !== undefined) data.pinned = updates.pinned;
  if (updates.deleted_for_all !== undefined) data.deletedForAll = updates.deleted_for_all;

  await updateDoc(msgRef, data);
}

export async function addReactionToFirestore(
  spaceId: string,
  messageId: string,
  userId: string,
  emoji: string
): Promise<void> {
  const db = getFirebaseFirestore();
  const msgRef = doc(db, `privateSpaces/${spaceId}/conversations/main/messages`, messageId);
  const msgSnap = await getDoc(msgRef);

  if (!msgSnap.exists()) return;

  const reactions = msgSnap.data().reactions || [];
  const existingIdx = reactions.findIndex((r: { userId: string; emoji: string }) => r.userId === userId && r.emoji === emoji);

  if (existingIdx >= 0) {
    // Remove reaction (toggle off)
    reactions.splice(existingIdx, 1);
  } else {
    reactions.push({ userId, emoji });
  }

  await updateDoc(msgRef, { reactions });
}

// ========================================================================
// Reminders & Shared Events
// ========================================================================

export function subscribeToFirestoreReminders(
  spaceId: string,
  callback: (reminders: Reminder[]) => void
): Unsubscribe {
  const db = getFirebaseFirestore();
  const remRef = collection(db, `privateSpaces/${spaceId}/reminders`);
  const q = query(remRef, orderBy('createdAt', 'desc'));

  return onSnapshot(q, (snapshot) => {
    const list: Reminder[] = snapshot.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        space_id: spaceId,
        created_by: data.createdBy,
        assigned_to: data.assignedTo || null,
        title: data.title,
        description: data.description || null,
        due_date: data.dueDate,
        recurrence: data.recurrence || 'none',
        priority: data.priority || 'medium',
        is_completed: data.isCompleted || false,
        completed_at: data.completedAt || null,
        completed_by: data.completedBy || null,
        created_at: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        updated_at: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      };
    });
    callback(list);
  });
}

export async function addReminderToFirestore(
  spaceId: string,
  reminder: Partial<Reminder>
): Promise<string> {
  const db = getFirebaseFirestore();
  const remRef = collection(db, `privateSpaces/${spaceId}/reminders`);
  const docRef = await addDoc(remRef, {
    title: reminder.title,
    description: reminder.description || null,
    dueDate: reminder.due_date,
    recurrence: reminder.recurrence || 'none',
    priority: reminder.priority || 'medium',
    isCompleted: false,
    assignedTo: reminder.assigned_to || null,
    createdBy: reminder.created_by,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function toggleReminderCompleteInFirestore(
  spaceId: string,
  reminderId: string,
  isCompleted: boolean,
  userId: string
): Promise<void> {
  const db = getFirebaseFirestore();
  const remRef = doc(db, `privateSpaces/${spaceId}/reminders`, reminderId);
  await updateDoc(remRef, {
    isCompleted,
    completedAt: isCompleted ? new Date().toISOString() : null,
    completedBy: isCompleted ? userId : null,
    updatedAt: serverTimestamp(),
  });
}
