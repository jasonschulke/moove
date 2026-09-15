/**
 * Bottom navigation.
 *
 * Four flat tabs, no centre button. Workout is an ordinary tab like the rest;
 * when a session is running its icon turns green and wears a progress ring,
 * which is the only signal the floating circle was carrying.
 */

type NavPage = 'today' | 'workout' | 'library' | 'settings';

interface NavBarProps {
  currentPage: NavPage;
  onNavigate: (page: NavPage) => void;
  hasActiveWorkout: boolean;
  /** 0-100. Undefined for cardio, which has no set count to measure. */
  workoutProgress?: number;
}

/** A progress ring sized to sit behind a 24px tab icon. */
function ActivityRing({ progress }: { progress: number }) {
  const circumference = 2 * Math.PI * 13;
  return (
    <svg className="absolute inset-0 -rotate-90" width="30" height="30" viewBox="0 0 30 30">
      <circle cx="15" cy="15" r="13" fill="none" strokeWidth="2"
        className="stroke-slate-200 dark:stroke-slate-700" />
      <circle cx="15" cy="15" r="13" fill="none" strokeWidth="2" strokeLinecap="round"
        className="stroke-emerald-600 dark:stroke-emerald-400"
        strokeDasharray={circumference}
        strokeDashoffset={circumference - (progress / 100) * circumference}
        style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
    </svg>
  );
}

const ICONS: Record<NavPage, string> = {
  today: 'M12 7.5V12l3 2',
  workout: 'M6.5 6.5v11M4 9v6M17.5 6.5v11M20 9v6M6.5 12h11',
  library: 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4',
  settings: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z',
};

const LABELS: Record<NavPage, string> = {
  today: 'Today',
  workout: 'Workout',
  library: 'Library',
  settings: 'Settings',
};

const ORDER: NavPage[] = ['today', 'workout', 'library', 'settings'];

export function NavBar({ currentPage, onNavigate, hasActiveWorkout, workoutProgress }: NavBarProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-t border-slate-200 dark:border-slate-800 safe-bottom">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
        {ORDER.map(page => {
          const isActive = currentPage === page;
          const isRunning = page === 'workout' && hasActiveWorkout;
          const tint = isRunning
            ? 'text-emerald-600 dark:text-emerald-400'
            : isActive
              ? 'text-slate-800 dark:text-slate-100'
              : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200';

          return (
            <button
              key={page}
              onClick={() => onNavigate(page)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex flex-col items-center gap-1 px-4 py-2 transition-colors ${tint}`}
            >
              <span className="relative flex items-center justify-center w-[30px] h-[30px]">
                {isRunning && workoutProgress !== undefined && <ActivityRing progress={workoutProgress} />}
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {page === 'today' && <circle cx="12" cy="12" r="9" strokeWidth={isActive ? 2.5 : 2} />}
                  <path strokeLinecap="round" strokeLinejoin="round"
                    strokeWidth={isActive ? 2.5 : 2} d={ICONS[page]} />
                  {page === 'settings' && (
                    <path strokeLinecap="round" strokeLinejoin="round"
                      strokeWidth={isActive ? 2.5 : 2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  )}
                </svg>
              </span>
              <span className={`text-xs ${isActive ? 'font-medium' : ''}`}>{LABELS[page]}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
