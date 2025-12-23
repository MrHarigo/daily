'use client';

import { useEffect, useState, useCallback } from 'react';
import { useHabitStore } from '@/stores/habitStore';
import { useCalendarStore } from '@/stores/calendarStore';
import { HabitCard } from '@/components/HabitCard';
import { DateSelector } from '@/components/DateSelector';

// Track optimistic completion states for instant filtering
type OptimisticCompletion = { completed: boolean; value: number };

export function Dashboard() {
  const { getActiveHabits, completions, selectedDate, setSelectedDate, fetchHabits, fetchCompletions, isLoading } = useHabitStore();
  const { fetchHolidays, fetchDayOffs, isWorkingDay } = useCalendarStore();
  const [showDone, setShowDone] = useState(false);

  // Optimistic completions for instant filtering (before server responds)
  const [optimisticCompletions, setOptimisticCompletions] = useState<Record<string, OptimisticCompletion>>({});
  const [prevCompletions, setPrevCompletions] = useState(completions);

  // Callback for HabitCard to report optimistic updates
  const onOptimisticUpdate = useCallback((habitId: string, completed: boolean, value: number) => {
    const key = `${habitId}-${selectedDate}`;
    setOptimisticCompletions(prev => ({ ...prev, [key]: { completed, value } }));
  }, [selectedDate]);

  // Clear optimistic state when server completions update (React-approved pattern)
  if (prevCompletions !== completions) {
    setOptimisticCompletions({});
    setPrevCompletions(completions);
  }

  useEffect(() => {
    const year = new Date().getFullYear();
    fetchHolidays(year);
    fetchDayOffs();
    // Always fetch fresh data, but show cached data while loading
    fetchHabits();
  }, [fetchHolidays, fetchDayOffs, fetchHabits]);

  useEffect(() => {
    const today = new Date(selectedDate);
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    fetchCompletions(startOfWeek.toISOString().split('T')[0], endOfWeek.toISOString().split('T')[0]);
  }, [selectedDate, fetchCompletions]);

  const isToday = selectedDate === new Date().toISOString().split('T')[0];
  const isWorkDay = isWorkingDay(selectedDate);

  const habits = getActiveHabits();
  const activeHabits = habits.filter((h) => h.created_at <= selectedDate);

  const getCompletion = (habitId: string) => {
    const key = `${habitId}-${selectedDate}`;
    return completions[key];
  };

  // Check if habit is completed (using optimistic state first, then server state)
  const isHabitCompleted = (habitId: string) => {
    const key = `${habitId}-${selectedDate}`;
    // Optimistic state takes precedence for instant filtering
    if (key in optimisticCompletions) {
      return optimisticCompletions[key].completed;
    }
    return completions[key]?.completed ?? false;
  };

  const todoHabits = activeHabits.filter((h) => !isHabitCompleted(h.id));
  const doneHabits = activeHabits.filter((h) => isHabitCompleted(h.id));

  const completedCount = doneHabits.length;
  const progressPercent = activeHabits.length > 0 ? Math.round((completedCount / activeHabits.length) * 100) : 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{isToday ? "Today's Habits" : 'Habits'}</h1>
          <p className="text-gray-500 mt-1">
            {new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <DateSelector selectedDate={selectedDate} onDateChange={setSelectedDate} />
      </div>

      {!isWorkDay && (
        <div className="card bg-surface-700/50 border-warning/30">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🌴</span>
            <div>
              <p className="font-medium text-warning">Non-working day</p>
              <p className="text-sm text-gray-400">Habits are paused. Your streak won&apos;t be affected.</p>
            </div>
          </div>
        </div>
      )}

      {isWorkDay && activeHabits.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-400">Daily Progress</span>
            <span className="text-sm font-mono text-accent">{completedCount}/{activeHabits.length} ({progressPercent}%)</span>
          </div>
          <div className="h-2 bg-surface-600 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-accent to-accent-bright transition-all duration-500 ease-out" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      )}

      {isLoading && habits.length === 0 ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : habits.length === 0 ? (
        <div className="card text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface-700 flex items-center justify-center">
            <span className="text-3xl">📝</span>
          </div>
          <h3 className="text-xl font-semibold mb-2">No habits yet</h3>
          <p className="text-gray-400 mb-6">Go to Settings to add your first habit</p>
        </div>
      ) : activeHabits.length === 0 ? (
        <div className="card text-center py-8">
          <p className="text-gray-400">No habits were active on this date</p>
        </div>
      ) : (
        <div className="space-y-6">
          {todoHabits.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">To Do ({todoHabits.length})</h2>
              <div className="space-y-3">
                {todoHabits.map((habit) => (
                  <HabitCard key={habit.id} habit={habit} completion={getCompletion(habit.id)} date={selectedDate} disabled={!isWorkDay} onOptimisticUpdate={onOptimisticUpdate} />
                ))}
              </div>
            </div>
          )}

          {doneHabits.length > 0 && (
            <div>
              <button onClick={() => setShowDone(!showDone)}
                className="flex items-center gap-2 text-sm font-medium text-gray-500 uppercase tracking-wide mb-3 hover:text-gray-400 transition-colors">
                <span className={`transition-transform duration-200 ${showDone ? 'rotate-90' : ''}`}>▶</span>
                Done ({doneHabits.length})
              </button>
              {showDone && (
                <div className="space-y-3">
                  {doneHabits.map((habit) => (
                    <HabitCard key={habit.id} habit={habit} completion={getCompletion(habit.id)} date={selectedDate} disabled={!isWorkDay} onOptimisticUpdate={onOptimisticUpdate} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

