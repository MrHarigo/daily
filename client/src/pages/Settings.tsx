import { useEffect, useState } from 'react';
import { useHabitStore, Habit } from '../stores/habitStore';
import { useCalendarStore } from '../stores/calendarStore';
import { AddHabitModal } from '../components/AddHabitModal';

export function Settings() {
  const { habits, fetchHabits, updateHabit, archiveHabit, deleteHabit, pauseHabit, unpauseHabit } = useHabitStore();
  const { dayOffs, fetchDayOffs, addDayOff, removeDayOff, fetchHolidays } = useCalendarStore();

  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [newDayOff, setNewDayOff] = useState('');
  const [dayOffReason, setDayOffReason] = useState('');
  const [isRefreshingHolidays, setIsRefreshingHolidays] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    fetchHabits();
    fetchDayOffs();
  }, [fetchHabits, fetchDayOffs]);

  const handleArchiveHabit = async (habit: Habit) => {
    if (confirm(`Archive "${habit.name}"? You can restore it later.`)) {
      await archiveHabit(habit.id);
    }
  };

  const handleDeleteHabit = async (habit: Habit) => {
    if (confirm(`Permanently delete "${habit.name}"? This will remove all data and cannot be undone!`)) {
      await deleteHabit(habit.id);
    }
  };

  const handlePauseHabit = async (habit: Habit) => {
    if (habit.paused_at) {
      await unpauseHabit(habit.id);
    } else {
      await pauseHabit(habit.id);
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
    setIsRefreshingHolidays(true);
    const year = new Date().getFullYear();
    try {
      // Force refresh from API
      await fetch(`/api/calendar/holidays/${year}/refresh`, { method: 'POST', credentials: 'include' });
      await fetchHolidays(year);
    } catch (error) {
      console.error('Failed to refresh holidays:', error);
    } finally {
      setIsRefreshingHolidays(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-gray-500 mt-1">Manage your habits and calendar</p>
      </div>

      {/* Habits Management */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Manage Habits</h2>
          <button
            onClick={() => setShowAddModal(true)}
            className="btn btn-primary text-sm"
          >
            + Add Habit
          </button>
        </div>
        
        {habits.length === 0 ? (
          <div className="card text-center py-8">
            <p className="text-gray-400">No habits yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {habits.map((habit) => (
              <div key={habit.id} className="card">
                {editingHabit?.id === habit.id ? (
                  <EditHabitForm
                    habit={editingHabit}
                    onSave={async (updates) => {
                      await updateHabit(habit.id, updates);
                      setEditingHabit(null);
                    }}
                    onCancel={() => setEditingHabit(null)}
                  />
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium flex items-center gap-2">
                        {habit.name}
                        {habit.paused_at && (
                          <span className="text-xs bg-warning/20 text-warning px-2 py-0.5 rounded">
                            Paused
                          </span>
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
                        onClick={() => handlePauseHabit(habit)}
                        className={`btn btn-ghost text-sm ${habit.paused_at ? 'text-accent' : 'text-warning'}`}
                        title={habit.paused_at ? 'Resume habit' : 'Pause habit (freezes streak)'}
                      >
                        {habit.paused_at ? 'Resume' : 'Pause'}
                      </button>
                      <button
                        onClick={() => setEditingHabit(habit)}
                        className="btn btn-ghost text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleArchiveHabit(habit)}
                        className="btn btn-ghost text-sm text-gray-400"
                        title="Archive (keeps data, can restore)"
                      >
                        Archive
                      </button>
                      <button
                        onClick={() => handleDeleteHabit(habit)}
                        className="btn btn-ghost text-sm text-danger"
                        title="Permanently delete"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Day-offs Management */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Day-offs</h2>
        <p className="text-sm text-gray-500 mb-4">
          Mark additional non-working days beyond weekends and Japanese holidays.
        </p>

        {/* Add day-off form */}
        <form onSubmit={handleAddDayOff} className="card mb-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="date"
              value={newDayOff}
              onChange={(e) => setNewDayOff(e.target.value)}
              className="input flex-1"
            />
            <input
              type="text"
              value={dayOffReason}
              onChange={(e) => setDayOffReason(e.target.value)}
              placeholder="Reason (optional)"
              className="input flex-1"
            />
            <button
              type="submit"
              disabled={!newDayOff}
              className="btn btn-primary"
            >
              Add Day-off
            </button>
          </div>
        </form>

        {/* Day-offs list */}
        {dayOffs.length === 0 ? (
          <div className="card text-center py-6">
            <p className="text-gray-400 text-sm">No custom day-offs set</p>
          </div>
        ) : (
          <div className="space-y-2">
            {dayOffs
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
              .map((dayOff) => (
                <div key={dayOff.date} className="card flex items-center justify-between">
                  <div>
                    <span className="font-mono">
                      {new Date(dayOff.date).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                    {dayOff.reason && (
                      <span className="text-gray-500 ml-2">— {dayOff.reason}</span>
                    )}
                  </div>
                  <button
                    onClick={() => removeDayOff(dayOff.date)}
                    className="btn btn-ghost text-sm text-danger"
                  >
                    Remove
                  </button>
                </div>
              ))}
          </div>
        )}
      </section>

      {/* Holidays */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold">Japanese Holidays</h2>
            <p className="text-sm text-gray-500">
              Public holidays are fetched automatically
            </p>
          </div>
          <button
            onClick={handleRefreshHolidays}
            disabled={isRefreshingHolidays}
            className="btn btn-secondary text-sm"
          >
            {isRefreshingHolidays ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
        <div className="card bg-surface-700/50">
          <p className="text-sm text-gray-400">
            Japanese national holidays for {new Date().getFullYear()} are automatically loaded and cached.
            Habits are paused on these days without breaking your streak.
          </p>
        </div>
      </section>

      {/* Add Habit Modal */}
      <AddHabitModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
      />
    </div>
  );
}

// Edit habit form component
function EditHabitForm({
  habit,
  onSave,
  onCancel,
}: {
  habit: Habit;
  onSave: (updates: Partial<Habit>) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(habit.name);
  const [targetValue, setTargetValue] = useState(
    habit.target_value?.toString() || ''
  );
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsLoading(true);
    await onSave({
      name: name.trim(),
      target_value: targetValue ? parseInt(targetValue) : null,
    });
    setIsLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">
          Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="input w-full"
        />
      </div>

      {habit.type !== 'boolean' && (
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            {habit.type === 'count' ? 'Target Count' : 'Target Minutes'}
          </label>
          <input
            type="number"
            min="1"
            value={targetValue}
            onChange={(e) => setTargetValue(e.target.value)}
            className="input w-full"
          />
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="btn btn-secondary flex-1"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading || !name.trim()}
          className="btn btn-primary flex-1"
        >
          {isLoading ? 'Saving...' : 'Save'}
        </button>
      </div>
    </form>
  );
}

