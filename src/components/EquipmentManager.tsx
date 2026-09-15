import { useState } from 'react';
import type { EquipmentType, EquipmentInventory } from '../types';
import { loadEquipmentInventory, addEquipmentWeight, removeEquipmentWeight } from '../data/storage';

const EQUIPMENT_TYPES: { type: Exclude<EquipmentType, 'bodyweight'>; label: string; icon: string }[] = [
  { type: 'kettlebell', label: 'Kettlebells', icon: 'fitness_center' },
  { type: 'dumbbell', label: 'Dumbbells', icon: 'fitness_center' },
  { type: 'barbell', label: 'Barbells', icon: 'fitness_center' },
  { type: 'sandbag', label: 'Sandbags', icon: 'inventory_2' },
  { type: 'resistance-band', label: 'Resistance Bands', icon: 'cable' },
  { type: 'cable', label: 'Cable Machine', icon: 'settings_input_component' },
  { type: 'machine', label: 'Machines', icon: 'precision_manufacturing' },
];

export function EquipmentManager() {
  const [inventory, setInventory] = useState<EquipmentInventory>(() => loadEquipmentInventory());
  const [expandedType, setExpandedType] = useState<Exclude<EquipmentType, 'bodyweight'> | null>(null);
  const [newWeight, setNewWeight] = useState('');

  // Reload inventory when it changes
  const refreshInventory = () => {
    setInventory(loadEquipmentInventory());
  };

  const handleAdd = (type: Exclude<EquipmentType, 'bodyweight'>) => {
    const weight = parseInt(newWeight);
    if (weight > 0) {
      addEquipmentWeight(type, weight);
      refreshInventory();
      setNewWeight('');
    }
  };

  const handleRemove = (type: Exclude<EquipmentType, 'bodyweight'>, weight: number) => {
    removeEquipmentWeight(type, weight);
    refreshInventory();
  };

  const toggleExpand = (type: Exclude<EquipmentType, 'bodyweight'>) => {
    setExpandedType(expandedType === type ? null : type);
    setNewWeight('');
  };

  return (
    <div className="space-y-3">
      {EQUIPMENT_TYPES.map(({ type, label, icon }) => {
        const weights = inventory[type] || [];
        const isExpanded = expandedType === type;

        return (
          <div
            key={type}
            className="rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden"
          >
            <button
              onClick={() => toggleExpand(type)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-emerald-500" style={{ fontSize: '20px' }}>
                  {icon}
                </span>
                <span className="font-medium text-slate-800 dark:text-slate-200">{label}</span>
                {weights.length > 0 && (
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    {weights.length} weight{weights.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <svg
                className={`w-5 h-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isExpanded && (
              <div className="px-4 pb-4 border-t border-slate-200 dark:border-slate-700">
                {/* Current weights */}
                {weights.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {weights.map((weight) => (
                      <span
                        key={weight}
                        className="px-3 py-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-sm font-medium flex items-center gap-2"
                      >
                        {weight} lb
                        <button
                          onClick={() => handleRemove(type, weight)}
                          className="p-0.5 rounded-full hover:bg-emerald-200 dark:hover:bg-emerald-800/50 text-emerald-600 dark:text-emerald-300 transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {weights.length === 0 && (
                  <p className="mt-3 text-sm text-slate-400 dark:text-slate-500">
                    No weights added yet
                  </p>
                )}

                {/* Add weight input */}
                <div className="mt-3 flex gap-2">
                  <input
                    type="number"
                    value={newWeight}
                    onChange={(e) => setNewWeight(e.target.value)}
                    placeholder="Weight (lb)"
                    className="flex-1 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-emerald-500 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAdd(type);
                      }
                    }}
                  />
                  <button
                    onClick={() => handleAdd(type)}
                    disabled={!newWeight || parseInt(newWeight) <= 0}
                    className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 dark:disabled:bg-slate-600 text-white font-medium text-sm transition-colors"
                  >
                    Add
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
