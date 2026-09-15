type WorkoutType = 'strength' | 'cardio-run' | 'cardio-walk' | null;

type NavPage = 'today' | 'home' | 'workout' | 'library' | 'chat' | 'settings';

interface NavBarProps {
  currentPage: NavPage;
  onNavigate: (page: NavPage) => void;
  hasActiveWorkout: boolean;
  workoutType?: WorkoutType;
  workoutProgress?: number;
}

// Animated icon component using APNG
// Icons from Icons8 (https://icons8.com) - used under free license with attribution
function AnimatedIcon({ name, size = 28 }: { name: string; size?: number }) {
  return (
    <img
      src={`/animations/${name}.png`}
      alt={name}
      width={size}
      height={size}
      style={{ width: size, height: size }}
    />
  );
}

// Static dumbbell icon (no workout active)
function DumbbellIcon() {
  return (
    <span className="material-symbols-outlined text-white" style={{ fontSize: '28px' }}>
      fitness_center
    </span>
  );
}

// Animated strength icon (deadlift)
function LiftingIcon() {
  return <AnimatedIcon name="deadlift" />;
}

// Animated running icon
function RunningIcon() {
  return <AnimatedIcon name="running" />;
}

// Animated walking icon
function WalkingIcon() {
  return <AnimatedIcon name="walking" />;
}

function ProgressRing({ progress, children }: { progress: number; children: React.ReactNode }) {
  const circumference = 2 * Math.PI * 24;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative w-14 h-14">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 56 56">
        <defs>
          {/* Diagonal stripe pattern for remaining track */}
          <pattern id="stripePattern" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(-45)">
            <rect width="6" height="6" fill="rgba(16, 185, 129, 0.15)" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(16, 185, 129, 0.25)" strokeWidth="3" />
          </pattern>
        </defs>
        {/* Background track - faint green with stripes */}
        <circle cx="28" cy="28" r="24" fill="none" stroke="url(#stripePattern)" strokeWidth="3" />
        {/* Faint green base under stripes */}
        <circle cx="28" cy="28" r="24" fill="none" className="stroke-emerald-100 dark:stroke-emerald-700/20" strokeWidth="3" />
        {/* Stripe overlay */}
        <circle cx="28" cy="28" r="24" fill="none" stroke="url(#stripePattern)" strokeWidth="3" />
        {/* Progress arc - solid emerald on top */}
        <circle
          cx="28" cy="28" r="24"
          fill="none"
          className="stroke-emerald-600 dark:stroke-emerald-400"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {children}
      </div>
    </div>
  );
}

function WorkoutIcon({ type }: { type: WorkoutType }) {
  switch (type) {
    case 'strength':
      return <LiftingIcon />;
    case 'cardio-run':
      return <RunningIcon />;
    case 'cardio-walk':
      return <WalkingIcon />;
    default:
      return <DumbbellIcon />;
  }
}

export function NavBar({ currentPage, onNavigate, hasActiveWorkout, workoutType, workoutProgress }: NavBarProps) {
  const getButtonClass = (page: string) => {
    const isActive = currentPage === page;
    return `flex flex-col items-center gap-1 px-2 py-2 transition-colors ${
      isActive
        ? 'text-slate-800 dark:text-slate-100'
        : 'text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200'
    }`;
  };

  const getStrokeWidth = (page: string) => {
    return currentPage === page ? 2.5 : 2;
  };

  const getFontWeight = (page: string) => {
    return currentPage === page ? 'font-medium' : '';
  };

  const isWorkoutActive = currentPage === 'workout';

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-t border-slate-200 dark:border-slate-800 safe-bottom">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
        <button onClick={() => onNavigate('today')} className={getButtonClass('today')}>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="9" strokeWidth={getStrokeWidth('today')} />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={getStrokeWidth('today')} d="M12 7.5V12l3 2" />
          </svg>
          <span className={`text-xs ${getFontWeight('today')}`}>Today</span>
        </button>

        <button onClick={() => onNavigate('home')} className={getButtonClass('home')}>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={getStrokeWidth('home')} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          <span className={`text-xs ${getFontWeight('home')}`}>Home</span>
        </button>

        <button onClick={() => onNavigate('library')} className={getButtonClass('library')}>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={getStrokeWidth('library')} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
          </svg>
          <span className={`text-xs ${getFontWeight('library')}`}>Library</span>
        </button>

        {/* Center Workout button with floating circle */}
        <button
          onClick={() => onNavigate('workout')}
          className="relative flex flex-col items-center gap-1 px-3 py-2"
        >
          {/* Floating circle - center aligned with top border of nav */}
          <div className={`absolute -top-7 flex items-center justify-center shadow-lg transition-all rounded-full ${
            hasActiveWorkout
              ? 'shadow-emerald-500/40'
              : 'shadow-slate-500/30'
          }`}>
            {hasActiveWorkout && workoutProgress !== undefined ? (
              <ProgressRing progress={workoutProgress}>
                <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center">
                  <WorkoutIcon type={workoutType ?? null} />
                </div>
              </ProgressRing>
            ) : (
              <div className={`w-14 h-14 rounded-full flex items-center justify-center ring-4 ring-slate-200 dark:ring-slate-900 ${
                hasActiveWorkout ? 'bg-emerald-500' : 'bg-slate-700'
              }`}>
                {hasActiveWorkout ? (
                  <WorkoutIcon type={workoutType ?? null} />
                ) : (
                  <DumbbellIcon />
                )}
              </div>
            )}
          </div>
          {/* Spacer to maintain alignment with other tabs */}
          <div className="w-6 h-6" />
          <span className={`text-xs ${isWorkoutActive ? 'text-slate-800 dark:text-slate-100 font-medium' : 'text-slate-400'}`}>Workout</span>
        </button>

        <button onClick={() => onNavigate('chat')} className={getButtonClass('chat')}>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={getStrokeWidth('chat')} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
          <span className={`text-xs ${getFontWeight('chat')}`}>Coach</span>
        </button>

        <button onClick={() => onNavigate('settings')} className={getButtonClass('settings')}>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={getStrokeWidth('settings')} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={getStrokeWidth('settings')} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className={`text-xs ${getFontWeight('settings')}`}>Settings</span>
        </button>
      </div>
    </nav>
  );
}
