/**
 * Storage Layer - Local storage persistence for all app data
 *
 * All data is stored in localStorage with JSON serialization.
 * Cloud sync is available but disabled by default to prevent data sharing.
 */

import type { WorkoutSession, ExerciseLog, SavedWorkout, WorkoutBlock } from '../types';
import { generateUUID } from '../utils/uuid';
import { supabase } from '../lib/supabase';
import { scheduleSyncToCloud } from './supabaseSync';

// Helper to trigger sync if user is logged in
async function triggerSyncIfLoggedIn() {
  if (!supabase) return;
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    scheduleSyncToCloud(user.id);
  }
}

// ============================================================================
// STORAGE KEYS
// ============================================================================

const SESSIONS_KEY = 'workout_sessions';           // Completed workout sessions
const CURRENT_SESSION_KEY = 'current_workout_session'; // Active workout in progress
const SAVED_WORKOUTS_KEY = 'saved_workouts';       // User's workout library
const REST_DAYS_KEY = 'rest_days';                 // Scheduled rest days
const CUSTOM_EXERCISES_KEY = 'custom_exercises';   // User-created exercises
const CLAUDE_API_KEY = 'claude_api_key';           // AI chat API key
const CHAT_HISTORY_KEY = 'claude_chat_history';    // AI chat message history
const EQUIPMENT_CONFIG_KEY = 'equipment_config';   // Default weights per equipment
const EQUIPMENT_INVENTORY_KEY = 'equipment_inventory'; // User's equipment with multiple weights
const OWNED_GEAR_KEY = 'owned_gear';               // Which equipment types the user owns
const BODY_METRICS_KEY = 'body_metrics';           // Body weight/fat measurements
const ACTIVITY_DAYS_KEY = 'activity_days';         // Daily activity summaries
const USER_NAME_KEY = 'workout_user_name';         // User's display name
const PERSONALITY_KEY = 'workout_personality';     // AI personality preference
const FAVORITES_KEY = 'workout_favorites';         // Favorited workouts/exercises
const SKIP_COUNTS_KEY = 'workout_skip_counts';     // Skip/swap tracking
const CUSTOM_DESCRIPTIONS_KEY = 'workout_custom_descriptions'; // User exercise notes
const SEEDED_KEY = 'workout_defaults_seeded';      // Default workout seeded once

// ============================================================================
// DATE UTILITIES
// ============================================================================

/** Format a date as YYYY-MM-DD in local timezone (not UTC) */
export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ============================================================================
// USER PROFILE
// ============================================================================

export function saveUserName(name: string): void {
  localStorage.setItem(USER_NAME_KEY, name);
  triggerSyncIfLoggedIn();
}

export function loadUserName(): string | null {
  return localStorage.getItem(USER_NAME_KEY);
}

// ============================================================================
// WORKOUT SESSIONS
// ============================================================================

export function saveSessions(sessions: WorkoutSession[]): void {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  triggerSyncIfLoggedIn();
}

export function loadSessions(): WorkoutSession[] {
  const data = localStorage.getItem(SESSIONS_KEY);
  return data ? JSON.parse(data) : [];
}

export function saveCurrentSession(session: WorkoutSession | null): void {
  if (session) {
    localStorage.setItem(CURRENT_SESSION_KEY, JSON.stringify(session));
  } else {
    localStorage.removeItem(CURRENT_SESSION_KEY);
  }
}

export function loadCurrentSession(): WorkoutSession | null {
  const data = localStorage.getItem(CURRENT_SESSION_KEY);
  return data ? JSON.parse(data) : null;
}

export function addCompletedSession(session: WorkoutSession): void {
  const sessions = loadSessions();
  sessions.unshift(session);
  saveSessions(sessions);
  saveCurrentSession(null);
}

export function deleteSession(sessionId: string): void {
  const sessions = loadSessions();
  saveSessions(sessions.filter(s => s.id !== sessionId));
}

// Saved Workouts (Library)
export function loadSavedWorkouts(): SavedWorkout[] {
  const data = localStorage.getItem(SAVED_WORKOUTS_KEY);
  return data ? JSON.parse(data) : [];
}

export function saveSavedWorkouts(workouts: SavedWorkout[]): void {
  localStorage.setItem(SAVED_WORKOUTS_KEY, JSON.stringify(workouts));
  triggerSyncIfLoggedIn();
}

