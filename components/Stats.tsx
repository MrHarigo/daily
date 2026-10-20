'use client';

import { useEffect, useMemo, useState } from 'react';
import { useStatsStore, StatsHabit, StatsRange, Tally } from '@/stores/statsStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Heatmap, HistoryStrip, BarChart, HeatCell, levelFromRatio, weekStart } from '@/components/StatsCharts';
import { parseLocalDate } from '@/lib/date-utils';

const RANGES: { value: StatsRange; label: string; long: string }[] = [
  { value: 7, label: '7d', long: 'last 7 days' },
  { value: 30, label: '30d', long: 'last 30 days' },
  { value: 90, label: '90d', long: 'last 90 days' },
  { value: 365, label: '1y', long: 'last year' },
  { value: 0, label: 'All', long: 'all time' },
];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const isActive = (h: StatsHabit) => !h.paused_at && !h.archived_at;
const pct = (t: Tally) => (t.scheduled > 0 ? Math.round((t.done / t.scheduled) * 100) : null);

function formatTime(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatTotal(h: StatsHabit) {
  switch (h.type) {
    case 'time': return formatTime(h.stats.totalValue);
    case 'count': return `${h.stats.totalValue} times`;
    default: return `${h.stats.totalCompletions} days`;
  }
}

function describeHabit(h: StatsHabit) {
  const schedule = h.scheduled_days ? h.scheduled_days.map(d => DAY_NAMES[d]).join('/') : 'Mon–Fri';
  const target = h.type === 'time' ? ` · ${h.target_value}m` : h.type === 'count' ? ` · ${h.target_value}×` : '';
  return `${h.type}${target} · ${schedule}`;
}

/** Heat cell for one habit on one day: shaded by value/target for count and time habits. */
function habitCell(h: StatsHabit, day: StatsHabit['stats']['days'][number], offDays: Set<string>, today: string): HeatCell {
  const label = (s: string) => `${day.date} · ${s}`;
  if (day.completed) return { date: day.date, level: 4, label: label('done') };
  if (!day.scheduled) {
    return offDays.has(day.date)
      ? { date: day.date, level: 'off', label: label('holiday / day off') }
      : { date: day.date, level: 'none', label: label('not scheduled') };
  }
  if (day.date === today) return { date: day.date, level: 'none', label: label('due today') };
  const target = (h.target_value ?? 0) * (h.type === 'time' ? 60 : 1);
  const ratio = h.type !== 'boolean' && target > 0 ? Math.min(day.value / target, 0.99) : 0;
  return { date: day.date, level: levelFromRatio(ratio), label: label(ratio > 0 ? `${Math.round(ratio * 100)}% of target` : 'missed') };
}

export function Stats() {
  const { data, range, isLoading, error, fetchStats, setRange } = useStatsStore();
  const [showInactive, setShowInactive] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    // Always fetch fresh data, but show cached data while loading
    fetchStats();
  }, [fetchStats]);

  const offDays = useMemo(() => new Set(data?.offDays ?? []), [data]);

  // Overall heatmap: share of active habits done on each weekday
  const overallCells = useMemo<HeatCell[]>(() => {
    if (!data) return [];
    const byDate = new Map<string, Tally>();
    for (const h of data.habits.filter(isActive)) {
      for (const d of h.stats.days) {
        const t = byDate.get(d.date) ?? { done: 0, scheduled: 0 };
        // A pending today doesn't count as a miss
        if (d.scheduled && !(d.date === data.today && !d.completed)) {
          t.scheduled++;
          if (d.completed) t.done++;
        }
        byDate.set(d.date, t);
      }
    }
    return [...byDate.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([date, t]): HeatCell => {
        if (offDays.has(date)) return { date, level: 'off', label: `${date} · holiday / day off` };
        if (t.scheduled === 0) return { date, level: 'none', label: `${date} · nothing due` };
        return { date, level: levelFromRatio(t.done / t.scheduled), label: `${date} · ${t.done} of ${t.scheduled} done` };
      });
  }, [data, offDays]);

  // Show error state if fetch failed
  if (error) {
    return (
      <div className="card text-center py-12 bg-red-950/30 border-red-900/50">
        <p className="text-red-400 font-medium mb-2">Failed to load statistics</p>
        <p className="text-sm text-gray-400 mb-4">{error}</p>
        <button
          onClick={fetchStats}
          className="btn btn-secondary"
        >
          Retry
        </button>
      </div>
    );
  }

  // Only show full loading state if we have no cached data
  if (!data) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const active = data.habits.filter(isActive);
  const inactive = data.habits.filter(h => !isActive(h));
  const rangeInfo = RANGES.find(r => r.value === range)!;

  const dueToday = active.filter(h => h.stats.scheduledToday);
  const doneToday = dueToday.filter(h => h.stats.completedToday).length;
  const sum = (key: 'range' | 'prevRange') =>
    active.reduce((t, h) => ({ done: t.done + h.stats[key].done, scheduled: t.scheduled + h.stats[key].scheduled }), { done: 0, scheduled: 0 });
  const rate = pct(sum('range'));
  const prevRate = range === 0 ? null : pct(sum('prevRange'));
  const bestCurrent = Math.max(0, ...active.map(h => h.stats.currentStreak));
  const longestEver = Math.max(0, ...data.habits.map(h => h.stats.bestStreak));

  const selected = data.habits.find(h => h.id === selectedId) ?? null;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Statistics</h1>
          <p className="text-gray-500 mt-1 capitalize">{rangeInfo.long}</p>
        </div>
        <div className="flex rounded-lg bg-surface-800 border border-surface-600 p-1" role="group" aria-label="Date range">
          {RANGES.map(r => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              aria-pressed={range === r.value}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                range === r.value ? 'bg-accent text-surface-900' : 'text-gray-400 hover:text-white'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className={`grid grid-cols-2 sm:grid-cols-4 gap-4 transition-opacity ${isLoading ? 'opacity-60' : ''}`}>
        <Tile
          value={dueToday.length > 0 ? `${doneToday} / ${dueToday.length}` : '—'}
          label={dueToday.length > 0 ? 'Done today' : 'Nothing due today'}
        />
        <Tile
          value={rate === null ? '—' : `${rate}%`}
          label="Completion rate"
          note={rate !== null && prevRate !== null ? `${rate >= prevRate ? '▲' : '▼'} ${Math.abs(rate - prevRate)} pts vs previous` : undefined}
          noteTone={rate !== null && prevRate !== null && rate < prevRate ? 'down' : 'up'}
        />
        <Tile value={String(bestCurrent)} label="Best current streak" />
        <Tile value={String(longestEver)} label="Longest streak" />
      </div>

      {active.length > 0 && (
        <div className="card space-y-3">
          <h2 className="font-semibold">Daily completion</h2>
          <Heatmap cells={overallCells} label={`Share of active habits completed each weekday, ${rangeInfo.long}`} />
        </div>
      )}

      <div>
        <h2 className="text-xl font-semibold mb-4">By Habit</h2>

        {data.habits.length === 0 ? (
          <div className="card text-center py-8">
            <p className="text-gray-400">No habits tracked yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {active.map(h => (
              <HabitRow key={h.id} habit={h} offDays={offDays} today={data.today} onSelect={() => setSelectedId(h.id)} />
            ))}

            {/* Paused/Archived Habits (Collapsible) */}
            {inactive.length > 0 && (
              <div className="pt-4">
                <button
                  onClick={() => setShowInactive(!showInactive)}
                  className="flex items-center gap-2 text-sm font-medium text-gray-500 uppercase tracking-wide mb-3 hover:text-gray-400 transition-colors"
                >
                  <span className={`transition-transform duration-200 ${showInactive ? 'rotate-90' : ''}`}>
                    ▶
                  </span>
                  Paused & Archived ({inactive.length})
                </button>

                {showInactive && (
                  <div className="space-y-3 opacity-60">
                    {inactive.map(h => (
                      <HabitRow key={h.id} habit={h} offDays={offDays} today={data.today} onSelect={() => setSelectedId(h.id)} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <Dialog open={selected !== null} onOpenChange={open => !open && setSelectedId(null)}>
        <DialogContent className="bg-zinc-900 border-white/10 text-white sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          {selected && (
            <HabitDetail habit={selected} offDays={offDays} today={data.today} rangeLabel={rangeInfo.long} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Tile({ value, label, note, noteTone }: { value: string; label: string; note?: string; noteTone?: 'up' | 'down' }) {
  return (
    <div className="card">
      <div className="text-2xl font-bold text-accent tabular-nums">{value}</div>
      <div className="text-sm text-gray-500 mt-1">{label}</div>
      {note && (
        <div className={`text-xs font-mono mt-1 ${noteTone === 'down' ? 'text-warning' : 'text-accent'}`}>{note}</div>
      )}
    </div>
  );
}

function HabitRow({ habit: h, offDays, today, onSelect }: { habit: StatsHabit; offDays: Set<string>; today: string; onSelect: () => void }) {
  const s = h.stats;
  const rate = pct(s.range);
  const isAtRisk = isActive(h) && s.currentStreak > 0 && s.scheduledToday && !s.completedToday;
  const isPaused = !!h.paused_at && !h.archived_at;
  const strip = s.days.filter(d => d.scheduled).slice(-20).map(d => habitCell(h, d, offDays, today));

  return (
    <button onClick={onSelect} className="card w-full text-left hover:border-surface-500 transition-colors">
      <div className="flex items-center gap-4 sm:gap-6">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium truncate flex items-center gap-2">
            {h.name}
            {isPaused && <span className="text-xs bg-warning/20 text-warning px-2 py-0.5 rounded">Paused</span>}
            {h.archived_at && <span className="text-xs bg-gray-500/20 text-gray-400 px-2 py-0.5 rounded">Archived</span>}
          </h3>
          <p className="text-xs text-gray-500 font-mono truncate">{describeHabit(h)}</p>
        </div>
        <div className="hidden sm:block">
          <HistoryStrip cells={strip} />
        </div>
        <div className="text-right min-w-[52px]">
          <div className="text-lg font-bold tabular-nums">{rate === null ? '—' : `${rate}%`}</div>
          <div className="text-gray-500 text-xs">Rate</div>
        </div>
        <div className="text-right min-w-[64px]">
          <div className="text-lg font-bold tabular-nums">
            <span className={isAtRisk ? 'text-warning' : ''}>{s.currentStreak}</span>
            <span className="text-gray-500 font-normal"> / {s.bestStreak}</span>
          </div>
          <div className={`text-xs ${isAtRisk ? 'text-warning' : 'text-gray-500'}`}>{isAtRisk ? 'Due today' : 'Streak / best'}</div>
        </div>
      </div>
    </button>
  );
}

function HabitDetail({ habit: h, offDays, today, rangeLabel }: { habit: StatsHabit; offDays: Set<string>; today: string; rangeLabel: string }) {
  const s = h.stats;
  const rate = pct(s.range);
  const cells = s.days.map(d => habitCell(h, d, offDays, today));

  const weekdayBars = s.byWeekday
    .map((t, i) => ({ key: DAY_NAMES[i + 1], label: DAY_NAMES[i + 1], value: pct(t) }))
    .filter((b): b is { key: string; label: string; value: number } => b.value !== null);

  // Count/time habits: average value per scheduled day, by week (last 12 weeks of the range)
  const unit = h.type === 'time' ? 60 : 1;
  const weeks = new Map<string, Tally>();
  if (h.type !== 'boolean') {
    for (const d of s.days) {
      if (!d.scheduled || (d.date === today && !d.completed)) continue;
      const w = weekStart(d.date);
      const t = weeks.get(w) ?? { done: 0, scheduled: 0 };
      t.done += d.value / unit;
      t.scheduled++;
      weeks.set(w, t);
    }
  }
  const weeklyBars = [...weeks.entries()].slice(-12).map(([w, t]) => {
    const date = parseLocalDate(w);
    return { key: w, label: `${date.getMonth() + 1}/${date.getDate()}`, value: Math.round(t.done / t.scheduled) };
  });
  const target = h.target_value ?? undefined;
  // Round the axis up to whole half-hours (time) or even counts so the mid tick is a clean number
  const step = h.type === 'time' ? 30 : 2;
  const weeklyMax = Math.ceil((Math.max(target ?? 0, ...weeklyBars.map(b => b.value)) * 1.1) / step) * step || step;
  const fmtValue = (v: number) => (h.type === 'time' ? `${Math.round(v)}m` : String(Math.round(v)));

  return (
    // min-w-0: the dialog is a grid, and the heatmap must scroll instead of widening it
    <div className="space-y-6 min-w-0">
      <DialogHeader>
        <DialogTitle className="text-xl font-bold">{h.name}</DialogTitle>
        <p className="text-xs text-gray-500 font-mono">{describeHabit(h)}</p>
      </DialogHeader>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MiniStat value={rate === null ? '—' : `${rate}%`} label={`Rate, ${rangeLabel}`} />
        <MiniStat value={String(s.currentStreak)} label="Current streak" />
        <MiniStat value={String(s.bestStreak)} label="Longest streak" />
        <MiniStat value={formatTotal(h)} label="Total, all time" />
      </div>

      {cells.length > 0 && <Heatmap cells={cells} label={`${h.name}, ${rangeLabel}`} />}

      <div className={`grid gap-6 ${weeklyBars.length > 0 ? 'sm:grid-cols-2' : ''}`}>
        {weekdayBars.length > 0 && (
          <figure className="space-y-2">
            <figcaption className="text-sm text-gray-400">Completion rate by weekday</figcaption>
            <BarChart bars={weekdayBars} max={100} format={v => `${Math.round(v)}%`} label={`Completion rate by weekday for ${h.name}`} />
          </figure>
        )}
        {weeklyBars.length > 0 && (
          <figure className="space-y-2">
            <figcaption className="text-sm text-gray-400">
              Average {h.type === 'time' ? 'minutes' : 'count'} per scheduled day, by week
            </figcaption>
            <BarChart bars={weeklyBars} max={weeklyMax} format={fmtValue} target={target} label={`Weekly average for ${h.name}`} />
          </figure>
        )}
      </div>
    </div>
  );
}

function MiniStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-lg bg-surface-800 p-3">
      <div className="text-lg font-bold tabular-nums">{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}
