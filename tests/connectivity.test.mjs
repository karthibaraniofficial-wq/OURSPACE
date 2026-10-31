import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('OURSPACE Global Internet Connectivity & Production Networking Test Suite', () => {

  // ========================================================================
  // 1. Network Status Transitions & State Resilience
  // ========================================================================
  describe('1. Network Status Transitions & Handover State Machine', () => {
    class MockNetworkState {
      constructor() {
        this.isOnline = true;
        this.connectionStatus = 'connected';
        this.pendingQueue = [];
      }

      setOffline() {
        this.isOnline = false;
        this.connectionStatus = 'offline';
      }

      setReconnecting() {
        this.isOnline = true;
        this.connectionStatus = 'reconnecting';
      }

      setConnected() {
        this.isOnline = true;
        this.connectionStatus = 'connected';
      }

      enqueue(action) {
        this.pendingQueue.push({
          ...action,
          queuedAt: Date.now(),
        });
      }

      flush() {
        const items = [...this.pendingQueue];
        this.pendingQueue = [];
        return items;
      }
    }

    test('Transitions smoothly through Connected -> Offline -> Reconnecting -> Connected', () => {
      const state = new MockNetworkState();
      assert.equal(state.isOnline, true);
      assert.equal(state.connectionStatus, 'connected');

      // User enters elevator / subway / loses Wi-Fi
      state.setOffline();
      assert.equal(state.isOnline, false);
      assert.equal(state.connectionStatus, 'offline');

      // Cellular connection acquired (handshake initiated)
      state.setReconnecting();
      assert.equal(state.isOnline, true);
      assert.equal(state.connectionStatus, 'reconnecting');

      // LiveKit / Firestore channel re-established
      state.setConnected();
      assert.equal(state.isOnline, true);
      assert.equal(state.connectionStatus, 'connected');
    });

    test('Buffers offline actions and flushes in strict FIFO order on reconnect', () => {
      const state = new MockNetworkState();
      state.setOffline();

      state.enqueue({ id: 'msg-1', type: 'SEND_MESSAGE', content: 'Hey darling!' });
      state.enqueue({ id: 'msg-2', type: 'ADD_REACTION', messageId: 'msg-prev', emoji: '❤️' });
      state.enqueue({ id: 'msg-3', type: 'SEND_MESSAGE', content: 'Are you free for a call?' });

      assert.equal(state.pendingQueue.length, 3);

      state.setReconnecting();
      state.setConnected();

      const flushed = state.flush();
      assert.equal(flushed.length, 3);
      assert.equal(flushed[0].id, 'msg-1');
      assert.equal(flushed[1].id, 'msg-2');
      assert.equal(flushed[2].id, 'msg-3');
      assert.equal(state.pendingQueue.length, 0);
    });

    test('Enforces idempotency keys on retry to prevent duplicate message sends', () => {
      const sentIds = new Set();
      function dispatchMessage(msg) {
        if (sentIds.has(msg.idempotencyKey)) {
          return { status: 'DUPLICATE_IGNORED', id: msg.idempotencyKey };
        }
        sentIds.add(msg.idempotencyKey);
        return { status: 'DISPATCHED', id: msg.idempotencyKey };
      }

      const messageA = { idempotencyKey: 'idemp-uuid-1', content: 'Love you!' };
      assert.equal(dispatchMessage(messageA).status, 'DISPATCHED');
      // Network hiccup causes duplicate dispatch retry
      assert.equal(dispatchMessage(messageA).status, 'DUPLICATE_IGNORED');
    });
  });

  // ========================================================================
  // 2. Production URL Sanitation & Zero-Localhost Enforcement
  // ========================================================================
  describe('2. Production Endpoint Validation & Zero-Localhost Policy', () => {
    function validateProductionEndpoint(url, isProduction) {
      if (!url) {
        throw new Error('URL cannot be empty');
      }

      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();

      if (isProduction) {
        const forbiddenPatterns = [
          'localhost',
          '127.0.0.1',
          '0.0.0.0',
          '192.168.',
          '10.',
          '172.16.',
          '172.17.',
          '172.18.',
          '172.19.',
          '172.20.',
          '172.21.',
          '172.22.',
          '172.23.',
          '172.24.',
          '172.25.',
          '172.26.',
          '172.27.',
          '172.28.',
          '172.29.',
          '172.30.',
          '172.31.',
        ];

        for (const pattern of forbiddenPatterns) {
          if (host.includes(pattern)) {
            throw new Error(`Production environment must not use local or private network address: ${host}`);
          }
        }

        if (parsed.protocol !== 'https:' && parsed.protocol !== 'wss:') {
          throw new Error(`Production endpoint must use secure HTTPS or WSS protocol: ${url}`);
        }
      }

      return { valid: true, host, protocol: parsed.protocol };
    }

    test('Rejects localhost and private IP addresses in production mode', () => {
      assert.throws(() => validateProductionEndpoint('http://localhost:3000', true), /local or private network/);
      assert.throws(() => validateProductionEndpoint('http://127.0.0.1:8080', true), /local or private network/);
      assert.throws(() => validateProductionEndpoint('http://192.168.1.100:7880', true), /local or private network/);
      assert.throws(() => validateProductionEndpoint('http://10.0.0.5:5001', true), /local or private network/);
    });

    test('Rejects insecure HTTP and WS protocols in production mode', () => {
      assert.throws(() => validateProductionEndpoint('http://ourspace.app', true), /secure HTTPS or WSS/);
      assert.throws(() => validateProductionEndpoint('ws://livekit.ourspace.app', true), /secure HTTPS or WSS/);
    });

    test('Validates legitimate public cloud endpoints for production', () => {
      const webUrl = validateProductionEndpoint('https://ourspace.app', true);
      assert.equal(webUrl.valid, true);
      assert.equal(webUrl.host, 'ourspace.app');
      assert.equal(webUrl.protocol, 'https:');

      const livekitUrl = validateProductionEndpoint('wss://ourspace.livekit.cloud', true);
      assert.equal(livekitUrl.valid, true);
      assert.equal(livekitUrl.host, 'ourspace.livekit.cloud');
      assert.equal(livekitUrl.protocol, 'wss:');

      const functionsUrl = validateProductionEndpoint('https://us-central1-ourspace-prod.cloudfunctions.net', true);
      assert.equal(functionsUrl.valid, true);
      assert.equal(functionsUrl.protocol, 'https:');
    });

    test('Allows localhost strictly when in development mode', () => {
      const devWeb = validateProductionEndpoint('http://localhost:3000', false);
      assert.equal(devWeb.valid, true);
      assert.equal(devWeb.host, 'localhost');
    });
  });

  // ========================================================================
  // 3. WebRTC NAT Traversal & LiveKit ICE Configuration
  // ========================================================================
  describe('3. WebRTC ICE Candidate & NAT Traversal Configuration', () => {
    function generateIceServers(livekitUrl, customTurn) {
      const servers = [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ];

      if (customTurn) {
        servers.push({
          urls: customTurn.urls,
          username: customTurn.username,
          credential: customTurn.credential,
        });
      }

      // Add TLS 443 TURN fallback for restrictive firewalls
      servers.push({
        urls: 'turns:turn.livekit.cloud:443?transport=tcp',
        username: 'livekit-tls-fallback',
        credential: 'cloud-token',
      });

      return servers;
    }

    test('Includes STUN for open networks and TURN-over-TLS (port 443) for firewalls', () => {
      const iceServers = generateIceServers('wss://ourspace.livekit.cloud');
      assert.ok(iceServers.length >= 3);

      const hasStun = iceServers.some((s) => typeof s.urls === 'string' && s.urls.startsWith('stun:'));
      assert.equal(hasStun, true);

      const hasTlsTurn = iceServers.some(
        (s) => typeof s.urls === 'string' && s.urls.includes(':443') && s.urls.startsWith('turns:')
      );
      assert.equal(hasTlsTurn, true);
    });

    test('Simulates ICE restart on Wi-Fi to 5G cellular handover', () => {
      let iceRestartCount = 0;
      class MockWebRTCConnection {
        constructor() {
          this.connectionState = 'connected';
        }
        onNetworkHandover() {
          this.connectionState = 'reconnecting';
          this.restartIce();
        }
        restartIce() {
          iceRestartCount++;
          this.connectionState = 'connected';
        }
      }

      const connection = new MockWebRTCConnection();
      assert.equal(connection.connectionState, 'connected');

      // Partner leaves house: Wi-Fi disconnects, mobile 5G connects
      connection.onNetworkHandover();
      assert.equal(iceRestartCount, 1);
      assert.equal(connection.connectionState, 'connected');
    });
  });

  // ========================================================================
  // 4. Cross-Platform Push Notification & Deep Linking Structure
  // ========================================================================
  describe('4. Push Notification & Universal Link Parsing', () => {
    function parseDeepLink(rawUrl) {
      if (!rawUrl.startsWith('ourspace://') && !rawUrl.startsWith('https://ourspace.app/')) {
        throw new Error('Unsupported URL scheme');
      }

      let parsed;
      if (rawUrl.startsWith('ourspace://')) {
        parsed = new URL(rawUrl.replace('ourspace://', 'https://ourspace.app/'));
      } else {
        parsed = new URL(rawUrl);
      }

      const code = parsed.searchParams.get('code');
      const action = parsed.pathname.replace(/^\//, '');

      return {
        action,
        code,
      };
    }

    test('Correctly parses custom scheme pair link: ourspace://pair?code=ROMANCE123', () => {
      const result = parseDeepLink('ourspace://pair?code=ROMANCE123');
      assert.equal(result.action, 'pair');
      assert.equal(result.code, 'ROMANCE123');
    });

    test('Correctly parses Universal Link: https://ourspace.app/pair?code=ROMANCE123', () => {
      const result = parseDeepLink('https://ourspace.app/pair?code=ROMANCE123');
      assert.equal(result.action, 'pair');
      assert.equal(result.code, 'ROMANCE123');
    });

    test('Rejects malformed or untrusted deep links', () => {
      assert.throws(() => parseDeepLink('https://malicious.com/pair?code=EVIL'), /Unsupported URL scheme/);
      assert.throws(() => parseDeepLink('http://insecure.app/pair'), /Unsupported URL scheme/);
    });

    test('Validates multi-platform FCM push payload structure', () => {
      function buildFcmPayload(partnerToken, senderName, messageText, spaceId) {
        return {
          token: partnerToken,
          notification: {
            title: senderName,
            body: messageText,
          },
          data: {
            spaceId,
            click_action: 'FLUTTER_NOTIFICATION_CLICK',
            url: `https://ourspace.app/chat`,
          },
          android: {
            priority: 'high',
            notification: {
              channelId: 'ourspace_messages',
              icon: 'ic_notification',
              color: '#f43f5e',
            },
          },
          apns: {
            payload: {
              aps: {
                sound: 'default',
                badge: 1,
              },
            },
          },
        };
      }

      const payload = buildFcmPayload('fcm-token-123', 'Alice', 'Thinking of you ❤️', 'sp-romance');
      assert.equal(payload.token, 'fcm-token-123');
      assert.equal(payload.notification.title, 'Alice');
      assert.equal(payload.notification.body, 'Thinking of you ❤️');
      assert.equal(payload.android.notification.channelId, 'ourspace_messages');
      assert.equal(payload.apns.payload.aps.badge, 1);
    });
  });
});
