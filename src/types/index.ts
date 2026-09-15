/**
 * Moove - Workout Tracking App
 * Core type definitions for the application
 */

// ============================================================================
// EQUIPMENT & MOVEMENT TYPES
// ============================================================================

/** Available equipment types for exercises */
export type EquipmentType =
  | 'bodyweight'
  | 'dumbbell'
  | 'kettlebell'
  | 'barbell'
  | 'sandbag'
  | 'resistance-band'
  | 'cable'
  | 'machine'
  | 'yoga-mat'
  | 'jump-rope'
  | 'ab-wheel'
  | 'treadmill'
  | 'smartwatch'
  | 'weight-scale'
  | 'hand-gripper'
  | 'squat-rack'
  | 'bench-press'
  | 'exercise-bike';

/** User's equipment inventory with available weights for each type */
export type EquipmentInventory = {
  [K in Exclude<EquipmentType, 'bodyweight'>]?: number[];
};

/** Movement patterns / muscle groups for categorizing exercises */
export type MuscleArea =
  | 'squat'
  | 'hinge'
  | 'press'
  | 'push'
  | 'pull'
  | 'core'
  | 'conditioning'
  | 'warmup'
  | 'cooldown'
  | 'full-body';

/** Workout block types for structuring sessions */
export type BlockType = 'warmup' | 'strength' | 'conditioning' | 'cardio' | 'cooldown';

/** Cardio workout types (no blocks/sets needed) */
export type CardioType = 'walk' | 'run' | 'trail-run' | 'hike';

/** Labels for cardio types */
export const CARDIO_TYPE_LABELS: Record<CardioType, string> = {
  'walk': 'Walk',
  'run': 'Run',
  'trail-run': 'Trail Run',
  'hike': 'Hike',
};

/** Icons/emoji for cardio types */
export const CARDIO_TYPE_ICONS: Record<CardioType, string> = {
  'walk': '🚶',
  'run': '🏃',
  'trail-run': '⛰️',
  'hike': '🥾',
};

/** Rate of Perceived Exertion (RPE) scale 1-10 */
export type EffortLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

// ============================================================================
// EXERCISE DEFINITIONS
// ============================================================================

/** Definition of an exercise in the exercise library */
export interface Exercise {
  id: string;
  name: string;
  area: MuscleArea;
  equipment: EquipmentType;
  defaultWeight?: number;
  defaultReps?: number | 'AMRAP';
  defaultDuration?: number;      // Duration in seconds
  imageUrl?: string;
  description?: string;
  alternatives?: string[];       // IDs of exercises that can substitute
}

/** An exercise as configured within a workout (with specific parameters) */
export interface WorkoutExercise {
  exerciseId: string;
  weight?: number;
  reps?: number | 'AMRAP';
  duration?: number;             // Duration in seconds
  sets?: number;
  notes?: string;
}

// ============================================================================
// WORKOUT STRUCTURE
// ============================================================================

/** A set within a workout block (for grouped exercises) */
export interface WorkoutSet {
  id: string;
  setNumber: number;
  exercises: WorkoutExercise[];
}

/** A block/section within a workout (warmup, strength, etc.) */
export interface WorkoutBlock {
  id: string;
  type: BlockType;
  name: string;
  exercises: WorkoutExercise[];  // Flat exercise list
  sets?: WorkoutSet[];           // Optional set-based structure
  repeat?: number;               // Times to repeat block
}

/** A saved workout template */
export interface WorkoutTemplate {
  id: string;
  name: string;
  blocks: WorkoutBlock[];
}

/** A workout saved to the user's library */
export interface SavedWorkout {
  id: string;
  name: string;
  estimatedMinutes?: number;
  blocks: WorkoutBlock[];
  createdAt: string;
  updatedAt: string;
  // Cardio-specific fields (if cardioType is set, blocks should be empty)
  cardioType?: CardioType;
}

// ============================================================================
// SESSION TRACKING
// ============================================================================

/** Log entry for a completed exercise during a session */
export interface ExerciseLog {
  exerciseId: string;
  weight?: number;
  reps?: number;
  duration?: number;
  effort?: EffortLevel;
  notes?: string;
  completedAt: string;
}

/** An active or completed workout session */
export interface WorkoutSession {
  id: string;
  templateId?: string;
  name: string;
  blocks: WorkoutBlock[];
  startedAt: string;
  completedAt?: string;
  exercises: ExerciseLog[];
  totalDuration?: number;        // Duration in seconds
  overallEffort?: EffortLevel;
  // Cardio-specific fields
  cardioType?: CardioType;       // If set, this is a cardio workout
  distance?: number;             // Distance in miles

  // Navigation state. Only meaningful on the in-progress session, which is
  // persisted to localStorage so an interrupted workout resumes in place.
  // Stripped before a session is written to completed history.
  currentBlockIndex?: number;
  currentExerciseIndex?: number;
  swappedExercises?: Record<string, string>;
}

// ============================================================================
// HEALTH DATA (Apple Health Import)
// ============================================================================

/** A body metric measurement (weight, body fat, etc.) */
export interface BodyMetric {
  date: string;          // ISO date string
  weight?: number;       // lbs
  bodyFat?: number;      // percentage
  source: string;        // 'apple_health' | 'manual'
}

/** A daily activity summary (from Apple Health activity rings) */
export interface ActivityDay {
  date: string;          // YYYY-MM-DD
  activeEnergy?: number; // kcal
  exerciseMinutes?: number;
  standHours?: number;
}

// ============================================================================
// USER PREFERENCES
// ============================================================================

/** Personality types for the AI coach / greeting messages */
export type PersonalityType = 'neutral' | 'sarcastic' | 'encouraging' | 'rude' | 'zen' | 'flirty';

/** Available personality options with descriptions */
export const PERSONALITY_OPTIONS: { value: PersonalityType; label: string; description: string }[] = [
  { value: 'zen', label: 'Zen', description: 'Calm and mindful' },
  { value: 'encouraging', label: 'Encouraging', description: 'Supportive and motivating' },
  { value: 'flirty', label: 'Flirty', description: 'Playful and charming' },
  { value: 'neutral', label: 'Neutral', description: 'Straightforward and professional' },
  { value: 'sarcastic', label: 'Sarcastic', description: 'Witty with playful sarcasm' },
  { value: 'rude', label: 'Rude', description: 'Blunt and unapologetic' },
];

/** RPE scale descriptions for the effort picker UI */
export const EFFORT_DESCRIPTIONS: Record<EffortLevel, { label: string; description: string }> = {
  1: { label: 'Very Light', description: 'Barely any effort, could do this all day' },
  2: { label: 'Light', description: 'Easy breathing, very comfortable' },
  3: { label: 'Light-Moderate', description: 'Comfortable, could hold a conversation' },
  4: { label: 'Moderate', description: 'Breathing heavier, still comfortable' },
  5: { label: 'Moderate', description: 'Starting to sweat, can still talk' },
  6: { label: 'Moderate-Hard', description: 'Challenging but sustainable' },
  7: { label: 'Hard', description: 'Difficult to talk, breathing hard' },
  8: { label: 'Very Hard', description: 'Very challenging, short sentences only' },
  9: { label: 'Extremely Hard', description: 'Almost all-out, can barely continue' },
  10: { label: 'Maximum', description: 'All-out effort, cannot maintain' }
};
