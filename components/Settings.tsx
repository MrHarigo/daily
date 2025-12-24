'use client';

import { useEffect, useState } from 'react';
import { useHabitStore, Habit } from '@/stores/habitStore';
import { useCalendarStore } from '@/stores/calendarStore';
import { useAuthStore } from '@/stores/authStore';
import { AddHabitModal } from '@/components/AddHabitModal';
import { parseLocalDate } from '@/lib/date-utils';

interface SettingsProps {
  onLogout: () => void;
}

export function Settings({ onLogout }: SettingsProps) {
  const {
    getActiveHabits,
    getPausedHabits,
    getArchivedHabits,
    isLoading,
    error,
    fetchHabits,
    updateHabit,
    archiveHabit,
    unarchiveHabit,
    deleteHabit,
    pauseHabit,
    unpauseHabit,
  } = useHabitStore();
  const { dayOffs, fetchDayOffs, addDayOff, removeDayOff, fetchHolidays } = useCalendarStore();
  const { user, devices, devicesLoading, devicesError, fetchDevices, addDevice, removeDevice } = useAuthStore();

  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [newDayOff, setNewDayOff] = useState('');
  const [dayOffReason, setDayOffReason] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  // Device management state (only local UI state)
  const [isAddingDevice, setIsAddingDevice] = useState(false);
  const [deviceError, setDeviceError] = useState<string | null>(null);

  // Habit operations loading state: { habitId: operation }
  const [loadingOperations, setLoadingOperations] = useState<Record<string, string>>({});

  useEffect(() => {
    // Always fetch fresh data, but show cached data while loading
    fetchHabits();
    fetchDevices();
    fetchDayOffs();
  }, [fetchHabits, fetchDevices, fetchDayOffs]);

  // Get habits from computed getters
  const activeHabits = getActiveHabits();
  const pausedHabits = getPausedHabits();
  const archivedHabits = getArchivedHabits();

  const handleArchiveHabit = async (habit: Habit) => {
    if (confirm(`Archive "${habit.name}"? You can restore it later.`)) {
      setLoadingOperations((prev) => ({ ...prev, [habit.id]: 'archive' }));
      try {
        await archiveHabit(habit.id);
      } catch (error) {
        console.error('Failed to archive habit:', error);
      } finally {
        setLoadingOperations((prev) => {
          const { [habit.id]: _, ...rest } = prev;
          return rest;
        });
      }
    }
  };

  const handleDeleteHabit = async (habit: Habit) => {
    if (confirm(`Permanently delete "${habit.name}"? This will remove all data and cannot be undone!`)) {
      setLoadingOperations((prev) => ({ ...prev, [habit.id]: 'delete' }));
      try {
        await deleteHabit(habit.id);
      } catch (error) {
        console.error('Failed to delete habit:', error);
      } finally {
        setLoadingOperations((prev) => {
          const { [habit.id]: _, ...rest } = prev;
          return rest;
        });
      }
    }
  };

  const handlePauseHabit = async (habit: Habit) => {
    const operation = habit.paused_at ? 'unpause' : 'pause';
    setLoadingOperations((prev) => ({ ...prev, [habit.id]: operation }));
    try {
      if (habit.paused_at) {
        await unpauseHabit(habit.id);
      } else {
        await pauseHabit(habit.id);
      }
    } catch (error) {
      console.error(`Failed to ${operation} habit:`, error);
    } finally {
      setLoadingOperations((prev) => {
        const { [habit.id]: _, ...rest } = prev;
        return rest;
      });
    }
  };

  const handleUnarchiveHabit = async (habit: Habit) => {
    setLoadingOperations((prev) => ({ ...prev, [habit.id]: 'unarchive' }));
    try {
      await unarchiveHabit(habit.id);
    } catch (error) {
      console.error('Failed to unarchive habit:', error);
    } finally {
      setLoadingOperations((prev) => {
        const { [habit.id]: _, ...rest } = prev;
        return rest;
      });
    }
  };

  const handleAddDayOff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDayOff) return;
    await addDayOff(newDayOff, dayOffReason || undefined);
    setNewDayOff('');
    setDayOffReason('');
  };

  const handleRefreshHolidays = async () => {
    const year = new Date().getFullYear();
    await fetchHolidays(year);
  };

  const handleAddDevice = async () => {
    setIsAddingDevice(true);
    setDeviceError(null);

    try {
      await addDevice();
    } catch (err) {
      if ((err as { name?: string })?.name !== 'NotAllowedError') {
        setDeviceError(err instanceof Error ? err.message : 'Failed to add device');
      }
    } finally {
      setIsAddingDevice(false);
    }
  };

  const handleRemoveDevice = async (deviceId: string, deviceName: string) => {
    if (!confirm(`Remove "${deviceName}"? You won't be able to sign in from this device anymore.`)) {
      return;
    }

    try {
      await removeDevice(deviceId);
    } catch (err) {
      setDeviceError(err instanceof Error ? err.message : 'Failed to remove device');
    }
  };

  const formatDate = (dateStr: string) => {
    return parseLocalDate(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-gray-500 mt-1">Manage your habits and account</p>
      </div>

      {/* Habits Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Manage Habits</h2>
          <button onClick={() => setShowAddModal(true)} className="btn btn-primary text-sm">+ Add Habit</button>
        </div>

        {error && (
          <div className="bg-red-950/30 border border-red-900/50 rounded-lg p-4 mb-4">
            <p className="text-red-400 font-medium mb-2">Failed to load habits</p>
            <p className="text-sm text-gray-400 mb-3">{error}</p>
            <button onClick={fetchHabits} className="btn btn-secondary btn-sm">
              Retry
            </button>
          </div>
        )}

        {isLoading && activeHabits.length === 0 && pausedHabits.length === 0 && archivedHabits.length === 0 ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : activeHabits.length === 0 && pausedHabits.length === 0 && archivedHabits.length === 0 ? (
          <div className="card text-center py-8">
            <p className="text-gray-400">No habits yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Active Habits */}
            {activeHabits.length > 0 && (
              <div className="space-y-2">
                {activeHabits.map((habit) => (
                  <HabitSettingsCard
                    key={habit.id}
                    habit={habit}
                    editingHabit={editingHabit}
                    onEdit={setEditingHabit}
                    onSave={async (updates) => {
                      await updateHabit(habit.id, updates);
                      setEditingHabit(null);
                    }}
                    onCancel={() => setEditingHabit(null)}
                    onPause={() => handlePauseHabit(habit)}
                    onArchive={() => handleArchiveHabit(habit)}
                    onDelete={() => handleDeleteHabit(habit)}
                    loadingOperation={loadingOperations[habit.id]}
                  />
                ))}
              </div>
            )}

            {/* Paused Habits */}
            {pausedHabits.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2 mt-6">
                  Paused ({pausedHabits.length})
                </h3>
                <div className="space-y-2">
                  {pausedHabits.map((habit) => (
                    <HabitSettingsCard
                      key={habit.id}
                      habit={habit}
                      editingHabit={editingHabit}
                      onEdit={setEditingHabit}
                      onSave={async (updates) => {
                        await updateHabit(habit.id, updates);
                        setEditingHabit(null);
                      }}
                      onCancel={() => setEditingHabit(null)}
                      onPause={() => handlePauseHabit(habit)}
                      onArchive={() => handleArchiveHabit(habit)}
                      onDelete={() => handleDeleteHabit(habit)}
                      isPaused
                      loadingOperation={loadingOperations[habit.id]}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Archived Habits */}
            {archivedHabits.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2 mt-6">
                  Archived ({archivedHabits.length})
                </h3>
                <div className="space-y-2">
                  {archivedHabits.map((habit) => {
                    const loading = loadingOperations[habit.id];
                    return (
                      <div key={habit.id} className="card opacity-60">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-medium flex items-center gap-2">
                              {habit.name}
                              <span className="text-xs bg-gray-500/20 text-gray-400 px-2 py-0.5 rounded">Archived</span>
                            </h3>
                            <p className="text-sm text-gray-500">
                              {habit.type === 'boolean' && 'Check off'}
                              {habit.type === 'count' && `Count • Goal: ${habit.target_value || '–'}`}
                              {habit.type === 'time' && `Timer • Goal: ${habit.target_value || '–'} min`}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleUnarchiveHabit(habit)}
                              disabled={!!loading}
                              className="btn btn-ghost text-sm text-accent"
                            >
                              {loading === 'unarchive' ? (
                                <span className="flex items-center gap-1">
                                  <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                  Restoring...
                                </span>
                              ) : 'Restore'}
                            </button>
                            <button
                              onClick={() => handleDeleteHabit(habit)}
                              disabled={!!loading}
                              className="btn btn-ghost text-sm text-danger"
                            >
                              {loading === 'delete' ? (
                                <span className="flex items-center gap-1">
                                  <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                  Deleting...
                                </span>
                              ) : 'Delete'}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Day-offs Section */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Day-offs</h2>
        <p className="text-sm text-gray-500 mb-4">Mark additional non-working days beyond weekends and Japanese holidays.</p>

        <form onSubmit={handleAddDayOff} className="card mb-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <input type="date" value={newDayOff} onChange={(e) => setNewDayOff(e.target.value)} className="input flex-1" />
            <input type="text" value={dayOffReason} onChange={(e) => setDayOffReason(e.target.value)} placeholder="Reason (optional)" className="input flex-1" />
            <button type="submit" disabled={!newDayOff} className="btn btn-primary">Add Day-off</button>
          </div>
        </form>

        {dayOffs.length === 0 ? (
          <div className="card text-center py-6">
            <p className="text-gray-400 text-sm">No custom day-offs set</p>
          </div>
        ) : (
          <div className="space-y-2">
            {dayOffs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((dayOff) => (
              <div key={dayOff.date} className="card flex items-center justify-between">
                <div>
                  <span className="font-mono">
                    {new Date(dayOff.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  {dayOff.reason && <span className="text-gray-500 ml-2">— {dayOff.reason}</span>}
                </div>
                <button onClick={() => removeDayOff(dayOff.date)} className="btn btn-ghost text-sm text-danger">Remove</button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Holidays Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold">Japanese Holidays</h2>
            <p className="text-sm text-gray-500">Public holidays are fetched automatically</p>
          </div>
          <button onClick={handleRefreshHolidays} className="btn btn-secondary text-sm">Refresh</button>
        </div>
        <div className="card bg-surface-700/50">
          <p className="text-sm text-gray-400">
            Japanese national holidays for {new Date().getFullYear()} are automatically loaded and cached.
          </p>
        </div>
      </section>

      {/* Devices Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold">Devices</h2>
            <p className="text-sm text-gray-500">Manage devices that can access your account</p>
          </div>
          <button 
            onClick={handleAddDevice} 
            disabled={isAddingDevice}
            className="btn btn-primary text-sm"
          >
            {isAddingDevice ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-surface-900 border-t-transparent rounded-full animate-spin" />
                Adding...
              </span>
            ) : '+ Add Device'}
          </button>
        </div>

        {deviceError && (
          <div className="bg-danger/10 border border-danger/30 rounded-lg p-3 mb-4">
            <p className="text-danger text-sm">{deviceError}</p>
          </div>
        )}

        {devicesError && (
          <div className="bg-red-950/30 border border-red-900/50 rounded-lg p-4 mb-4">
            <p className="text-red-400 font-medium mb-2">Failed to load devices</p>
            <p className="text-sm text-gray-400 mb-3">{devicesError}</p>
            <button onClick={fetchDevices} className="btn btn-secondary btn-sm">
              Retry
            </button>
          </div>
        )}

        {devicesLoading && devices.length === 0 ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-2">
            {devices.map((device) => (
              <div key={device.id} className="card flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-surface-700 flex items-center justify-center">
                    <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      {device.device_name === 'Mac' || device.device_name === 'Windows' || device.device_name === 'Linux' ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      )}
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium">{device.device_name || 'Unknown Device'}</p>
                    <p className="text-sm text-gray-500">Added {formatDate(device.created_at)}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveDevice(device.id, device.device_name || 'this device')}
                  className="btn btn-ghost text-sm text-danger"
                  disabled={devices.length <= 1}
                  title={devices.length <= 1 ? 'Cannot remove your only device' : 'Remove device'}
                >
                  Remove
                </button>
              </div>
            ))}

            {devices.length === 0 && (
              <div className="card text-center py-6">
                <p className="text-gray-400 text-sm">No devices registered</p>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Account Section */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Account</h2>
        <div className="card">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center text-accent text-xl font-bold">
              {user?.username?.charAt(0).toUpperCase() || '?'}
            </div>
            <div>
              <p className="font-medium">{user?.username || 'User'}</p>
              <p className="text-sm text-gray-500">{user?.email}</p>
            </div>
          </div>
          <button onClick={onLogout} className="btn btn-danger">Log Out</button>
        </div>
      </section>

      <AddHabitModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} />
    </div>
  );
}

interface HabitSettingsCardProps {
  habit: Habit;
  editingHabit: Habit | null;
  onEdit: (habit: Habit) => void;
  onSave: (updates: Partial<Habit>) => Promise<void>;
  onCancel: () => void;
  onPause: () => void;
  onArchive: () => void;
  onDelete: () => void;
  isPaused?: boolean;
  loadingOperation?: string;
}

function HabitSettingsCard({ habit, editingHabit, onEdit, onSave, onCancel, onPause, onArchive, onDelete, isPaused, loadingOperation }: HabitSettingsCardProps) {
  if (editingHabit?.id === habit.id) {
    return (
      <div className="card">
        <EditHabitForm habit={editingHabit} onSave={onSave} onCancel={onCancel} />
      </div>
    );
  }

  return (
    <div className={`card ${isPaused ? 'opacity-75' : ''}`}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium flex items-center gap-2">
            {habit.name}
            {habit.paused_at && (
              <span className="text-xs bg-warning/20 text-warning px-2 py-0.5 rounded">Paused</span>
            )}
          </h3>
          <p className="text-sm text-gray-500">
            {habit.type === 'boolean' && 'Check off'}
            {habit.type === 'count' && `Count • Goal: ${habit.target_value || '–'}`}
            {habit.type === 'time' && `Timer • Goal: ${habit.target_value || '–'} min`}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onPause}
            disabled={!!loadingOperation}
            className={`btn btn-ghost text-sm ${habit.paused_at ? 'text-accent' : 'text-warning'}`}
          >
            {loadingOperation === 'pause' || loadingOperation === 'unpause' ? (
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                {loadingOperation === 'unpause' ? 'Resuming...' : 'Pausing...'}
              </span>
            ) : (
              habit.paused_at ? 'Resume' : 'Pause'
            )}
          </button>
          <button
            onClick={() => onEdit(habit)}
            disabled={!!loadingOperation}
            className="btn btn-ghost text-sm"
          >
            Edit
          </button>
          <button
            onClick={onArchive}
            disabled={!!loadingOperation}
            className="btn btn-ghost text-sm text-gray-400"
          >
            {loadingOperation === 'archive' ? (
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Archiving...
              </span>
            ) : 'Archive'}
          </button>
          <button
            onClick={onDelete}
            disabled={!!loadingOperation}
            className="btn btn-ghost text-sm text-danger"
          >
            {loadingOperation === 'delete' ? (
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Deleting...
              </span>
            ) : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditHabitForm({ habit, onSave, onCancel }: { habit: Habit; onSave: (updates: Partial<Habit>) => Promise<void>; onCancel: () => void }) {
  const [name, setName] = useState(habit.name);
  const [targetValue, setTargetValue] = useState(habit.target_value?.toString() || '');

  // Initialize schedule state from habit
  const initialScheduleType: 'weekdays' | 'custom' =
    habit.scheduled_days === null || habit.scheduled_days === undefined ? 'weekdays' : 'custom';
  const initialCustomDays = habit.scheduled_days
    ? new Set(habit.scheduled_days)
    : new Set([1, 2, 3, 4, 5]);

  const [scheduleType, setScheduleType] = useState<'weekdays' | 'custom'>(initialScheduleType);
  const [customDays, setCustomDays] = useState<Set<number>>(initialCustomDays);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    const scheduledDays = scheduleType === 'weekdays'
      ? null
      : Array.from(customDays).sort();

    await onSave({
      name: name.trim(),
      target_value: targetValue ? parseInt(targetValue) : null,
      scheduled_days: scheduledDays
    });
    setIsLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">Name</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="input w-full" />
      </div>
      {habit.type !== 'boolean' && (
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            {habit.type === 'count' ? 'Target Count' : 'Target Minutes'}
          </label>
          <input type="number" min="1" value={targetValue} onChange={(e) => setTargetValue(e.target.value)} className="input w-full" />
        </div>
      )}

      {/* Schedule Section */}
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

      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="btn btn-secondary flex-1">Cancel</button>
        <button type="submit" disabled={isLoading || !name.trim()} className="btn btn-primary flex-1">{isLoading ? 'Saving...' : 'Save'}</button>
      </div>
    </form>
  );
}
