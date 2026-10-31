import test from 'node:test';
import assert from 'node:assert';
import {
  createAlbumSchema,
  createLockerItemSchema,
  resetLockerSchema,
  createBucketListItemSchema,
  createDatePlanSchema,
  updateProfileSchema,
} from '../packages/validation/src/index.ts';

test('V2.3 Memory Albums Validation & Privacy Rules', () => {
  // 1. Valid shared album
  const validShared = {
    space_id: 'space-1234',
    title: 'Paris Summer Vacation',
    description: 'Our romantic week exploring the Eiffel Tower and cafes',
    category: 'Trips',
    album_date: '2026-07-14',
    visibility: 'shared',
    cover_url: 'https://example.com/cover.jpg',
  };
  const parsed = createAlbumSchema.safeParse(validShared);
  assert.ok(parsed.success, 'Valid shared album should parse successfully');

  // 2. Valid personal album
  const validPersonal = {
    space_id: 'space-1234',
    title: 'Surprise Gift Ideas for Partner',
    category: 'Future Memories',
    visibility: 'personal',
  };
  const parsedPersonal = createAlbumSchema.safeParse(validPersonal);
  assert.ok(parsedPersonal.success, 'Valid personal album should parse successfully');
  assert.strictEqual(parsedPersonal.data.visibility, 'personal');

  // 3. Invalid album (missing space_id and title)
  const invalid = {
    category: 'Trips',
  };
  const parsedInvalid = createAlbumSchema.safeParse(invalid);
  assert.strictEqual(parsedInvalid.success, false, 'Missing required fields should fail');
});

test('V2.3 Our Locker Encrypted Item Validation & Wipe Schema', () => {
  // 1. Valid encrypted item
  const validEncItem = {
    section: 'personal_details',
    folder_id: null,
    title_ciphertext: 'B3a9xY7z==',
    payload_ciphertext: '88FaCde0192==',
    iv: 'a1b2c3d4e5f6a1b2c3d4e5f6',
    salt: 'f0e1d2c3b4a59687f0e1d2c3b4a59687',
  };
  const parsedItem = createLockerItemSchema.safeParse(validEncItem);
  assert.ok(parsedItem.success, 'Encrypted locker item schema must succeed');

  // 2. Destructive wipe confirmation phrase validation
  const validWipe = { confirmation_phrase: 'DELETE MY LOCKER' };
  assert.ok(resetLockerSchema.safeParse(validWipe).success, 'Exact phrase must succeed');

  const invalidWipe = { confirmation_phrase: 'delete my locker' }; // lowercase
  assert.strictEqual(resetLockerSchema.safeParse(invalidWipe).success, false, 'Incorrect case must fail');

  const wrongPhrase = { confirmation_phrase: 'RESET' };
  assert.strictEqual(resetLockerSchema.safeParse(wrongPhrase).success, false, 'Wrong phrase must fail');
});

test('V2.3 Locker Deletion State Machine Progression', () => {
  const STATES = [
    'ACTIVE',
    'WIPE_PENDING',
    'PURGING_FILES',
    'PURGING_METADATA',
    'VERIFYING_DELETION',
    'READY_FOR_NEW_KEY',
    'ACTIVE_WITH_NEW_KEY',
  ];

  let currentState = 'ACTIVE';

  function transitionTo(nextState) {
    const currentIndex = STATES.indexOf(currentState);
    const nextIndex = STATES.indexOf(nextState);
    if (nextIndex !== currentIndex + 1) {
      throw new Error(`Illegal state transition from ${currentState} to ${nextState}`);
    }
    currentState = nextState;
  }

  // Attempting to jump from ACTIVE directly to READY_FOR_NEW_KEY must be blocked
  assert.throws(() => {
    transitionTo('READY_FOR_NEW_KEY');
  }, /Illegal state transition/);

  // Correct step-by-step state progression
  transitionTo('WIPE_PENDING');
  assert.strictEqual(currentState, 'WIPE_PENDING');

  transitionTo('PURGING_FILES');
  assert.strictEqual(currentState, 'PURGING_FILES');

  transitionTo('PURGING_METADATA');
  assert.strictEqual(currentState, 'PURGING_METADATA');

  transitionTo('VERIFYING_DELETION');
  assert.strictEqual(currentState, 'VERIFYING_DELETION');

  // Only after verification passes can we reach READY_FOR_NEW_KEY
  transitionTo('READY_FOR_NEW_KEY');
  assert.strictEqual(currentState, 'READY_FOR_NEW_KEY');

  transitionTo('ACTIVE_WITH_NEW_KEY');
  assert.strictEqual(currentState, 'ACTIVE_WITH_NEW_KEY');
});

test('V2.3 Couple Features Validation: Bucket List & Date Plans', () => {
  // 1. Bucket List item
  const bucketItem = {
    space_id: 'space-999',
    title: 'Hot air balloon over Cappadocia',
    category: 'adventure',
  };
  const parsedBucket = createBucketListItemSchema.safeParse(bucketItem);
  assert.ok(parsedBucket.success, 'Valid bucket list item must succeed');

  // 2. Date Plan
  const datePlan = {
    space_id: 'space-999',
    title: 'Candlelit Italian Dinner',
    idea_category: 'romantic',
    scheduled_for: '2026-11-15T19:00:00Z',
    budget_estimate: 75.0,
    notes: 'Cozy table by the window booked',
  };
  const parsedDate = createDatePlanSchema.safeParse(datePlan);
  assert.ok(parsedDate.success, 'Valid date plan must succeed');
});

test('V2.3 Profile Customization Validation', () => {
  const profileUpdate = {
    display_name: 'Alex & Jordan',
    bio: 'Together since 2022, living our happiest life ✨',
    status_message: 'Thinking of you 🌸',
    accent_color: '#f43f5e',
    theme_mode: 'dark',
  };
  const parsedProfile = updateProfileSchema.safeParse(profileUpdate);
  assert.ok(parsedProfile.success, 'Valid profile update must succeed');

  // Invalid hex color
  const invalidHex = { accent_color: 'red' };
  assert.strictEqual(updateProfileSchema.safeParse(invalidHex).success, false, 'Invalid hex must fail');
});
