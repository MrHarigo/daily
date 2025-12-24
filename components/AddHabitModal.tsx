'use client';

import { useState } from 'react';
import { HabitType, useHabitStore } from '@/stores/habitStore';

interface AddHabitModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddHabitModal({ isOpen, onClose }: AddHabitModalProps) {
  const { createHabit } = useHabitStore();
  const [name, setName] = useState('');
  const [type, setType] = useState<HabitType>('boolean');
  const [targetValue, setTargetValue] = useState('');
  const [scheduleType, setScheduleType] = useState<'weekdays' | 'custom'>('weekdays');
  const [customDays, setCustomDays] = useState<Set<number>>(new Set([1, 2, 3, 4, 5]));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    // Validate custom schedule
    if (scheduleType === 'custom' && customDays.size === 0) {
      setError('Please select at least one day');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const scheduledDays = scheduleType === 'weekdays'
        ? null
        : Array.from(customDays).sort();

      await createHabit(
        name.trim(),
        type,
        targetValue ? parseInt(targetValue) : undefined,
        scheduledDays
      );
      setName('');
      setType('boolean');
      setTargetValue('');
      setScheduleType('weekdays');
      setCustomDays(new Set([1, 2, 3, 4, 5]));
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create habit');
    } finally {
      setIsLoading(false);
    }
  };

  const habitTypes: { value: HabitType; label: string; description: string; icon: string }[] = [
    {
      value: 'boolean',
      label: 'Check off',
      description: 'Simple done/not done',
      icon: '✓',
    },
    {
      value: 'count',
      label: 'Count',
      description: 'Track a number of times',
      icon: '123',
    },
    {
      value: 'time',
      label: 'Timer',
      description: 'Track time spent',
      icon: '⏱',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-surface-800 border border-surface-600 rounded-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-surface-600">
          <h2 className="text-xl font-semibold">New Habit</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-surface-700 flex items-center justify-center transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-6">
          {/* Name */}
          <div>
            <label htmlFor="habit-name" className="block text-sm font-medium text-gray-300 mb-2">
              Habit Name
            </label>
            <input
              id="habit-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Morning exercise"
              className="input w-full"
              autoFocus
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Tracking Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              {habitTypes.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setType(t.value)}
                  className={`p-3 rounded-lg border text-center transition-all ${
                    type === t.value
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-surface-500 hover:border-surface-400'
                  }`}
                >
                  <div className="text-xl mb-1">{t.icon}</div>
                  <div className="text-sm font-medium">{t.label}</div>
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {habitTypes.find((t) => t.value === type)?.description}
            </p>
          </div>

          {/* Target Value */}
          {type !== 'boolean' && (
            <div>
              <label htmlFor="target-value" className="block text-sm font-medium text-gray-300 mb-2">
                {type === 'count' ? 'Target Count' : 'Target Minutes'}
              </label>
              <input
                id="target-value"
                type="number"
                min="1"
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                placeholder={type === 'count' ? 'e.g., 3' : 'e.g., 30'}
                className="input w-full"
              />
              <p className="text-xs text-gray-500 mt-1">
                {type === 'count'
                  ? 'How many times per day?'
                  : 'How many minutes per day?'}
              </p>
            </div>
          )}

          {/* Schedule */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Schedule
            </label>

            {/* Radio buttons */}
            <div className="space-y-2 mb-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="schedule-type"
                  value="weekdays"
                  checked={scheduleType === 'weekdays'}
                  onChange={() => setScheduleType('weekdays')}
                  className="w-4 h-4 text-accent focus:ring-accent"
                />
                <span className="text-sm">Weekdays (Mon-Fri)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="schedule-type"
                  value="custom"
                  checked={scheduleType === 'custom'}
                  onChange={() => setScheduleType('custom')}
                  className="w-4 h-4 text-accent focus:ring-accent"
                />
                <span className="text-sm">Custom schedule</span>
              </label>
            </div>

            {/* Day checkboxes (only shown when custom) */}
            {scheduleType === 'custom' && (
              <div className="grid grid-cols-5 gap-2 mt-3">
                {[
                  { day: 1, label: 'Mon' },
                  { day: 2, label: 'Tue' },
                  { day: 3, label: 'Wed' },
                  { day: 4, label: 'Thu' },
                  { day: 5, label: 'Fri' },
                ].map(({ day, label }) => (
                  <label
                    key={day}
                    className={`p-2 rounded-lg border text-center cursor-pointer transition-all ${
                      customDays.has(day)
                        ? 'border-accent bg-accent/10 text-accent'
                        : 'border-surface-500 hover:border-surface-400'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={customDays.has(day)}
                      onChange={(e) => {
                        const newDays = new Set(customDays);
                        if (e.target.checked) {
                          newDays.add(day);
                        } else {
                          newDays.delete(day);
                        }
                        setCustomDays(newDays);
                      }}
                      className="sr-only"
                    />
                    <span className="text-sm font-medium">{label}</span>
                  </label>
                ))}
              </div>
            )}

            <p className="text-xs text-gray-500 mt-2">
              {scheduleType === 'weekdays'
                ? 'Habit will appear every weekday'
                : `Habit will appear on ${customDays.size} selected day${customDays.size !== 1 ? 's' : ''}`
              }
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-danger/10 border border-danger/30 rounded-lg p-3">
              <p className="text-danger text-sm">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary flex-1"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !name.trim()}
              className="btn btn-primary flex-1"
            >
              {isLoading ? 'Creating...' : 'Create Habit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

