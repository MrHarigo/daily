'use client';

import { useEffect, useRef } from 'react';
import { parseLocalDate, addDays } from '@/lib/date-utils';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// 0 = scheduled but missed, 1-4 = increasing completion, 'off' = holiday/day-off, 'none' = nothing due
export type HeatLevel = 0 | 1 | 2 | 3 | 4 | 'off' | 'none';
export interface HeatCell {
  date: string;
  level: HeatLevel;
  label: string;
}

const LEVEL_CLASS: Record<HeatLevel, string> = {
  0: 'bg-surface-600',
  1: 'bg-accent/25',
  2: 'bg-accent/50',
  3: 'bg-accent/75',
  4: 'bg-accent',
  off: 'bg-hatch',
  none: 'border border-surface-600',
};

export function levelFromRatio(ratio: number): HeatLevel {
  if (ratio <= 0) return 0;
  if (ratio < 0.5) return 1;
  if (ratio < 0.8) return 2;
  if (ratio < 1) return 3;
  return 4;
}

/** Monday of the week containing date (YYYY-MM-DD). */
export function weekStart(date: string): string {
  return addDays(date, 1 - parseLocalDate(date).getDay());
}

/** Mon–Fri grid, one column per week. Habits are only ever scheduled on weekdays. */
export function Heatmap({ cells, label }: { cells: HeatCell[]; label: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Open scrolled to the most recent weeks
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [cells]);

  if (cells.length === 0) return null;

  const firstWeek = weekStart(cells[0].date);
  const weekIndex = (date: string) =>
    Math.round((parseLocalDate(weekStart(date)).getTime() - parseLocalDate(firstWeek).getTime()) / (7 * 86_400_000));
  const weeks = weekIndex(cells[cells.length - 1].date) + 1;

  // Month label above the first week that starts in a new month
  const monthLabels: { col: number; text: string }[] = [];
  let lastMonth = -1;
  for (let w = 0; w < weeks; w++) {
    const month = parseLocalDate(addDays(firstWeek, w * 7)).getMonth();
    if (month !== lastMonth) {
      monthLabels.push({ col: w, text: MONTHS[month] });
      lastMonth = month;
    }
  }

  return (
    <div className="space-y-3">
      <div ref={scrollRef} className="overflow-x-auto pb-1">
        <div
          role="img"
          aria-label={label}
          className="grid gap-[3px] w-max text-[10px] text-gray-500 font-mono"
          style={{
            gridTemplateColumns: `28px repeat(${weeks}, 13px)`,
            gridTemplateRows: '14px repeat(5, 13px)',
          }}
        >
          {monthLabels.map(m => (
            <div key={m.col} className="whitespace-nowrap" style={{ gridRow: 1, gridColumn: m.col + 2 }}>
              {m.text}
            </div>
          ))}
          {WEEKDAYS.map((d, i) => (
            <div key={d} className="leading-[13px]" style={{ gridRow: i + 2, gridColumn: 1 }}>
              {i % 2 === 0 ? d : ''}
            </div>
          ))}
          {cells.map(c => (
            <div
              key={c.date}
              title={c.label}
              className={`w-[13px] h-[13px] rounded-[3px] ${LEVEL_CLASS[c.level]}`}
              style={{ gridRow: parseLocalDate(c.date).getDay() + 1, gridColumn: weekIndex(c.date) + 2 }}
            />
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          Less
          {([0, 1, 2, 3, 4] as const).map(l => (
            <span key={l} className={`inline-block w-[11px] h-[11px] rounded-[3px] ${LEVEL_CLASS[l]}`} />
          ))}
          More
        </span>
        <span className="flex items-center gap-1">
          <span className={`inline-block w-[11px] h-[11px] rounded-[3px] ${LEVEL_CLASS.off}`} />
          Holiday / day off (not counted)
        </span>
      </div>
    </div>
  );
}

/** Last N scheduled days as a strip of small bars, oldest first. */
export function HistoryStrip({ cells }: { cells: HeatCell[] }) {
  return (
    <div className="flex gap-[2px]" aria-hidden="true">
      {cells.map(c => (
        <span key={c.date} title={c.label} className={`w-[7px] h-[18px] rounded-[2px] ${LEVEL_CLASS[c.level]}`} />
      ))}
    </div>
  );
}

export interface Bar {
  key: string;
  label: string;
  value: number;
}

/**
 * Vertical bars on one scale. Bars below the target are dimmed; the dashed line marks the target.
 * Only the latest and the lowest bar get a value label, the rest show it on hover.
 */
export function BarChart({
  bars,
  max,
  format,
  target,
  label,
}: {
  bars: Bar[];
  max: number;
  format: (v: number) => string;
  target?: number;
  label: string;
}) {
  const W = 360, H = 200, L = 40, R = 352, T = 20, B = 176;
  const y = (v: number) => B - (Math.min(v, max) / max) * (B - T);
  const slot = (R - L) / Math.max(bars.length, 1);
  const bw = Math.min(30, slot * 0.6);
  const minIdx = bars.reduce((m, b, i) => (b.value < bars[m].value ? i : m), 0);
  // Label at most ~6 bars on the x axis, counting back from the latest
  const labelEvery = Math.ceil(bars.length / 6);
  const ticks = [0, max / 2, max];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={label}>
      {ticks.map(t => (
        <g key={t}>
          <line x1={L} x2={R} y1={y(t)} y2={y(t)} className="stroke-surface-600" strokeWidth={1} />
          <text x={L - 6} y={y(t) + 4} textAnchor="end" className="fill-gray-500 font-mono text-[11px]">
            {format(t)}
          </text>
        </g>
      ))}
      {bars.map((b, i) => {
        const x = L + slot * i + (slot - bw) / 2;
        const top = y(b.value);
        const r = Math.min(4, B - top);
        const below = target !== undefined && b.value < target;
        return (
          <g key={b.key}>
            <path
              d={`M${x},${B} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${B} Z`}
              className={below ? 'fill-accent/40' : 'fill-accent'}
            >
              <title>{`${b.label}: ${format(b.value)}`}</title>
            </path>
            {(bars.length - 1 - i) % labelEvery === 0 && (
              <text x={x + bw / 2} y={B + 16} textAnchor="middle" className="fill-gray-500 font-mono text-[11px]">
                {b.label}
              </text>
            )}
            {(i === minIdx || i === bars.length - 1) && (
              <text x={x + bw / 2} y={top - 6} textAnchor="middle" className="fill-gray-200 font-mono text-[11px] font-semibold">
                {format(b.value)}
              </text>
            )}
          </g>
        );
      })}
      {target !== undefined && (
        <line x1={L} x2={R} y1={y(target)} y2={y(target)} className="stroke-gray-300" strokeWidth={1.5} strokeDasharray="4 3" />
      )}
    </svg>
  );
}
