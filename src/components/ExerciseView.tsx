import { useState, useEffect } from 'react';
import type { WorkoutExercise, ExerciseLog } from '../types';
import { getExerciseById, getAlternatives } from '../data/exercises';
import { getDefaultWeightForEquipment } from '../data/storage';
import { getLastWeekAverages, getExerciseHistory } from '../data/stats';
import { fetchExerciseGif } from '../utils/exerciseGifs';
import { Timer } from './Timer';
import { Sparkline } from './Sparkline';

interface ExerciseViewProps {
  workoutExercise: WorkoutExercise;
  onComplete: (log: {
    exerciseId: string;
    weight?: number;
    reps?: number;
    duration?: number;
  }) => void;
  onSkip: () => void;
  onSwapExercise: (newExerciseId: string) => void;
  onBack?: () => void;
  canGoBack?: boolean;
  compact?: boolean;
}

export function ExerciseView({
  workoutExercise,
  onComplete,
  onSkip,
  onSwapExercise,
  onBack,
  canGoBack = false,
  compact = false,
}: ExerciseViewProps) {
  const exercise = getExerciseById(workoutExercise.exerciseId);
  const lastWeekAvg = exercise ? getLastWeekAverages(exercise.id) : null;

  // Weight priority: explicit workout value > last week avg > equipment default > exercise default
  const getInitialWeight = (): number | undefined => {
    if (workoutExercise.weight) return workoutExercise.weight;
    if (lastWeekAvg?.avgWeight && lastWeekAvg.avgWeight > 0) return lastWeekAvg.avgWeight;
    if (exercise) return getDefaultWeightForEquipment(exercise.equipment) ?? exercise.defaultWeight;
    return undefined;
  };

  // Reps priority: explicit workout value > last week avg > exercise default
  const getInitialReps = (): number | string | undefined => {
    if (workoutExercise.reps) return workoutExercise.reps;
    if (lastWeekAvg?.avgReps && lastWeekAvg.avgReps > 0) return lastWeekAvg.avgReps;
    return exercise?.defaultReps;
  };

  const [weight, setWeight] = useState<number | undefined>(getInitialWeight);
  const [reps, setReps] = useState<number | string | undefined>(getInitialReps);
  const [showTimer, setShowTimer] = useState(false);
  const [gifUrl, setGifUrl] = useState<string | null>(null);
  const [gifLoading, setGifLoading] = useState(true);
  const [exerciseHistory, setExerciseHistory] = useState<ExerciseLog[]>([]);

  // Reset state when exercise changes - fixes the weight/reps auto-apply bug
  useEffect(() => {
    setWeight(getInitialWeight());
    setReps(getInitialReps());
    setShowTimer(false);
  }, [workoutExercise.exerciseId]);

  // Fetch exercise GIF
  useEffect(() => {
    if (exercise) {
      setGifLoading(true);
      fetchExerciseGif(exercise.name).then(url => {
        setGifUrl(url);
        setGifLoading(false);
      });
    }
  }, [exercise?.name]);

  // Fetch exercise history for sparklines (90 days ~ 50 data points max)
  useEffect(() => {
    if (exercise) {
      const history = getExerciseHistory(exercise.id, 50);
      setExerciseHistory(history);
    }
  }, [exercise?.id]);

  if (!exercise) {
    return <div className="p-4 text-red-400">Exercise not found</div>;
  }

  const alternatives = getAlternatives(exercise.id);
  const duration = workoutExercise.duration ?? exercise.defaultDuration;

  const handleComplete = () => {
    onComplete({
      exerciseId: exercise.id,
      weight,
      reps: typeof reps === 'number' ? reps : undefined,
      duration,
    });
  };

  const equipmentLabel = exercise.equipment.charAt(0).toUpperCase() + exercise.equipment.slice(1);
  const areaLabel = exercise.area.charAt(0).toUpperCase() + exercise.area.slice(1);

  return (
    <div className={`flex flex-col ${compact ? 'h-full' : ''}`}>
      {/* Main Content */}
      <div className={`${compact ? 'px-4 py-4 flex-1 flex flex-col justify-between' : 'px-5 py-6'}`}>
        {/* Hero: Exercise Name - centered */}
        <div className={`text-center ${compact ? 'mb-4' : 'mb-6'}`}>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">{exercise.name}</h1>
          <div className={`${compact ? 'text-xs' : 'text-sm'} text-slate-500 dark:text-slate-400 mt-1`}>
            {areaLabel} · {equipmentLabel}
          </div>
        </div>

        {/* Exercise GIF - hide in compact mode to save space */}
        {gifUrl && !gifLoading && !compact && (
          <div className="flex justify-center mb-6">
            <img
              src={gifUrl}
              alt={`${exercise.name} demonstration`}
              className="w-32 h-32 object-contain rounded-lg bg-slate-100 dark:bg-slate-800"
              loading="lazy"
            />
          </div>
        )}

        {/* Middle section - inputs and info */}
        <div>
          {/* Timer - Collapsible */}
          {showTimer && (
            <div className={compact ? 'mb-3' : 'mb-6'}>
              <Timer autoStart={true} />
            </div>
          )}

          {/* Description/Instructions - fixed height to keep layout stable */}
          <div className={`${compact ? 'mb-5 h-10' : 'mb-6 h-12'} flex items-center justify-center`}>
            <p className={`text-sm text-slate-500 dark:text-slate-400 leading-relaxed italic text-center ${compact ? 'line-clamp-2' : 'line-clamp-3'}`}>
              {exercise.description || 'Perform the exercise with controlled movement and proper form.'}
            </p>
          </div>

          {/* Progress Sparklines - 90 day trailing */}
          {exerciseHistory.length >= 2 && (
            <div className={`flex items-center justify-center gap-6 ${compact ? 'mb-3' : 'mb-4'}`}>
              {exerciseHistory.some(h => h.weight && h.weight > 0) && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 dark:text-slate-500">Weight</span>
                  <Sparkline history={exerciseHistory} metric="weight" />
                </div>
              )}
              {exerciseHistory.some(h => typeof h.reps === 'number' && h.reps > 0) && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 dark:text-slate-500">Reps</span>
                  <Sparkline history={exerciseHistory} metric="reps" />
                </div>
              )}
            </div>
          )}

          {/* Weight & Reps Input */}
          <div className="grid grid-cols-2 gap-3">
            {/* Weight Field */}
            <div className={`flex items-center gap-2 px-3 ${compact ? 'py-2.5' : 'py-2.5'} rounded-lg border border-slate-200 dark:border-slate-700 ${
              exercise.equipment === 'bodyweight'
                ? 'bg-slate-50 dark:bg-slate-800/50'
                : 'bg-white dark:bg-slate-800'
            }`}>
              <span className="material-symbols-outlined text-slate-400 flex-shrink-0" style={{ fontSize: '18px' }}>weight</span>
              <span className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wide flex-shrink-0">Weight</span>
              {exercise.equipment === 'bodyweight' ? (
                <span className="flex-1 text-right text-slate-500 dark:text-slate-400 font-medium">BW</span>
              ) : (
                <>
                  <input
                    type="number"
                    value={weight || ''}
                    onChange={e => setWeight(e.target.value ? Number(e.target.value) : undefined)}
                    className="flex-1 min-w-0 bg-transparent text-slate-900 dark:text-slate-100 text-lg font-semibold text-right focus:outline-none"
                    placeholder="—"
                  />
                  <span className="text-xs text-slate-400 flex-shrink-0">lb</span>
                </>
              )}
            </div>

            {/* Reps/Duration Field */}
            <div className={`flex items-center gap-2 px-3 ${compact ? 'py-2.5' : 'py-2.5'} rounded-lg border border-slate-200 dark:border-slate-700 ${
              duration
                ? 'bg-slate-50 dark:bg-slate-800/50'
                : 'bg-white dark:bg-slate-800'
            }`}>
              <span className="material-symbols-outlined text-slate-400 flex-shrink-0" style={{ fontSize: '18px' }}>{duration ? 'schedule' : 'tag'}</span>
              <span className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wide flex-shrink-0">{duration ? 'Time' : 'Reps'}</span>
              {duration ? (
                <span className="flex-1 text-right text-slate-500 dark:text-slate-400 font-medium">{duration}s</span>
              ) : (
                <input
                  type={reps === 'AMRAP' ? 'text' : 'number'}
                  value={reps === 'AMRAP' ? 'AMRAP' : reps || ''}
                  onChange={e => {
                    const val = e.target.value;
                    if (val.toUpperCase() === 'AMRAP') {
                      setReps('AMRAP');
                    } else {
                      setReps(val ? Number(val) : undefined);
                    }
                  }}
                  className="flex-1 min-w-0 bg-transparent text-slate-900 dark:text-slate-100 text-lg font-semibold text-right focus:outline-none"
                  placeholder="—"
                />
              )}
            </div>
          </div>
        </div>

        {/* Swap - Always visible, vertically centered */}
        <div className={`${compact ? 'flex-1' : 'h-14 mt-6'} flex items-center justify-center`}>
          {alternatives.length > 0 ? (
            <>
              <span className={`${compact ? 'text-xs' : 'text-sm'} text-slate-400 dark:text-slate-500`}>Swap: </span>
              {alternatives.map((alt, idx) => (
                <span key={alt.id}>
                  <button
                    onClick={() => onSwapExercise(alt.id)}
                    className={`${compact ? 'text-xs' : 'text-sm'} text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 dark:hover:text-emerald-300`}
                  >
                    {alt.name}
                  </button>
                  {idx < alternatives.length - 1 && <span className="text-slate-300 dark:text-slate-600 mx-1">·</span>}
                </span>
              ))}
            </>
          ) : (
            <span className={`${compact ? 'text-xs' : 'text-sm'} text-slate-300 dark:text-slate-700`}>No alternatives available</span>
          )}
        </div>
      </div>

      {/* Footer Actions */}
      <div className={`${compact ? 'px-4 py-3' : 'px-5 py-4'} border-t border-slate-200 dark:border-slate-800`}>
        <div className={`flex ${compact ? 'gap-2' : 'gap-3'}`}>
          {/* Back button - always visible, dimmed when inactive */}
          <button
            onClick={canGoBack && onBack ? onBack : undefined}
            disabled={!canGoBack}
            className={`${compact ? 'py-2.5 px-3' : 'py-3.5 px-4'} rounded-xl transition-colors ${
              canGoBack
                ? 'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-500 dark:text-slate-400'
                : 'bg-slate-100/50 dark:bg-slate-800/50 text-slate-300 dark:text-slate-600 cursor-not-allowed'
            }`}
            title="Previous exercise"
          >
            <svg className={compact ? 'w-4 h-4' : 'w-5 h-5'} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={onSkip}
            className={`flex-1 ${compact ? 'py-2.5 px-4 text-sm' : 'py-3.5 px-6 text-base'} rounded-xl font-semibold transition-colors bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200`}
          >
            Skip
          </button>
          <button
            onClick={handleComplete}
            className={`flex-1 ${compact ? 'py-2.5 px-4 text-sm' : 'py-3.5 px-6 text-base'} rounded-xl font-semibold transition-colors bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/25`}
          >
            Done
          </button>
          {/* Timer button - now on the right */}
          <button
            onClick={() => setShowTimer(!showTimer)}
            className={`${compact ? 'py-2.5 px-3' : 'py-3.5 px-4'} rounded-xl transition-colors ${
              showTimer
                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                : 'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-500 dark:text-slate-400'
            }`}
            title="Timer"
          >
            <span className="material-symbols-outlined" style={{ fontSize: compact ? '16px' : '20px', lineHeight: 1, verticalAlign: 'middle', marginTop: '-2px' }}>timer</span>
          </button>
        </div>
      </div>
    </div>
  );
}
