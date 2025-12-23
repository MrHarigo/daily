import { create } from 'zustand';
import { api } from '@/lib/api';
import { parseLocalDate } from '@/lib/date-utils';

export interface Holiday {
  date: string;
  name: string;
  name_en?: string;
}

export interface DayOff {
  date: string;
  reason?: string;
}

export interface NonWorkingDays {
  holidays: Holiday[];
  dayOffs: DayOff[];
  weekends: string[];
}

interface CalendarState {
  holidays: Record<number, Holiday[]>; // keyed by year
  dayOffs: DayOff[];
  isLoading: boolean;

  // Actions
  fetchHolidays: (year: number) => Promise<void>;
  fetchDayOffs: () => Promise<void>;
  addDayOff: (date: string, reason?: string) => Promise<void>;
  removeDayOff: (date: string) => Promise<void>;
  isWorkingDay: (date: string) => boolean;
  getNonWorkingDays: (startDate: string, endDate: string) => Promise<NonWorkingDays>;
}

export const useCalendarStore = create<CalendarState>((set, get) => ({
  holidays: {},
  dayOffs: [],
  isLoading: false,

  fetchHolidays: async (year) => {
    if (get().holidays[year]) return; // Already cached

    try {
      set({ isLoading: true });
      const holidays = await api.get<Holiday[]>(`/calendar/holidays?year=${year}`);
      set((state) => ({
        holidays: { ...state.holidays, [year]: holidays },
        isLoading: false,
      }));
    } catch (error) {
      console.error('Failed to fetch holidays:', error);
      set({ isLoading: false });
    }
  },

  fetchDayOffs: async () => {
    try {
      const dayOffs = await api.get<DayOff[]>('/calendar/dayoffs');
      set({ dayOffs });
    } catch (error) {
      console.error('Failed to fetch day-offs:', error);
    }
  },

  addDayOff: async (date, reason) => {
    try {
      const dayOff = await api.post<DayOff>('/calendar/dayoffs', { date, reason });
      set((state) => ({
        dayOffs: [...state.dayOffs.filter((d) => d.date !== date), dayOff],
      }));
    } catch (error) {
      console.error('Failed to add day-off:', error);
      throw error;
    }
  },

  removeDayOff: async (date) => {
    try {
      await api.delete(`/calendar/dayoffs?date=${date}`);
      set((state) => ({
        dayOffs: state.dayOffs.filter((d) => d.date !== date),
      }));
    } catch (error) {
      console.error('Failed to remove day-off:', error);
      throw error;
    }
  },

  isWorkingDay: (dateStr) => {
    const date = parseLocalDate(dateStr);
    const dayOfWeek = date.getDay();

    // Weekend
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return false;
    }

    // Holiday
    const year = date.getFullYear();
    const holidays = get().holidays[year] || [];
    if (holidays.some((h) => h.date === dateStr)) {
      return false;
    }

    // Day-off
    if (get().dayOffs.some((d) => d.date === dateStr)) {
      return false;
    }

    return true;
  },

  getNonWorkingDays: async (startDate, endDate) => {
    try {
      const result = await api.get<NonWorkingDays>(
        `/calendar/non-working-days?start_date=${startDate}&end_date=${endDate}`
      );
      return result;
    } catch (error) {
      console.error('Failed to get non-working days:', error);
      return { holidays: [], dayOffs: [], weekends: [] };
    }
  },
}));

