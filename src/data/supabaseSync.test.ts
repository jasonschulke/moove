import { describe, it, expect, beforeEach } from 'vitest';
import type { UserPreferences, Profile } from './supabaseSync';
import { hasLocalData, applyPreferencesToLocal, applyProfileToLocal } from './supabaseSync';

beforeEach(() => {
  localStorage.clear();
});

const emptyPreferences: UserPreferences = {
  rest_days: [],
  equipment_config: {},
  favorites: { workouts: [], exercises: [] },
  skip_counts: {},
  custom_descriptions: { exercises: {}, workouts: {} },
  chat_history: [],
};

describe('hasLocalData', () => {
  it('is false on a clean install', () => {
    expect(hasLocalData()).toBe(false);
  });

  it('is false when the stored collections are empty', () => {
    localStorage.setItem('workout_sessions', '[]');
    localStorage.setItem('saved_workouts', '[]');
    localStorage.setItem('equipment_config', '{}');
    expect(hasLocalData()).toBe(false);
  });

  it('is true when there are completed sessions', () => {
    localStorage.setItem('workout_sessions', '[{"id":"a"}]');
    expect(hasLocalData()).toBe(true);
  });

  // This is the case that used to slip through and take the download branch,
  // which overwrites exactly these keys from the cloud.
  it('is true when the only local data is custom exercises', () => {
    localStorage.setItem('workout_sessions', '[]');
    localStorage.setItem('saved_workouts', '[]');
    localStorage.setItem('custom_exercises', '[{"id":"farmer-carry"}]');
    expect(hasLocalData()).toBe(true);
  });

  it('is true when the only local data is equipment inventory', () => {
    localStorage.setItem('equipment_inventory', '{"kettlebell":[35,53]}');
    expect(hasLocalData()).toBe(true);
  });

  it('is true when the only local data is rest days', () => {
    localStorage.setItem('rest_days', '["2026-09-13"]');
    expect(hasLocalData()).toBe(true);
  });
});

describe('applyPreferencesToLocal', () => {
  it('writes values the cloud actually has', () => {
    applyPreferencesToLocal({
      ...emptyPreferences,
      rest_days: ['2026-09-13'],
      favorites: { workouts: ['w1'], exercises: [] },
    });
    expect(JSON.parse(localStorage.getItem('rest_days')!)).toEqual(['2026-09-13']);
    expect(JSON.parse(localStorage.getItem('workout_favorites')!).workouts).toEqual(['w1']);
  });

  // Signup creates a preferences row with empty defaults, so an existing row
  // is not evidence the cloud knows anything.
  it('does not blank local preferences when the cloud row is empty', () => {
    localStorage.setItem('rest_days', '["2026-09-13"]');
    localStorage.setItem('equipment_config', '{"kettlebell":53}');
    applyPreferencesToLocal(emptyPreferences);
    expect(JSON.parse(localStorage.getItem('rest_days')!)).toEqual(['2026-09-13']);
    expect(JSON.parse(localStorage.getItem('equipment_config')!)).toEqual({ kettlebell: 53 });
  });

  it('leaves untouched keys absent rather than writing empty values', () => {
    applyPreferencesToLocal(emptyPreferences);
    expect(localStorage.getItem('claude_chat_history')).toBeNull();
  });
});

describe('applyProfileToLocal', () => {
  it('writes a populated profile', () => {
    const profile: Profile = { name: 'Jason', personality: 'zen', theme: 'light' };
    applyProfileToLocal(profile);
    expect(localStorage.getItem('workout_user_name')).toBe('Jason');
    expect(localStorage.getItem('workout_personality')).toBe('zen');
    expect(localStorage.getItem('workout_theme')).toBe('light');
  });

  it('does not clear a local name when the cloud profile has none', () => {
    localStorage.setItem('workout_user_name', 'Jason');
    applyProfileToLocal({ name: null, personality: 'zen', theme: 'dark' });
    expect(localStorage.getItem('workout_user_name')).toBe('Jason');
  });
});
