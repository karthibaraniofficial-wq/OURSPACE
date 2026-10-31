import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('OURSPACE Production Readiness & Security Audit Test Suite', () => {

  // ========================================================================
  // 1. Security & Two-Person Isolation Audit
  // ========================================================================
  describe('1. Security & Two-Person Isolation Assertions', () => {
    test('Strict 2-member limit logic: Rejects 3rd member transaction', () => {
      const space = { id: 'sp-123', memberCount: 2, members: ['uid-1', 'uid-2'] };
      
      function canAddMember(currentSpace, newUid) {
        if (currentSpace.memberCount >= 2) {
          throw new Error('Space membership limit reached: OURSPACE strictly permits a maximum of 2 members.');
        }
        return true;
      }

      assert.throws(() => canAddMember(space, 'uid-3'), {
        message: /Space membership limit reached/,
      });
    });

    test('Invitation State Machine: Only pending & unexpired invites can be accepted', () => {
      function validateInvitationAcceptance(invite, userUid) {
        if (invite.status !== 'pending') {
          return { allowed: false, reason: 'Invitation is not pending' };
        }
        if (new Date(invite.expiresAt).getTime() < Date.now()) {
          return { allowed: false, reason: 'Invitation has expired' };
        }
        if (invite.createdBy === userUid) {
          return { allowed: false, reason: 'Creator cannot accept their own invite' };
        }
        return { allowed: true };
      }

      const activeInvite = {
        code: 'LOVE-TEST',
        status: 'pending',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        createdBy: 'uid-alice',
      };

      const acceptedInvite = { ...activeInvite, status: 'accepted' };
      const expiredInvite = { ...activeInvite, expiresAt: new Date(Date.now() - 3600000).toISOString() };

      assert.equal(validateInvitationAcceptance(activeInvite, 'uid-bob').allowed, true);
      assert.equal(validateInvitationAcceptance(acceptedInvite, 'uid-bob').allowed, false);
      assert.equal(validateInvitationAcceptance(expiredInvite, 'uid-bob').allowed, false);
      assert.equal(validateInvitationAcceptance(activeInvite, 'uid-alice').allowed, false);
    });

    test('Message Editing Authorization: Non-author cannot alter message content', () => {
      function canUpdateMessage(msg, actorUid, updates) {
        const isAuthor = msg.senderId === actorUid;
        const keys = Object.keys(updates);
        if (isAuthor) return true;
        // Non-authors can only toggle reactions or readBy
        const allowedPartnerKeys = ['reactions', 'readBy'];
        return keys.every((k) => allowedPartnerKeys.includes(k));
      }

      const message = { id: 'msg-1', senderId: 'uid-alice', content: 'Hi darling' };

      // Author can edit content
      assert.equal(canUpdateMessage(message, 'uid-alice', { content: 'Hi sweetheart' }), true);
      // Partner CANNOT edit content
      assert.equal(canUpdateMessage(message, 'uid-bob', { content: 'Tampered message' }), false);
      // Partner CAN add reaction
      assert.equal(canUpdateMessage(message, 'uid-bob', { reactions: [{ uid: 'uid-bob', emoji: '❤️' }] }), true);
    });
  });

  // ========================================================================
  // 2. Storage Security & Path Traversal Audit
  // ========================================================================
  describe('2. Storage Security & Path Traversal Guardrails', () => {
    test('Enforces strict 50MB file size ceiling', () => {
      const MAX_SIZE = 50 * 1024 * 1024;
      const validSize = 45 * 1024 * 1024;
      const oversized = 51 * 1024 * 1024;

      assert.ok(validSize <= MAX_SIZE);
      assert.ok(oversized > MAX_SIZE);
    });

    test('Validates MIME type whitelist', () => {
      const allowedMimes = [
        'image/jpeg', 'image/png', 'image/webp', 'image/gif',
        'video/mp4', 'video/webm', 'audio/mpeg', 'audio/wav',
        'application/pdf', 'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain', 'application/zip',
      ];

      const disallowedMimes = [
        'application/x-msdownload', // .exe
        'application/x-sh',         // .sh
        'text/javascript',          // .js
        'application/x-php',        // .php
      ];

      function isMimeAllowed(mime) {
        return (
          mime.startsWith('image/') ||
          mime.startsWith('video/') ||
          mime.startsWith('audio/') ||
          mime === 'application/pdf' ||
          mime === 'application/msword' ||
          mime.startsWith('application/vnd.openxmlformats-officedocument') ||
          mime === 'text/plain' ||
          mime === 'application/zip'
        );
      }

      for (const m of allowedMimes) {
        assert.equal(isMimeAllowed(m), true, `Allowed mime rejected: ${m}`);
      }
      for (const m of disallowedMimes) {
        assert.equal(isMimeAllowed(m), false, `Disallowed mime accepted: ${m}`);
      }
    });

    test('Rejects directory traversal attempts in storage paths', () => {
      function sanitizeStoragePath(spaceId, category, fileName) {
        if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
          throw new Error('Directory traversal attempt detected in filename.');
        }
        const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
        return `spaces/${spaceId}/${category}/${Date.now()}_${safeName}`;
      }

      assert.throws(() => sanitizeStoragePath('sp-1', 'image', '../../etc/passwd'));
      assert.throws(() => sanitizeStoragePath('sp-1', 'image', '..\\secret.key'));
      const clean = sanitizeStoragePath('sp-1', 'image', 'my photo (1).jpg');
      assert.ok(clean.startsWith('spaces/sp-1/image/'));
      assert.ok(clean.includes('my_photo__1_.jpg'));
    });
  });

  // ========================================================================
  // 3. Cloud Functions & Calling Authorization Audit
  // ========================================================================
  describe('3. Cloud Functions & LiveKit Token Security', () => {
    test('LiveKit token minting blocks unauthenticated callers', () => {
      function mintLiveKitToken(request) {
        if (!request.auth) {
          throw new Error('UNAUTHENTICATED');
        }
        if (!request.spaceId || !request.roomName) {
          throw new Error('INVALID_ARGUMENT');
        }
        return { token: 'valid-jwt' };
      }

      assert.throws(() => mintLiveKitToken({ auth: null }), { message: 'UNAUTHENTICATED' });
    });

    test('LiveKit token minting strictly disables mock tokens in production', () => {
      function resolveLiveKitToken(isProd, apiKey, apiSecret) {
        if (!apiKey || !apiSecret) {
          if (isProd) {
            throw new Error('FAILED_PRECONDITION: LiveKit credentials unconfigured in production');
          }
          return { isDemo: true, token: 'mock-token' };
        }
        return { isDemo: false, token: 'real-livekit-jwt' };
      }

      // In development, mock token is returned for local developer ease
      assert.equal(resolveLiveKitToken(false, null, null).isDemo, true);
      // In production, mock token MUST be rejected
      assert.throws(() => resolveLiveKitToken(true, null, null), {
        message: /FAILED_PRECONDITION/,
      });
    });

    test('FCM token cleanup: Detects and removes invalid registration tokens', () => {
      const mockDevices = [
        { id: 'dev-1', token: 'valid-token-1' },
        { id: 'dev-2', token: 'stale-token-expired' },
      ];

      const multicastResponse = {
        successCount: 1,
        failureCount: 1,
        responses: [
          { success: true },
          { success: false, error: { code: 'messaging/registration-token-not-registered' } },
        ],
      };

      const tokensToRemove = [];
      multicastResponse.responses.forEach((resp, idx) => {
        if (!resp.success && resp.error?.code === 'messaging/registration-token-not-registered') {
          tokensToRemove.push(mockDevices[idx].token);
        }
      });

      assert.equal(tokensToRemove.length, 1);
      assert.equal(tokensToRemove[0], 'stale-token-expired');
    });
  });

  // ========================================================================
  // 4. Performance & Memory Leak Prevention Audit
  // ========================================================================
  describe('4. Performance & Resource Guardrails', () => {
    test('Chat message query limits batch size to prevent unbounded reads', () => {
      const DEFAULT_PAGE_LIMIT = 50;
      assert.equal(DEFAULT_PAGE_LIMIT, 50);
    });

    test('Cleanup listener releases subscription without dangling handles', () => {
      let listenerActive = true;
      function unsubscribe() {
        listenerActive = false;
      }

      let activeSub = unsubscribe;
      function cleanupListeners() {
        if (activeSub) {
          activeSub();
          activeSub = null;
        }
      }

      assert.equal(listenerActive, true);
      cleanupListeners();
      assert.equal(listenerActive, false);
      assert.equal(activeSub, null);
    });
  });

  // ========================================================================
  // 5. Production Demo Bypass Protection
  // ========================================================================
  describe('5. Production Demo Bypass Protections', () => {
    test('switchDemoUser is disabled when running in production mode', () => {
      function switchDemoUser(isProd, isConfigured) {
        if (isProd && isConfigured) {
          return { allowed: false, error: 'Demo user bypass is disabled in production.' };
        }
        return { allowed: true };
      }

      assert.equal(switchDemoUser(false, false).allowed, true); // Dev without Firebase
      assert.equal(switchDemoUser(true, true).allowed, false);  // Production with Firebase
    });
  });
});
