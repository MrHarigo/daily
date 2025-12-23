'use client';

import { useEffect, useState } from 'react';
import { useStatsStore, HabitInfo, HabitStat } from '@/stores/statsStore';

export function Stats() {
  const { overview, habits, habitStats, isLoading, error, fetchStats } = useStatsStore();
  const [showInactive, setShowInactive] = useState(false);

  useEffect(() => {
    // Always fetch fresh data, but show cached data while loading
    fetchStats();
  }, [fetchStats]);

  // Split habits into active, paused, and archived
  const activeHabits = habits.filter(h => !h.paused_at && !h.archived_at);
  const pausedHabits = habits.filter(h => h.paused_at && !h.archived_at);
  const archivedHabits = habits.filter(h => h.archived_at);
  const inactiveHabits = [...pausedHabits, ...archivedHabits];

  // Show error state if fetch failed
  if (error) {
    return (
      <div className="card text-center py-12 bg-red-950/30 border-red-900/50">
        <p className="text-red-400 font-medium mb-2">Failed to load statistics</p>
        <p className="text-sm text-gray-400 mb-4">{error}</p>
        <button
          onClick={fetchStats}
          className="btn btn-secondary"
        >
          Retry
        </button>
      </div>
    );
  }

  // Only show full loading state if we have no cached data
  if (isLoading && !overview) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="card text-center py-12">
        <p className="text-gray-400">Failed to load statistics</p>
      </div>
    );
  }

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const formatTotalValue = (habit: HabitInfo, stat: HabitStat) => {
    switch (habit.type) {
      case 'boolean': return `${stat.totalCompletions} days`;
      case 'time': return formatTime(stat.totalTime || 0);
      case 'count': return `${stat.totalCount || 0} times`;
      default: return stat.totalCompletions;
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Statistics</h1>
        <p className="text-gray-500 mt-1">All time</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="card text-center">
          <div className="text-3xl font-bold text-accent flex items-center justify-center gap-2">
            {overview.longestStreak > 0 && overview.completedToday && <span className="text-orange-500">🔥</span>}
            {overview.longestStreak > 0 && !overview.completedToday && <span className="text-gray-500 opacity-50">🔥</span>}
            {overview.longestStreak}
          </div>
          <div className="text-sm text-gray-500 mt-1">
            {overview.longestStreak > 0 && !overview.completedToday ? 'Streak at risk!' : 'Best Current Streak'}
          </div>
        </div>
        <div className="card text-center">
          <div className="text-3xl font-bold text-accent">{overview.totalCompletions}</div>
          <div className="text-sm text-gray-500 mt-1">Total Completions</div>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">By Habit</h2>
        
        {habits.length === 0 ? (
          <div className="card text-center py-8">
            <p className="text-gray-400">No habits tracked yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Active Habits */}
            {activeHabits.map((habit) => {
              const stat = habitStats[habit.id];
              if (!stat) return null;
              return (
                <div key={habit.id} className="card">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium truncate">{habit.name}</h3>
                      <p className="text-sm text-gray-500 capitalize">{habit.type}</p>
                    </div>
                    <div className="flex items-center gap-8 text-sm">
                      <div className="text-center min-w-[60px]">
                        <div className="text-lg font-bold flex items-center justify-center gap-1">
                          {stat.currentStreak > 0 && stat.completedToday && <span className="text-orange-500">🔥</span>}
                          {stat.currentStreak > 0 && !stat.completedToday && <span className="text-gray-500 opacity-50">🔥</span>}
                          {stat.currentStreak}
                        </div>
                        <div className="text-gray-500 text-xs">{stat.currentStreak > 0 && !stat.completedToday ? 'At risk' : 'Streak'}</div>
                      </div>
                      <div className="text-center min-w-[80px]">
                        <div className="text-lg font-bold text-accent">{formatTotalValue(habit, stat)}</div>
                        <div className="text-gray-500 text-xs">Total</div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Paused/Archived Habits (Collapsible) */}
            {inactiveHabits.length > 0 && (
              <div className="pt-4">
                <button
                  onClick={() => setShowInactive(!showInactive)}
                  className="flex items-center gap-2 text-sm font-medium text-gray-500 uppercase tracking-wide mb-3 hover:text-gray-400 transition-colors"
                >
                  <span className={`transition-transform duration-200 ${showInactive ? 'rotate-90' : ''}`}>
                    ▶
                  </span>
                  Paused & Archived ({inactiveHabits.length})
                </button>
                
                {showInactive && (
                  <div className="space-y-3">
                    {inactiveHabits.map((habit) => {
                      const stat = habitStats[habit.id];
                      if (!stat) return null;
                      const isPaused = !!habit.paused_at && !habit.archived_at;
                      const isArchived = !!habit.archived_at;
                      return (
                        <div key={habit.id} className="card opacity-60">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                            <div className="flex-1 min-w-0">
                              <h3 className="font-medium truncate flex items-center gap-2">
                                {habit.name}
                                {isPaused && (
                                  <span className="text-xs bg-warning/20 text-warning px-2 py-0.5 rounded">Paused</span>
                                )}
                                {isArchived && (
                                  <span className="text-xs bg-gray-500/20 text-gray-400 px-2 py-0.5 rounded">Archived</span>
                                )}
                              </h3>
                              <p className="text-sm text-gray-500 capitalize">{habit.type}</p>
                            </div>
                            <div className="flex items-center gap-8 text-sm">
                              <div className="text-center min-w-[60px]">
                                <div className="text-lg font-bold text-gray-500">
                                  {stat.currentStreak}
                                </div>
                                <div className="text-gray-500 text-xs">Streak</div>
                              </div>
                              <div className="text-center min-w-[80px]">
                                <div className="text-lg font-bold text-gray-400">{formatTotalValue(habit, stat)}</div>
                                <div className="text-gray-500 text-xs">Total</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

