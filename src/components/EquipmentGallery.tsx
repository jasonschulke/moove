import { useState } from 'react';
import type { EquipmentType, EquipmentInventory } from '../types';
import { loadEquipmentInventory, addEquipmentWeight, removeEquipmentWeight, loadOwnedGear, addOwnedGear, removeOwnedGear } from '../data/storage';

interface EquipmentItem {
  type: Exclude<EquipmentType, 'bodyweight'>;
  label: string;
  image: string;
}

const EQUIPMENT_ITEMS: EquipmentItem[] = [
  { type: 'kettlebell', label: 'Kettlebells', image: '/kettlebell.png' },
  { type: 'dumbbell', label: 'Dumbbells', image: '/dumbbell.png' },
  { type: 'sandbag', label: 'Sandbags', image: '/sandbag.png' },
  { type: 'resistance-band', label: 'Bands', image: '/bands.png' },
  { type: 'machine', label: 'Rower', image: '/rowing_machine.png' },
  { type: 'yoga-mat', label: 'Yoga Mat', image: '/yoga_mat.png' },
  { type: 'jump-rope', label: 'Jump Rope', image: '/jump_rope.png' },
  { type: 'ab-wheel', label: 'Ab Wheel', image: '/ab_wheel.png' },
  { type: 'treadmill', label: 'Treadmill', image: '/treadmill.png' },
  { type: 'smartwatch', label: 'Smartwatch', image: '/smartwatch.png' },
  { type: 'weight-scale', label: 'Scale', image: '/weight_scale.png' },
  { type: 'hand-gripper', label: 'Gripper', image: '/hand_gripper.png' },
  { type: 'squat-rack', label: 'Squat Rack', image: '/squat_rack.png' },
  { type: 'bench-press', label: 'Bench Press', image: '/bench_press.png' },
  { type: 'exercise-bike', label: 'Bike', image: '/exercise_bike.png' },
];

export function EquipmentGallery() {
  const [inventory, setInventory] = useState<EquipmentInventory>(() => loadEquipmentInventory());
  const [ownedGear, setOwnedGear] = useState<EquipmentType[]>(() => loadOwnedGear());
  const [selectedType, setSelectedType] = useState<Exclude<EquipmentType, 'bodyweight'> | null>(null);
  const [newWeight, setNewWeight] = useState('');

  const refreshData = () => {
    setInventory(loadEquipmentInventory());
    setOwnedGear(loadOwnedGear());
  };

  const handleQuickAdd = (type: Exclude<EquipmentType, 'bodyweight'>) => {
    addOwnedGear(type);
    refreshData();
  };

  const handleRemoveGear = (type: Exclude<EquipmentType, 'bodyweight'>) => {
    removeOwnedGear(type);
    if (selectedType === type) setSelectedType(null);
    refreshData();
  };

  const handleAddWeight = () => {
    if (!selectedType) return;
    const weight = parseInt(newWeight);
    if (weight > 0) {
      addEquipmentWeight(selectedType, weight);
      refreshData();
      setNewWeight('');
    }
  };

  const handleRemoveWeight = (type: Exclude<EquipmentType, 'bodyweight'>, weight: number) => {
    removeEquipmentWeight(type, weight);
    refreshData();
  };

  const myGear = EQUIPMENT_ITEMS.filter(item => ownedGear.includes(item.type));
  const allGear = EQUIPMENT_ITEMS.filter(item => !ownedGear.includes(item.type));
  const selectedItem = EQUIPMENT_ITEMS.find(item => item.type === selectedType);
  const selectedWeights = selectedType ? (inventory[selectedType] || []) : [];

  return (
    <div className="space-y-6">
      {/* My Gear */}
      {myGear.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">My Gear</h3>
          <div className="grid grid-cols-3 gap-3">
            {myGear.map((item) => {
              const weights = inventory[item.type] || [];
              const isSelected = selectedType === item.type;

              return (
                <button
                  key={item.type}
                  onClick={() => setSelectedType(isSelected ? null : item.type)}
                  className={`relative aspect-square rounded-2xl p-3 flex flex-col items-center justify-center transition-all ${
                    isSelected
                      ? 'ring-2 ring-emerald-500 ring-offset-2 dark:ring-offset-slate-900 bg-slate-100 dark:bg-slate-800'
                      : 'bg-slate-100 dark:bg-slate-800'
                  }`}
                >
                  <div className="flex flex-col items-center">
                    <div className="w-16 h-16 flex items-center justify-center mb-2">
                      <img
                        src={item.image}
                        alt={item.label}
                        className="w-14 h-14 object-contain dark:invert"
                      />
                    </div>
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                      {item.label}
                    </span>
                    {weights.length > 0 && (
                      <span className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-500">
                        {weights.length} weight{weights.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  {weights.length > 0 && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-white">{weights.length}</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Selected Equipment Detail */}
      {selectedType && selectedItem && (
        <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 shadow-lg animate-slide-up">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
              <img src={selectedItem.image} alt={selectedItem.label} className="w-8 h-8 object-contain dark:invert" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">{selectedItem.label}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {selectedWeights.length === 0
                  ? 'No weights added yet'
                  : `${selectedWeights.length} weight${selectedWeights.length !== 1 ? 's' : ''} in your gym`}
              </p>
            </div>
            <button
              onClick={() => handleRemoveGear(selectedType)}
              className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              title="Remove from My Gear"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>

          {/* Weight chips */}
          {selectedWeights.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {selectedWeights.map((weight) => (
                <span
                  key={weight}
                  className="px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-medium flex items-center gap-2"
                >
                  {weight} lb
                  <button
                    onClick={() => handleRemoveWeight(selectedType, weight)}
                    className="p-0.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Add weight */}
          <div className="flex gap-2">
            <input
              type="number"
              value={newWeight}
              onChange={(e) => setNewWeight(e.target.value)}
              placeholder="Add weight (lb)"
              className="flex-1 px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddWeight();
                }
              }}
            />
            <button
              onClick={handleAddWeight}
              disabled={!newWeight || parseInt(newWeight) <= 0}
              className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 dark:disabled:bg-slate-600 text-white font-medium transition-colors"
            >
              Add
            </button>
          </div>
        </div>
      )}

      {/* All Gear */}
      {allGear.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">All Gear</h3>
          <div className="grid grid-cols-3 gap-3">
            {allGear.map((item) => (
              <button
                key={item.type}
                onClick={() => handleQuickAdd(item.type)}
                className="relative aspect-square rounded-2xl p-3 flex flex-col items-center justify-center transition-all bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 flex items-center justify-center mb-2">
                    <img
                      src={item.image}
                      alt={item.label}
                      className="w-14 h-14 object-contain opacity-40 dark:invert dark:opacity-30"
                    />
                  </div>
                  <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                    {item.label}
                  </span>
                </div>

                {/* Plus icon */}
                <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                  <svg className="w-3 h-3 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {myGear.length === 0 && (
        <p className="text-center text-sm text-slate-400 dark:text-slate-500">
          Tap equipment below to add it to your gym
        </p>
      )}
    </div>
  );
}
