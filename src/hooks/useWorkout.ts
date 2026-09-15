/**
 * useWorkout Hook - Manages active workout session state
 *
 * Handles starting, navigating, and completing workouts.
 * Persists session state to localStorage for crash recovery.
 */

import { useState, useCallback, useEffect } from 'react';
import type { WorkoutSession, WorkoutBlock, ExerciseLog, EffortLevel, CardioType } from '../types';
import { CARDIO_TYPE_LABELS } from '../types';
import { saveCurrentSession, loadCurrentSession, addCompletedSession } from '../data/storage';
import { generateUUID } from '../utils/uuid';

export function useWorkout() {
  // One read of localStorage, not three. The stored session carries its own
  // navigation state, which is what lets an interrupted workout resume.
  const [restored] = useState(() => loadCurrentSession());
  const [session, setSession] = useState<WorkoutSession | null>(restored);
  const [currentBlockIndex, setCurrentBlockIndex] = useState(restored?.currentBlockIndex ?? 0);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(restored?.currentExerciseIndex ?? 0);

  // Persist the session together with where the user is inside it.
  useEffect(() => {
    if (session) {
      saveCurrentSession({ ...session, currentBlockIndex, currentExerciseIndex });
    } else {
      saveCurrentSession(null);
    }
  }, [session, currentBlockIndex, currentExerciseIndex]);

  const startWorkoutWithBlocks = useCallback((blocks: WorkoutBlock[]) => {
    const newSession: WorkoutSession = {
      id: generateUUID(),
      name: 'Custom Workout',
      blocks,
      startedAt: new Date().toISOString(),
      exercises: [],
    };
    setSession(newSession);
    setCurrentBlockIndex(0);
    setCurrentExerciseIndex(0);
  }, []);

  const startCardioWorkout = useCallback((cardioType: CardioType) => {
    const newSession: WorkoutSession = {
      id: generateUUID(),
      name: CARDIO_TYPE_LABELS[cardioType],
      blocks: [],
      startedAt: new Date().toISOString(),
      exercises: [],
      cardioType,
    };
    setSession(newSession);
    setCurrentBlockIndex(0);
    setCurrentExerciseIndex(0);
  }, []);

  const logExercise = useCallback((log: Omit<ExerciseLog, 'completedAt'>) => {
    const exerciseLog: ExerciseLog = {
      ...log,
      completedAt: new Date().toISOString(),
    };

    setSession(prev => prev ? {
      ...prev,
      exercises: [...prev.exercises, exerciseLog],
    } : null);
  }, []);

  const nextExercise = useCallback((totalExercisesInBlock: number, totalBlocks: number) => {
    if (currentExerciseIndex < totalExercisesInBlock - 1) {
      setCurrentExerciseIndex(prev => prev + 1);
    } else if (currentBlockIndex < totalBlocks - 1) {
      setCurrentBlockIndex(prev => prev + 1);
      setCurrentExerciseIndex(0);
    }
  }, [currentBlockIndex, currentExerciseIndex]);

  const previousExercise = useCallback((getBlockExerciseCount: (index: number) => number) => {
    if (currentExerciseIndex > 0) {
      setCurrentExerciseIndex(prev => prev - 1);
    } else if (currentBlockIndex > 0) {
      const prevBlockIndex = currentBlockIndex - 1;
      setCurrentBlockIndex(prevBlockIndex);
      setCurrentExerciseIndex(getBlockExerciseCount(prevBlockIndex) - 1);
    }
  }, [currentBlockIndex, currentExerciseIndex]);

  const completeWorkout = useCallback((overallEffort?: EffortLevel, distance?: number) => {
    if (!session) return;

    // Navigation state describes an in-progress workout. It has no business in
    // the permanent history record, so it is dropped here.
    const {
      currentBlockIndex: _blockIndex,
      currentExerciseIndex: _exerciseIndex,
      swappedExercises: _swapped,
      ...sessionRecord
    } = session;
    void _blockIndex;
    void _exerciseIndex;
    void _swapped;

    const completedSession: WorkoutSession = {
      ...sessionRecord,
      completedAt: new Date().toISOString(),
      totalDuration: Math.round((Date.now() - new Date(session.startedAt).getTime()) / 1000),
      overallEffort,
      distance,
    };

    addCompletedSession(completedSession);
    setSession(null);
    setCurrentBlockIndex(0);
    setCurrentExerciseIndex(0);
  }, [session]);

  const cancelWorkout = useCallback(() => {
    setSession(null);
    setCurrentBlockIndex(0);
    setCurrentExerciseIndex(0);
    saveCurrentSession(null);
  }, []);

  /** Persist mid-workout exercise substitutions so they survive a reload. */
  const updateSwappedExercises = useCallback((swapped: Record<string, string>) => {
    setSession(prev => prev ? { ...prev, swappedExercises: swapped } : null);
  }, []);

  /** Persist mid-workout edits to the block structure. */
  const updateSessionBlocks = useCallback((blocks: WorkoutBlock[]) => {
    setSession(prev => prev ? { ...prev, blocks } : null);
  }, []);

  return {
    session,
    currentBlockIndex,
    currentExerciseIndex,
    startWorkoutWithBlocks,
    startCardioWorkout,
    logExercise,
    nextExercise,
    previousExercise,
    completeWorkout,
    cancelWorkout,
    setCurrentBlockIndex,
    setCurrentExerciseIndex,
    updateSwappedExercises,
    updateSessionBlocks,
  };
}
