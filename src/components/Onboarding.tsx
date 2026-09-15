import { useState } from 'react';
import { saveUserName, savePersonality } from '../data/storage';
import { useAuth } from '../contexts/AuthContext';
import type { PersonalityType } from '../types';
import { PERSONALITY_OPTIONS } from '../types';

interface OnboardingProps {
  onComplete: () => void;
}

const STEPS = [
  {
    title: 'Welcome to Moove',
    description: 'One question a day: what can you do today to move forward. Log it in a tap and get on with your life.',
    highlight: null,
    type: 'welcome',
  },
  {
    title: 'Choose Your Vibe',
    description: 'How do you want the app to talk to you?',
    highlight: null,
    type: 'personality',
  },
  {
    title: 'Start With Today',
    description: 'The ring is the day: walk, walk the dog, dry day. Under it sits one suggestion, picked from what you still owe the week and how much week is left.',
    highlight: 'today',
    type: 'feature',
  },
  {
    title: 'Build Your Library',
    description: 'Saved workouts, exercises and gear live here. Start a workout from this tab, or build a new routine with warmup, strength, conditioning and cooldown blocks.',
    highlight: 'library',
    type: 'feature',
  },
  {
    title: 'Look Back Later',
    description: 'The week, the month and the year. Charts are a weekly question, not a daily one, so they live here instead of on Today.',
    highlight: 'insights',
    type: 'feature',
  },
];

