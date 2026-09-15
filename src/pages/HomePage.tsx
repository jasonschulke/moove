import { useEffect, useState, useMemo, useCallback } from 'react';
import { loadRestDays, saveRestDays, toggleYearDayStatus, hasWorkoutOnDate, hasRealWorkoutOnDate, addBacklogWorkout, backfillEffortScores, loadUserName, loadPersonality, formatLocalDate } from '../data/storage';
import { getWorkoutStats, getThisWeekWorkoutDates, getYearlyContributions, getEffortHistory, getMostSkippedExercises, getSessionsByDate, getMostUsedExercises } from '../data/stats';
import { EffortChart } from '../components/EffortChart';
import { getExerciseById } from '../data/exercises';
import type { PersonalityType, WorkoutSession } from '../types';
import { CARDIO_TYPE_LABELS, CARDIO_TYPE_ICONS } from '../types';

function getTimeBasedGreeting(name: string | null, personality: PersonalityType): string {
  const hour = new Date().getHours();
  const displayName = name || 'there';
  const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';

  const greetings: Record<PersonalityType, Record<string, string[]>> = {
    neutral: {
      morning: [`Mornin', ${displayName}.`, `Good morning, ${displayName}.`],
      afternoon: [`Afternoon, ${displayName}.`, `Good afternoon, ${displayName}.`],
      evening: [`Evenin', ${displayName}.`, `Good evening, ${displayName}.`],
    },
    sarcastic: {
      morning: [`Oh look who finally woke up, ${displayName}.`, `Rise and grind, ${displayName}. Or just rise, whatever.`],
      afternoon: [`Afternoon, ${displayName}. Missing morning workouts again?`, `Well well, ${displayName} decided to show up.`],
      evening: [`Evening workout? Bold choice, ${displayName}.`, `Late night gains, ${displayName}? Respect.`],
    },
    encouraging: {
      morning: [`Good morning, ${displayName}! Today is YOUR day!`, `Rise and shine, ${displayName}! You've got this!`],
      afternoon: [`Hey ${displayName}! Keep that momentum going!`, `Afternoon, ${displayName}! You're doing amazing!`],
      evening: [`Evening, ${displayName}! Great job showing up today!`, `Hey ${displayName}! Finishing the day strong!`],
    },
    rude: {
      morning: [`Ugh, you're up? Fine, ${displayName}. Let's get this over with.`, `Oh look, ${displayName} decided to show up. Shocking.`],
      afternoon: [`Still here, ${displayName}? I guess that's something.`, `Afternoon already and you're just starting, ${displayName}? Whatever.`],
      evening: [`Cutting it close, ${displayName}. Typical.`, `Finally working out, ${displayName}? Better late than never, I suppose.`],
    },
    zen: {
      morning: [`Breathe in the morning energy, ${displayName}.`, `A peaceful morning awaits you, ${displayName}.`],
      afternoon: [`Center yourself this afternoon, ${displayName}.`, `The afternoon brings balance, ${displayName}.`],
      evening: [`Find your evening calm, ${displayName}.`, `As the day ends, strength begins, ${displayName}.`],
    },
    flirty: {
      morning: [`Good morning, gorgeous! Ready to get sweaty, ${displayName}?`, `Hey ${displayName}, looking good! Let's make those muscles jealous.`],
      afternoon: [`Hey there, ${displayName}. Come here often?`, `Afternoon, ${displayName}. Those gains are looking good on you.`],
      evening: [`Evening, ${displayName}. You, me, and some weights?`, `Hey ${displayName}, let's end the day right together.`],
    },
  };

  const options = greetings[personality][timeOfDay];
  return options[Math.floor(Math.random() * options.length)];
}

