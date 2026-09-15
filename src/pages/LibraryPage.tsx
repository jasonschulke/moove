import { useState, useRef, useMemo } from 'react';
import type { SavedWorkout, WorkoutBlock, Exercise, MuscleArea, EquipmentType, WorkoutSession } from '../types';
import { CARDIO_TYPE_LABELS, CARDIO_TYPE_ICONS } from '../types';
import { loadSavedWorkouts, deleteSavedWorkout, addSavedWorkout, updateSavedWorkout, loadFavorites, toggleFavoriteWorkout, toggleFavoriteExercise, getExerciseDescription, setExerciseDescription, clearExerciseDescription, loadSessions, deleteSession } from '../data/storage';
import { getLastWeekAverages } from '../data/stats';
import { useExercises } from '../contexts/ExerciseContext';
import { useSignUpPrompt } from '../contexts/SignUpPromptContext';
import { Button } from '../components/Button';
import { WorkoutBuilder } from '../components/WorkoutBuilder';
import { ExerciseCard } from '../components/ExerciseCard';
import { EditableDescription } from '../components/EditableDescription';
import { EquipmentGallery } from '../components/EquipmentGallery';
import { ScreenHeader } from '../components/ScreenHeader';

interface LibraryPageProps {
  onStartWorkout: (blocks: WorkoutBlock[]) => void;
  /** Opens the start flow, which is where cardio and "repeat last" live. */
  onOpenWorkoutFlow: () => void;
}

type TabType = 'workouts' | 'exercises' | 'history' | 'equipment';

type SourceFilter = 'all' | 'default' | 'custom' | 'favorites';
type TypeFilter = 'all' | MuscleArea;

const SOURCE_FILTERS: { value: SourceFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'default', label: 'Built-In' },
  { value: 'custom', label: 'Custom' },
  { value: 'favorites', label: 'Favorites' },
];

const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'warmup', label: 'Warmup' },
  { value: 'squat', label: 'Squat' },
  { value: 'hinge', label: 'Hinge' },
  { value: 'press', label: 'Press' },
  { value: 'push', label: 'Push' },
  { value: 'pull', label: 'Pull' },
  { value: 'core', label: 'Core' },
  { value: 'conditioning', label: 'Conditioning' },
  { value: 'cooldown', label: 'Cooldown' },
  { value: 'full-body', label: 'Full Body' },
];

