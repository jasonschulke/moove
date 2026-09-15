/**
 * Moove - Personal Workout Tracking PWA
 *
 * Main application component handling:
 * - Page navigation via bottom nav bar
 * - Theme management (dark/light mode)
 * - Workout session state
 * - Onboarding flow for new users
 */

import { useState, useEffect } from 'react';
import type { WorkoutBlock, EffortLevel, CardioType } from './types';
import { useWorkout } from './hooks/useWorkout';
import { useLandscape } from './hooks/useLandscape';
import { seedDefaultWorkouts } from './data/storage';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SignUpPromptProvider, useSignUpPrompt } from './contexts/SignUpPromptContext';
import { ExerciseProvider } from './contexts/ExerciseContext';
import { ToastProvider } from './contexts/ToastContext';
import { performInitialSync, setSyncStatusCallback } from './data/supabaseSync';
import { NavBar } from './components/NavBar';
import { WorkoutBuilder } from './components/WorkoutBuilder';
import { WorkoutStartFlow } from './components/WorkoutStartFlow';
import { TodayPage } from './pages/TodayPage';
import { InsightsPage } from './pages/InsightsPage';
import { WorkoutPage } from './pages/WorkoutPage';
import { LibraryPage } from './pages/LibraryPage';
import { SettingsPage } from './pages/SettingsPage';
import { Onboarding } from './components/Onboarding';
import { UpdatePrompt } from './components/UpdatePrompt';

const ONBOARDING_KEY = 'workout_onboarding_complete';
const THEME_MIGRATED_KEY = 'workout_theme_light_default';

/** Check if we're coming from an auth callback (magic link) */
const isAuthCallback = () => {
  const hash = window.location.hash;
  return hash.includes('access_token') || hash.includes('refresh_token');
};

/** Available pages in the app */
type Page = 'today' | 'workout' | 'library' | 'insights' | 'settings';

/** Theme options */
type Theme = 'dark' | 'light';

