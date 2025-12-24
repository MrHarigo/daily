import { create } from 'zustand';
import { api } from '@/lib/api';
import { getTodayLocal } from '@/lib/date-utils';

export type HabitType = 'boolean' | 'count' | 'time';

export interface Habit {
  id: string;
  name: string;
  type: HabitType;
  target_value: number | null;
  sort_order: number;
  created_at: string;
  paused_at?: string | null;
  archived_at?: string | null;
  scheduled_days?: number[] | null;
}

export interface HabitCompletion {
  id?: string;
  habit_id: string;
  date: string;
  value: number;
  completed: boolean;
}

export interface ActiveTimer {
  habit_id: string;
  date: string;
  started_at: string;
  accumulated_seconds: number;
  is_running: boolean;
}

interface HabitState {
  allHabits: Habit[]; // Single source of truth for all habits
  isLoading: boolean;
  error: string | null;
  completions: Record<string, HabitCompletion>; // keyed by `${habit_id}-${date}`
  activeTimers: Record<string, ActiveTimer>; // keyed by habit_id
  selectedDate: string;

  // Computed getters
  getActiveHabits: () => Habit[];
  getPausedHabits: () => Habit[];
  getArchivedHabits: () => Habit[];

  // Actions
  setSelectedDate: (date: string) => void;
  fetchHabits: () => Promise<void>;
  fetchCompletions: (startDate: string, endDate: string) => Promise<void>;
  createHabit: (name: string, type: HabitType, targetValue?: number, scheduledDays?: number[] | null) => Promise<void>;
  updateHabit: (id: string, updates: Partial<Habit>) => Promise<void>;
  archiveHabit: (id: string) => Promise<void>;
  unarchiveHabit: (id: string) => Promise<void>;
  deleteHabit: (id: string) => Promise<void>;
  pauseHabit: (id: string) => Promise<void>;
  unpauseHabit: (id: string) => Promise<void>;
  toggleCompletion: (habitId: string, date: string) => Promise<void>;
  incrementCount: (habitId: string, date: string, delta: number) => Promise<void>;
  setTimeValue: (habitId: string, date: string, seconds: number, targetValue: number | null) => Promise<void>;

  // Timer actions
  fetchTimer: (habitId: string) => Promise<void>;
  startTimer: (habitId: string, date: string) => Promise<void>;
  pauseTimer: (habitId: string) => Promise<void>;
  stopTimer: (habitId: string) => Promise<void>;
  resetTimer: (habitId: string) => Promise<void>;
}

const getCompletionKey = (habitId: string, date: string) => `${habitId}-${date}`;

