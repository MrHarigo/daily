'use client';

import { useEffect, useState } from 'react';
import { useHabitStore, Habit } from '@/stores/habitStore';
import { useCalendarStore } from '@/stores/calendarStore';
import { useAuthStore } from '@/stores/authStore';
import { AddHabitModal } from '@/components/AddHabitModal';
import { api } from '@/lib/api';
import { startRegistration } from '@simplewebauthn/browser';
import type { PublicKeyCredentialCreationOptionsJSON } from '@simplewebauthn/browser';

interface SettingsProps {
  onLogout: () => void;
}

interface HabitWithArchived extends Habit {
  archived_at?: string | null;
}

interface Device {
  id: string;
  device_name: string;
  created_at: string;
}

export function Settings({ onLogout }: SettingsProps) {
  const { updateHabit, archiveHabit, deleteHabit, pauseHabit, unpauseHabit } = useHabitStore();
  const { dayOffs, fetchDayOffs, addDayOff, removeDayOff, fetchHolidays } = useCalendarStore();
  const { user } = useAuthStore();

  const [allHabits, setAllHabits] = useState<HabitWithArchived[]>([]);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [newDayOff, setNewDayOff] = useState('');
  const [dayOffReason, setDayOffReason] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  
  // Device management state
  const [devices, setDevices] = useState<Device[]>([]);
  const [isAddingDevice, setIsAddingDevice] = useState(false);
  const [deviceError, setDeviceError] = useState<string | null>(null);

  const fetchAllHabits = async () => {
    try {
      const habits = await api.get<HabitWithArchived[]>('/habits?includeAll=true');
      setAllHabits(habits);
    } catch (error) {
      console.error('Failed to fetch habits:', error);
    }
  };

  const fetchDevices = async () => {
    try {
      const data = await api.get<Device[]>('/auth/devices');
      setDevices(data);
    } catch (error) {
      console.error('Failed to fetch devices:', error);
    }
  };

  useEffect(() => {
    fetchAllHabits();
    fetchDayOffs();
    fetchDevices();
  }, [fetchDayOffs]);

  // Split habits into sections
  const activeHabits = allHabits.filter(h => !h.paused_at && !h.archived_at);
  const pausedHabits = allHabits.filter(h => h.paused_at && !h.archived_at);
  const archivedHabits = allHabits.filter(h => h.archived_at);

  const handleArchiveHabit = async (habit: HabitWithArchived) => {
    if (confirm(`Archive "${habit.name}"? You can restore it later.`)) {
      await archiveHabit(habit.id);
      fetchAllHabits();
    }
  };

  const handleDeleteHabit = async (habit: HabitWithArchived) => {
    if (confirm(`Permanently delete "${habit.name}"? This will remove all data and cannot be undone!`)) {
      await deleteHabit(habit.id);
      fetchAllHabits();
    }
  };

  const handlePauseHabit = async (habit: HabitWithArchived) => {
    if (habit.paused_at) {
      await unpauseHabit(habit.id);
    } else {
      await pauseHabit(habit.id);
    }
    fetchAllHabits();
  };

  const handleUnarchiveHabit = async (habit: HabitWithArchived) => {
    try {
      await api.post(`/habits/${habit.id}/unarchive`, {});
      fetchAllHabits();
    } catch (error) {
      console.error('Failed to unarchive habit:', error);
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
      // Get registration options
      const options = await api.get<PublicKeyCredentialCreationOptionsJSON>('/auth/add-device');
      
      // Start WebAuthn registration
      const credential = await startRegistration({ optionsJSON: options });
      
      // Verify with server
      const result = await api.post<{ verified: boolean; deviceName: string }>('/auth/add-device', credential);
      
      if (result.verified) {
        fetchDevices();
      }
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
      await api.delete(`/auth/devices?id=${encodeURIComponent(deviceId)}`);
      fetchDevices();
    } catch (err) {
      setDeviceError(err instanceof Error ? err.message : 'Failed to remove device');
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
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
        
        {allHabits.length === 0 ? (
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
                      fetchAllHabits();
                    }}
                    onCancel={() => setEditingHabit(null)}
                    onPause={() => handlePauseHabit(habit)}
                    onArchive={() => handleArchiveHabit(habit)}
                    onDelete={() => handleDeleteHabit(habit)}
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
                        fetchAllHabits();
                      }}
                      onCancel={() => setEditingHabit(null)}
                      onPause={() => handlePauseHabit(habit)}
                      onArchive={() => handleArchiveHabit(habit)}
                      onDelete={() => handleDeleteHabit(habit)}
                      isPaused
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
                  {archivedHabits.map((habit) => (
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
                          <button onClick={() => handleUnarchiveHabit(habit)} className="btn btn-ghost text-sm text-accent">Restore</button>
                          <button onClick={() => handleDeleteHabit(habit)} className="btn btn-ghost text-sm text-danger">Delete</button>
                        </div>
                      </div>
                    </div>
                  ))}
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

      <AddHabitModal isOpen={showAddModal} onClose={() => { setShowAddModal(false); fetchAllHabits(); }} />
    </div>
  );
}

interface HabitSettingsCardProps {
  habit: HabitWithArchived;
  editingHabit: Habit | null;
  onEdit: (habit: Habit) => void;
  onSave: (updates: Partial<Habit>) => Promise<void>;
  onCancel: () => void;
  onPause: () => void;
  onArchive: () => void;
  onDelete: () => void;
  isPaused?: boolean;
}

function HabitSettingsCard({ habit, editingHabit, onEdit, onSave, onCancel, onPause, onArchive, onDelete, isPaused }: HabitSettingsCardProps) {
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
          <button onClick={onPause}
            className={`btn btn-ghost text-sm ${habit.paused_at ? 'text-accent' : 'text-warning'}`}>
            {habit.paused_at ? 'Resume' : 'Pause'}
          </button>
          <button onClick={() => onEdit(habit)} className="btn btn-ghost text-sm">Edit</button>
          <button onClick={onArchive} className="btn btn-ghost text-sm text-gray-400">Archive</button>
          <button onClick={onDelete} className="btn btn-ghost text-sm text-danger">Delete</button>
        </div>
      </div>
    </div>
  );
}

function EditHabitForm({ habit, onSave, onCancel }: { habit: Habit; onSave: (updates: Partial<Habit>) => Promise<void>; onCancel: () => void }) {
  const [name, setName] = useState(habit.name);
  const [targetValue, setTargetValue] = useState(habit.target_value?.toString() || '');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsLoading(true);
    await onSave({ name: name.trim(), target_value: targetValue ? parseInt(targetValue) : null });
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
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="btn btn-secondary flex-1">Cancel</button>
        <button type="submit" disabled={isLoading || !name.trim()} className="btn btn-primary flex-1">{isLoading ? 'Saving...' : 'Save'}</button>
      </div>
    </form>
  );
}
