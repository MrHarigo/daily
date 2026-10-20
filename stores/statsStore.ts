import { create } from 'zustand';
import { api } from '@/lib/api';
import { getTodayLocal } from '@/lib/date-utils';
import type { HabitStats } from '@/lib/stats-utils';
import type { Habit } from '@/stores/habitStore';

export type { HabitStats, StatsDay, Tally } from '@/lib/stats-utils';

export type StatsHabit = Habit & { stats: HabitStats };

export interface StatsData {
  today: string;
  from: string;
  offDays: string[];
  habits: StatsHabit[];
}

// Range length in days ending today; 0 = all time
export type StatsRange = 7 | 30 | 90 | 365 | 0;

interface StatsState {
  data: StatsData | null;
  range: StatsRange;
  isLoading: boolean;
  error: string | null;

  fetchStats: () => Promise<void>;
  setRange: (range: StatsRange) => void;
}

export const useStatsStore = create<StatsState>((set, get) => ({
  data: null,
  range: 30,
  isLoading: false,
  error: null,

  fetchStats: async () => {
    const { range } = get();
    set({ isLoading: true, error: null });

    try {
      const data = await api.get<StatsData>(`/stats?today=${getTodayLocal()}&days=${range}`);
      // Drop the response if the range changed while it was in flight
      if (get().range === range) set({ data, isLoading: false });
    } catch (error) {
      console.error('Failed to fetch stats:', error);
      if (get().range === range) {
        set({
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to fetch stats',
        });
      }
    }
  },

  setRange: (range) => {
    set({ range });
    get().fetchStats();
  },
}));