export function HomePage() {
  const [stats, setStats] = useState(() => getWorkoutStats());
  const [, setThisWeekDates] = useState(() => getThisWeekWorkoutDates());
  const [yearlyData, setYearlyData] = useState(() => getYearlyContributions());
  const [restDays, setRestDays] = useState(() => loadRestDays());
  const [effortHistory, setEffortHistory] = useState(() => getEffortHistory());
  const [userName] = useState(() => loadUserName());
  const [personality] = useState(() => loadPersonality());
  const [mostSkipped, setMostSkipped] = useState(() => getMostSkippedExercises(5));
  const [mostUsedExercises, setMostUsedExercises] = useState(() => getMostUsedExercises(5));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedDateWorkouts, setSelectedDateWorkouts] = useState<WorkoutSession[]>([]);
  const [exerciseTab, setExerciseTab] = useState<'used' | 'skipped'>('used');
  const [dateMenuOpen, setDateMenuOpen] = useState<string | null>(null);
  const [monthOffset, setMonthOffset] = useState(0); // 0 = current month, -1 = previous, +1 = next
  const greeting = getTimeBasedGreeting(userName, personality);

  // Get current date string for memo dependencies (ensures calendar updates daily)
  const currentDateStr = new Date().toLocaleDateString();

  // Refresh data on mount and when returning to the page
  const refreshData = useCallback(() => {
    setStats(getWorkoutStats());
    setThisWeekDates(getThisWeekWorkoutDates());
    setYearlyData(getYearlyContributions());
    setRestDays(loadRestDays());
    setEffortHistory(getEffortHistory());
    setMostSkipped(getMostSkippedExercises(5));
    setMostUsedExercises(getMostUsedExercises(5));
  }, []);

  useEffect(() => {
    // Add backlog workouts for specified dates (only if not already present)
    const backlogDates = ['2026-01-06', '2026-01-07', '2026-01-20', '2026-01-21', '2026-01-23', '2026-01-24'];
    backlogDates.forEach(dateStr => {
      if (!hasWorkoutOnDate(dateStr)) {
        addBacklogWorkout(dateStr);
      }
    });

    // Backfill effort scores for workouts that don't have them
    backfillEffortScores();

    refreshData();
  }, [refreshData]);

  // Refresh data when page becomes visible (e.g., returning from workout)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshData();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [refreshData]);

  // Handle date menu actions
  const handleDateMenuAction = useCallback((dateStr: string, action: 'workout' | 'rest' | 'clear' | 'view') => {
    setDateMenuOpen(null);

    if (action === 'view') {
      const sessions = getSessionsByDate(dateStr);
      if (sessions.length > 0) {
        setSelectedDate(dateStr);
        setSelectedDateWorkouts(sessions);
      }
      return;
    }

    if (action === 'workout') {
      if (!hasWorkoutOnDate(dateStr)) {
        addBacklogWorkout(dateStr);
      }
    } else if (action === 'rest') {
      const currentRestDays = loadRestDays();
      if (!currentRestDays.has(dateStr)) {
        if (hasWorkoutOnDate(dateStr) && !hasRealWorkoutOnDate(dateStr)) {
          // Remove backlog workout first
          toggleYearDayStatus(dateStr);
        }
        currentRestDays.add(dateStr);
        saveRestDays(currentRestDays);
      }
    } else if (action === 'clear') {
      // Clear both workout and rest status
      if (hasWorkoutOnDate(dateStr) && !hasRealWorkoutOnDate(dateStr)) {
        toggleYearDayStatus(dateStr); // Remove backlog workout
      }
      const currentRestDays = loadRestDays();
      if (currentRestDays.has(dateStr)) {
        currentRestDays.delete(dateStr);
        saveRestDays(currentRestDays);
      }
    }

    // Refresh data
    setYearlyData(getYearlyContributions());
    setRestDays(loadRestDays());
    setStats(getWorkoutStats());
    setThisWeekDates(getThisWeekWorkoutDates());
  }, []);


  // Day info type for calendar
  type DayInfo = {
    date: Date | null;
    dateStr: string;
    hasWorkout: boolean;
    hasCardio: boolean;
    hasStrength: boolean;
    isRest: boolean;
    isToday: boolean;
    isPast: boolean;
  };

  // This Month calendar grid
  const monthCalendar = useMemo(() => {
    const now = new Date();
    const targetDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();

    // Get the day of week the month starts on (0 = Sunday)
    const startDayOfWeek = firstDay.getDay();
    // Adjust for Monday start
    const mondayAdjustedStart = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

    const weeks: { days: DayInfo[]; isCurrentWeek: boolean }[] = [];
    let currentWeekDays: DayInfo[] = [];
    let weekContainsToday = false;
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Add empty cells for days before the month starts
    for (let i = 0; i < mondayAdjustedStart; i++) {
      currentWeekDays.push({ date: null, dateStr: '', hasWorkout: false, hasCardio: false, hasStrength: false, isRest: false, isToday: false, isPast: false });
    }

    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateStr = formatLocalDate(date);
      const isToday = day === now.getDate() && month === now.getMonth() && year === now.getFullYear();
      const isPast = date < today;
      const dayInfo = yearlyData.get(dateStr) || { count: 0, hasCardio: false, hasStrength: false };
      const hasWorkout = dayInfo.count > 0;

      if (isToday) {
        weekContainsToday = true;
      }

      currentWeekDays.push({
        date,
        dateStr,
        hasWorkout,
        hasCardio: dayInfo.hasCardio,
        hasStrength: dayInfo.hasStrength,
        isRest: restDays.has(dateStr),
        isToday,
        isPast,
      });

      if (currentWeekDays.length === 7) {
        weeks.push({ days: currentWeekDays, isCurrentWeek: weekContainsToday });
        currentWeekDays = [];
        weekContainsToday = false;
      }
    }

    // Fill remaining days in last week
    if (currentWeekDays.length > 0) {
      while (currentWeekDays.length < 7) {
        currentWeekDays.push({ date: null, dateStr: '', hasWorkout: false, hasCardio: false, hasStrength: false, isRest: false, isToday: false, isPast: false });
      }
      weeks.push({ days: currentWeekDays, isCurrentWeek: weekContainsToday });
    }

    // Format today's date as "Weekday, Month Day"
    const todayFormatted = now.toLocaleString('default', { weekday: 'long', month: 'long', day: 'numeric' });

    // Check if viewing current month
    const isCurrentMonth = monthOffset === 0;

    return {
      weeks,
      monthName: firstDay.toLocaleString('default', { month: 'long', year: 'numeric' }),
      todayFormatted,
      isCurrentMonth,
    };
  }, [yearlyData, restDays, currentDateStr, monthOffset]);

  // Year day info type
  type YearDayInfo = {
    date: string;
    dayOfMonth: number;
    hasWorkout: boolean;
    hasCardio: boolean;
    hasStrength: boolean;
    isRest: boolean;
    isPast: boolean;
    isToday: boolean;
  };

  // Year contribution grid starting from Jan 1, 2026
  const { contributionGrid, monthLabels, currentWeekIndex } = useMemo(() => {
    const startDate = new Date(2026, 0, 1); // Jan 1, 2026
    const endDate = new Date(2026, 11, 31); // Dec 31, 2026
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weeks: YearDayInfo[][] = [];
    let currentWeek: YearDayInfo[] = [];
    const labels: { weekIndex: number; label: string }[] = [];
    let foundCurrentWeekIdx = -1;

    // Start from the Monday of the week containing Jan 1
    const firstDay = startDate.getDay();
    const mondayOffset = firstDay === 0 ? -6 : 1 - firstDay;
    const gridStart = new Date(startDate);
    gridStart.setDate(startDate.getDate() + mondayOffset);

    let currentMonth = -1;
    let currentDate = new Date(gridStart);
    let weekContainsToday = false;

    while (currentDate <= endDate || currentWeek.length > 0) {
      const dateStr = formatLocalDate(currentDate);
      const isInYear = currentDate >= startDate && currentDate <= endDate;
      const month = currentDate.getMonth();
      const isPast = currentDate < today;
      const dayInfo = yearlyData.get(dateStr) || { count: 0, hasCardio: false, hasStrength: false };

      // Check if this day is today
      if (currentDate.toDateString() === now.toDateString()) {
        weekContainsToday = true;
      }

      // Track month changes for labels
      if (isInYear && month !== currentMonth && currentWeek.length === 0) {
        labels.push({
          weekIndex: weeks.length,
          label: currentDate.toLocaleString('default', { month: 'short' }),
        });
        currentMonth = month;
      }

      const isToday = currentDate.toDateString() === now.toDateString();
      currentWeek.push({
        date: isInYear ? dateStr : '',
        dayOfMonth: isInYear ? currentDate.getDate() : 0,
        hasWorkout: isInYear ? dayInfo.count > 0 : false,
        hasCardio: isInYear ? dayInfo.hasCardio : false,
        hasStrength: isInYear ? dayInfo.hasStrength : false,
        isRest: isInYear ? restDays.has(dateStr) : false,
        isPast: isInYear ? isPast : false,
        isToday: isInYear ? isToday : false,
      });

      if (currentWeek.length === 7) {
        if (weekContainsToday) {
          foundCurrentWeekIdx = weeks.length;
        }
        weeks.push(currentWeek);
        currentWeek = [];
        weekContainsToday = false;
      }

      currentDate.setDate(currentDate.getDate() + 1);

      // Stop after completing the year
      if (currentDate > endDate && currentWeek.length === 0) break;
    }

    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push({ date: '', dayOfMonth: 0, hasWorkout: false, hasCardio: false, hasStrength: false, isRest: false, isPast: false, isToday: false });
      }
      if (weekContainsToday) {
        foundCurrentWeekIdx = weeks.length;
      }
      weeks.push(currentWeek);
    }

    return { contributionGrid: weeks, monthLabels: labels, currentWeekIndex: foundCurrentWeekIdx };
  }, [yearlyData, restDays, currentDateStr]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    return `${mins} min`;
  };

  // Find favorite workout day
  const favoriteDay = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const maxDay = Object.entries(stats.workoutsByDay).reduce(
      (max, [day, count]) => (count > max.count ? { day: parseInt(day), count } : max),
      { day: -1, count: 0 }
    );
    return maxDay.count > 0 ? days[maxDay.day] : '--';
  }, [stats.workoutsByDay]);

  // Calculate active days this year
  const activeDaysThisYear = useMemo(() => {
    let count = 0;
    contributionGrid.forEach(week => {
      week.forEach(day => {
        if (day.hasWorkout) count++;
      });
    });
    return count;
  }, [contributionGrid]);

  // Workout details modal
  if (selectedDate && selectedDateWorkouts.length > 0) {
    const dateDisplay = new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    return (
      <div className="min-h-screen pb-24 bg-slate-100 dark:bg-slate-950">
        <header className="px-4 pt-16 pb-4 safe-top">
          <button
            onClick={() => { setSelectedDate(null); setSelectedDateWorkouts([]); }}
            className="flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 mb-4"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Workout History</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{dateDisplay}</p>
        </header>

        <div className="px-4 space-y-4">
          {selectedDateWorkouts.map(session => (
            <div
              key={session.id}
              className="p-4 rounded-xl bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 shadow-sm"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{session.name}</h3>
                {session.overallEffort && (
                  <span className="px-2 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-sm font-medium">
                    Effort: {session.overallEffort}/10
                  </span>
                )}
              </div>

              <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400 mb-4">
                {session.cardioType ? (
                  <>
                    <span className="flex items-center gap-1">
                      {CARDIO_TYPE_ICONS[session.cardioType]} {CARDIO_TYPE_LABELS[session.cardioType]}
                    </span>
                    {session.distance && <span>{session.distance} miles</span>}
                  </>
                ) : (
                  <span>{session.exercises.length} exercises</span>
                )}
                {session.totalDuration && (
                  <span>{Math.round(session.totalDuration / 60)} min</span>
                )}
              </div>

              {/* Exercise list - only for non-cardio workouts */}
              {!session.cardioType && session.exercises.length > 0 && (
                <div className="border-t border-slate-200 dark:border-slate-700 pt-3">
                  <h4 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">Exercises</h4>
                  <div className="space-y-2">
                    {session.exercises.map((log, idx) => {
                      const exercise = getExerciseById(log.exerciseId);
                      return (
                        <div
                          key={idx}
                          className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-50 dark:bg-slate-900/50"
                        >
                          <span className="text-sm text-slate-700 dark:text-slate-300">
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
                </div>
              )}

              {/* Blocks summary - only for non-cardio workouts */}
              {!session.cardioType && session.blocks && session.blocks.length > 0 && (
                <div className="border-t border-slate-200 dark:border-slate-700 pt-3 mt-3">
                  <h4 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">Workout Structure</h4>
                  <div className="flex flex-wrap gap-2">
                    {session.blocks.map((block, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-1 text-xs rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                      >
                        {block.name} ({block.exercises.length})
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 bg-slate-100 dark:bg-slate-950">
      {/* Header */}
      <header className="px-4 pt-16 pb-4 safe-top bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <img src="/logo_icon.png" alt="Moove" className="h-9 dark:invert" />
          <img src="/moove.svg" alt="Moove" className="h-5 dark:invert" />
        </div>
      </header>

      {/* Greeting */}
      <p className="px-4 mt-4 text-base text-slate-600 dark:text-slate-300 leading-relaxed">{greeting}</p>

      {/* This Month Calendar */}
      <section className="px-4 mb-6 mt-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">This Month</h2>
          {stats.currentStreak > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-base">🔥</span>
              <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                {stats.currentStreak} day{stats.currentStreak !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
        <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
          {/* Month navigation with date */}
          <div className="flex items-center justify-center gap-2 mb-3">
            <button
              onClick={() => setMonthOffset(prev => prev - 1)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="text-sm text-slate-600 dark:text-slate-300 min-w-[160px] text-center font-medium">
              {monthCalendar.isCurrentMonth ? monthCalendar.todayFormatted : monthCalendar.monthName}
            </div>
            <button
              onClick={() => setMonthOffset(prev => prev + 1)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            {monthOffset !== 0 && (
              <button
                onClick={() => setMonthOffset(0)}
                className="px-2 py-0.5 text-xs rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors"
              >
                Today
              </button>
            )}
          </div>
          {/* Day headers */}
          <div className="grid grid-cols-7 mb-2">
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
              <div key={i} className="flex justify-center text-xs text-slate-400 dark:text-slate-500 font-medium">
                {day}
              </div>
            ))}
          </div>
          {/* Calendar grid */}
          <div className="space-y-1">
            {monthCalendar.weeks.map((week, weekIdx) => (
              <div
                key={weekIdx}
                className={`grid grid-cols-7 py-1 -mx-2 px-2 rounded-lg transition-colors ${
                  week.isCurrentWeek
                    ? 'bg-slate-100 dark:bg-slate-800/40'
                    : ''
                }`}
              >
                {week.days.map((day, dayIdx) => {
                  const hasRealWorkout = day.dateStr ? hasRealWorkoutOnDate(day.dateStr) : false;
                  const isMenuOpen = dateMenuOpen === day.dateStr;
                  return (
                    <div key={dayIdx} className="flex justify-center relative">
                      <button
                        onClick={() => {
                          if (!day.dateStr) return;
                          setDateMenuOpen(isMenuOpen ? null : day.dateStr);
                        }}
                        disabled={!day.date}
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                          !day.date
                            ? 'bg-transparent'
                            : day.hasWorkout
                            ? hasRealWorkout
                              ? `bg-emerald-500 text-white ring-2 ring-emerald-300 dark:ring-emerald-700 ${day.isPast ? 'opacity-60' : ''}`
                              : `bg-emerald-500 text-white ${day.isPast ? 'opacity-60' : ''}`
                            : day.isRest
                            ? `bg-violet-300 dark:bg-violet-400 text-white ${day.isPast ? 'opacity-60' : ''}`
                            : day.isToday
                            ? 'border-2 border-dashed border-emerald-500 text-slate-700 dark:text-slate-300'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                        } ${day.isToday && day.date ? 'ring-2 ring-offset-2 ring-emerald-500 dark:ring-offset-slate-800' : ''}`}
                      >
                        {day.date?.getDate()}
                      </button>
                      {/* Date menu popup */}
                      {isMenuOpen && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setDateMenuOpen(null)} />
                          <div className="absolute top-12 left-1/2 -translate-x-1/2 z-50 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 py-1 min-w-[160px]">
                            {/* Empty option - only show if day has something to clear */}
                            {(day.hasWorkout || day.isRest) && !hasRealWorkout && (
                              <button
                                onClick={() => handleDateMenuAction(day.dateStr, 'clear')}
                                className="w-full px-4 py-2.5 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-3"
                              >
                                <span className="material-symbols-outlined text-slate-400 dark:text-slate-500" style={{ fontSize: '18px' }}>blur_on</span>
                                <span className="font-semibold text-slate-400 dark:text-slate-500">Empty</span>
                              </button>
                            )}
                            {/* Active option - only for non-real workouts */}
                            {!hasRealWorkout && (
                              <button
                                onClick={() => handleDateMenuAction(day.dateStr, 'workout')}
                                className="w-full px-4 py-2.5 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-3"
                              >
                                <span className="material-symbols-outlined text-emerald-500" style={{ fontSize: '18px' }}>exercise</span>
                                <span className="font-semibold text-emerald-600 dark:text-emerald-400">Active</span>
                              </button>
                            )}
                            {/* Rest option - only for non-real workouts */}
                            {!hasRealWorkout && (
                              <button
                                onClick={() => handleDateMenuAction(day.dateStr, 'rest')}
                                className="w-full px-4 py-2.5 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-3"
                              >
                                <span className="material-symbols-outlined text-violet-400 dark:text-violet-300" style={{ fontSize: '18px' }}>relax</span>
                                <span className="font-semibold text-violet-500 dark:text-violet-400">Rest</span>
                              </button>
                            )}
                            {/* View History - only for real workouts */}
                            {hasRealWorkout && (
                              <button
                                onClick={() => handleDateMenuAction(day.dateStr, 'view')}
                                className="w-full px-4 py-2.5 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-3"
                              >
                                <span className="material-symbols-outlined text-slate-500 dark:text-slate-400" style={{ fontSize: '18px' }}>history</span>
                                <span className="font-semibold text-slate-600 dark:text-slate-300">View History</span>
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          {/* Legend */}
          <div className="flex items-center justify-center gap-4 mt-3 text-[11px]">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-emerald-500" style={{ fontSize: '14px' }}>exercise</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">Active</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-violet-400 dark:text-violet-300" style={{ fontSize: '14px' }}>relax</span>
              <span className="font-semibold text-violet-500 dark:text-violet-400">Rest</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-slate-400 dark:text-slate-500" style={{ fontSize: '14px' }}>blur_on</span>
              <span className="font-semibold text-slate-400 dark:text-slate-500">Empty</span>
            </div>
          </div>
        </div>
      </section>

      {/* Yearly Contribution Grid */}
      <section className="px-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">This Year</h2>
          <div className="flex items-center gap-1.5">
            <span className="text-base">💪</span>
            <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
              {activeDaysThisYear} active day{activeDaysThisYear !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
        <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm overflow-x-auto scrollbar-hide">
          <div className="min-w-max">
            {/* Month labels row */}
            <div className="flex gap-[3px] mb-2 h-4">
              {contributionGrid.map((_, weekIndex) => {
                const label = monthLabels.find(m => m.weekIndex === weekIndex);
                return (
                  <div key={weekIndex} className="w-[11px] flex-shrink-0">
                    {label && (
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {label.label}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            {/* Grid with timeline */}
            <div className="flex gap-[3px] relative">
              {contributionGrid.map((week, weekIndex) => (
                <div key={weekIndex} className="flex flex-col items-center relative">
                  <div className="flex flex-col gap-[3px]">
                    {week.map((day, dayIndex) => (
                      <div
                        key={`${weekIndex}-${dayIndex}`}
                        className={`w-[11px] h-[11px] rounded-[2px] flex items-center justify-center ${
                          !day.date
                            ? 'bg-transparent'
                            : day.hasWorkout
                            ? `bg-emerald-500 ${day.isPast ? 'opacity-60' : ''}`
                            : day.isRest
                            ? `bg-violet-300 dark:bg-violet-400 ${day.isPast ? 'opacity-60' : ''}`
                            : 'bg-slate-200 dark:bg-slate-700'
                        } ${day.isToday ? 'ring-1 ring-orange-400 dark:ring-orange-500' : ''}`}
                        title={day.date ? `${day.date}: ${day.hasWorkout ? 'Active' : day.isRest ? 'Rest' : 'Empty'}` : ''}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {/* Timeline indicator */}
            <div className="flex gap-[3px] mt-1">
              {contributionGrid.map((_, weekIndex) => (
                <div key={weekIndex} className="w-[11px] flex flex-col items-center">
                  {weekIndex === currentWeekIndex ? (
                    <div className="w-full h-[3px] bg-emerald-500 rounded-full relative -top-0.5" />
                  ) : weekIndex < currentWeekIndex ? (
                    <div className="w-full h-[1px] bg-emerald-300 dark:bg-emerald-700" />
                  ) : (
                    <div className="w-full h-[1px] bg-slate-300 dark:bg-slate-600" />
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-center gap-4 mt-2 text-[11px]">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-emerald-500" style={{ fontSize: '14px' }}>exercise</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">Active</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-violet-400 dark:text-violet-300" style={{ fontSize: '14px' }}>relax</span>
              <span className="font-semibold text-violet-500 dark:text-violet-400">Rest</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-slate-400 dark:text-slate-500" style={{ fontSize: '14px' }}>blur_on</span>
              <span className="font-semibold text-slate-400 dark:text-slate-500">Empty</span>
            </div>
          </div>
        </div>
      </section>

      {/* Insights Section */}
      <section className="px-4 mb-6">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3">Insights</h2>

        <div className="space-y-4">
          {/* Effort Trend Card */}
          <div className="rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="px-4 pt-3 pb-1">
              <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400">Effort Trend</h3>
            </div>
            <div className="p-4 pt-2">
              <EffortChart data={effortHistory} />
            </div>
          </div>

          {/* Stats Card */}
          <div className="rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="px-4 pt-3 pb-1">
              <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400">Stats</h3>
            </div>
            <div className="p-4 pt-2">
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50">
                  <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{stats.thisWeek}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">This week</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50">
                  <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{stats.thisMonth}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">This month</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50">
                  <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{stats.totalWorkouts}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Total</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50">
                  <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                    {stats.avgDuration > 0 ? formatDuration(stats.avgDuration) : '--'}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Avg time</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50">
                  <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{stats.longestStreak}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Best streak</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50">
                  <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{favoriteDay}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Top day</div>
                </div>
              </div>
            </div>
          </div>

          {/* Exercise Patterns Card */}
          {(mostUsedExercises.length > 0 || mostSkipped.length > 0) && (
            <div className="rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
              <div className="px-4 pt-3 pb-1">
                <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400">Exercise Patterns</h3>
              </div>
              {/* Tab buttons - pill style */}
              <div className="px-4 pt-2">
                <div className="flex rounded-xl bg-slate-200 dark:bg-slate-700 p-1">
                  <button
                    onClick={() => setExerciseTab('used')}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                      exerciseTab === 'used'
                        ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-slate-100 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    Most Used
                  </button>
                  <button
                    onClick={() => setExerciseTab('skipped')}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                      exerciseTab === 'skipped'
                        ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-slate-100 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    Most Skipped
                  </button>
                </div>
              </div>
              {/* Tab content */}
              <div className="p-4">
                {exerciseTab === 'used' && mostUsedExercises.length > 0 && (
                  <div className="space-y-2">
                    {mostUsedExercises.map((item, idx) => {
                      const exercise = getExerciseById(item.exerciseId);
                      if (!exercise) return null;
                      return (
                        <div key={item.exerciseId} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700 last:border-0">
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-slate-400 dark:text-slate-500 w-4">{idx + 1}.</span>
                            <span className="text-sm text-slate-700 dark:text-slate-300">{exercise.name}</span>
                          </div>
                          <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-xs">
                            {item.count}x
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
                {exerciseTab === 'used' && mostUsedExercises.length === 0 && (
                  <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-4">No exercise data yet</p>
                )}
                {exerciseTab === 'skipped' && mostSkipped.length > 0 && (
                  <div className="space-y-2">
                    {mostSkipped.map((item, idx) => {
                      const exercise = getExerciseById(item.exerciseId);
                      if (!exercise) return null;
                      return (
                        <div key={item.exerciseId} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700 last:border-0">
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-slate-400 dark:text-slate-500 w-4">{idx + 1}.</span>
                            <span className="text-sm text-slate-700 dark:text-slate-300">{exercise.name}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            {item.skips > 0 && (
                              <span className="px-2 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                                {item.skips} skipped
                              </span>
                            )}
                            {item.swaps > 0 && (
                              <span className="px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                                {item.swaps} swapped
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                      Consider removing or replacing these exercises
                    </p>
                  </div>
                )}
                {exerciseTab === 'skipped' && mostSkipped.length === 0 && (
                  <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-4">No skipped exercises</p>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