export function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPersonality, setSelectedPersonality] = useState<PersonalityType>('encouraging');
  const { signInWithEmail, isConfigured } = useAuth();
  const currentStep = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const isWelcomeStep = currentStep.type === 'welcome';
  const isPersonalityStep = currentStep.type === 'personality';

  const finishOnboarding = async () => {
    if (userName.trim()) {
      saveUserName(userName.trim());
    }
    savePersonality(selectedPersonality);
    onComplete();
  };

  const handleNext = async () => {
    // Send magic link when leaving welcome step if email was entered
    if (isWelcomeStep && userEmail.trim() && isConfigured && !emailSent) {
      setIsLoading(true);
      setEmailError(null);
      const { error } = await signInWithEmail(userEmail.trim());
      setIsLoading(false);
      if (error) {
        setEmailError(error.message);
        // Still continue to next step even if email fails
      } else {
        setEmailSent(true);
      }
    }

    if (isLast) {
      finishOnboarding();
    } else {
      setStep(step + 1);
    }
  };

  const handleSkip = () => {
    finishOnboarding();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      {/* Dimmed background */}
      <div className="absolute inset-0 bg-slate-900/80 z-0" />

      {/* Content area with mock UI.
          The preview, the nav highlight and the card are flow siblings in a
          column. They used to be absolutely positioned, which put the nav
          highlight permanently behind the card, so the one thing those steps
          exist to point at was never visible. */}
      <div className="relative flex-1 min-h-0 flex flex-col z-10">
        <div className="flex-1 min-h-0 overflow-hidden opacity-40 pointer-events-none">
          {currentStep.type === 'welcome' && <MockWelcomeScreen />}
          {currentStep.type === 'personality' && <MockPersonalityScreen />}
          {currentStep.highlight === 'today' && <MockTodayScreen />}
          {currentStep.highlight === 'insights' && <MockInsightsScreen />}
          {currentStep.highlight === 'library' && <MockLibraryScreen />}
        </div>

        {/* Which tab this step is about */}
        {currentStep.highlight && (
          <div data-testid="nav-preview" className="flex justify-around px-4 pb-2 pt-1 flex-shrink-0">
            {['today', 'library', 'insights', 'settings'].map((item) => (
              <div
                key={item}
                className={`w-14 h-14 rounded-xl flex items-center justify-center transition-all ${
                  currentStep.highlight === item
                    ? 'bg-emerald-500/30 ring-2 ring-emerald-400 scale-110'
                    : ''
                }`}
              >
                <NavIcon name={item} active={currentStep.highlight === item} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom card */}
      <div className="relative z-20 m-4 flex-shrink-0 bg-white dark:bg-slate-800 rounded-3xl px-6 pt-6 pb-8 shadow-xl">
        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-6">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-all ${
                i === step
                  ? 'w-6 bg-emerald-500'
                  : i < step
                  ? 'bg-emerald-300 dark:bg-emerald-700'
                  : 'bg-slate-200 dark:bg-slate-600'
              }`}
            />
          ))}
        </div>

        {/* Email sent confirmation banner */}
        {emailSent && !isWelcomeStep && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Check your email to complete sign in</span>
            </div>
          </div>
        )}

        {/* Email error banner */}
        {emailError && !isWelcomeStep && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <div className="flex items-center gap-2 text-red-700 dark:text-red-400 text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{emailError}</span>
            </div>
          </div>
        )}

        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 text-center mb-3">
          {currentStep.title}
        </h2>
        <p className="text-slate-600 dark:text-slate-400 text-center mb-6 max-w-sm mx-auto">
          {currentStep.description}
        </p>

        {/* Name and email input on welcome step */}
        {isWelcomeStep && (
          <div className="mb-6 space-y-3">
            <input
              type="text"
              placeholder="What's your first name?"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            {isConfigured && (
              <div>
                <input
                  type="email"
                  placeholder="Email (optional)"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-xs text-slate-400 dark:text-slate-500 text-center mt-1.5">
                  Sync your workouts across devices
                </p>
              </div>
            )}
          </div>
        )}

        {/* Personality selection step */}
        {isPersonalityStep && (
          <div className="mb-6">
            <div className="grid grid-cols-2 gap-2">
              {PERSONALITY_OPTIONS.map(option => (
                <button
                  key={option.value}
                  onClick={() => setSelectedPersonality(option.value)}
                  className={`p-3 rounded-xl border-2 transition-all text-left ${
                    selectedPersonality === option.value
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                      : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
                  }`}
                >
                  <div className={`font-medium text-sm ${
                    selectedPersonality === option.value
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-slate-700 dark:text-slate-300'
                  }`}>
                    {option.label}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                    {option.description}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3">
          {!isLast && !isWelcomeStep && (
            <button
              onClick={handleSkip}
              disabled={isLoading}
              className="flex-1 py-3.5 rounded-xl text-slate-500 dark:text-slate-400 font-medium hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              Skip
            </button>
          )}
          <button
            onClick={handleNext}
            disabled={isLoading || (isWelcomeStep && !userName.trim())}
            className={`${isLast || isWelcomeStep ? 'flex-1' : 'flex-[2]'} py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2`}
          >
            {isLoading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Sending...
              </>
            ) : (
              isLast ? "Let's Go" : 'Next'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Mock welcome screen for intro
function MockWelcomeScreen() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-200 dark:from-slate-900 dark:to-slate-950 flex flex-col items-center pt-24 px-8">
      {/* Logo */}
      <img src="/logo_icon.png" alt="Moove" className="h-20 mb-8 dark:invert" />

      {/* Feature highlights */}
      <div className="w-full max-w-xs space-y-4 mt-8">
        {[
          { icon: '📊', label: 'Track Progress', color: 'bg-emerald-500' },
          { icon: '💪', label: 'Build Workouts', color: 'bg-blue-500' },
          { icon: '📚', label: 'Exercise Library', color: 'bg-purple-500' },
          { icon: '💬', label: 'Ask Coach', color: 'bg-amber-500' },
        ].map((feature, i) => (
          <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-white/80 dark:bg-slate-800/80 backdrop-blur">
            <div className={`w-10 h-10 rounded-lg ${feature.color} flex items-center justify-center text-lg`}>
              {feature.icon}
            </div>
            <span className="font-medium text-slate-700 dark:text-slate-300">{feature.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Mock personality screen for onboarding preview
function MockPersonalityScreen() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-200 dark:from-slate-900 dark:to-slate-950 flex flex-col items-center pt-24 px-8">
      {/* Logo */}
      <img src="/logo_icon.png" alt="Moove" className="h-16 mb-6 dark:invert" />

      {/* Speech bubbles showing different personalities */}
      <div className="w-full max-w-xs space-y-4 mt-4">
        {[
          { label: 'Encouraging', msg: "You're doing amazing! Keep it up!", color: 'bg-emerald-500' },
          { label: 'Rude', msg: "Ugh, finally decided to show up?", color: 'bg-red-500' },
          { label: 'Sarcastic', msg: "Oh look who decided to workout...", color: 'bg-purple-500' },
          { label: 'Zen', msg: "Find your inner strength...", color: 'bg-cyan-500' },
        ].map((item, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className={`w-8 h-8 rounded-full ${item.color} flex-shrink-0`} />
            <div className="flex-1 p-3 rounded-xl rounded-tl-sm bg-white/80 dark:bg-slate-800/80 backdrop-blur">
              <span className="text-xs font-medium text-slate-400 dark:text-slate-500 block mb-1">{item.label}</span>
              <span className="text-sm text-slate-700 dark:text-slate-300">{item.msg}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Mock Today screen for onboarding preview
function MockTodayScreen() {
  const rows = [
    { name: 'Walk', done: false, detail: null },
    { name: 'Walk the dog', done: false, detail: null },
    { name: 'Dry day', done: true, detail: null },
    { name: 'Lift', done: false, detail: '0 OF 3 THIS WEEK' },
    { name: 'Run', done: false, detail: '0 OF 1 THIS WEEK' },
  ];

  return (
    <div className="mv-paper min-h-screen pt-14">
      <header className="px-4 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src="/logo_icon.png" alt="Moove" className="h-9 dark:invert" />
          <img src="/moove.svg" alt="Moove" className="h-5 dark:invert" />
        </div>
        <span className="mv-caps">Mon 14 September</span>
      </header>
      <div className="mv-rule mx-4" />

      <div className="px-4 pt-5">
        <div className="mv-card flex items-center gap-5 p-5">
          <div className="relative flex-shrink-0" style={{ width: 88, height: 88 }}>
            <svg width="88" height="88" viewBox="0 0 88 88" className="-rotate-90">
              <circle cx="44" cy="44" r="40" fill="none" stroke="var(--mv-track)" strokeWidth="8" />
              <circle cx="44" cy="44" r="40" fill="none" stroke="var(--mv-green)" strokeWidth="8"
                strokeLinecap="round" strokeDasharray={2 * Math.PI * 40}
                strokeDashoffset={(2 * Math.PI * 40) * (2 / 3)} />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="mv-serif leading-none text-[26px]" style={{ color: 'var(--mv-ink)' }}>
                1<span style={{ color: 'var(--mv-faint)' }}>/3</span>
              </span>
            </div>
          </div>
          <div>
            <div className="mv-caps mb-1.5">Today</div>
            <div className="text-[14px]" style={{ color: 'var(--mv-muted)' }}>2 still open.</div>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4">
        <div className="mv-card p-5">
          <div className="mv-caps mb-2">Next</div>
          <div className="mv-serif text-[26px] leading-tight mb-1" style={{ color: 'var(--mv-ink)' }}>Lift</div>
          <div className="text-[13.5px]" style={{ color: 'var(--mv-muted)' }}>3 left, 7 days</div>
        </div>
      </div>

      <div className="px-4 pt-5 flex flex-col gap-2">
        {rows.map(row => (
          <div key={row.name} className="mv-card flex items-center gap-3 px-4 py-3.5">
            <span className="flex items-center justify-center flex-shrink-0 rounded-full"
              style={{
                width: 26, height: 26,
                background: row.done ? 'var(--mv-green)' : 'transparent',
                border: row.done ? 'none' : '1.8px solid var(--mv-track)',
              }}>
              {row.done && (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ffffff"
                  strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              )}
            </span>
            <span className="flex-grow text-[15px]"
              style={{ color: 'var(--mv-ink)', opacity: row.done ? 0.45 : 1 }}>
              {row.name}
            </span>
            {row.detail && <span className="mv-caps flex-shrink-0">{row.detail}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

// Mock Insights screen for onboarding preview
function MockInsightsScreen() {
  const bars = [
    { name: 'Walk', pct: 100, count: '7/7' },
    { name: 'Walk the dog', pct: 100, count: '7/7' },
    { name: 'Dry day', pct: 80, count: '4/5' },
    { name: 'Lift', pct: 100, count: '3/3' },
    { name: 'Run', pct: 0, count: '0/1' },
  ];

  return (
    <div className="mv-paper min-h-screen pt-14">
      <header className="px-4 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src="/logo_icon.png" alt="Moove" className="h-9 dark:invert" />
          <span className="mv-caps" style={{ fontSize: 13, letterSpacing: '2px', color: 'var(--mv-ink)' }}>Insights</span>
        </div>
        <div className="flex gap-4">
          <span className="mv-caps" style={{ color: 'var(--mv-ink)', borderBottom: '2px solid var(--mv-ink)' }}>Week</span>
          <span className="mv-caps">Month</span>
          <span className="mv-caps">Year</span>
        </div>
      </header>
      <div className="mv-rule mx-4" />

      <div className="px-4 pt-6">
        <div className="mv-card p-5">
          <div className="mv-caps mb-2">14&ndash;20 September</div>
          <div className="mv-serif text-[23px] leading-snug mb-4" style={{ color: 'var(--mv-ink)' }}>
            5 of 7 closed. No run yet.
          </div>
          {bars.map(b => (
            <div key={b.name} className="flex items-center gap-3 py-1.5">
              <span className="w-[88px] flex-shrink-0 text-[13px]" style={{ color: 'var(--mv-ink)' }}>{b.name}</span>
              <span className="flex-grow h-1.5 rounded-full" style={{ background: '#ece7dd' }}>
                <span className="block h-1.5 rounded-full" style={{ width: `${b.pct}%`, background: '#047857' }} />
              </span>
              <span className="mv-caps w-8 text-right flex-shrink-0">{b.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Mock library screen for onboarding preview
function MockLibraryScreen() {
  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 px-4 pt-16">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <img src="/logo_icon.png" alt="Moove" className="h-9 dark:invert" />
        <img src="/library.svg" alt="Library" className="h-5 dark:invert" />
      </div>

      {/* Tabs */}
      <div className="flex rounded-xl bg-slate-200 dark:bg-slate-800 p-1 mb-6">
        <div className="flex-1 py-2 px-4 rounded-lg bg-white dark:bg-slate-700 text-center">
          <span className="text-sm font-medium text-slate-900 dark:text-slate-100">Workouts</span>
        </div>
        <div className="flex-1 py-2 px-4 text-center">
          <span className="text-sm text-slate-500">Exercises</span>
        </div>
        <div className="flex-1 py-2 px-4 text-center">
          <span className="text-sm text-slate-500">History</span>
        </div>
      </div>

      {/* Saved workouts */}
      <div className="space-y-3">
        {[
          { name: 'Morning Strength', blocks: 3, exercises: 12 },
          { name: 'Full Body HIIT', blocks: 4, exercises: 16 },
          { name: 'Upper Body Focus', blocks: 2, exercises: 8 },
        ].map((workout, i) => (
          <div key={i} className="p-4 rounded-xl bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-900 dark:text-slate-100">{workout.name}</span>
                <button className="text-slate-300 dark:text-slate-600">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </button>
              </div>
              <div className="text-sm text-slate-500 mt-1">{workout.blocks} blocks • {workout.exercises} exercises</div>
            </div>
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        ))}
      </div>

      {/* Add new button */}
      <div className="mt-4 p-4 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center gap-2 text-slate-500">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        <span>Create New Workout</span>
      </div>
    </div>
  );
}

// Nav icons for highlighting
function NavIcon({ name, active }: { name: string; active: boolean }) {
  const color = active ? 'text-emerald-400' : 'text-slate-400';

  // Paths match src/components/NavBar.tsx. If one changes there, change it here.
  switch (name) {
    case 'today':
      return (
        <svg className={`w-6 h-6 ${color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9" strokeWidth={2} />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 7.5V12l3 2" />
        </svg>
      );
    case 'workout':
      return (
        <svg className={`w-6 h-6 ${color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6.5 6.5v11M4 9v6M17.5 6.5v11M20 9v6M6.5 12h11" />
        </svg>
      );
    case 'insights':
      return (
        <svg className={`w-6 h-6 ${color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 19V9M10 19V5M16 19v-7M22 19H3" />
        </svg>
      );
    case 'library':
      return (
        <svg className={`w-6 h-6 ${color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
        </svg>
      );
    case 'settings':
      return (
        <svg className={`w-6 h-6 ${color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      );
    default:
      return null;
  }
}
