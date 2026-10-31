import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  registerSchema,
  loginSchema,
  joinSpaceSchema,
  createReminderSchema,
  updateNotificationPreferencesSchema,
} from '../packages/validation/src/index.ts';

describe('OURSPACE Zod Validation Contracts Suite', () => {
  test('registerSchema accepts valid strong password', () => {
    const valid = {
      email: 'alex@ourspace.app',
      password: 'MyPassword123!',
      displayName: 'Alex',
    };
    const result = registerSchema.safeParse(valid);
    assert.equal(result.success, true);
  });

  test('registerSchema rejects weak password without number or uppercase', () => {
    const invalid = {
      email: 'alex@ourspace.app',
      password: 'password',
      displayName: 'Alex',
    };
    const result = registerSchema.safeParse(invalid);
    assert.equal(result.success, false);
    if (!result.success) {
      assert.ok(result.error.issues.length > 0);
    }
  });

  test('joinSpaceSchema normalizes and validates invite code format', () => {
    const valid = { code: 'LOVE-ABCD' };
    const res = joinSpaceSchema.safeParse(valid);
    assert.equal(res.success, true);

    const tooShort = { code: 'ABC' };
    const res2 = joinSpaceSchema.safeParse(tooShort);
    assert.equal(res2.success, false);
  });

  test('createReminderSchema enforces valid datetime ISO strings', () => {
    const valid = {
      space_id: '11111111-1111-1111-1111-111111111111',
      title: 'Romantic Sunset Dinner',
      due_date: new Date().toISOString(),
      priority: 'high',
      recurrence: 'none',
    };
    const res = createReminderSchema.safeParse(valid);
    assert.equal(res.success, true);

    const invalid = {
      space_id: '11111111-1111-1111-1111-111111111111',
      title: '',
      due_date: 'not-a-date',
    };
    const res2 = createReminderSchema.safeParse(invalid);
    assert.equal(res2.success, false);
  });

  test('updateNotificationPreferencesSchema validates defaults and time formats', () => {
    const valid = {
      messages_sound: 'soft-bell',
      calls_ringtone: 'romantic-harp',
      reminders_sound: 'marimba-chime',
      vibration_enabled: true,
      dnd_enabled: true,
      dnd_start: '22:00:00',
      dnd_end: '07:00:00',
      preview_privacy: false,
      notify_messages: true,
      notify_calls: true,
      notify_reminders: true,
      notify_memories: true,
    };
    const res = updateNotificationPreferencesSchema.safeParse(valid);
    assert.equal(res.success, true);
  });
});
