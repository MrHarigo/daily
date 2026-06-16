import { create } from 'zustand';
import { api } from '@/lib/api';
import type { EventRow } from '@/lib/events';

export type EventColor = string;
export type { EventRow };

export interface EventInput {
  title: string;
  emoji: string;
  target_date: string;
  color: EventColor;
  note?: string;
}

interface EventState {
  events: EventRow[];
  isLoading: boolean;
  error: string | null;

  fetchEvents: () => Promise<void>;
  createEvent: (data: EventInput) => Promise<void>;
  updateEvent: (id: string, data: EventInput) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
}

const byDate = (a: EventRow, b: EventRow) =>
  new Date(a.target_date).getTime() - new Date(b.target_date).getTime();

export const useEventStore = create<EventState>((set, get) => ({
  events: [],
  isLoading: false,
  error: null,

  fetchEvents: async () => {
    set({ isLoading: true, error: null });
    try {
      const events = await api.get<EventRow[]>('/events');
      set({ events: [...events].sort(byDate), isLoading: false });
    } catch (error) {
      console.error('Failed to fetch events:', error);
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch events',
      });
    }
  },

  createEvent: async (data) => {
    // Optimistic insert with a temporary row, reconciled on success.
    const tempEvent: EventRow = {
      id: `temp-${Date.now()}`,
      user_id: '',
      created_at: new Date().toISOString(),
      note: data.note || null,
      ...data,
    };
    set((state) => ({ events: [...state.events, tempEvent].sort(byDate) }));
    try {
      const created = await api.post<EventRow>('/events', data);
      set((state) => ({
        events: state.events.map((e) => (e.id === tempEvent.id ? created : e)).sort(byDate),
      }));
    } catch (error) {
      console.error('Failed to create event:', error);
      set((state) => ({ events: state.events.filter((e) => e.id !== tempEvent.id) }));
      throw error;
    }
  },

  updateEvent: async (id, data) => {
    const previous = get().events;
    set((state) => ({
      events: state.events
        .map((e) => (e.id === id ? { ...e, ...data, note: data.note || null } : e))
        .sort(byDate),
    }));
    try {
      const updated = await api.put<EventRow>(`/events/${id}`, data);
      set((state) => ({
        events: state.events.map((e) => (e.id === id ? updated : e)).sort(byDate),
      }));
    } catch (error) {
      console.error('Failed to update event:', error);
      set({ events: previous });
      throw error;
    }
  },

  deleteEvent: async (id) => {
    const previous = get().events;
    set((state) => ({ events: state.events.filter((e) => e.id !== id) }));
    try {
      await api.delete(`/events/${id}`);
    } catch (error) {
      console.error('Failed to delete event:', error);
      set({ events: previous });
      throw error;
    }
  },
}));
