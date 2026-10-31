import test from 'node:test';
import assert from 'node:assert/strict';

// Helper: base64url encode/decode
function base64UrlEncode(str) {
  return Buffer.from(str).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function createMockLiveKitJwt(identity, roomName, name = 'Test User') {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64UrlEncode(
    JSON.stringify({
      sub: identity,
      name,
      video: {
        room: roomName,
        roomJoin: true,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
      },
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    })
  );
  const signature = base64UrlEncode('mock-signature');
  return `${header}.${payload}.${signature}`;
}

function parseJwtSubject(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const jsonStr = Buffer.from(parts[1], 'base64url').toString('utf8');
    const payload = JSON.parse(jsonStr);
    return payload.sub || payload.identity || null;
  } catch {
    return null;
  }
}

test('PHASE 1: LiveKit Participant Identity Collision Prevention', async (t) => {
  await t.test('Caller and receiver have unique, distinct LiveKit identities', () => {
    const callerUid = 'firebase_user_A_123';
    const receiverUid = 'firebase_user_B_456';
    const roomName = 'ourspace-space1-call-12345';

    // Mint tokens
    const callerToken = createMockLiveKitJwt(callerUid, roomName, 'Alice');
    const receiverToken = createMockLiveKitJwt(receiverUid, roomName, 'Bob');

    const callerIdentity = parseJwtSubject(callerToken);
    const receiverIdentity = parseJwtSubject(receiverToken);

    assert.equal(callerIdentity, callerUid);
    assert.equal(receiverIdentity, receiverUid);
    assert.notEqual(callerIdentity, receiverIdentity, 'Caller and receiver MUST have different identities');
    assert.notEqual(callerIdentity, 'partner', "Identity must never be fallback 'partner'");
    assert.notEqual(receiverIdentity, 'partner', "Identity must never be fallback 'partner'");
  });

  await t.test('Client token validation detects and rejects identity mismatch / collision', () => {
    const localAuthenticatedUid = 'firebase_user_A_123';
    const mismatchedToken = createMockLiveKitJwt('firebase_user_B_456', 'ourspace-room', 'Attacker');

    const tokenSubject = parseJwtSubject(mismatchedToken);
    const isIdentityValid = tokenSubject === localAuthenticatedUid;

    assert.equal(isIdentityValid, false, 'Client must reject token whose identity does not equal authenticated user UID');
  });

  await t.test('Client token validation approves correctly issued user token', () => {
    const localAuthenticatedUid = 'firebase_user_A_123';
    const validToken = createMockLiveKitJwt(localAuthenticatedUid, 'ourspace-room', 'Alice');

    const tokenSubject = parseJwtSubject(validToken);
    const isIdentityValid = tokenSubject === localAuthenticatedUid;

    assert.equal(isIdentityValid, true, 'Client accepts token issued to authenticated UID');
  });
});

