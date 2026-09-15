import { useState, useEffect } from 'react';
import { getClaudeApiKey, setClaudeApiKey, clearClaudeApiKey, loadCustomExercises, deleteCustomExercise, clearChatHistory, loadPersonality, savePersonality, loadUserName, saveUserName, clearAllData } from '../data/storage';
import { exportAllDataAsJSON, exportWorkoutsAsCSV, exportExerciseLogsAsCSV } from '../data/export';
import { getDeviceId } from '../utils/deviceId';
import { deleteAllCloudData } from '../data/supabaseSync';
import { useAuth } from '../contexts/AuthContext';
import { AuthModal } from '../components/AuthModal';
import { Button } from '../components/Button';
import { HealthImport } from '../components/HealthImport';
import type { Exercise, PersonalityType } from '../types';
import { PERSONALITY_OPTIONS } from '../types';
import { ScreenHeader } from '../components/ScreenHeader';

interface SettingsPageProps {
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export function SettingsPage({ theme, onToggleTheme }: SettingsPageProps) {
  const [apiKey, setApiKeyState] = useState('');
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [customExercises, setCustomExercises] = useState<Exercise[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [personality, setPersonality] = useState<PersonalityType>('neutral');
  const [userName, setUserName] = useState<string>('');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const deviceId = getDeviceId();
  const { user, syncStatus, signOut, isConfigured } = useAuth();

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  useEffect(() => {
    setSavedKey(getClaudeApiKey());
    setCustomExercises(loadCustomExercises());
    setPersonality(loadPersonality());
    setUserName(loadUserName() || '');
  }, []);

  const handleNameChange = (name: string) => {
    setUserName(name);
    saveUserName(name);
  };

  const handlePersonalityChange = (newPersonality: PersonalityType) => {
    setPersonality(newPersonality);
    savePersonality(newPersonality);
  };

  const handleSaveKey = () => {
    if (apiKey.trim()) {
      setClaudeApiKey(apiKey.trim());
      setSavedKey(apiKey.trim());
      setApiKeyState('');
    }
  };

  const handleClearKey = () => {
    clearClaudeApiKey();
    setSavedKey(null);
    setApiKeyState('');
  };

  const handleDeleteExercise = (id: string) => {
    deleteCustomExercise(id);
    setCustomExercises(loadCustomExercises());
    setShowDeleteConfirm(null);
  };

  const handleClearChat = () => {
    clearChatHistory();
  };

  const handleExportJSON = () => {
    const data = exportAllDataAsJSON();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `moove-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportWorkoutsCSV = () => {
    const data = exportWorkoutsAsCSV();
    const blob = new Blob([data], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `moove-workouts-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportExerciseLogsCSV = () => {
    const data = exportExerciseLogsAsCSV();
    const blob = new Blob([data], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `moove-exercise-logs-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const maskedKey = savedKey ? `sk-ant-...${savedKey.slice(-8)}` : null;

  return (
    <div className="min-h-screen pb-24 bg-slate-100 dark:bg-slate-950">
      <ScreenHeader wordmark="/settings.svg" alt="Settings" />

      <div className="px-4 space-y-6 mt-4">
        {/* ACCOUNT Section */}
        {isConfigured && (
          <div>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3">Account</h2>
            <div className="space-y-4">
              <section className="p-4 rounded-xl bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none">
                {user ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-base font-medium text-slate-900 dark:text-slate-100">Signed in</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{user.email}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Sync status indicator */}
                        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
                          syncStatus === 'synced' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                          syncStatus === 'syncing' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                          syncStatus === 'error' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                          syncStatus === 'offline' ? 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400' :
                          'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                        }`}>
                          {syncStatus === 'syncing' && (
                            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                          )}
                          {syncStatus === 'synced' && (
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                          {syncStatus === 'error' && (
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                          )}
                          <span className="capitalize">{syncStatus}</span>
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Your workouts sync automatically across all your devices.
                    </p>
                    <Button variant="ghost" onClick={signOut} className="w-full">
                      Sign Out
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <h3 className="text-base font-medium text-slate-900 dark:text-slate-100">Sync Across Devices</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Sign in to sync your workouts, exercises, and preferences across all your devices.
                      </p>
                    </div>
                    <Button variant="primary" onClick={() => setShowAuthModal(true)} className="w-full">
                      <div className="flex items-center justify-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        Sign in with Email
                      </div>
                    </Button>
                  </div>
                )}
              </section>
            </div>
          </div>
        )}

        {/* MY PREFERENCES Section */}
        <div>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3">My Preferences</h2>
          <div className="space-y-4">
        {/* Profile Section */}
        <section className="p-4 rounded-xl bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">Profile</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            Your name for personalized greetings.
          </p>
          <input
            type="text"
            value={userName}
            onChange={e => handleNameChange(e.target.value)}
            placeholder="Enter your name"
            className="w-full px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </section>

        {/* Appearance Section */}
        <section className="p-4 rounded-xl bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">Appearance</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            Choose your preferred color theme.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => theme === 'dark' && onToggleTheme()}
              className={`flex-1 p-3 rounded-lg border-2 transition-all ${
                theme === 'light'
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                <span className={`text-sm font-medium ${theme === 'light' ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-400'}`}>
                  Light
                </span>
              </div>
            </button>
            <button
              onClick={() => theme === 'light' && onToggleTheme()}
              className={`flex-1 p-3 rounded-lg border-2 transition-all ${
                theme === 'dark'
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
                <span className={`text-sm font-medium ${theme === 'dark' ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-400'}`}>
                  Dark
                </span>
              </div>
            </button>
          </div>
        </section>

        {/* Personality Section */}
        <section className="p-4 rounded-xl bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">Personality</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            Choose how the app talks to you.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {PERSONALITY_OPTIONS.map(option => (
              <button
                key={option.value}
                onClick={() => handlePersonalityChange(option.value)}
                className={`p-3 rounded-lg border-2 transition-all text-left min-h-[80px] flex flex-col ${
                  personality === option.value
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                <div className={`font-medium text-sm ${personality === option.value ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'}`}>
                  {option.label}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                  {option.description}
                </div>
              </button>
            ))}
          </div>
        </section>

          </div>
        </div>

        {/* MY DATA Section */}
        <div>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3">My Data</h2>
          <div className="space-y-4">

        {/* Import Health Data - Collapsible */}
        <section className="rounded-xl bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none overflow-hidden">
          <button
            onClick={() => toggleSection('importData')}
            className="w-full p-4 flex items-center justify-between text-left"
          >
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Import Health Data</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Import from Apple Health</p>
            </div>
            <svg className={`w-5 h-5 text-slate-400 transition-transform ${expandedSections.has('importData') ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {expandedSections.has('importData') && (
            <div className="px-4 pb-4">
              <HealthImport />
            </div>
          )}
        </section>

        {/* Custom Exercises Section - Collapsible */}
        <section className="rounded-xl bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none overflow-hidden">
          <button
            onClick={() => toggleSection('customExercises')}
            className="w-full p-4 flex items-center justify-between text-left"
          >
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Custom Exercises</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {customExercises.length > 0 ? `${customExercises.length} exercise${customExercises.length !== 1 ? 's' : ''} added` : 'None added yet'}
              </p>
            </div>
            <svg className={`w-5 h-5 text-slate-400 transition-transform ${expandedSections.has('customExercises') ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {expandedSections.has('customExercises') && (
            <div className="px-4 pb-4">
              {customExercises.length === 0 ? (
                <div className="text-center py-4 text-slate-500 text-sm">
                  No custom exercises yet. Ask Coach to add some!
                </div>
              ) : (
                <div className="space-y-2">
                  {customExercises.map(exercise => (
                    <div
                      key={exercise.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-slate-100 dark:bg-slate-700/50"
                    >
                      <div>
                        <div className="font-medium text-slate-800 dark:text-slate-200">{exercise.name}</div>
                        <div className="text-sm text-slate-500 dark:text-slate-400">
                          {exercise.area} • {exercise.equipment}
                        </div>
                      </div>
                      {showDeleteConfirm === exercise.id ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleDeleteExercise(exercise.id)}
                            className="px-3 py-1 rounded bg-red-500 text-white text-sm"
                          >
                            Delete
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm(null)}
                            className="px-3 py-1 rounded bg-slate-300 dark:bg-slate-600 text-slate-700 dark:text-slate-200 text-sm"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowDeleteConfirm(exercise.id)}
                          className="text-slate-400 hover:text-red-500 dark:hover:text-red-400 p-2"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        {/* Chat History Section - Collapsible */}
        <section className="rounded-xl bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none overflow-hidden">
          <button
            onClick={() => toggleSection('chatHistory')}
            className="w-full p-4 flex items-center justify-between text-left"
          >
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Chat History</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Clear conversation history</p>
            </div>
            <svg className={`w-5 h-5 text-slate-400 transition-transform ${expandedSections.has('chatHistory') ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {expandedSections.has('chatHistory') && (
            <div className="px-4 pb-4">
              <Button variant="ghost" onClick={handleClearChat} className="w-full">
                Clear Chat History
              </Button>
            </div>
          )}
        </section>

        {/* Manage Data - Collapsible */}
        <section className="rounded-xl bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none overflow-hidden">
          <button
            onClick={() => toggleSection('exportData')}
            className="w-full p-4 flex items-center justify-between text-left"
          >
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Manage Data</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Export or delete your data</p>
            </div>
            <svg className={`w-5 h-5 text-slate-400 transition-transform ${expandedSections.has('exportData') ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {expandedSections.has('exportData') && (
            <div className="px-4 pb-4 space-y-2">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Download your workout history</p>
              <Button variant="secondary" onClick={handleExportJSON} className="w-full">
                <div className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Export All Data (JSON)
                </div>
              </Button>
              <Button variant="secondary" onClick={handleExportWorkoutsCSV} className="w-full">
                <div className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Export Workouts (CSV)
                </div>
              </Button>
              <Button variant="secondary" onClick={handleExportExerciseLogsCSV} className="w-full">
                <div className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Export Exercise Logs (CSV)
                </div>
              </Button>

              <div className="border-t border-slate-200 dark:border-slate-700 mt-4 pt-4">
                <p className="text-xs text-red-500 dark:text-red-400 mb-3">Danger zone</p>
                <Button
                  variant="ghost"
                  onClick={() => setShowDeleteAllConfirm(true)}
                  className="w-full text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <div className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete All Data
                  </div>
                </Button>
              </div>
            </div>
          )}
        </section>
          </div>
        </div>

        {/* SYSTEM INFO Section */}
        <div>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3">System Info</h2>
          <div className="space-y-4">
        {/* Refresh App Section */}
        <section className="p-4 rounded-xl bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Refresh App</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Re-runs onboarding. Keeps your workout data.
              </p>
            </div>
            <Button
              variant="secondary"
              onClick={() => {
                localStorage.removeItem('workout_onboarding_complete');
                localStorage.removeItem('workout_user_name');
                window.location.reload();
              }}
              className="px-4 py-2 text-sm"
            >
              Refresh
            </Button>
          </div>
        </section>

        {/* Claude API Key Section - Collapsible */}
        <section className="rounded-xl bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none overflow-hidden">
          <button
            onClick={() => toggleSection('apiKey')}
            className="w-full p-4 flex items-center justify-between text-left"
          >
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Claude API Key</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {savedKey ? 'API key configured' : 'Required for Coach assistant'}
              </p>
            </div>
            <svg className={`w-5 h-5 text-slate-400 transition-transform ${expandedSections.has('apiKey') ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {expandedSections.has('apiKey') && (
            <div className="px-4 pb-4">
          {savedKey ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-100 dark:bg-slate-700/50">
                <div className="flex-1">
                  <span className="text-slate-700 dark:text-slate-300 font-mono text-sm">
                    {showKey ? savedKey : maskedKey}
                  </span>
                </div>
                <button
                  onClick={() => setShowKey(!showKey)}
                  className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {showKey ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    )}
                  </svg>
                </button>
              </div>
              <Button variant="ghost" onClick={handleClearKey} className="w-full">
                Remove API Key
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {/* In a form with autocomplete off, because a bare password input
                  makes Chrome log a DOM warning and invites password managers
                  to treat an API key as a site login. */}
              <form onSubmit={e => e.preventDefault()} autoComplete="off">
                <input
                  type="password"
                  name="anthropic-api-key"
                  autoComplete="off"
                  spellCheck={false}
                  value={apiKey}
                  onChange={e => setApiKeyState(e.target.value)}
                  placeholder="sk-ant-api03-..."
                  className="w-full px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono text-sm"
                />
              </form>
              <Button
                variant="primary"
                onClick={handleSaveKey}
                disabled={!apiKey.trim()}
                className="w-full"
              >
                Save API Key
              </Button>
              <p className="text-xs text-slate-500">
                Get your API key from{' '}
                <a
                  href="https://console.anthropic.com/settings/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 dark:hover:text-emerald-300"
                >
                  console.anthropic.com
                </a>
              </p>
            </div>
          )}
            </div>
          )}
        </section>

        {/* Auth Modal */}
        <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />

        {/* Delete All Data Confirmation Modal */}
        {showDeleteAllConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-xl">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                Delete All Data?
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                This will permanently delete all your workouts, exercises, and settings. This action cannot be undone.
              </p>
              {user && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mb-4 p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                  This will also delete your data from the cloud. Your account will remain active.
                </p>
              )}
              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  onClick={() => setShowDeleteAllConfirm(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <button
                  onClick={async () => {
                    // Delete from cloud if user is signed in
                    if (user) {
                      await deleteAllCloudData(user.id);
                    }
                    // Delete from localStorage
                    clearAllData();
                    window.location.reload();
                  }}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-red-500 hover:bg-red-600 text-white font-medium transition-colors"
                >
                  Delete Everything
                </button>
              </div>
            </div>
          </div>
        )}

        {/* App Info - Collapsible */}
        <section className="rounded-xl bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none overflow-hidden">
          <button
            onClick={() => toggleSection('about')}
            className="w-full p-4 flex items-center justify-between text-left"
          >
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">About</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Version 1.0.0</p>
            </div>
            <svg className={`w-5 h-5 text-slate-400 transition-transform ${expandedSections.has('about') ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {expandedSections.has('about') && (
            <div className="px-4 pb-4 space-y-2 text-sm text-slate-500 dark:text-slate-400">
              <div className="flex justify-between">
                <span>Version</span>
                <span className="text-slate-700 dark:text-slate-300">1.0.0</span>
              </div>
              <div className="flex justify-between">
                <span>Storage</span>
                <span className="text-slate-700 dark:text-slate-300">localStorage</span>
              </div>
              <div className="flex justify-between">
                <span>Device ID</span>
                <span className="text-slate-700 dark:text-slate-300 font-mono text-xs">{deviceId}</span>
              </div>
              <div className="pt-2 mt-2 border-t border-slate-200 dark:border-slate-700 space-y-1">
                <div>
                  <span>Animated icons by </span>
                  <a
                    href="https://icons8.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-500"
                  >
                    Icons8
                  </a>
                </div>
                <div>
                  <span>Equipment icons from </span>
                  <a
                    href="https://thenounproject.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-500"
                  >
                    Noun Project
                  </a>
                  <span> (CC BY 3.0)</span>
                </div>
              </div>
            </div>
          )}
        </section>
          </div>
        </div>
      </div>
    </div>
  );
}