export const useHabitStore = create<HabitState>((set, get) => ({
  allHabits: [],
  isLoading: false,
  error: null,
  completions: {},
  activeTimers: {},
  selectedDate: getTodayLocal(),

  // Computed getters
  getActiveHabits: () => {
    const { allHabits } = get();
    return allHabits.filter(h => !h.paused_at && !h.archived_at);
  },

  getPausedHabits: () => {
    const { allHabits } = get();
    return allHabits.filter(h => h.paused_at && !h.archived_at);
  },

  getArchivedHabits: () => {
    const { allHabits } = get();
    return allHabits.filter(h => h.archived_at);
  },

  setSelectedDate: (date) => set({ selectedDate: date }),

  fetchHabits: async () => {
    const state = get();
    if (state.isLoading) return;

    try {
      set({ isLoading: true, error: null });
      const allHabits = await api.get<Habit[]>('/habits?includeAll=true');
      set({ allHabits, isLoading: false });

      // Also fetch timers for time-based habits
      const timeHabits = allHabits.filter(h => h.type === 'time' && !h.paused_at && !h.archived_at);
      for (const habit of timeHabits) {
        get().fetchTimer(habit.id);
      }
    } catch (error) {
      console.error('Failed to fetch habits:', error);
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch habits'
      });
    }
  },

  fetchCompletions: async (startDate, endDate) => {
    try {
      const completions = await api.get<HabitCompletion[]>(
        `/completions?startDate=${startDate}&endDate=${endDate}`
      );

      const completionsMap: Record<string, HabitCompletion> = {};
      for (const c of completions) {
        // Server now returns date as 'YYYY-MM-DD' string
        const dateStr = c.date;
        completionsMap[getCompletionKey(c.habit_id, dateStr)] = c;
      }

      set((state) => ({
        completions: { ...state.completions, ...completionsMap },
      }));
    } catch (error) {
      console.error('Failed to fetch completions:', error);
    }
  },

  createHabit: async (name, type, targetValue, scheduledDays) => {
    try {
      const habit = await api.post<Habit>('/habits', {
        name,
        type,
        target_value: targetValue,
        scheduled_days: scheduledDays,
      });
      set((state) => ({
        allHabits: [...state.allHabits, habit],
      }));
    } catch (error) {
      console.error('Failed to create habit:', error);
      throw error;
    }
  },

  updateHabit: async (id, updates) => {
    try {
      const habit = await api.put<Habit>(`/habits/${id}`, updates);
      set((state) => ({
        allHabits: state.allHabits.map((h) => (h.id === id ? habit : h)),
      }));
    } catch (error) {
      console.error('Failed to update habit:', error);
      throw error;
    }
  },

  archiveHabit: async (id) => {
    try {
      const habit = await api.post<Habit>(`/habits/${id}/archive`, {});
      set((state) => ({
        allHabits: state.allHabits.map((h) => (h.id === id ? habit : h)),
      }));
    } catch (error) {
      console.error('Failed to archive habit:', error);
      throw error;
    }
  },

  unarchiveHabit: async (id) => {
    try {
      const habit = await api.post<Habit>(`/habits/${id}/unarchive`, {});
      set((state) => ({
        allHabits: state.allHabits.map((h) => (h.id === id ? habit : h)),
      }));
    } catch (error) {
      console.error('Failed to unarchive habit:', error);
      throw error;
    }
  },

  deleteHabit: async (id) => {
    try {
      await api.delete(`/habits/${id}`);
      set((state) => ({
        allHabits: state.allHabits.filter((h) => h.id !== id),
      }));
    } catch (error) {
      console.error('Failed to delete habit:', error);
      throw error;
    }
  },

  pauseHabit: async (id) => {
    try {
      const habit = await api.post<Habit>(`/habits/${id}/pause`, {});
      set((state) => ({
        allHabits: state.allHabits.map((h) => (h.id === id ? habit : h)),
      }));
    } catch (error) {
      console.error('Failed to pause habit:', error);
      throw error;
    }
  },

  unpauseHabit: async (id) => {
    try {
      const habit = await api.post<Habit>(`/habits/${id}/unpause`, {});
      set((state) => ({
        allHabits: state.allHabits.map((h) => (h.id === id ? habit : h)),
      }));
    } catch (error) {
      console.error('Failed to unpause habit:', error);
      throw error;
    }
  },

  toggleCompletion: async (habitId, date) => {
    const key = getCompletionKey(habitId, date);
    const current = get().completions[key];
    const newCompleted = !current?.completed;

    try {
      const completion = await api.post<HabitCompletion>(
        `/habits/${habitId}/completion`,
        {
          date,
          value: newCompleted ? 1 : 0,
          completed: newCompleted,
        }
      );

      set((state) => ({
        completions: {
          ...state.completions,
          [key]: { ...completion, date },
        },
      }));
    } catch (error) {
      console.error('Failed to toggle completion:', error);
    }
  },

  incrementCount: async (habitId, date, delta) => {
    try {
      const completion = await api.post<HabitCompletion>(
        `/habits/${habitId}/increment`,
        { date, delta }
      );

      const key = getCompletionKey(habitId, date);
      set((state) => ({
        completions: {
          ...state.completions,
          [key]: { ...completion, date },
        },
      }));
    } catch (error) {
      console.error('Failed to increment count:', error);
    }
  },

  setTimeValue: async (habitId, date, seconds, targetValue) => {
    try {
      const targetSeconds = (targetValue || 0) * 60;
      const completed = seconds >= targetSeconds;
      
      const completion = await api.post<HabitCompletion>(
        `/habits/${habitId}/completion`,
        { date, value: seconds, completed }
      );

      const key = getCompletionKey(habitId, date);
      set((state) => ({
        completions: {
          ...state.completions,
          [key]: { ...completion, date },
        },
      }));
    } catch (error) {
      console.error('Failed to set time value:', error);
    }
  },

  fetchTimer: async (habitId) => {
    try {
      const timer = await api.get<ActiveTimer | null>(`/habits/${habitId}/timer`);
      if (timer) {
        set((state) => ({
          activeTimers: { ...state.activeTimers, [habitId]: timer },
        }));
      }
    } catch (error) {
      console.error('Failed to fetch timer:', error);
    }
  },

  startTimer: async (habitId, date) => {
    try {
      const timer = await api.post<ActiveTimer>(`/habits/${habitId}/timer/start`, {
        date,
      });
      set((state) => ({
        activeTimers: { ...state.activeTimers, [habitId]: timer },
      }));
    } catch (error) {
      console.error('Failed to start timer:', error);
    }
  },

  pauseTimer: async (habitId) => {
    try {
      const timer = await api.post<ActiveTimer>(`/habits/${habitId}/timer/pause`, {});
      set((state) => ({
        activeTimers: { ...state.activeTimers, [habitId]: timer },
      }));
    } catch (error) {
      console.error('Failed to pause timer:', error);
    }
  },

  stopTimer: async (habitId) => {
    // Check if timer exists locally first
    const timer = get().activeTimers[habitId];
    if (!timer) {
      console.log('No timer to stop');
      return;
    }

    // Optimistically remove timer to prevent double-clicks
    set((state) => {
      const newTimers = { ...state.activeTimers };
      delete newTimers[habitId];
      return { activeTimers: newTimers };
    });

    try {
      const result = await api.post<{ completion: HabitCompletion; totalSeconds: number }>(
        `/habits/${habitId}/timer/stop`,
        {}
      );

      // Update completion
      const key = getCompletionKey(habitId, result.completion.date);
      set((state) => ({
        completions: {
          ...state.completions,
          [key]: result.completion,
        },
      }));
    } catch (error) {
      console.error('Failed to stop timer:', error);
      // Restore timer on error (could also refetch)
    }
  },

  resetTimer: async (habitId) => {
    try {
      await api.post(`/habits/${habitId}/timer/reset`, {});
      set((state) => {
        const newTimers = { ...state.activeTimers };
        delete newTimers[habitId];
        return { activeTimers: newTimers };
      });
    } catch (error) {
      console.error('Failed to reset timer:', error);
    }
  },
}));