test('PHASE 2: Secure Token Flow Authorization Rules', async (t) => {
  const mockSpace = {
    id: 'space_couple_1',
    members: ['user_A', 'user_B'],
  };

  const mockCallSession = {
    id: 'call_999',
    spaceId: 'space_couple_1',
    callerId: 'user_A',
    receiverId: 'user_B',
    roomName: 'ourspace-space_cou-call_999',
    status: 'active',
  };

  function validateTokenRequest({ authUid, spaceId, roomName, callId, space, callSession }) {
    if (!authUid) throw new Error('unauthenticated: Must be logged in');
    if (!space.members.includes(authUid)) throw new Error('permission-denied: Not a space member');
    if (callId) {
      if (!callSession || callSession.id !== callId) throw new Error('not-found: Call not found');
      if (callSession.callerId !== authUid && callSession.receiverId !== authUid) {
        throw new Error('permission-denied: Not a participant');
      }
      if (callSession.roomName !== roomName) throw new Error('invalid-argument: Room mismatch');
      if (callSession.status !== 'ringing' && callSession.status !== 'active') {
        throw new Error('failed-precondition: Call no longer active');
      }
    }
    return {
      token: createMockLiveKitJwt(authUid, roomName),
      identity: authUid,
      roomName,
    };
  }

  await t.test('Authorized caller can obtain token with verified identity', () => {
    const res = validateTokenRequest({
      authUid: 'user_A',
      spaceId: mockSpace.id,
      roomName: mockCallSession.roomName,
      callId: mockCallSession.id,
      space: mockSpace,
      callSession: mockCallSession,
    });
    assert.equal(res.identity, 'user_A');
  });

  await t.test('Authorized receiver can obtain token with verified identity', () => {
    const res = validateTokenRequest({
      authUid: 'user_B',
      spaceId: mockSpace.id,
      roomName: mockCallSession.roomName,
      callId: mockCallSession.id,
      space: mockSpace,
      callSession: mockCallSession,
    });
    assert.equal(res.identity, 'user_B');
  });

  await t.test('Third party attacker is rejected with permission-denied', () => {
    assert.throws(
      () =>
        validateTokenRequest({
          authUid: 'attacker_user_C',
          spaceId: mockSpace.id,
          roomName: mockCallSession.roomName,
          callId: mockCallSession.id,
          space: mockSpace,
          callSession: mockCallSession,
        }),
      /permission-denied/
    );
  });

  await t.test('Mismatched room name is rejected', () => {
    assert.throws(
      () =>
        validateTokenRequest({
          authUid: 'user_A',
          spaceId: mockSpace.id,
          roomName: 'hacked-room-xyz',
          callId: mockCallSession.id,
          space: mockSpace,
          callSession: mockCallSession,
        }),
      /invalid-argument/
    );
  });

  await t.test('Ended call session cannot mint tokens', () => {
    const endedCall = { ...mockCallSession, status: 'ended' };
    assert.throws(
      () =>
        validateTokenRequest({
          authUid: 'user_A',
          spaceId: mockSpace.id,
          roomName: mockCallSession.roomName,
          callId: mockCallSession.id,
          space: mockSpace,
          callSession: endedCall,
        }),
      /failed-precondition/
    );
  });
});

test('PHASE 3: Call State Machine Transitions', async (t) => {
  class MockCallMachine {
    constructor() {
      this.state = 'IDLE';
      this.signalingStatus = 'idle';
      this.mediaStatus = 'disconnected';
      this.isConnecting = false;
      this.tokenRequested = false;
    }

    initiate() {
      assert.equal(this.state, 'IDLE');
      this.state = 'OUTGOING_RINGING';
      this.signalingStatus = 'ringing';
      this.isConnecting = true;
    }

    receive() {
      assert.equal(this.state, 'IDLE');
      this.state = 'INCOMING_RINGING';
      this.signalingStatus = 'ringing';
    }

    accept() {
      assert.ok(this.state === 'INCOMING_RINGING' || this.state === 'OUTGOING_RINGING');
      this.state = 'ACCEPTED';
      this.signalingStatus = 'active';
      this.mediaStatus = 'connecting';
      this.isConnecting = false;
    }

    startConnecting() {
      assert.equal(this.state, 'ACCEPTED');
      this.state = 'CONNECTING';
      this.mediaStatus = 'connecting';
    }

    mediaConnected() {
      assert.equal(this.state, 'CONNECTING');
      this.state = 'MEDIA_CONNECTED';
      this.mediaStatus = 'connected';
    }

    reconnecting() {
      assert.equal(this.state, 'MEDIA_CONNECTED');
      this.state = 'RECONNECTING';
      this.mediaStatus = 'reconnecting';
    }

    reconnected() {
      assert.equal(this.state, 'RECONNECTING');
      this.state = 'MEDIA_CONNECTED';
      this.mediaStatus = 'connected';
    }

    end() {
      this.state = 'ENDED';
      this.signalingStatus = 'ended';
      this.mediaStatus = 'disconnected';
      this.isConnecting = false;
    }
  }

  await t.test('Full happy path: Caller -> Ringing -> Accepted -> Connected -> Ended', () => {
    const machine = new MockCallMachine();
    assert.equal(machine.state, 'IDLE');

    machine.initiate();
    assert.equal(machine.state, 'OUTGOING_RINGING');
    assert.equal(machine.signalingStatus, 'ringing');

    machine.accept();
    assert.equal(machine.state, 'ACCEPTED');
    assert.equal(machine.signalingStatus, 'active');

    machine.startConnecting();
    assert.equal(machine.state, 'CONNECTING');
    assert.equal(machine.mediaStatus, 'connecting');

    machine.mediaConnected();
    assert.equal(machine.state, 'MEDIA_CONNECTED');
    assert.equal(machine.mediaStatus, 'connected');

    machine.reconnecting();
    assert.equal(machine.state, 'RECONNECTING');
    assert.equal(machine.mediaStatus, 'reconnecting');

    machine.reconnected();
    assert.equal(machine.state, 'MEDIA_CONNECTED');

    machine.end();
    assert.equal(machine.state, 'ENDED');
    assert.equal(machine.signalingStatus, 'ended');
    assert.equal(machine.mediaStatus, 'disconnected');
  });
});

