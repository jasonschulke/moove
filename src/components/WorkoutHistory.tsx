/**
 * The workout history: every finished session, newest first, with a detail
 * view and swipe-to-delete.
 *
 * It lived under a Library tab, next to the things you configure. But history
 * is not configuration, it is the record, and the record belongs with the rest
 * of the record in Insights.
 *
 * Lifted out of LibraryPage largely as it was. The markup here predates the
 * design system and still speaks in slate and emerald utilities; it is worth
 * bringing over on its own pass rather than rewriting it in the same change
 * that moves it.
 */

import { useRef, useState } from 'react';
import { loadSessions, deleteSession } from '../data/storage';
import { CARDIO_TYPE_ICONS, CARDIO_TYPE_LABELS } from '../types';
import type { WorkoutSession, WorkoutBlock } from '../types';
import { Button } from './Button';
import { useExercises } from '../contexts/ExerciseContext';

/** Pixels of drag before a swipe counts as a delete. */
const SWIPE_THRESHOLD = 80;

interface WorkoutHistoryProps {
  /** Loads a past session back into the builder. Absent hides the offer. */
  onStartWorkout?: (blocks: WorkoutBlock[]) => void;
}

export function WorkoutHistory({ onStartWorkout }: WorkoutHistoryProps = {}) {
  // The detail view names exercises by id, which the provider resolves.
  const { getExerciseById } = useExercises();

  // History state
  const [sessions, setSessions] = useState(() =>
    loadSessions()
      .filter(s => s.completedAt)
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
  );
  const [selectedSession, setSelectedSession] = useState<WorkoutSession | null>(null);

  // History swipe to delete state
  const [swipingSession, setSwipingSession] = useState<string | null>(null);
  const historySwipeStartX = useRef(0);
  const historySwipeStartY = useRef(0);
  const historySwipeOffsetRef = useRef(0);
  const historySwipeElementRef = useRef<HTMLDivElement | null>(null);
  const historySwipeActive = useRef(false);

  const handleHistoryTouchStart = (e: React.TouchEvent, sessionId: string, element: HTMLDivElement | null) => {
    historySwipeStartX.current = e.touches[0].clientX;
    historySwipeStartY.current = e.touches[0].clientY;
    historySwipeOffsetRef.current = 0;
    historySwipeElementRef.current = element;
    setSwipingSession(sessionId);
    historySwipeActive.current = false;
    if (element) {
      element.style.transition = 'none';
    }
  };

  const handleHistoryTouchMove = (e: React.TouchEvent) => {
    if (!swipingSession || !historySwipeElementRef.current) return;
    const diffX = historySwipeStartX.current - e.touches[0].clientX;
    const diffY = Math.abs(e.touches[0].clientY - historySwipeStartY.current);

    if (!historySwipeActive.current && Math.abs(diffX) > 10) {
      historySwipeActive.current = diffX > diffY * 2;
    }

    if (historySwipeActive.current) {
      const offset = Math.max(0, Math.min(diffX, 120));
      historySwipeOffsetRef.current = offset;
      historySwipeElementRef.current.style.transform = `translateX(-${offset}px)`;
    }
  };

  const handleHistoryTouchEnd = () => {
    if (!swipingSession) return;
    const element = historySwipeElementRef.current;
    if (element) {
      element.style.transition = 'transform 0.2s ease-out';
      if (historySwipeActive.current && historySwipeOffsetRef.current >= SWIPE_THRESHOLD) {
        element.style.transform = 'translateX(-100%)';
        setTimeout(() => {
          deleteSession(swipingSession);
          setSessions(loadSessions().filter(s => s.completedAt).sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()));
        }, 200);
      } else {
        element.style.transform = 'translateX(0)';
      }
    }
    setSwipingSession(null);
    historySwipeActive.current = false;
  };

  const handleDeleteSession = (sessionId: string) => {
    deleteSession(sessionId);
    setSessions(loadSessions().filter(s => s.completedAt).sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()));
    setSelectedSession(null);
  };

  return (
      selectedSession ? (
        <div className="px-4">
          <button
            onClick={() => setSelectedSession(null)}
            className="flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 mb-4"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to History
          </button>

          <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 shadow-sm mb-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{selectedSession.name}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  {new Date(selectedSession.completedAt!).toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              </div>
              {selectedSession.overallEffort && (
                <span className="px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-sm font-medium">
                  Effort: {selectedSession.overallEffort}/10
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 mb-4 flex-wrap">
              {selectedSession.cardioType ? (
                <>
                  <span className="px-2.5 py-1 rounded-lg bg-cyan-50 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 text-sm font-medium">
                    {CARDIO_TYPE_ICONS[selectedSession.cardioType]} {CARDIO_TYPE_LABELS[selectedSession.cardioType]}
                  </span>
                  {selectedSession.distance && (
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-sm font-medium">
                      {selectedSession.distance} miles
                    </span>
                  )}
                </>
              ) : (
                <span className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm font-medium">
                  {selectedSession.exercises.length} exercises
                </span>
              )}
              {selectedSession.totalDuration && (
                <span className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-sm font-medium">
                  {Math.round(selectedSession.totalDuration / 60)} min
                </span>
              )}
            </div>

            {/* Repeat workout button - only for block-based workouts */}
            {onStartWorkout && selectedSession.blocks && selectedSession.blocks.length > 0 && !selectedSession.cardioType && (
              <Button
                variant="primary"
                onClick={() => onStartWorkout(selectedSession.blocks!)}
                className="w-full"
              >
                Repeat This Workout
              </Button>
            )}
          </div>

          {/* Workout Structure with Blocks > Exercises */}
          {selectedSession.blocks && selectedSession.blocks.length > 0 ? (
            <div className="space-y-4">
              {selectedSession.blocks.map((block, blockIdx) => (
                <div key={blockIdx} className="p-4 rounded-xl bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                  <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                    {block.name}
                  </h4>
                  <div className="space-y-2">
                    {block.exercises.map((workoutExercise, exIdx) => {
                      const exercise = getExerciseById(workoutExercise.exerciseId);
                      const log = selectedSession.exercises.find(l => l.exerciseId === workoutExercise.exerciseId);
                      return (
                        <div
                          key={exIdx}
                          className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-50 dark:bg-slate-800"
                        >
                          <div className="flex items-center gap-2">
                            {workoutExercise.sets && (
                              <span className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-xs text-slate-500 dark:text-slate-400 font-medium">
                                {workoutExercise.sets}
                              </span>
                            )}
                            <span className="font-medium text-slate-700 dark:text-slate-300 text-sm">
                              {exercise?.name || workoutExercise.exerciseId}
                            </span>
                          </div>
                          <span className="text-sm text-slate-500 dark:text-slate-400 tabular-nums">
                            {log?.weight && `${log.weight}lb`}
                            {log?.weight && log?.reps && ' × '}
                            {log?.reps || workoutExercise.reps}
                            {(log?.duration || workoutExercise.duration) && `${log?.duration || workoutExercise.duration}s`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : selectedSession.exercises.length > 0 ? (
            /* Fallback for sessions without blocks */
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-3">Exercises Logged</h4>
              {selectedSession.exercises.map((log, idx) => {
                const exercise = getExerciseById(log.exerciseId);
                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-4 rounded-xl bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700"
                  >
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {exercise?.name || log.exerciseId}
                    </span>
                    <span className="text-sm text-slate-500 dark:text-slate-400 tabular-nums">
                      {log.weight && `${log.weight}lb`}
                      {log.weight && log.reps && ' × '}
                      {log.reps && `${log.reps}`}
                      {log.duration && `${log.duration}s`}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : null}

          {/* Delete button */}
          <div className="mt-6">
            <Button
              variant="ghost"
              onClick={() => handleDeleteSession(selectedSession.id)}
              className="w-full text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              Delete This Workout
            </Button>
          </div>
        </div>
      ) : (
        <div className="px-4">
          {sessions.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center">
                <svg className="w-8 h-8 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="text-slate-500 dark:text-slate-400">No workout history yet</div>
              <div className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                Complete a workout to see it here
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {sessions.map(session => {
                const dateStr = new Date(session.completedAt!).toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                });
                const timeStr = new Date(session.completedAt!).toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                });

                return (
                  <div key={session.id} className="relative overflow-hidden rounded-2xl">
                    {/* Delete background */}
                    <div className="absolute inset-y-0 right-0 w-24 bg-red-500 flex items-center justify-end pr-4">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </div>
                    <div
                      ref={el => { if (swipingSession === session.id) historySwipeElementRef.current = el; }}
                      onTouchStart={(e) => handleHistoryTouchStart(e, session.id, e.currentTarget)}
                      onTouchMove={handleHistoryTouchMove}
                      onTouchEnd={handleHistoryTouchEnd}
                      className="relative"
                    >
                      <button
                        onClick={() => setSelectedSession(session)}
                        className="w-full p-5 rounded-2xl bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 shadow-sm text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors active:scale-[0.99]"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{session.name}</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                              {dateStr} at {timeStr}
                            </p>
                          </div>
                          <svg className="w-5 h-5 text-slate-400 dark:text-slate-500 ml-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {session.cardioType ? (
                            <>
                              <span className="px-2.5 py-1 rounded-lg bg-cyan-50 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 text-sm font-medium">
                                {CARDIO_TYPE_ICONS[session.cardioType]} {CARDIO_TYPE_LABELS[session.cardioType]}
                              </span>
                              {session.distance && (
                                <span className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-sm font-medium">
                                  {session.distance} mi
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-sm font-medium">
                              {session.exercises.length} exercises
                            </span>
                          )}
                          {session.totalDuration && (
                            <span className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm font-medium">
                              {Math.round(session.totalDuration / 60)} min
                            </span>
                          )}
                          {session.overallEffort && (
                            <span className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-sm font-medium">
                              Effort: {session.overallEffort}/10
                            </span>
                          )}
                        </div>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )
  );
}
