export const EVENT_RETURNING_COLS = `id, user_id, title, emoji,
  to_char(target_date, 'YYYY-MM-DD') as target_date,
  color, note,
  to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS') as created_at`;

export interface EventRow {
  id: string;
  user_id: string;
  title: string;
  emoji: string;
  target_date: string;
  color: string;
  note: string | null;
  created_at: string;
}

export const MAX_TITLE_LENGTH = 255;

// PostgreSQL stores UUIDs in lowercase; match case-insensitively.
export const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const PRESET_COLORS = ['violet', 'rose', 'amber', 'sky', 'emerald'];

// A color is valid if it's a known preset name or a 6-digit hex (#RRGGBB),
// matching what EventCard knows how to render.
export function isValidColor(color: string): boolean {
  return PRESET_COLORS.includes(color) || /^#[0-9a-fA-F]{6}$/.test(color);
}