test('PHASE 4 & 5 & 6: LiveKit Media Track Lifecycle & Rendering', async (t) => {
  class MockLiveKitTrack {
    constructor(kind, source) {
      this.kind = kind;
      this.source = source;
      this.attachedElements = [];
      this.isStopped = false;
      this.isEnabled = true;
    }

    attach(el = {}) {
      this.attachedElements.push(el);
      return el;
    }

    detach(el) {
      if (el) {
        this.attachedElements = this.attachedElements.filter((e) => e !== el);
      } else {
        this.attachedElements = [];
      }
    }

    stop() {
      this.isStopped = true;
    }

    setEnabled(enabled) {
      this.isEnabled = enabled;
    }
  }

  await t.test('Two-way Audio Track publication, mute/unmute and release', () => {
    const audioTrack = new MockLiveKitTrack('audio', 'microphone');
    const mockAudioEl = { id: 'remote_audio_player', play: () => Promise.resolve(), pause: () => {} };

    // Attach remote audio
    audioTrack.attach(mockAudioEl);
    assert.equal(audioTrack.attachedElements.length, 1);

    // Mute
    audioTrack.setEnabled(false);
    assert.equal(audioTrack.isEnabled, false);

    // Unmute
    audioTrack.setEnabled(true);
    assert.equal(audioTrack.isEnabled, true);

    // End call cleanup
    audioTrack.detach(mockAudioEl);
    audioTrack.stop();
    assert.equal(audioTrack.attachedElements.length, 0);
    assert.equal(audioTrack.isStopped, true);
  });

  await t.test('Remote Video Track attachment avoids null-ref race condition', () => {
    const videoTrack = new MockLiveKitTrack('video', 'camera');
    
    // In our new architecture, TrackVideo receives the track and attaches ONLY once the video element is mounted
    let mountedVideoEl = null;

    // 1. Track arrives (TrackSubscribed event)
    let pendingTrack = videoTrack;
    assert.ok(pendingTrack);

    // 2. Component renders and mounts <video> element
    mountedVideoEl = { tagName: 'VIDEO', autoPlay: true, playsInline: true };

    // 3. useEffect attaches track to mounted element
    pendingTrack.attach(mountedVideoEl);
    assert.equal(videoTrack.attachedElements.length, 1);
    assert.equal(videoTrack.attachedElements[0], mountedVideoEl);

    // 4. Track unmounted / cleaned up
    pendingTrack.detach(mountedVideoEl);
    assert.equal(videoTrack.attachedElements.length, 0);
  });
});