function AppContent() {
  const [currentPage, setCurrentPage] = useState<Page>('today');
  const [showBuilder, setShowBuilder] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(() => {
    // Skip onboarding if coming from magic link (user has been here before)
    if (isAuthCallback()) {
      localStorage.setItem(ONBOARDING_KEY, 'true');
      return false;
    }
    return !localStorage.getItem(ONBOARDING_KEY);
  });
  const [theme, setTheme] = useState<Theme>(() => {
    // Light is the design. Changing the default only helped fresh installs,
    // so this flips existing ones once as well: anyone carrying the old dark
    // default lands on light, and a deliberate choice made after this sticks.
    if (!localStorage.getItem(THEME_MIGRATED_KEY)) {
      localStorage.setItem(THEME_MIGRATED_KEY, 'true');
      localStorage.setItem('workout_theme', 'light');
      return 'light';
    }
    const saved = localStorage.getItem('workout_theme');
    return (saved as Theme) || 'light';
  });
  const workout = useWorkout();
  const { isLandscape } = useLandscape();
  const { user, loading: authLoading, setSyncStatus } = useAuth();
  const { triggerSignUpPrompt } = useSignUpPrompt();

  // If user becomes authenticated, they've been here before - skip onboarding
  useEffect(() => {
    if (user && showOnboarding) {
      localStorage.setItem(ONBOARDING_KEY, 'true');
      setShowOnboarding(false);
    }
  }, [user, showOnboarding]);

  // Splash screen timeout
  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  // Seed default workouts on first load
  useEffect(() => {
    seedDefaultWorkouts();
  }, []);

  // Set up sync status callback and perform initial sync on login
  useEffect(() => {
    setSyncStatusCallback(setSyncStatus);
  }, [setSyncStatus]);

  useEffect(() => {
    if (user) {
      performInitialSync(user.id);
    }
  }, [user]);

  // Apply theme
  useEffect(() => {
    localStorage.setItem('workout_theme', theme);
    const root = document.documentElement;

    // Tailwind dark mode only needs the 'dark' class
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    // Update browser theme-color to match app background
    const themeColor = theme === 'dark' ? '#020617' : '#f1f5f9';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColor);
  }, [theme]);

  // Navigate to workout page only when workout first starts (not on every render)
  const [hasNavigatedToWorkout, setHasNavigatedToWorkout] = useState(false);
  useEffect(() => {
    // Check for either block-based workout or cardio workout
    const hasActiveWorkout = workout.session && (workout.session.blocks?.length > 0 || workout.session.cardioType);
    if (hasActiveWorkout && !hasNavigatedToWorkout) {
      setCurrentPage('workout');
      setShowBuilder(false);
      setHasNavigatedToWorkout(true);
    }
    // Reset flag when workout ends
    if (!workout.session) {
      setHasNavigatedToWorkout(false);
    }
  }, [workout.session, hasNavigatedToWorkout]);

  const hasActiveWorkout =
    !!workout.session && ((workout.session.blocks?.length ?? 0) > 0 || !!workout.session.cardioType);

  const handleBuilderStart = (blocks: WorkoutBlock[]) => {
    workout.startWorkoutWithBlocks(blocks);
    setShowBuilder(false);
    setCurrentPage('workout');
  };

  const handleBuilderCancel = () => {
    setShowBuilder(false);
  };

  const handleCompleteWorkout = (effort?: EffortLevel, distance?: number) => {
    workout.completeWorkout(effort, distance);
    setCurrentPage('today');
    // Prompt anonymous users to sign up after completing a workout
    triggerSignUpPrompt('workout');
  };

  const handleStartCardio = (type: CardioType) => {
    workout.startCardioWorkout(type);
    setCurrentPage('workout');
  };

  const handleCancelWorkout = () => {
    workout.cancelWorkout();
    setCurrentPage('today');
  };

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const handleOnboardingComplete = () => {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    setShowOnboarding(false);
  };

  // Show splash screen
  if (showSplash) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <img
          src="/logo_stacked.png"
          alt="Moove"
          className="h-32 animate-logo-grow"
        />
      </div>
    );
  }

  // Show onboarding for new users
  // But wait for auth to settle if we might be on a callback
  if (showOnboarding) {
    // If auth is still loading and we're on a callback, wait for it to settle
    if (authLoading && isAuthCallback()) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100">
          <img
            src="/logo_stacked.png"
            alt="Moove"
            className="h-32 animate-logo-grow"
          />
          <p className="mt-4 text-slate-500 text-sm font-medium tracking-wide">Signing you in...</p>
        </div>
      );
    }
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  // Show workout builder
  if (showBuilder) {
    return (
      <div className={theme}>
        <WorkoutBuilder
          onStart={handleBuilderStart}
          onCancel={handleBuilderCancel}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen transition-colors bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {currentPage === 'today' && (
        <TodayPage
          activeWorkout={
            hasActiveWorkout
              ? { name: workout.session!.name, onResume: () => setCurrentPage('workout') }
              : undefined
          }
        />
      )}

      {currentPage === 'workout' && (
        workout.session && (workout.session.blocks?.length > 0 || workout.session.cardioType) ? (
          <WorkoutPage
            session={workout.session}
            currentBlockIndex={workout.currentBlockIndex}
            currentExerciseIndex={workout.currentExerciseIndex}
            onLogExercise={workout.logExercise}
            onNextExercise={workout.nextExercise}
            onPreviousExercise={workout.previousExercise}
            onCompleteWorkout={handleCompleteWorkout}
            onCancelWorkout={handleCancelWorkout}
            onStartWorkout={() => setShowBuilder(true)}
            onUpdateSwappedExercises={workout.updateSwappedExercises}
            onUpdateSessionBlocks={workout.updateSessionBlocks}
          />
        ) : (
          <WorkoutStartFlow
            onStartLastWorkout={handleBuilderStart}
            onCreateNew={() => setShowBuilder(true)}
            onStartSavedWorkout={(savedWorkout) => {
              if (savedWorkout.cardioType) {
                handleStartCardio(savedWorkout.cardioType);
              } else {
                handleBuilderStart(savedWorkout.blocks);
              }
            }}
            onStartCardio={handleStartCardio}
            onManageLibrary={() => setCurrentPage('library')}
          />
        )
      )}

      {currentPage === 'insights' && <InsightsPage />}

      {currentPage === 'library' && (
        <LibraryPage onStartWorkout={handleBuilderStart} onOpenWorkoutFlow={() => setCurrentPage('workout')} />
      )}


      {currentPage === 'settings' && <SettingsPage theme={theme} onToggleTheme={toggleTheme} />}

      {/* Hide NavBar in landscape mode during active workout */}
      {!(isLandscape && currentPage === 'workout' && workout.session && ((workout.session.blocks?.length ?? 0) > 0 || !!workout.session.cardioType)) && (
        <NavBar
          currentPage={currentPage === 'workout' ? 'library' : currentPage}
          onNavigate={setCurrentPage}
        />
      )}
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <ExerciseProvider>
        <SignUpPromptProvider>
          <ToastProvider>
            <AppContent />
            <UpdatePrompt />
          </ToastProvider>
        </SignUpPromptProvider>
      </ExerciseProvider>
    </AuthProvider>
  );
}

export default App;
