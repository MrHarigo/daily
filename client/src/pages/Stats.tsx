import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface HabitStat {
  id: string;
  name: string;
  type: 'boolean' | 'count' | 'time';
  currentStreak: number;
  totalValue: number;
}

interface OverviewStats {
  overall: {
    bestCurrentStreak: number;
    totalCompletions: number;
    totalHabits: number;
  };
  habits: HabitStat[];
}

export function Stats() {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await api.get<OverviewStats>('/stats/overview');
        setStats(data);
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="card text-center py-12">
        <p className="text-gray-400">Failed to load statistics</p>
      </div>
    );
  }

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const formatTotalValue = (habit: HabitStat) => {
    switch (habit.type) {
      case 'boolean':
        return `${habit.totalValue} days`;
      case 'time':
        return formatTime(habit.totalValue);
      case 'count':
        return `${habit.totalValue} times`;
      default:
        return habit.totalValue;
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Statistics</h1>
        <p className="text-gray-500 mt-1">All time</p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card text-center">
          <div className="text-3xl font-bold text-accent flex items-center justify-center gap-2">
            {stats.overall.bestCurrentStreak > 0 && <span className="text-orange-500">🔥</span>}
            {stats.overall.bestCurrentStreak}
          </div>
          <div className="text-sm text-gray-500 mt-1">Best Current Streak</div>
        </div>
        <div className="card text-center">
          <div className="text-3xl font-bold text-accent">
            {stats.overall.totalCompletions}
          </div>
          <div className="text-sm text-gray-500 mt-1">Total Completions</div>
        </div>
      </div>

      {/* Habit Stats */}
      <div>
        <h2 className="text-xl font-semibold mb-4">By Habit</h2>
        
        {stats.habits.length === 0 ? (
          <div className="card text-center py-8">
            <p className="text-gray-400">No habits tracked yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {stats.habits.map((habit) => (
              <div key={habit.id} className="card">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  {/* Name and type */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate">{habit.name}</h3>
                    <p className="text-sm text-gray-500 capitalize">{habit.type}</p>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-8 text-sm">
                    {/* Current Streak */}
                    <div className="text-center min-w-[60px]">
                      <div className="text-lg font-bold flex items-center justify-center gap-1">
                        {habit.currentStreak > 0 && <span className="text-orange-500">🔥</span>}
                        {habit.currentStreak}
                      </div>
                      <div className="text-gray-500 text-xs">Streak</div>
                    </div>

                    {/* Total Value */}
                    <div className="text-center min-w-[80px]">
                      <div className="text-lg font-bold text-accent">
                        {formatTotalValue(habit)}
                      </div>
                      <div className="text-gray-500 text-xs">Total</div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
