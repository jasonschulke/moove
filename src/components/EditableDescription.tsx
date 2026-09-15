import { useState } from 'react';

/**
 * A description block that can be edited in place and reset to its default.
 * Owns only its own editing state; persistence is the caller's job.
 */
export function EditableDescription({
  defaultDescription,
  customDescription,
  onSave,
  onReset,
}: {
  defaultDescription?: string;
  customDescription?: string;
  onSave: (description: string) => void;
  onReset: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(customDescription || defaultDescription || '');

  const displayDescription = customDescription || defaultDescription;
  const hasCustom = !!customDescription;

  const handleSave = () => {
    if (editValue.trim()) {
      onSave(editValue.trim());
    }
    setIsEditing(false);
  };

  const handleReset = () => {
    onReset();
    setEditValue(defaultDescription || '');
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="p-4 rounded-xl bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none">
        <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">Edit Description</h3>
        <textarea
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-emerald-500 resize-none"
          rows={4}
          placeholder="Add a description..."
          autoFocus
        />
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => { setIsEditing(false); setEditValue(customDescription || defaultDescription || ''); }}
            className="flex-1 px-3 py-2 text-sm rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-3 py-2 text-sm rounded-lg bg-emerald-600 text-white"
          >
            Save
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-xl bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Description</h3>
        <div className="flex items-center gap-2">
          {hasCustom && (
            <button
              onClick={handleReset}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              Reset to default
            </button>
          )}
          <button
            onClick={() => setIsEditing(true)}
            className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-500"
          >
            Edit
          </button>
        </div>
      </div>
      {displayDescription ? (
        <p className="text-slate-700 dark:text-slate-200">{displayDescription}</p>
      ) : (
        <p className="text-slate-400 dark:text-slate-500 italic">No description. Tap "Edit" to add one.</p>
      )}
      {hasCustom && (
        <span className="inline-block mt-2 px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs">
          Custom
        </span>
      )}
    </div>
  );
}