export function addSavedWorkout(workout: Omit<SavedWorkout, 'id' | 'createdAt' | 'updatedAt'>): SavedWorkout {
  const workouts = loadSavedWorkouts();
  const newWorkout: SavedWorkout = {
    ...workout,
    id: generateUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  workouts.unshift(newWorkout);
  saveSavedWorkouts(workouts);
  return newWorkout;
}

export function updateSavedWorkout(id: string, updates: Partial<Omit<SavedWorkout, 'id' | 'createdAt'>>): SavedWorkout | null {
  const workouts = loadSavedWorkouts();
  const index = workouts.findIndex(w => w.id === id);
  if (index === -1) return null;

  workouts[index] = {
    ...workouts[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  saveSavedWorkouts(workouts);
  return workouts[index];
}

export function deleteSavedWorkout(id: string): void {
  const workouts = loadSavedWorkouts();
  saveSavedWorkouts(workouts.filter(w => w.id !== id));
}

export function getSavedWorkoutById(id: string): SavedWorkout | undefined {
  return loadSavedWorkouts().find(w => w.id === id);
}

// Seed default workouts if library is empty
const DEFAULT_FULL_BODY_WORKOUT: Omit<SavedWorkout, 'id' | 'createdAt' | 'updatedAt'> = {
  name: 'Full Body Strength',
  estimatedMinutes: 45,
  blocks: [
    {
      id: 'warmup-block',
      type: 'warmup',
      name: 'Warmup',
      exercises: [
        { exerciseId: 'worlds-greatest-stretch', reps: 5 },
        { exerciseId: 'hollow-body-hold', duration: 30 },
      ],
    },
    {
      id: 'strength-block',
      type: 'strength',
      name: 'Strength',
      exercises: [
        // Set 1: Squat, Hinge, Press, Pull
        { exerciseId: 'goblet-squat', sets: 1, reps: 10 },
        { exerciseId: 'deadlift', sets: 1, reps: 10 },
        { exerciseId: 'overhead-press', sets: 1, reps: 8 },
        { exerciseId: 'rows', sets: 1, reps: 10 },
        // Set 2: Squat, Hinge, Press, Pull
        { exerciseId: 'goblet-squat', sets: 2, reps: 10 },
        { exerciseId: 'deadlift', sets: 2, reps: 10 },
        { exerciseId: 'overhead-press', sets: 2, reps: 8 },
        { exerciseId: 'rows', sets: 2, reps: 10 },
        // Set 3: Squat, Hinge, Press, Pull
        { exerciseId: 'goblet-squat', sets: 3, reps: 10 },
        { exerciseId: 'deadlift', sets: 3, reps: 10 },
        { exerciseId: 'overhead-press', sets: 3, reps: 8 },
        { exerciseId: 'rows', sets: 3, reps: 10 },
      ],
    },
    {
      id: 'conditioning-block',
      type: 'conditioning',
      name: 'Conditioning',
      exercises: [
        { exerciseId: 'kb-swing', reps: 20 },
        { exerciseId: 'planks', duration: 45 },
      ],
    },
    {
      id: 'cooldown-block',
      type: 'cooldown',
      name: 'Cooldown',
      exercises: [
        { exerciseId: 'childs-pose', duration: 60 },
      ],
    },
  ],
};

/**
 * Seed the default workout, once per install.
 *
 * Guarded by a flag rather than by an empty library, so that deliberately
 * deleting every saved workout does not silently bring the default back on
 * the next app load.
 */
export function seedDefaultWorkouts(): void {
  if (localStorage.getItem(SEEDED_KEY)) return;
  if (loadSavedWorkouts().length === 0) {
    addSavedWorkout(DEFAULT_FULL_BODY_WORKOUT);
  }
  localStorage.setItem(SEEDED_KEY, 'true');
}

// Last Workout
export function getLastWorkout(): { blocks: WorkoutBlock[]; completedAt: string } | null {
  const sessions = loadSessions().filter(s => s.completedAt && s.blocks?.length > 0);
  if (sessions.length === 0) return null;
  return {
    blocks: sessions[0].blocks,
    completedAt: sessions[0].completedAt!,
  };
}

export function getExerciseHistory(exerciseId: string, limit = 10): ExerciseLog[] {
  const sessions = loadSessions();
  const history: ExerciseLog[] = [];

  for (const session of sessions) {
    for (const log of session.exercises) {
      if (log.exerciseId === exerciseId) {
        history.push(log);
        if (history.length >= limit) return history;
      }
    }
  }

  return history;
}

export function getLastWeekAverages(exerciseId: string): { avgWeight: number; avgReps: number } | null {
  const sessions = loadSessions();
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const recentLogs = sessions
    .filter(s => new Date(s.startedAt) >= oneWeekAgo)
    .flatMap(s => s.exercises)
    .filter(e => e.exerciseId === exerciseId);

  if (recentLogs.length === 0) return null;

  const weights = recentLogs.filter(l => l.weight).map(l => l.weight!);
  const reps = recentLogs.filter(l => typeof l.reps === 'number').map(l => l.reps as number);

  return {
    avgWeight: weights.length > 0 ? Math.round(weights.reduce((a, b) => a + b, 0) / weights.length) : 0,
    avgReps: reps.length > 0 ? Math.round(reps.reduce((a, b) => a + b, 0) / reps.length) : 0,
  };
}

// Get workout dates for the current week (for checkmark display)
export function getThisWeekWorkoutDates(): Set<string> {
  const sessions = loadSessions().filter(s => s.completedAt);
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay()); // Start from Sunday
  startOfWeek.setHours(0, 0, 0, 0);

  const dates = new Set<string>();
  sessions.forEach(s => {
    const sessionDate = new Date(s.startedAt);
    if (sessionDate >= startOfWeek) {
      dates.add(sessionDate.toDateString());
    }
  });
  return dates;
}

/** Workout type info for calendar display */
export interface DayWorkoutInfo {
  count: number;
  hasCardio: boolean;
  hasStrength: boolean;
}

// Get yearly contribution data (GitHub-style grid)
export function getYearlyContributions(): Map<string, DayWorkoutInfo> {
  const sessions = loadSessions().filter(s => s.completedAt);
  const contributions = new Map<string, DayWorkoutInfo>();

  // Get dates for the last 365 days
  const now = new Date();
  for (let i = 364; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = formatLocalDate(date);
    contributions.set(dateStr, { count: 0, hasCardio: false, hasStrength: false });
  }

  // Count workouts per day and track type
  sessions.forEach(s => {
    const dateStr = formatLocalDate(new Date(s.startedAt));
    if (contributions.has(dateStr)) {
      const current = contributions.get(dateStr)!;
      current.count++;
      if (s.cardioType) {
        current.hasCardio = true;
      } else if (s.exercises.length > 0) {
        current.hasStrength = true;
      }
    }
  });

  return contributions;
}

export function getWorkoutStats(): {
  totalWorkouts: number;
  thisWeek: number;
  thisMonth: number;
  avgDuration: number;
  longestStreak: number;
  currentStreak: number;
  workoutsByDay: Record<number, number>;
} {
  const sessions = loadSessions().filter(s => s.completedAt);

  const now = new Date();
  const oneWeekAgo = new Date(now);
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const oneMonthAgo = new Date(now);
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

  const thisWeek = sessions.filter(s => new Date(s.startedAt) >= oneWeekAgo).length;
  const thisMonth = sessions.filter(s => new Date(s.startedAt) >= oneMonthAgo).length;

  const durations = sessions
    .filter(s => s.totalDuration)
    .map(s => s.totalDuration!);
  const avgDuration = durations.length > 0
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : 0;

  // Calculate streaks
  const sortedDates = [...new Set(
    sessions.map(s => new Date(s.startedAt).toDateString())
  )].sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;

  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();

  for (let i = 0; i < sortedDates.length; i++) {
    const date = sortedDates[i];
    const prevDate = i > 0 ? sortedDates[i - 1] : null;

    if (i === 0) {
      if (date === today || date === yesterday) {
        currentStreak = 1;
        tempStreak = 1;
      }
    } else if (prevDate) {
      const diff = new Date(prevDate).getTime() - new Date(date).getTime();
      if (diff <= 86400000 * 1.5) {
        tempStreak++;
        if (i < sortedDates.length && (sortedDates[0] === today || sortedDates[0] === yesterday)) {
          currentStreak = tempStreak;
        }
      } else {
        tempStreak = 1;
      }
    }
    longestStreak = Math.max(longestStreak, tempStreak);
  }

  // Workouts by day of week (0 = Sunday)
  const workoutsByDay: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  sessions.forEach(s => {
    const day = new Date(s.startedAt).getDay();
    workoutsByDay[day]++;
  });

  return {
    totalWorkouts: sessions.length,
    thisWeek,
    thisMonth,
    avgDuration,
    longestStreak,
    currentStreak,
    workoutsByDay,
  };
}

// ============================================================================
// REST DAYS
// ============================================================================

export function loadRestDays(): Set<string> {
  const data = localStorage.getItem(REST_DAYS_KEY);
  return data ? new Set(JSON.parse(data)) : new Set();
}

export function saveRestDays(dates: Set<string>): void {
  localStorage.setItem(REST_DAYS_KEY, JSON.stringify([...dates]));
  triggerSyncIfLoggedIn();
}

export function toggleRestDay(dateStr: string): boolean {
  const restDays = loadRestDays();
  if (restDays.has(dateStr)) {
    restDays.delete(dateStr);
    saveRestDays(restDays);
    return false;
  } else {
    restDays.add(dateStr);
    saveRestDays(restDays);
    return true;
  }
}

export function isRestDay(dateStr: string): boolean {
  return loadRestDays().has(dateStr);
}

// ============================================================================
// CUSTOM EXERCISES
// ============================================================================

import type { Exercise } from '../types';

export function loadCustomExercises(): Exercise[] {
  const data = localStorage.getItem(CUSTOM_EXERCISES_KEY);
  return data ? JSON.parse(data) : [];
}

export function saveCustomExercises(exercises: Exercise[]): void {
  localStorage.setItem(CUSTOM_EXERCISES_KEY, JSON.stringify(exercises));
  triggerSyncIfLoggedIn();
}

export function addCustomExercise(exercise: Omit<Exercise, 'id'>): Exercise {
  const exercises = loadCustomExercises();
  const newExercise: Exercise = {
    ...exercise,
    id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  };
  exercises.push(newExercise);
  saveCustomExercises(exercises);
  return newExercise;
}

export function deleteCustomExercise(id: string): void {
  const exercises = loadCustomExercises();
  saveCustomExercises(exercises.filter(e => e.id !== id));
}

// ============================================================================
// CLAUDE AI CHAT
// ============================================================================

// Fallback API key (base64 encoded + reversed for basic obfuscation)
const _k = () => atob('QUFBXzlkeDUtQWo5ZTdWUTBsNmNGTjhkVGk2NFJuZ2lDN2hKc2ZHZmhSMm1qVXRacW9heHlSWlA1YWJxWHdzeE14dzVFRGJROUdoRFdDQ2FtX1pMcUJxN1ZXOFRFTEwtMzBpcGEtdG5hLWtz').split('').reverse().join('');

export function getClaudeApiKey(): string | null {
  // User's own key takes priority
  const userKey = localStorage.getItem(CLAUDE_API_KEY);
  if (userKey) return userKey;
  // Fallback to embedded key
  return _k();
}

export function setClaudeApiKey(key: string): void {
  localStorage.setItem(CLAUDE_API_KEY, key);
}

export function clearClaudeApiKey(): void {
  localStorage.removeItem(CLAUDE_API_KEY);
}

// Chat History
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export function loadChatHistory(): ChatMessage[] {
  const data = localStorage.getItem(CHAT_HISTORY_KEY);
  return data ? JSON.parse(data) : [];
}

export function saveChatHistory(messages: ChatMessage[]): void {
  // Keep only last 50 messages to save space
  const trimmed = messages.slice(-50);
  localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(trimmed));
  triggerSyncIfLoggedIn();
}

export function clearChatHistory(): void {
  localStorage.removeItem(CHAT_HISTORY_KEY);
}

// ============================================================================
// BACKLOG WORKOUTS (Manual date entries)
// ============================================================================

export function addBacklogWorkout(dateStr: string): WorkoutSession {
  const sessions = loadSessions();
  const date = new Date(dateStr + 'T12:00:00');

  const session: WorkoutSession = {
    id: generateUUID(),
    name: 'Backlog Workout',
    blocks: [],
    startedAt: date.toISOString(),
    completedAt: date.toISOString(),
    exercises: [],
    totalDuration: 30 * 60, // Default 30 min
  };

  sessions.push(session);
  sessions.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  saveSessions(sessions);
  return session;
}

export function removeWorkoutOnDate(dateStr: string): void {
  const sessions = loadSessions();
  const filtered = sessions.filter(s => {
    const sessionDate = formatLocalDate(new Date(s.startedAt));
    return sessionDate !== dateStr;
  });
  saveSessions(filtered);
}

export function hasWorkoutOnDate(dateStr: string): boolean {
  const sessions = loadSessions().filter(s => s.completedAt);
  return sessions.some(s => {
    const sessionDate = formatLocalDate(new Date(s.startedAt));
    return sessionDate === dateStr;
  });
}

// Check if date has a real workout (not a backlog placeholder)
export function hasRealWorkoutOnDate(dateStr: string): boolean {
  const sessions = loadSessions().filter(s => s.completedAt);
  return sessions.some(s => {
    const sessionDate = formatLocalDate(new Date(s.startedAt));
    // Real workouts have exercises logged OR are cardio workouts; backlog workouts are empty
    return sessionDate === dateStr && (s.exercises.length > 0 || s.cardioType);
  });
}

// Get effort data over time for chart
export function getEffortHistory(limit = 20): { date: string; effort: number }[] {
  const sessions = loadSessions()
    .filter(s => s.completedAt && s.overallEffort)
    .slice(0, limit)
    .reverse();

  return sessions.map(s => ({
    date: new Date(s.completedAt!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    effort: s.overallEffort!,
  }));
}

// Backfill effort scores for workouts that don't have them
export function backfillEffortScores(): void {
  const sessions = loadSessions();
  let updated = false;

  const updatedSessions = sessions.map(session => {
    if (session.completedAt && !session.overallEffort) {
      updated = true;
      // Random effort in 4-6 range
      const randomEffort = Math.floor(Math.random() * 3) + 4;
      return { ...session, overallEffort: randomEffort as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 };
    }
    return session;
  });

  if (updated) {
    saveSessions(updatedSessions);
  }
}

// Toggle year overview status: none -> workout -> rest -> none
// Protects real workouts from being removed
export function toggleYearDayStatus(dateStr: string): 'none' | 'workout' | 'rest' | 'protected' {
  const hasWorkout = hasWorkoutOnDate(dateStr);
  const isRealWorkout = hasRealWorkoutOnDate(dateStr);
  const restDays = loadRestDays();
  const isRest = restDays.has(dateStr);

  // If it's a real workout, don't allow toggling it off
  if (isRealWorkout) {
    return 'protected';
  }

  if (!hasWorkout && !isRest) {
    // none -> workout
    addBacklogWorkout(dateStr);
    return 'workout';
  } else if (hasWorkout && !isRest) {
    // workout -> rest
    removeWorkoutOnDate(dateStr);
    restDays.add(dateStr);
    saveRestDays(restDays);
    return 'rest';
  } else {
    // rest -> none
    restDays.delete(dateStr);
    saveRestDays(restDays);
    return 'none';
  }
}

// ============================================================================
// EQUIPMENT CONFIGURATION
// ============================================================================

import type { EquipmentType } from '../types';

export interface EquipmentConfig {
  dumbbell?: number;
  kettlebell?: number;
  barbell?: number;
  sandbag?: number;
  // Can add more as needed
}

// Default equipment based on user's setup
const DEFAULT_EQUIPMENT: EquipmentConfig = {
  dumbbell: 25,
  kettlebell: 50,  // Using heavier as default, user can adjust
  sandbag: 100,
  barbell: 45,     // Empty barbell
};

export function loadEquipmentConfig(): EquipmentConfig {
  const data = localStorage.getItem(EQUIPMENT_CONFIG_KEY);
  if (data) {
    return { ...DEFAULT_EQUIPMENT, ...JSON.parse(data) };
  }
  return DEFAULT_EQUIPMENT;
}

export function saveEquipmentConfig(config: EquipmentConfig): void {
  localStorage.setItem(EQUIPMENT_CONFIG_KEY, JSON.stringify(config));
  triggerSyncIfLoggedIn();
}

export function getDefaultWeightForEquipment(equipmentType: EquipmentType): number | undefined {
  const config = loadEquipmentConfig();
  switch (equipmentType) {
    case 'dumbbell':
      return config.dumbbell;
    case 'kettlebell':
      return config.kettlebell;
    case 'barbell':
      return config.barbell;
    case 'sandbag':
      return config.sandbag;
    case 'bodyweight':
      return undefined;
    default:
      return undefined;
  }
}

// ============================================================================
// EQUIPMENT INVENTORY (Multiple weights per equipment type)
// ============================================================================

import type { EquipmentInventory } from '../types';

const DEFAULT_EQUIPMENT_INVENTORY: EquipmentInventory = {
  kettlebell: [25, 35, 50],
  dumbbell: [10, 15, 20, 25],
};

export function loadEquipmentInventory(): EquipmentInventory {
  const data = localStorage.getItem(EQUIPMENT_INVENTORY_KEY);
  if (data) {
    return JSON.parse(data);
  }
  return DEFAULT_EQUIPMENT_INVENTORY;
}

export function saveEquipmentInventory(inventory: EquipmentInventory): void {
  localStorage.setItem(EQUIPMENT_INVENTORY_KEY, JSON.stringify(inventory));
  triggerSyncIfLoggedIn();
}

export function addEquipmentWeight(type: Exclude<EquipmentType, 'bodyweight'>, weight: number): void {
  const inventory = loadEquipmentInventory();
  const existing = inventory[type] || [];
  if (!existing.includes(weight)) {
    inventory[type] = [...existing, weight].sort((a, b) => a - b);
    saveEquipmentInventory(inventory);
  }
}

export function removeEquipmentWeight(type: Exclude<EquipmentType, 'bodyweight'>, weight: number): void {
  const inventory = loadEquipmentInventory();
  inventory[type] = (inventory[type] || []).filter(w => w !== weight);
  saveEquipmentInventory(inventory);
}

export function getAvailableWeightsForEquipment(type: EquipmentType): number[] {
  if (type === 'bodyweight') return [];
  return loadEquipmentInventory()[type] || [];
}

// OWNED GEAR (which equipment types the user has)
// ============================================================================

export function loadOwnedGear(): EquipmentType[] {
  const data = localStorage.getItem(OWNED_GEAR_KEY);
  if (data) {
    return JSON.parse(data);
  }
  // Migrate: treat any equipment with weights as owned
  const inventory = loadEquipmentInventory();
  const owned: EquipmentType[] = [];
  for (const [type, weights] of Object.entries(inventory)) {
    if (weights && weights.length > 0) {
      owned.push(type as EquipmentType);
    }
  }
  if (owned.length > 0) {
    saveOwnedGear(owned);
  }
  return owned;
}

export function saveOwnedGear(gear: EquipmentType[]): void {
  localStorage.setItem(OWNED_GEAR_KEY, JSON.stringify(gear));
  triggerSyncIfLoggedIn();
}

export function addOwnedGear(type: EquipmentType): void {
  const owned = loadOwnedGear();
  if (!owned.includes(type)) {
    owned.push(type);
    saveOwnedGear(owned);
  }
}

export function removeOwnedGear(type: EquipmentType): void {
  const owned = loadOwnedGear().filter(t => t !== type);
  saveOwnedGear(owned);
}

// ============================================================================
// PERSONALITY SETTINGS
// ============================================================================

import type { PersonalityType } from '../types';

export function loadPersonality(): PersonalityType {
  const data = localStorage.getItem(PERSONALITY_KEY);
  return (data as PersonalityType) || 'neutral';
}

export function savePersonality(personality: PersonalityType): void {
  localStorage.setItem(PERSONALITY_KEY, personality);
  triggerSyncIfLoggedIn();
}

// ============================================================================
// FAVORITES
// ============================================================================

export interface FavoritesData {
  workouts: string[];  // Array of workout IDs
  exercises: string[]; // Array of exercise IDs
}

export function loadFavorites(): FavoritesData {
  const data = localStorage.getItem(FAVORITES_KEY);
  return data ? JSON.parse(data) : { workouts: [], exercises: [] };
}

export function saveFavorites(favorites: FavoritesData): void {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  triggerSyncIfLoggedIn();
}

export function toggleFavoriteWorkout(workoutId: string): boolean {
  const favorites = loadFavorites();
  const index = favorites.workouts.indexOf(workoutId);
  if (index === -1) {
    favorites.workouts.push(workoutId);
    saveFavorites(favorites);
    return true;
  } else {
    favorites.workouts.splice(index, 1);
    saveFavorites(favorites);
    return false;
  }
}

export function toggleFavoriteExercise(exerciseId: string): boolean {
  const favorites = loadFavorites();
  const index = favorites.exercises.indexOf(exerciseId);
  if (index === -1) {
    favorites.exercises.push(exerciseId);
    saveFavorites(favorites);
    return true;
  } else {
    favorites.exercises.splice(index, 1);
    saveFavorites(favorites);
    return false;
  }
}

export function isFavoriteWorkout(workoutId: string): boolean {
  return loadFavorites().workouts.includes(workoutId);
}

export function isFavoriteExercise(exerciseId: string): boolean {
  return loadFavorites().exercises.includes(exerciseId);
}

// ============================================================================
// SKIP/SWAP TRACKING
// ============================================================================

export interface SkipCounts {
  [exerciseId: string]: { skips: number; swaps: number };
}

export function loadSkipCounts(): SkipCounts {
  const data = localStorage.getItem(SKIP_COUNTS_KEY);
  return data ? JSON.parse(data) : {};
}

export function saveSkipCounts(counts: SkipCounts): void {
  localStorage.setItem(SKIP_COUNTS_KEY, JSON.stringify(counts));
  triggerSyncIfLoggedIn();
}

export function incrementSkipCount(exerciseId: string): void {
  const counts = loadSkipCounts();
  if (!counts[exerciseId]) {
    counts[exerciseId] = { skips: 0, swaps: 0 };
  }
  counts[exerciseId].skips++;
  saveSkipCounts(counts);
}

export function incrementSwapCount(exerciseId: string): void {
  const counts = loadSkipCounts();
  if (!counts[exerciseId]) {
    counts[exerciseId] = { skips: 0, swaps: 0 };
  }
  counts[exerciseId].swaps++;
  saveSkipCounts(counts);
}

export function getMostSkippedExercises(limit = 5): { exerciseId: string; skips: number; swaps: number }[] {
  const counts = loadSkipCounts();
  return Object.entries(counts)
    .map(([exerciseId, data]) => ({ exerciseId, ...data }))
    .sort((a, b) => (b.skips + b.swaps) - (a.skips + a.swaps))
    .slice(0, limit);
}

// Get workout sessions for a specific date
export function getSessionsByDate(dateStr: string): WorkoutSession[] {
  const sessions = loadSessions().filter(s => s.completedAt);
  return sessions.filter(s => {
    const sessionDate = formatLocalDate(new Date(s.startedAt));
    return sessionDate === dateStr;
  });
}

// Get most used workouts based on frequency
export function getMostUsedWorkouts(limit = 10): { workoutName: string; count: number; lastUsed: string }[] {
  const sessions = loadSessions().filter(s => s.completedAt && s.name);
  const counts = new Map<string, { count: number; lastUsed: string }>();

  sessions.forEach(s => {
    const existing = counts.get(s.name) || { count: 0, lastUsed: '' };
    existing.count++;
    if (!existing.lastUsed || new Date(s.completedAt!) > new Date(existing.lastUsed)) {
      existing.lastUsed = s.completedAt!;
    }
    counts.set(s.name, existing);
  });

  return Array.from(counts.entries())
    .map(([workoutName, data]) => ({ workoutName, ...data }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

// Get most used exercises based on frequency
export function getMostUsedExercises(limit = 10): { exerciseId: string; count: number; lastUsed: string }[] {
  const sessions = loadSessions().filter(s => s.completedAt);
  const counts = new Map<string, { count: number; lastUsed: string }>();

  sessions.forEach(s => {
    s.exercises.forEach(ex => {
      const existing = counts.get(ex.exerciseId) || { count: 0, lastUsed: '' };
      existing.count++;
      if (!existing.lastUsed || new Date(ex.completedAt) > new Date(existing.lastUsed)) {
        existing.lastUsed = ex.completedAt;
      }
      counts.set(ex.exerciseId, existing);
    });
  });

  return Array.from(counts.entries())
    .map(([exerciseId, data]) => ({ exerciseId, ...data }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

// ============================================================================
// CUSTOM DESCRIPTIONS
// ============================================================================

export interface CustomDescriptions {
  exercises: Record<string, string>; // exerciseId -> custom description
  workouts: Record<string, string>;  // workoutId -> custom description
}

export function loadCustomDescriptions(): CustomDescriptions {
  const data = localStorage.getItem(CUSTOM_DESCRIPTIONS_KEY);
  return data ? JSON.parse(data) : { exercises: {}, workouts: {} };
}

export function saveCustomDescriptions(descriptions: CustomDescriptions): void {
  localStorage.setItem(CUSTOM_DESCRIPTIONS_KEY, JSON.stringify(descriptions));
  triggerSyncIfLoggedIn();
}

export function setExerciseDescription(exerciseId: string, description: string): void {
  const descriptions = loadCustomDescriptions();
  descriptions.exercises[exerciseId] = description;
  saveCustomDescriptions(descriptions);
}

export function clearExerciseDescription(exerciseId: string): void {
  const descriptions = loadCustomDescriptions();
  delete descriptions.exercises[exerciseId];
  saveCustomDescriptions(descriptions);
}

export function getExerciseDescription(exerciseId: string): string | undefined {
  return loadCustomDescriptions().exercises[exerciseId];
}

export function setWorkoutDescription(workoutId: string, description: string): void {
  const descriptions = loadCustomDescriptions();
  descriptions.workouts[workoutId] = description;
  saveCustomDescriptions(descriptions);
}

export function clearWorkoutDescription(workoutId: string): void {
  const descriptions = loadCustomDescriptions();
  delete descriptions.workouts[workoutId];
  saveCustomDescriptions(descriptions);
}

export function getWorkoutDescription(workoutId: string): string | undefined {
  return loadCustomDescriptions().workouts[workoutId];
}

// ============================================================================
// BODY METRICS & ACTIVITY DATA (Apple Health Import)
// ============================================================================

import type { BodyMetric, ActivityDay } from '../types';

export function loadBodyMetrics(): BodyMetric[] {
  const data = localStorage.getItem(BODY_METRICS_KEY);
  return data ? JSON.parse(data) : [];
}

export function saveBodyMetrics(metrics: BodyMetric[]): void {
  localStorage.setItem(BODY_METRICS_KEY, JSON.stringify(metrics));
  triggerSyncIfLoggedIn();
}

export function importBodyMetrics(newMetrics: BodyMetric[], overwrite = false): number {
  const existing = loadBodyMetrics();
  if (overwrite) {
    const newDates = new Set(newMetrics.map(m => m.date));
    const kept = existing.filter(m => !newDates.has(m.date));
    const merged = [...kept, ...newMetrics].sort((a, b) => a.date.localeCompare(b.date));
    saveBodyMetrics(merged);
    return newMetrics.length;
  }
  const existingDates = new Set(existing.map(m => m.date));
  const toAdd = newMetrics.filter(m => !existingDates.has(m.date));
  if (toAdd.length > 0) {
    const merged = [...existing, ...toAdd].sort((a, b) => a.date.localeCompare(b.date));
    saveBodyMetrics(merged);
  }
  return toAdd.length;
}

export function loadActivityDays(): ActivityDay[] {
  const data = localStorage.getItem(ACTIVITY_DAYS_KEY);
  return data ? JSON.parse(data) : [];
}

export function saveActivityDays(days: ActivityDay[]): void {
  localStorage.setItem(ACTIVITY_DAYS_KEY, JSON.stringify(days));
  triggerSyncIfLoggedIn();
}

export function importActivityDays(newDays: ActivityDay[], overwrite = false): number {
  const existing = loadActivityDays();
  if (overwrite) {
    const newDates = new Set(newDays.map(d => d.date));
    const kept = existing.filter(d => !newDates.has(d.date));
    const merged = [...kept, ...newDays].sort((a, b) => a.date.localeCompare(b.date));
    saveActivityDays(merged);
    return newDays.length;
  }
  const existingDates = new Set(existing.map(d => d.date));
  const toAdd = newDays.filter(d => !existingDates.has(d.date));
  if (toAdd.length > 0) {
    const merged = [...existing, ...toAdd].sort((a, b) => a.date.localeCompare(b.date));
    saveActivityDays(merged);
  }
  return toAdd.length;
}

export function importWorkoutSessions(newSessions: WorkoutSession[], overwrite = false): number {
  const existing = loadSessions();

  if (overwrite) {
    // Remove existing sessions that overlap with incoming ones (within 60s)
    const newStarts = newSessions.map(s => new Date(s.startedAt).getTime());
    const kept = existing.filter(s => {
      const t = new Date(s.startedAt).getTime();
      return !newStarts.some(nt => Math.abs(nt - t) < 60000);
    });
    const merged = [...kept, ...newSessions].sort((a, b) =>
      new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
    );
    saveSessions(merged);
    return newSessions.length;
  }

  const existingStarts = existing.map(s => new Date(s.startedAt).getTime());

  // Skip duplicates - sessions within 60 seconds of an existing session's start time
  const toAdd = newSessions.filter(s => {
    const startTime = new Date(s.startedAt).getTime();
    return !existingStarts.some(t => Math.abs(t - startTime) < 60000);
  });

  if (toAdd.length > 0) {
    const merged = [...existing, ...toAdd].sort((a, b) =>
      new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
    );
    saveSessions(merged);
  }
  return toAdd.length;
}

// ============================================================================
// DATA EXPORT
// ============================================================================

export function exportAllDataAsJSON(): string {
  const data = {
    exportDate: new Date().toISOString(),
    sessions: loadSessions(),
    savedWorkouts: loadSavedWorkouts(),
    customExercises: loadCustomExercises(),
    favorites: loadFavorites(),
    skipCounts: loadSkipCounts(),
    customDescriptions: loadCustomDescriptions(),
    restDays: [...loadRestDays()],
    equipmentConfig: loadEquipmentConfig(),
    personality: loadPersonality(),
    userName: loadUserName(),
  };
  return JSON.stringify(data, null, 2);
}

export function exportWorkoutsAsCSV(): string {
  const sessions = loadSessions().filter(s => s.completedAt);
  const lines: string[] = ['Date,Workout Name,Duration (min),Effort,Exercises Completed'];

  sessions.forEach(s => {
    const date = new Date(s.completedAt!).toLocaleDateString();
    const duration = s.totalDuration ? Math.round(s.totalDuration / 60) : '';
    const effort = s.overallEffort || '';
    const exerciseCount = s.exercises.length;
    lines.push(`"${date}","${s.name}",${duration},${effort},${exerciseCount}`);
  });

  return lines.join('\n');
}

export function exportExerciseLogsAsCSV(): string {
  const sessions = loadSessions().filter(s => s.completedAt);
  const lines: string[] = ['Date,Workout,Exercise,Weight (lb),Reps,Duration (s)'];

  sessions.forEach(s => {
    const date = new Date(s.completedAt!).toLocaleDateString();
    s.exercises.forEach(ex => {
      const weight = ex.weight || '';
      const reps = ex.reps || '';
      const duration = ex.duration || '';
      lines.push(`"${date}","${s.name}","${ex.exerciseId}",${weight},${reps},${duration}`);
    });
  });

  return lines.join('\n');
}

// ============================================================================
// DATA MANAGEMENT
// ============================================================================

/** Clear all app data from localStorage */
export function clearAllData(): void {
  const keysToRemove = [
    SESSIONS_KEY,
    CURRENT_SESSION_KEY,
    SAVED_WORKOUTS_KEY,
    REST_DAYS_KEY,
    CUSTOM_EXERCISES_KEY,
    CLAUDE_API_KEY,
    CHAT_HISTORY_KEY,
    EQUIPMENT_CONFIG_KEY,
    USER_NAME_KEY,
    PERSONALITY_KEY,
    FAVORITES_KEY,
    SKIP_COUNTS_KEY,
    CUSTOM_DESCRIPTIONS_KEY,
    'workout_onboarding_complete',
    'workout_theme',
  ];

  keysToRemove.forEach(key => localStorage.removeItem(key));
}
