export const EVENT_RETURNING_COLS = `id, title, emoji,
  to_char(target_date, 'YYYY-MM-DD') as target_date,
  color, note,
  to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS') as created_at`;

export interface EventRow {
  id: string;
  title: string;
  emoji: string;
  target_date: string;
  color: string;
  note: string | null;
  created_at: string;
}

export const MAX_TITLE_LENGTH = 255;
export const MAX_NOTE_LENGTH = 2000;
export const MAX_EMOJI_LENGTH = 16; // matches the events.emoji VARCHAR(16) column

// PostgreSQL stores UUIDs in lowercase; match case-insensitively.
export const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const PRESET_COLORS = ['violet', 'rose', 'amber', 'sky', 'emerald'];

// A color is valid if it's a known preset name or a 6-digit hex (#RRGGBB),
// matching what EventCard knows how to render.
export function isValidColor(color: string): boolean {
  return PRESET_COLORS.includes(color) || /^#[0-9a-fA-F]{6}$/.test(color);
}

// A target date must be a real calendar date in YYYY-MM-DD form. Guards the
// `::date` cast from throwing a Postgres error (opaque 500) on bad input.
export function isValidDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return false;
  // Reject rollovers JS silently normalizes (e.g. 2026-02-29 -> 2026-03-01)
  // that Postgres would reject at the ::date cast.
  return d.toISOString().slice(0, 10) === value;
}
