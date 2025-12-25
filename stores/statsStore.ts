import { create } from 'zustand';
import { api } from '@/lib/api';

export interface OverviewStats {
  longestStreak: number;
  completedToday: boolean;
  totalCompletions: number;
  totalHabits: number;
}

export interface HabitStat {
  currentStreak: number;
  completedToday: boolean;
  totalCompletions: number;
  totalTime?: number;
  totalCount?: number;
}

export interface HabitInfo {
  id: string;
  name: string;
  type: 'boolean' | 'count' | 'time';
  paused_at?: string | null;
  archived_at?: string | null;
  scheduled_days?: number[] | null;
}

interface StatsState {
  overview: OverviewStats | null;
  habits: HabitInfo[];
  habitStats: Record<string, HabitStat>;
  isLoading: boolean;
  error: string | null;

  fetchStats: () => Promise<void>;
}

export const useStatsStore = create<StatsState>((set, get) => ({
  overview: null,
  habits: [],
  habitStats: {},
  isLoading: false,
  error: null,

  fetchStats: async () => {
    const state = get();

    // Simple race condition prevention: skip if already loading
    if (state.isLoading) return;

    try {
      set({ isLoading: true, error: null });

      const [overviewData, habitsData] = await Promise.all([
        api.get<OverviewStats>('/stats/overview'),
        api.get<HabitInfo[]>('/habits?includeAll=true'),
      ]);

      // Fetch habit stats in a single batch request
      let habitStats: Record<string, HabitStat> = {};
      if (habitsData.length > 0) {
        try {
          const habitIds = habitsData.map(h => h.id).join(',');
          habitStats = await api.get<Record<string, HabitStat>>(`/stats/batch?habitIds=${habitIds}`);
        } catch (e) {
          console.error('Failed to fetch batch stats:', e);
        }
      }

      set({
        overview: overviewData,
        habits: habitsData,
        habitStats,
        isLoading: false,
      });
    } catch (error) {
      console.error('Failed to fetch stats:', error);
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch stats'
      });
    }
  },
}));
