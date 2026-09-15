/**
 * Serialisation of stored data for download.
 *
 * Split out of storage.ts. Produces JSON and CSV payloads; writes nothing.
 */

import { loadCustomDescriptions, loadCustomExercises, loadEquipmentConfig, loadFavorites, loadPersonality, loadRestDays, loadSavedWorkouts, loadSessions, loadSkipCounts, loadUserName } from './storage';

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
