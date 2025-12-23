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
}

interface StatsState {
  overview: OverviewStats | null;
  habits: HabitInfo[];
  habitStats: Map<string, HabitStat>;
  isLoading: boolean;
  lastFetchTimestamp: number;

  fetchStats: () => Promise<void>;
}

export const useStatsStore = create<StatsState>((set, get) => ({
  overview: null,
  habits: [],
  habitStats: new Map(),
  isLoading: false,
  lastFetchTimestamp: 0,

  fetchStats: async () => {
    const state = get();
    const now = Date.now();

    // Skip if already loading AND less than 5 seconds since last fetch attempt
    // This prevents stuck states while allowing retry after timeout
    if (state.isLoading && now - state.lastFetchTimestamp < 5000) {
      return;
    }

    try {
      set({ isLoading: true, lastFetchTimestamp: now });

      const [overviewData, habitsData] = await Promise.all([
        api.get<OverviewStats>('/stats/overview'),
        api.get<HabitInfo[]>('/habits?includeAll=true'),
      ]);

      // Fetch habit stats in a single batch request
      const statsMap = new Map<string, HabitStat>();
      if (habitsData.length > 0) {
        try {
          const habitIds = habitsData.map(h => h.id).join(',');
          const batchStats = await api.get<Record<string, HabitStat>>(`/stats/batch?habitIds=${habitIds}`);

          // Convert the response object to a Map
          Object.entries(batchStats).forEach(([habitId, stat]) => {
            statsMap.set(habitId, stat);
          });
        } catch (e) {
          console.error('Failed to fetch batch stats:', e);
        }
      }

      set({
        overview: overviewData,
        habits: habitsData,
        habitStats: statsMap,
        isLoading: false,
      });
    } catch (error) {
      console.error('Failed to fetch stats:', error);
      set({ isLoading: false });
    }
  },
}));