export function LibraryPage({ onStartWorkout, onOpenWorkoutFlow }: LibraryPageProps) {
  const { triggerSignUpPrompt } = useSignUpPrompt();
  const { exercises, addExercise, updateExercise, deleteExercise, getExerciseById } = useExercises();
  const [activeTab, setActiveTab] = useState<TabType>('workouts');

  // Workouts state
  const [workouts, setWorkouts] = useState(() => loadSavedWorkouts());
  const [editingWorkout, setEditingWorkout] = useState<SavedWorkout | null>(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [savingBlocks, setSavingBlocks] = useState<WorkoutBlock[] | null>(null);
  const [workoutName, setWorkoutName] = useState('');
  const [estimatedMinutes, setEstimatedMinutes] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Exercises state
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [search, setSearch] = useState('');
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [showExerciseDeleteConfirm, setShowExerciseDeleteConfirm] = useState<string | null>(null);
  const [favorites, setFavorites] = useState(() => loadFavorites());
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // Create/edit exercise modal state
  const [showCreateExercise, setShowCreateExercise] = useState(false);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
  const [newExerciseName, setNewExerciseName] = useState('');
  const [newExerciseArea, setNewExerciseArea] = useState<MuscleArea>('squat');
  const [newExerciseEquipment, setNewExerciseEquipment] = useState<EquipmentType>('bodyweight');
  const [newExerciseReps, setNewExerciseReps] = useState('');
  const [newExerciseDuration, setNewExerciseDuration] = useState('');
  const [newExerciseDescription, setNewExerciseDescription] = useState('');

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
      if (historySwipeActive.current && historySwipeOffsetRef.current >= swipeThreshold) {
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

  // Inline editing state
  const [addingToBlock, setAddingToBlock] = useState<number | null>(null);
  const [addingToSet, setAddingToSet] = useState<number | null>(null);
  const [exerciseSearch, setExerciseSearch] = useState('');

  // Swipe to delete state - use refs for smooth animation during swipe
  const [swipingExercise, setSwipingExercise] = useState<{ blockIdx: number; exerciseIdx: number } | null>(null);
  const swipeStartX = useRef(0);
  const swipeStartY = useRef(0);
  const swipeOffsetRef = useRef(0);
  const swipeElementRef = useRef<HTMLDivElement | null>(null);
  const swipeThreshold = 80;
  const swipeActive = useRef(false);

  // Swipe handlers with direct DOM manipulation for 60fps animation
  const handleTouchStart = (e: React.TouchEvent, blockIdx: number, exerciseIdx: number, element: HTMLDivElement | null) => {
    swipeStartX.current = e.touches[0].clientX;
    swipeStartY.current = e.touches[0].clientY;
    swipeOffsetRef.current = 0;
    swipeElementRef.current = element;
    setSwipingExercise({ blockIdx, exerciseIdx });
    swipeActive.current = false;
    if (element) {
      element.style.transition = 'none';
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!swipingExercise || !swipeElementRef.current) return;
    const diffX = swipeStartX.current - e.touches[0].clientX;
    const diffY = Math.abs(e.touches[0].clientY - swipeStartY.current);

    // Only activate swipe if horizontal movement is dominant (2:1 ratio)
    if (!swipeActive.current && Math.abs(diffX) > 10) {
      swipeActive.current = diffX > diffY * 2;
    }

    if (swipeActive.current) {
      const offset = Math.max(0, Math.min(diffX, 120));
      swipeOffsetRef.current = offset;
      // Direct DOM update - no React re-render
      swipeElementRef.current.style.transform = `translateX(-${offset}px)`;
    }
  };

  const handleTouchEnd = () => {
    if (!swipingExercise) return;
    const element = swipeElementRef.current;
    if (element) {
      element.style.transition = 'transform 0.2s ease-out';
      if (swipeActive.current && swipeOffsetRef.current >= swipeThreshold) {
        element.style.transform = 'translateX(-100%)';
        setTimeout(() => {
          removeExerciseFromBlock(swipingExercise.blockIdx, swipingExercise.exerciseIdx);
        }, 150);
      } else {
        element.style.transform = 'translateX(0)';
      }
    }
    setSwipingExercise(null);
    swipeOffsetRef.current = 0;
    swipeElementRef.current = null;
    swipeActive.current = false;
  };

  // Move exercise up or down within a block
  const moveExercise = (blockIdx: number, fromIdx: number, direction: 'up' | 'down') => {
    if (!savingBlocks) return;
    const toIdx = direction === 'up' ? fromIdx - 1 : fromIdx + 1;
    const block = savingBlocks[blockIdx];
    if (toIdx < 0 || toIdx >= block.exercises.length) return;

    const newBlocks = [...savingBlocks];
    const exercises = [...block.exercises];
    const [removed] = exercises.splice(fromIdx, 1);
    exercises.splice(toIdx, 0, removed);
    newBlocks[blockIdx] = { ...block, exercises };
    setSavingBlocks(newBlocks);
  };

  const refreshWorkouts = () => {
    setWorkouts(loadSavedWorkouts());
  };

  const handleToggleFavoriteWorkout = (workoutId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFavoriteWorkout(workoutId);
    setFavorites(loadFavorites());
  };

  const handleToggleFavoriteExercise = (exerciseId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFavoriteExercise(exerciseId);
    setFavorites(loadFavorites());
  };

  // Inline editing helpers
  const removeExerciseFromBlock = (blockIdx: number, exerciseIdx: number) => {
    if (!savingBlocks) return;
    const newBlocks = [...savingBlocks];
    newBlocks[blockIdx] = {
      ...newBlocks[blockIdx],
      exercises: newBlocks[blockIdx].exercises.filter((_, i) => i !== exerciseIdx),
    };
    // Remove empty blocks
    setSavingBlocks(newBlocks.filter(b => b.exercises.length > 0));
  };

  const addExerciseToBlock = (blockIdx: number, exerciseId: string, setNum?: number) => {
    if (!savingBlocks) return;
    const exercise = getExerciseById(exerciseId);
    if (!exercise) return;
    const newBlocks = [...savingBlocks];
    const newExercise = {
      exerciseId,
      weight: exercise.defaultWeight,
      reps: exercise.defaultReps,
      duration: exercise.defaultDuration,
      sets: setNum,
    };
    newBlocks[blockIdx] = {
      ...newBlocks[blockIdx],
      exercises: [...newBlocks[blockIdx].exercises, newExercise],
    };
    setSavingBlocks(newBlocks);
    // Keep menu open for quick multi-select, just clear search
    setExerciseSearch('');
  };

  const copyToNextSet = (blockIdx: number, exerciseId: string, currentSetNum: number) => {
    if (!savingBlocks) return;
    const block = savingBlocks[blockIdx];
    // Find max set number in this block
    const maxSet = Math.max(...block.exercises.map(e => e.sets || 1), 1);
    const nextSetNum = currentSetNum + 1;
    // Only copy if there's a next set (max 3 for strength)
    if (nextSetNum > Math.max(maxSet, 3)) return;

    const exercise = getExerciseById(exerciseId);
    if (!exercise) return;

    // Check if exercise already exists in next set
    const alreadyInNextSet = block.exercises.some(
      e => e.exerciseId === exerciseId && e.sets === nextSetNum
    );
    if (alreadyInNextSet) return;

    const newBlocks = [...savingBlocks];
    const newExercise = {
      exerciseId,
      weight: exercise.defaultWeight,
      reps: exercise.defaultReps,
      duration: exercise.defaultDuration,
      sets: nextSetNum,
    };
    newBlocks[blockIdx] = {
      ...newBlocks[blockIdx],
      exercises: [...newBlocks[blockIdx].exercises, newExercise],
    };
    setSavingBlocks(newBlocks);
  };

  // Map block types to allowed movement areas
  const getBlockAreas = (blockType: string): MuscleArea[] => {
    switch (blockType) {
      case 'warmup':
        return ['warmup', 'core', 'full-body'];
      case 'strength':
        return ['squat', 'hinge', 'press', 'push', 'pull'];
      case 'conditioning':
        return ['conditioning', 'core'];
      case 'cooldown':
        return ['warmup', 'core', 'cooldown'];
      default:
        return [];
    }
  };

  const filteredExercisesForAdding = useMemo(() => {
    if (addingToBlock === null || !savingBlocks) return [];
    const block = savingBlocks[addingToBlock];
    const existingIds = new Set(block.exercises.map(e => e.exerciseId));
    const allowedAreas = getBlockAreas(block.type);
    return exercises.filter(e => {
      if (existingIds.has(e.id)) return false;
      if (allowedAreas.length > 0 && !allowedAreas.includes(e.area)) return false;
      if (!exerciseSearch) return true;
      return e.name.toLowerCase().includes(exerciseSearch.toLowerCase());
    }).slice(0, 10);
  }, [addingToBlock, savingBlocks, exercises, exerciseSearch]);

  const getExerciseCount = (blocks: WorkoutBlock[]) => {
    return blocks.reduce((acc, b) => acc + b.exercises.length, 0);
  };

  const getBlockSummary = (blocks: WorkoutBlock[]) => {
    return blocks.map(b => `${b.name} (${b.exercises.length})`).join(', ');
  };

  // Block type icons
  const getBlockIcon = (type: string) => {
    switch (type) {
      case 'warmup':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
          </svg>
        );
      case 'strength':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12h2l2-3v6l-2-3H3zm18 0h-2l-2-3v6l2-3h2zm-9-4a2 2 0 100 4 2 2 0 000-4zm-4 2h2m4 0h2" />
          </svg>
        );
      case 'conditioning':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        );
      case 'cooldown':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        );
      default:
        return null;
    }
  };

  // Movement area colors
  const getAreaColor = (area: string) => {
    switch (area) {
      case 'squat':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300';
      case 'hinge':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300';
      case 'press':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
      case 'push':
        return 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300';
      case 'pull':
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300';
      case 'core':
        return 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300';
      case 'conditioning':
        return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300';
      case 'warmup':
        return 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300';
      case 'cooldown':
        return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300';
      default:
        return 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400';
    }
  };

  const handleCreateNew = () => {
    setShowBuilder(true);
  };

  const handleBuilderComplete = (blocks: WorkoutBlock[]) => {
    setShowBuilder(false);
    setSavingBlocks(blocks);
    setWorkoutName('');
    setEstimatedMinutes('');
  };

  const handleSaveWorkout = () => {
    if (!savingBlocks || !workoutName.trim() || isSaving) return;

    setIsSaving(true);

    try {
      if (editingWorkout) {
        updateSavedWorkout(editingWorkout.id, {
          name: workoutName.trim(),
          estimatedMinutes: estimatedMinutes ? parseInt(estimatedMinutes) : undefined,
          blocks: savingBlocks,
        });
      } else {
        addSavedWorkout({
          name: workoutName.trim(),
          estimatedMinutes: estimatedMinutes ? parseInt(estimatedMinutes) : undefined,
          blocks: savingBlocks,
        });
      }

      // Refresh workouts list first
      setWorkouts(loadSavedWorkouts());

      // Clear form state to return to main view
      setSavingBlocks(null);
      setEditingWorkout(null);
      setWorkoutName('');
      setEstimatedMinutes('');

      // Prompt anonymous users to sign up after saving a workout (only for new workouts)
      if (!editingWorkout) {
        triggerSignUpPrompt('save-workout');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditWorkout = (workout: SavedWorkout) => {
    setEditingWorkout(workout);
    setShowBuilder(true);
  };

  const handleSaveEditedWorkout = (updatedWorkout: SavedWorkout) => {
    updateSavedWorkout(updatedWorkout.id, {
      name: updatedWorkout.name,
      estimatedMinutes: updatedWorkout.estimatedMinutes,
      blocks: updatedWorkout.blocks,
    });
    setWorkouts(loadSavedWorkouts());
    setEditingWorkout(null);
    setShowBuilder(false);
  };

  const handleDeleteWorkout = (id: string) => {
    deleteSavedWorkout(id);
    refreshWorkouts();
    setShowDeleteConfirm(null);
  };

  const handleDeleteExercise = (id: string) => {
    deleteExercise(id);
    setShowExerciseDeleteConfirm(null);
  };

  const resetCreateExerciseForm = () => {
    setNewExerciseName('');
    setNewExerciseArea('squat');
    setNewExerciseEquipment('bodyweight');
    setNewExerciseReps('');
    setNewExerciseDuration('');
    setNewExerciseDescription('');
    setEditingExercise(null);
  };

  const handleEditExercise = (exercise: Exercise) => {
    setEditingExercise(exercise);
    setNewExerciseName(exercise.name);
    setNewExerciseArea(exercise.area);
    setNewExerciseEquipment(exercise.equipment);
    setNewExerciseReps(exercise.defaultReps?.toString() || '');
    setNewExerciseDuration(exercise.defaultDuration?.toString() || '');
    setNewExerciseDescription(exercise.description || '');
    setShowCreateExercise(true);
  };

  const handleCreateOrUpdateExercise = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExerciseName.trim()) return;

    if (editingExercise) {
      // Update existing exercise
      const updated = updateExercise(editingExercise.id, {
        name: newExerciseName.trim(),
        area: newExerciseArea,
        equipment: newExerciseEquipment,
        defaultReps: newExerciseReps ? parseInt(newExerciseReps) : undefined,
        defaultDuration: newExerciseDuration ? parseInt(newExerciseDuration) : undefined,
        description: newExerciseDescription.trim() || undefined,
      });
      resetCreateExerciseForm();
      setShowCreateExercise(false);
      if (updated) setSelectedExercise(updated);
    } else {
      // Create new exercise
      const newExercise = addExercise({
        name: newExerciseName.trim(),
        area: newExerciseArea,
        equipment: newExerciseEquipment,
        defaultReps: newExerciseReps ? parseInt(newExerciseReps) : undefined,
        defaultDuration: newExerciseDuration ? parseInt(newExerciseDuration) : undefined,
        description: newExerciseDescription.trim() || undefined,
      });
      resetCreateExerciseForm();
      setShowCreateExercise(false);
      setSelectedExercise(newExercise);
    }
  };

  const filteredExercises = useMemo(() => {
    return exercises.filter(e => {
      const isCustom = e.id.startsWith('custom-');

      // Source filter
      const matchesSource =
        sourceFilter === 'all' ||
        (sourceFilter === 'default' && !isCustom) ||
        (sourceFilter === 'custom' && isCustom) ||
        (sourceFilter === 'favorites' && favorites.exercises.includes(e.id));

      // Type filter
      const matchesType = typeFilter === 'all' || e.area === typeFilter;

      // Search filter
      const matchesSearch = search === '' ||
        e.name.toLowerCase().includes(search.toLowerCase()) ||
        e.equipment.toLowerCase().includes(search.toLowerCase());

      return matchesSource && matchesType && matchesSearch;
    });
  }, [exercises, sourceFilter, typeFilter, search, favorites.exercises]);

  // Filter workouts by favorites if showFavoritesOnly is true
  const displayedWorkouts = useMemo(() => {
    if (!showFavoritesOnly) return workouts;
    return workouts.filter(w => favorites.workouts.includes(w.id));
  }, [workouts, showFavoritesOnly, favorites.workouts]);

  const groupedByArea = useMemo(() => {
    const groups: Record<string, Exercise[]> = {};
    filteredExercises.forEach(e => {
      if (!groups[e.area]) groups[e.area] = [];
      groups[e.area].push(e);
    });
    return groups;
  }, [filteredExercises]);

  // Workout builder flow
  if (showBuilder) {
    return (
      <WorkoutBuilder
        onStart={handleBuilderComplete}
        onCancel={() => {
          setShowBuilder(false);
          setEditingWorkout(null);
        }}
        editWorkout={editingWorkout || undefined}
        onSave={handleSaveEditedWorkout}
      />
    );
  }

  // Save workout form
  if (savingBlocks) {
    return (
      <div className="min-h-screen flex flex-col px-4 pt-16 pb-24 safe-top bg-slate-100 dark:bg-slate-950">
        <header className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img src="/logo_icon.png" alt="Moove" className="h-9 dark:invert" />
              <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {editingWorkout ? 'Edit Workout' : 'Save Workout'}
              </h1>
            </div>
            <button
              onClick={() => {
                setSavingBlocks(null);
                setEditingWorkout(null);
              }}
              className="flex items-center text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </header>

        <div className="space-y-6 flex-1">
          {/* Name and Time - inline */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">Workout Name</label>
              <input
                type="text"
                value={workoutName}
                onChange={e => setWorkoutName(e.target.value)}
                placeholder="e.g., Full Body Strength"
                className="w-full px-4 py-3.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-base text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-shadow"
              />
            </div>
            <div className="w-24">
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">Time</label>
              <input
                type="number"
                value={estimatedMinutes}
                onChange={e => setEstimatedMinutes(e.target.value)}
                placeholder="min"
                className="w-full px-3 py-3.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-base text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-shadow text-center"
              />
            </div>
          </div>

          {/* Exercise List by Block with Inline Editing */}
          <div className="space-y-4">
            {savingBlocks.map((block, blockIdx) => {
              // Group exercises by set number
              const setGroups = new Map<number, { ex: typeof block.exercises[0]; originalIdx: number }[]>();
              block.exercises.forEach((ex, idx) => {
                const setNum = ex.sets || 1;
                if (!setGroups.has(setNum)) setGroups.set(setNum, []);
                setGroups.get(setNum)!.push({ ex, originalIdx: idx });
              });
              const sortedSets = Array.from(setGroups.entries()).sort((a, b) => a[0] - b[0]);
              const isAddingHere = addingToBlock === blockIdx;

              return (
                <div key={blockIdx} className="rounded-2xl bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                  {/* Block Header */}
                  <div className="px-4 py-3 bg-gradient-to-r from-slate-50 to-slate-100/50 dark:from-slate-800 dark:to-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 dark:text-slate-400">
                          {getBlockIcon(block.type)}
                        </span>
                        <h3 className="font-semibold text-slate-900 dark:text-slate-100">{block.name}</h3>
                      </div>
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-slate-200/80 dark:bg-slate-700 text-slate-600 dark:text-slate-400">
                        {block.exercises.length} exercise{block.exercises.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>

                  {/* Exercises - Always show with set grouping */}
                  <div className="p-4 space-y-5">
                    {sortedSets.map(([setNum, exerciseItems]) => (
                      <div key={setNum} className={`rounded-xl ${sortedSets.length > 1 ? 'bg-slate-50/50 dark:bg-slate-900/30 p-3' : ''}`}>
                        {/* Set with vertical bar */}
                        <div className="flex">
                          {/* Vertical bar column */}
                          <div className="flex flex-col items-center mr-3">
                            <div className="w-1.5 h-6 rounded-full bg-emerald-500 shrink-0" />
                            <div className="w-1.5 flex-1 rounded-full bg-emerald-200 dark:bg-emerald-800" />
                          </div>

                          {/* Content column */}
                          <div className="flex-1 min-w-0">
                            {/* Set Header */}
                            <div className="flex items-center justify-between mb-3 h-6">
                              <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
                                Set {setNum}
                              </span>
                              {!(isAddingHere && addingToSet === setNum) && (
                                <button
                                  onClick={() => {
                                    setAddingToBlock(blockIdx);
                                    setAddingToSet(setNum);
                                    setExerciseSearch('');
                                  }}
                                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 rounded-lg transition-colors"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                  </svg>
                                  Add
                                </button>
                              )}
                            </div>

                            {/* Exercise List */}
                            <div className="space-y-1">
                          {exerciseItems.map(({ ex, originalIdx }, idx) => {
                            const exercise = getExerciseById(ex.exerciseId);
                            const areaLabel = exercise?.area ? exercise.area.charAt(0).toUpperCase() + exercise.area.slice(1) : '';
                            const areaColorClass = exercise?.area ? getAreaColor(exercise.area) : '';
                            const isFirst = idx === 0;
                            const isLast = idx === exerciseItems.length - 1;

                            const isSwiping = swipingExercise?.blockIdx === blockIdx &&
                              swipingExercise?.exerciseIdx === originalIdx;

                            return (
                              <div
                                key={originalIdx}
                                className="relative overflow-hidden rounded-lg"
                              >
                                {/* Delete background - only show when swiping */}
                                {isSwiping && (
                                  <div className="absolute inset-y-0 right-0 w-24 bg-red-500 flex items-center justify-end pr-4">
                                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </div>
                                )}

                                {/* Exercise card */}
                                <div
                                  onTouchStart={(e) => handleTouchStart(e, blockIdx, originalIdx, e.currentTarget)}
                                  onTouchMove={handleTouchMove}
                                  onTouchEnd={handleTouchEnd}
                                  className="relative flex items-center gap-3 p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm"
                                  style={{ willChange: 'transform' }}
                                >
                                  {/* Movement type badge - colored */}
                                  {areaLabel && (
                                    <span className={`shrink-0 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide rounded ${areaColorClass}`}>
                                      {areaLabel}
                                    </span>
                                  )}
                                  <span className="flex-1 min-w-0 text-base font-medium text-slate-700 dark:text-slate-200 truncate">
                                    {exercise?.name || ex.exerciseId}
                                  </span>
                                  <span className="shrink-0 text-sm text-slate-400 dark:text-slate-500 tabular-nums">
                                    {ex.reps && `${ex.reps} reps`}
                                    {ex.duration && `${ex.duration}s`}
                                    {ex.weight && ` @ ${ex.weight}lb`}
                                  </span>
                                  {/* Copy to next set - only for strength block and not last set */}
                                  {block.type === 'strength' && setNum < 3 && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        copyToNextSet(blockIdx, ex.exerciseId, setNum);
                                      }}
                                      className="shrink-0 p-1.5 text-slate-400 hover:text-emerald-500 dark:text-slate-500 dark:hover:text-emerald-400 transition-colors"
                                      title="Copy to next set"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                      </svg>
                                    </button>
                                  )}
                                  {/* Reorder buttons */}
                                  <div className="shrink-0 flex flex-col -my-1">
                                    <button
                                      onClick={() => moveExercise(blockIdx, originalIdx, 'up')}
                                      disabled={isFirst}
                                      className={`p-0.5 rounded transition-colors ${isFirst ? 'text-slate-200 dark:text-slate-700' : 'text-slate-400 hover:text-emerald-500 dark:text-slate-500 dark:hover:text-emerald-400 active:scale-90'}`}
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                      </svg>
                                    </button>
                                    <button
                                      onClick={() => moveExercise(blockIdx, originalIdx, 'down')}
                                      disabled={isLast}
                                      className={`p-0.5 rounded transition-colors ${isLast ? 'text-slate-200 dark:text-slate-700' : 'text-slate-400 hover:text-emerald-500 dark:text-slate-500 dark:hover:text-emerald-400 active:scale-90'}`}
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                      </svg>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}

                          {/* Add exercise inline */}
                          {isAddingHere && addingToSet === setNum && (
                            <div className="mt-3 p-4 -ml-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
                              <div className="relative">
                                <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                <input
                                  type="text"
                                  value={exerciseSearch}
                                  onChange={e => setExerciseSearch(e.target.value)}
                                  placeholder="Search exercises..."
                                  className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 text-base text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-shadow"
                                  autoFocus
                                />
                              </div>
                              <div className="mt-3 max-h-64 overflow-y-auto space-y-1">
                                {filteredExercisesForAdding.map(ex => {
                                  const areaLabel = ex.area.charAt(0).toUpperCase() + ex.area.slice(1);
                                  const areaColorClass = getAreaColor(ex.area);
                                  return (
                                    <button
                                      key={ex.id}
                                      onClick={() => addExerciseToBlock(blockIdx, ex.id, setNum)}
                                      className="w-full flex items-center gap-3 px-4 py-3 text-left rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                                    >
                                      <span className={`shrink-0 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide rounded ${areaColorClass}`}>
                                        {areaLabel}
                                      </span>
                                      <span className="text-base font-medium text-slate-700 dark:text-slate-200">{ex.name}</span>
                                    </button>
                                  );
                                })}
                                {filteredExercisesForAdding.length === 0 && (
                                  <div className="py-4 text-center text-sm text-slate-400">No exercises found</div>
                                )}
                              </div>
                              <button
                                onClick={() => { setAddingToBlock(null); setAddingToSet(null); }}
                                className="mt-3 w-full py-2.5 text-sm font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors"
                              >
                                Done
                              </button>
                            </div>
                          )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Full builder link for major changes */}
          <button
            onClick={() => setShowBuilder(true)}
            className="w-full py-2 text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400 transition-colors"
          >
            Open full workout builder
          </button>
        </div>

        <div className="mt-8">
          <Button
            variant="primary"
            size="lg"
            onClick={handleSaveWorkout}
            disabled={!workoutName.trim() || isSaving}
            className="w-full"
          >
            {isSaving ? 'Saving...' : editingWorkout ? 'Save Changes' : 'Save to Library'}
          </Button>
        </div>
      </div>
    );
  }

  // Exercise detail view
  if (selectedExercise) {
    const averages = getLastWeekAverages(selectedExercise.id);
    const isCustom = selectedExercise.id.startsWith('custom-');
    const customDescription = getExerciseDescription(selectedExercise.id);

    return (
      <div className="min-h-screen pb-24 bg-slate-100 dark:bg-slate-950">
        <header className="px-4 pt-16 pb-4 safe-top">
          <button
            onClick={() => setSelectedExercise(null)}
            className="flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 mb-4"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{selectedExercise.name}</h1>
          {isCustom && (
            <span className="inline-block mt-2 px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-600/20 text-purple-700 dark:text-purple-400 text-xs">
              Custom
            </span>
          )}
        </header>

        <div className="px-4 space-y-6">
          <div className="flex gap-2 flex-wrap">
            <span className="px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-600/20 text-emerald-700 dark:text-emerald-400 text-sm">
              {selectedExercise.area}
            </span>
            <span className="px-3 py-1 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm">
              {selectedExercise.equipment}
            </span>
          </div>

          {/* Editable Description */}
          <EditableDescription
            defaultDescription={selectedExercise.description}
            customDescription={customDescription}
            onSave={(desc) => {
              setExerciseDescription(selectedExercise.id, desc);
              // Force re-render
              setSelectedExercise({ ...selectedExercise });
            }}
            onReset={() => {
              clearExerciseDescription(selectedExercise.id);
              // Force re-render
              setSelectedExercise({ ...selectedExercise });
            }}
          />

          <div className="p-4 rounded-xl bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none">
            <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3">Defaults</h3>
            <div className="grid grid-cols-2 gap-4">
              {selectedExercise.defaultWeight && (
                <div>
                  <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                    {selectedExercise.defaultWeight} lb
                  </div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">Weight</div>
                </div>
              )}
              {selectedExercise.defaultReps && (
                <div>
                  <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                    {selectedExercise.defaultReps}
                  </div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">Reps</div>
                </div>
              )}
              {selectedExercise.defaultDuration && (
                <div>
                  <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                    {selectedExercise.defaultDuration}s
                  </div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">Duration</div>
                </div>
              )}
            </div>
          </div>

          {averages && (averages.avgWeight > 0 || averages.avgReps > 0) && (
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-600/10 border border-emerald-200 dark:border-emerald-600/20">
              <h3 className="text-sm font-medium text-emerald-700 dark:text-emerald-400 mb-3">Last Week Averages</h3>
              <div className="grid grid-cols-2 gap-4">
                {averages.avgWeight > 0 && (
                  <div>
                    <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{averages.avgWeight} lb</div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">Avg Weight</div>
                  </div>
                )}
                {averages.avgReps > 0 && (
                  <div>
                    <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{averages.avgReps}</div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">Avg Reps</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {selectedExercise.alternatives && selectedExercise.alternatives.length > 0 && (
            <div className="p-4 rounded-xl bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none">
              <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3">Alternatives</h3>
              <div className="space-y-2">
                {selectedExercise.alternatives.map(altId => {
                  const alt = exercises.find(e => e.id === altId);
                  if (!alt) return null;
                  return (
                    <button
                      key={altId}
                      onClick={() => setSelectedExercise(alt)}
                      className="w-full p-3 rounded-lg bg-slate-100 dark:bg-slate-700/50 text-left hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                      <div className="font-medium text-slate-800 dark:text-slate-200">{alt.name}</div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">{alt.equipment}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {isCustom && (
            <div className="pt-4 space-y-3">
              {showExerciseDeleteConfirm === selectedExercise.id ? (
                <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30">
                  <p className="text-red-800 dark:text-red-200 mb-4 text-center">
                    Delete "{selectedExercise.name}"?
                  </p>
                  <div className="flex gap-3">
                    <Button variant="secondary" onClick={() => setShowExerciseDeleteConfirm(null)} className="flex-1">
                      Cancel
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => {
                        handleDeleteExercise(selectedExercise.id);
                        setSelectedExercise(null);
                      }}
                      className="flex-1"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <Button
                    variant="secondary"
                    onClick={() => handleEditExercise(selectedExercise)}
                    className="w-full"
                  >
                    Edit Exercise
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setShowExerciseDeleteConfirm(selectedExercise.id)}
                    className="w-full text-red-500 hover:text-red-600"
                  >
                    Delete Custom Exercise
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 bg-slate-100 dark:bg-slate-950">
      <ScreenHeader wordmark="/library.svg" alt="Library" />

      {/* Tabs */}
      <div className="px-4 mb-4 mt-4">
        <div className="flex rounded-xl bg-slate-200 dark:bg-slate-800 p-1">
          <button
            onClick={() => setActiveTab('workouts')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'workouts'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Workouts
          </button>
          <button
            onClick={() => setActiveTab('exercises')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'exercises'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Exercises
          </button>
          <button
            onClick={() => setActiveTab('equipment')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'equipment'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Gear
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'history'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            History
          </button>
        </div>
      </div>

      {/* Workouts Tab */}
      {activeTab === 'workouts' && (
        <div className="px-4">
          {/* Workout is no longer a tab, so this is the way in to the start
              flow: repeat the last session, or go for a walk, run or hike. */}
          <Button
            variant="primary"
            size="lg"
            onClick={onOpenWorkoutFlow}
            className="w-full mb-3"
          >
            Start a Workout
          </Button>

          <Button
            variant="secondary"
            size="lg"
            onClick={handleCreateNew}
            className="w-full mb-4"
          >
            Create New Workout
          </Button>

          {/* Favorites filter for workouts */}
          <button
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            className={`mb-4 flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
              showFavoritesOnly
                ? 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
            }`}
          >
            <svg className={`w-4 h-4 ${showFavoritesOnly ? 'fill-current' : ''}`} fill={showFavoritesOnly ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            <span className="text-sm font-medium">Favorites Only</span>
          </button>

          {displayedWorkouts.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center">
                <svg className="w-8 h-8 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <div className="text-slate-500 dark:text-slate-400">No saved workouts yet</div>
              <div className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                Create a workout and save it to your library
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {displayedWorkouts.map(workout => {
                const isFavorite = favorites.workouts.includes(workout.id);
                return (
                <div
                  key={workout.id}
                  className="p-5 rounded-2xl bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 shadow-sm"
                >
                  {showDeleteConfirm === workout.id ? (
                    <div className="text-center py-2">
                      <p className="text-lg text-slate-800 dark:text-slate-200 mb-4">Delete "{workout.name}"?</p>
                      <div className="flex gap-3">
                        <Button
                          variant="secondary"
                          onClick={() => setShowDeleteConfirm(null)}
                          className="flex-1"
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="danger"
                          onClick={() => handleDeleteWorkout(workout.id)}
                          className="flex-1"
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{workout.name}</h3>
                          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                            {getBlockSummary(workout.blocks)}
                          </p>
                          <div className="flex items-center gap-2 mt-3 flex-wrap">
                            <span className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-sm font-medium">
                              {getExerciseCount(workout.blocks)} exercises
                            </span>
                            {workout.estimatedMinutes && (
                              <span className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm font-medium">
                                ~{workout.estimatedMinutes} min
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={(e) => handleToggleFavoriteWorkout(workout.id, e)}
                          className={`p-1.5 rounded-full transition-colors ${
                            isFavorite
                              ? 'text-pink-500 hover:text-pink-600'
                              : 'text-slate-300 dark:text-slate-600 hover:text-pink-400 dark:hover:text-pink-400'
                          }`}
                        >
                          <svg className="w-6 h-6" fill={isFavorite ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                          </svg>
                        </button>
                      </div>
                      <div className="flex gap-3">
                        <Button
                          variant="primary"
                          onClick={() => onStartWorkout(workout.blocks)}
                          className="flex-1"
                        >
                          Start
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => handleEditWorkout(workout)}
                        >
                          Edit
                        </Button>
                        <button
                          onClick={() => setShowDeleteConfirm(workout.id)}
                          className="p-2.5 rounded-xl text-slate-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/20 transition-all"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
              })}
            </div>
          )}
        </div>
      )}

      {/* Exercises Tab */}
      {activeTab === 'exercises' && (
        <div>
          {/* Header with New Exercise button */}
          <div className="px-4 mb-4">
            <Button
              variant="primary"
              size="lg"
              onClick={() => setShowCreateExercise(true)}
              className="w-full"
            >
              <span className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Exercise
              </span>
            </Button>
          </div>

          {/* Search */}
          <div className="px-4 mb-4">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search exercises..."
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Filters */}
          <div className="px-4 mb-6 space-y-3">
            {/* Source filters */}
            <div>
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">Source</div>
              <div className="flex flex-wrap gap-2">
                {SOURCE_FILTERS.map(f => (
                  <button
                    key={f.value}
                    onClick={() => setSourceFilter(f.value)}
                    className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                      sourceFilter === f.value
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-transparent'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Type filters */}
            <div>
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">Type</div>
              <div className="flex flex-wrap gap-2">
                {TYPE_FILTERS.map(f => (
                  <button
                    key={f.value}
                    onClick={() => setTypeFilter(f.value)}
                    className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                      typeFilter === f.value
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-transparent'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Exercise List */}
          <div className="px-4 space-y-6">
            {sourceFilter === 'all' && typeFilter === 'all' ? (
              Object.entries(groupedByArea).map(([area, areaExercises]) => (
                <div key={area}>
                  <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                    {area}
                  </h3>
                  <div className="space-y-2">
                    {areaExercises.map(exercise => (
                      <ExerciseCard
                        key={exercise.id}
                        exercise={exercise}
                        onClick={() => setSelectedExercise(exercise)}
                        isFavorite={favorites.exercises.includes(exercise.id)}
                        onToggleFavorite={(e) => handleToggleFavoriteExercise(exercise.id, e)}
                      />
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="space-y-2">
                {filteredExercises.map(exercise => (
                  <ExerciseCard
                    key={exercise.id}
                    exercise={exercise}
                    onClick={() => setSelectedExercise(exercise)}
                    isFavorite={favorites.exercises.includes(exercise.id)}
                    onToggleFavorite={(e) => handleToggleFavoriteExercise(exercise.id, e)}
                  />
                ))}
              </div>
            )}

            {filteredExercises.length === 0 && (
              <div className="text-center py-12 text-slate-500">
                No exercises found
              </div>
            )}
          </div>
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
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
              {selectedSession.blocks && selectedSession.blocks.length > 0 && !selectedSession.cardioType && (
                <Button
                  variant="primary"
                  onClick={() => onStartWorkout(selectedSession.blocks)}
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
      )}

      {/* Equipment Tab */}
      {activeTab === 'equipment' && (
        <div className="px-4 pb-24">
          <EquipmentGallery />
        </div>
      )}

      {/* Create Exercise Modal */}
      {showCreateExercise && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-md w-full shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                {editingExercise ? 'Edit Exercise' : 'Create Exercise'}
              </h2>
              <button
                onClick={() => { setShowCreateExercise(false); resetCreateExerciseForm(); }}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateOrUpdateExercise} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">
                  Exercise Name *
                </label>
                <input
                  type="text"
                  value={newExerciseName}
                  onChange={(e) => setNewExerciseName(e.target.value)}
                  placeholder="e.g., Jump Squats"
                  className="w-full px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">
                    Movement Type
                  </label>
                  <select
                    value={newExerciseArea}
                    onChange={(e) => setNewExerciseArea(e.target.value as MuscleArea)}
                    className="w-full px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="squat">Squat</option>
                    <option value="hinge">Hinge</option>
                    <option value="press">Press</option>
                    <option value="push">Push</option>
                    <option value="pull">Pull</option>
                    <option value="core">Core</option>
                    <option value="conditioning">Conditioning</option>
                    <option value="warmup">Warmup</option>
                    <option value="cooldown">Cooldown</option>
                    <option value="full-body">Full Body</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">
                    Equipment
                  </label>
                  <select
                    value={newExerciseEquipment}
                    onChange={(e) => setNewExerciseEquipment(e.target.value as EquipmentType)}
                    className="w-full px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="bodyweight">Bodyweight</option>
                    <option value="dumbbell">Dumbbell</option>
                    <option value="kettlebell">Kettlebell</option>
                    <option value="barbell">Barbell</option>
                    <option value="sandbag">Sandbag</option>
                    <option value="resistance-band">Resistance Band</option>
                    <option value="cable">Cable</option>
                    <option value="machine">Machine</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">
                    Default Reps
                  </label>
                  <input
                    type="number"
                    value={newExerciseReps}
                    onChange={(e) => setNewExerciseReps(e.target.value)}
                    placeholder="e.g., 12"
                    className="w-full px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">
                    Default Duration (sec)
                  </label>
                  <input
                    type="number"
                    value={newExerciseDuration}
                    onChange={(e) => setNewExerciseDuration(e.target.value)}
                    placeholder="e.g., 30"
                    className="w-full px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">
                  Description (optional)
                </label>
                <textarea
                  value={newExerciseDescription}
                  onChange={(e) => setNewExerciseDescription(e.target.value)}
                  placeholder="Add notes about form, tips, etc."
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-emerald-500 resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  variant="secondary"
                  onClick={() => { setShowCreateExercise(false); resetCreateExerciseForm(); }}
                  className="flex-1"
                  type="button"
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  type="submit"
                  disabled={!newExerciseName.trim()}
                  className="flex-1"
                >
                  {editingExercise ? 'Save' : 'Create'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
