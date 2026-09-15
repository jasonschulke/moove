import type { Exercise } from '../types';

/** A single exercise row in the library list. Presentational; no stored state. */
export function ExerciseCard({ exercise, onClick, isFavorite, onToggleFavorite }: {
  exercise: Exercise;
  onClick: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: (e: React.MouseEvent) => void;
}) {
  const isCustom = exercise.id.startsWith('custom-');
  const equipmentLabel = exercise.equipment.charAt(0).toUpperCase() + exercise.equipment.slice(1).replace('-', ' ');

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      className="w-full p-4 rounded-xl bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors active:scale-[0.98] cursor-pointer"
    >
      <div className="flex justify-between items-center">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-slate-900 dark:text-slate-100">{exercise.name}</span>
            {onToggleFavorite && (
              <button
                onClick={(e) => { e.stopPropagation(); onToggleFavorite(e); }}
                className={`p-0.5 rounded-full transition-colors ${
                  isFavorite
                    ? 'text-pink-500 hover:text-pink-600'
                    : 'text-slate-300 dark:text-slate-600 hover:text-pink-400 dark:hover:text-pink-400'
                }`}
              >
                <svg className="w-4 h-4" fill={isFavorite ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </button>
            )}
            {isCustom ? (
              <span className="px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-600/20 text-violet-700 dark:text-violet-400 text-[10px] font-medium">
                Custom
              </span>
            ) : (
              <span className="px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-[10px] font-medium">
                Built-In
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-medium">
              {equipmentLabel}
            </span>
            {exercise.defaultWeight && (
              <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium">
                {exercise.defaultWeight} lb
              </span>
            )}
            {exercise.defaultReps && (
              <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs font-medium">
                {exercise.defaultReps} reps
              </span>
            )}
            {exercise.defaultDuration && (
              <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs font-medium">
                {exercise.defaultDuration}s
              </span>
            )}
          </div>
        </div>
        <svg className="w-5 h-5 text-slate-400 dark:text-slate-500 ml-3 flex-shrink-0 self-center" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </div>
  );
}
