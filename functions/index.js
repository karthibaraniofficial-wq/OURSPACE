import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const messaging = admin.messaging();

/**
 * Trigger: On Space Member Created
 * Strictly enforces the 2-member limit on private spaces.
 * If a third member document is created, it is immediately deleted and logged.
 */
export const onSpaceMemberCreate = onDocumentCreated(
  "privateSpaces/{spaceId}/members/{uid}",
  async (event) => {
    const spaceId = event.params.spaceId;
    const uid = event.params.uid;
    const spaceRef = db.collection("privateSpaces").doc(spaceId);
    const membersRef = spaceRef.collection("members");

    try {
      const membersSnap = await membersRef.get();
      if (membersSnap.size > 2) {
        console.warn(`[SECURITY ALERT] Space ${spaceId} exceeded maximum 2 members! Evicting unauthorized user ${uid}`);
        await event.data?.ref.delete();
        
        await db.collection("auditLogs").add({
          action: "UNAUTHORIZED_MEMBER_REJECTION",
          spaceId,
          uid,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          reason: "Maximum 2-person space limit exceeded",
        });
        return;
      }

      await spaceRef.update({
        memberCount: membersSnap.size,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log(`[SPACE UPDATED] Space ${spaceId} active members: ${membersSnap.size}`);
    } catch (err) {
      console.error(`Error processing space member creation for space ${spaceId}:`, err);
    }
  }
);

/**
 * Helper: Clean up invalid or expired FCM registration tokens
 */
async function cleanupInvalidFcmTokens(uid: string, token: string, deviceDocId?: string) {
  try {
    if (deviceDocId) {
      await db.collection("users").doc(uid).collection("devices").doc(deviceDocId).delete();
    } else {
      const devicesSnap = await db.collection("users").doc(uid).collection("devices").where("fcmToken", "==", token).get();
      for (const d of devicesSnap.docs) {
        await d.ref.delete();
      }
    }
    console.log(`[FCM CLEANUP] Removed invalid device token for user ${uid}`);
  } catch (err) {
    console.error(`[FCM CLEANUP ERROR] Could not remove invalid token for user ${uid}:`, err);
  }
}

/**
 * Trigger: On New Message Created
 * Dispatches an FCM push notification to the partner device.
 * Automatically cleans up invalid/expired device tokens.
 */
export const onNewMessageNotification = onDocumentCreated(
  "privateSpaces/{spaceId}/conversations/{conversationId}/messages/{messageId}",
  async (event) => {
    const spaceId = event.params.spaceId;
    const messageData = event.data?.data();
    if (!messageData) return;

    const senderId = messageData.senderId;

    try {
      // Find partner UID in this space
      const membersSnap = await db.collection("privateSpaces").doc(spaceId).collection("members").get();
      const partnerDocs = membersSnap.docs.filter((doc) => doc.id !== senderId);

      for (const partnerDoc of partnerDocs) {
        const partnerUid = partnerDoc.id;
        // Fetch partner's device FCM tokens
        const devicesSnap = await db.collection("users").doc(partnerUid).collection("devices").get();
        const devices = devicesSnap.docs.map((d) => ({ id: d.id, token: d.data().fcmToken })).filter((d) => Boolean(d.token));

        if (devices.length === 0) continue;

        const tokens = devices.map((d) => d.token);

        const payload = {
          notification: {
            title: messageData.senderName || "New Message in OURSPACE",
            body: messageData.type === "image" ? "📷 Sent a photo" :
                  messageData.type === "video" ? "🎥 Sent a video" :
                  messageData.type === "audio" ? "🎵 Sent a voice note" :
                  messageData.content || "Sent a message",
          },
          data: {
            spaceId,
            conversationId: event.params.conversationId,
            messageId: event.params.messageId,
            type: "chat_message",
          },
          tokens,
        };

        const res = await messaging.sendEachForMulticast(payload);
        console.log(`[FCM SENT] Sent message notification to ${tokens.length} devices. Success: ${res.successCount}`);

        // Clean up invalid registration tokens
        if (res.failureCount > 0) {
          res.responses.forEach((resp, idx) => {
            if (!resp.success) {
              const errorCode = resp.error?.code;
              if (
                errorCode === "messaging/invalid-registration-token" ||
                errorCode === "messaging/registration-token-not-registered"
              ) {
                cleanupInvalidFcmTokens(partnerUid, tokens[idx], devices[idx]?.id);
              }
            }
          });
        }
      }
    } catch (err) {
      console.error("[FCM ERROR] Failed to send message notification:", err);
    }
  }
);

/**
 * Scheduled: Check Scheduled Reminders
 * Runs every minute to alert users of upcoming or overdue reminders.
 * Handles recurring event computation and cleans up expired tokens.
 */
export const checkScheduledReminders = onSchedule(
  "every 1 minutes",
  async () => {
    const now = admin.firestore.Timestamp.now();

    try {
      // Query reminders across all spaces that are pending and due
      const remindersQuery = await db
        .collectionGroup("reminders")
        .where("isCompleted", "==", false)
        .where("dueAt", "<=", now)
        .limit(50)
        .get();

      if (remindersQuery.empty) {
        return;
      }

      console.log(`[REMINDERS] Processing ${remindersQuery.size} due reminders`);

      for (const doc of remindersQuery.docs) {
        const reminder = doc.data();
        const spaceRef = doc.ref.parent.parent;
        if (!spaceRef) continue;

        // Mark as completed or update next recurrence
        if (reminder.recurrence && reminder.recurrence !== "none") {
          // Compute next due date
          const currentDue = reminder.dueAt.toDate();
          const nextDue = new Date(currentDue);
          if (reminder.recurrence === "daily") nextDue.setDate(nextDue.getDate() + 1);
          else if (reminder.recurrence === "weekly") nextDue.setDate(nextDue.getDate() + 7);
          else if (reminder.recurrence === "monthly") nextDue.setMonth(nextDue.getMonth() + 1);
          else if (reminder.recurrence === "yearly") nextDue.setFullYear(nextDue.getFullYear() + 1);

          await doc.ref.update({
            dueAt: admin.firestore.Timestamp.fromDate(nextDue),
            lastTriggeredAt: now,
          });
        } else {
          await doc.ref.update({
            isCompleted: true,
            completedAt: now,
            lastTriggeredAt: now,
          });
        }

        // Notify space members
        const membersSnap = await spaceRef.collection("members").get();
        for (const member of membersSnap.docs) {
          const devicesSnap = await db.collection("users").doc(member.id).collection("devices").get();
          const devices = devicesSnap.docs.map((d) => ({ id: d.id, token: d.data().fcmToken })).filter((d) => Boolean(d.token));

          if (devices.length > 0) {
            const tokens = devices.map((d) => d.token);
            const res = await messaging.sendEachForMulticast({
              notification: {
                title: "⏰ OURSPACE Reminder",
                body: reminder.title || "You have a scheduled reminder!",
              },
              data: {
                reminderId: doc.id,
                spaceId: spaceRef.id,
                type: "reminder_alert",
              },
              tokens,
            });

            if (res.failureCount > 0) {
              res.responses.forEach((resp, idx) => {
                if (!resp.success) {
                  const errorCode = resp.error?.code;
                  if (
                    errorCode === "messaging/invalid-registration-token" ||
                    errorCode === "messaging/registration-token-not-registered"
                  ) {
                    cleanupInvalidFcmTokens(member.id, tokens[idx], devices[idx]?.id);
                  }
                }
              });
            }
          }
        }
      }
    } catch (err) {
      console.error("[REMINDERS ERROR] Failed checking reminders:", err);
    }
  }
);

/**
 * Callable: Mint LiveKit Room Token
 * Generates an authorized LiveKit JWT token for WebRTC calls.
 * Ensures caller is an authenticated space member before minting.
 * Strictly disables demo mock bypasses in production.
 */
export const getLiveKitToken = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be logged in to request a call token.");
  }

  const { spaceId, roomName } = request.data || {};
  if (!spaceId || !roomName) {
    throw new HttpsError("invalid-argument", "spaceId and roomName are required.");
  }

  const uid = request.auth.uid;

  // Validate space membership
  const memberDoc = await db.collection("privateSpaces").doc(spaceId).collection("members").doc(uid).get();
  if (!memberDoc.exists) {
    throw new HttpsError("permission-denied", "You are not an authorized member of this private space.");
  }

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!apiKey || !apiSecret) {
    if (process.env.NODE_ENV === "production") {
      throw new HttpsError(
        "failed-precondition",
        "LiveKit credentials are not configured on the production server."
      );
    }
    // Return a mock token ONLY in development / demo mode
    return {
      token: `demo-livekit-token-${uid}-${roomName}`,
      isDemo: true,
      identity: uid,
      roomName,
    };
  }

  try {
    const { AccessToken } = await import("livekit-server-sdk");
    const at = new AccessToken(apiKey, apiSecret, {
      identity: uid,
      name: request.auth.token.name || "OURSPACE User",
    });
    at.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
    });

    const token = await at.toJwt();
    return { token, isDemo: false, identity: uid, roomName };
  } catch (err) {
    console.error("[LIVEKIT TOKEN ERROR]", err);
    throw new HttpsError("internal", "Failed to generate LiveKit room token.");
  }
});
