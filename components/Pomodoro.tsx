'use client';

import { useEffect, useState } from 'react';

type Phase = 'work' | 'break';

interface PomodoroState {
  work: number; // minutes
  break: number; // minutes
  phase: Phase;
  endAt: number | null; // epoch ms, set only while running
  left: number; // ms remaining while paused
}

const STORAGE_KEY = 'pomodoro';
const DEFAULT_STATE: PomodoroState = { work: 25, break: 5, phase: 'work', endAt: null, left: 25 * 60_000 };

// Only rendered after the client-side auth check, so localStorage is available here.
function loadState(): PomodoroState {
  try {
    return { ...DEFAULT_STATE, ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') };
  } catch {
    return DEFAULT_STATE;
  }
}

function formatTime(ms: number) {
  const s = Math.ceil(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function beep() {
  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  osc.frequency.value = 880;
  osc.connect(ctx.destination);
  osc.onended = () => ctx.close();
  osc.start();
  osc.stop(ctx.currentTime + 0.6);
}

function notify(next: Phase) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  new Notification(next === 'break' ? 'Focus session done' : 'Break over', {
    body: next === 'break' ? 'Time for a break.' : 'Back to work.',
  });
}

export function Pomodoro() {
  const [state, setState] = useState(loadState);
  const [now, setNow] = useState(Date.now);

  const running = state.endAt !== null;
  const remaining = state.endAt !== null ? Math.max(0, state.endAt - now) : state.left;

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    if (state.endAt === null) return;
    const endAt = state.endAt;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= endAt) {
        const next: Phase = state.phase === 'work' ? 'break' : 'work';
        setState({ ...state, phase: next, endAt: null, left: state[next] * 60_000 });
        beep();
        notify(next);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [state]);

  useEffect(() => {
    if (!running) return;
    const original = document.title;
    document.title = `${formatTime(remaining)} · ${state.phase === 'work' ? 'Focus' : 'Break'}`;
    return () => {
      document.title = original;
    };
  }, [running, remaining, state.phase]);

  function start() {
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
    const t = Date.now();
    setNow(t);
    setState({ ...state, endAt: t + state.left });
  }

  function pause() {
    setState({ ...state, endAt: null, left: Math.max(0, (state.endAt ?? 0) - Date.now()) });
  }

  function reset(phase: Phase = state.phase) {
    setState({ ...state, phase, endAt: null, left: state[phase] * 60_000 });
  }

  function setLength(phase: Phase, minutes: number) {
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 180) return;
    setState({ ...state, [phase]: minutes, left: phase === state.phase ? minutes * 60_000 : state.left });
  }

  return (
    <div className="max-w-sm mx-auto flex flex-col items-center gap-6" data-testid="pomodoro">
      <div className="flex gap-2">
        {(['work', 'break'] as const).map((p) => (
          <button
            key={p}
            onClick={() => reset(p)}
            disabled={running}
            className={`btn-press px-4 py-1.5 rounded-lg text-sm font-medium transition-all disabled:cursor-not-allowed ${
              state.phase === p ? 'bg-accent/10 text-accent' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {p === 'work' ? 'Focus' : 'Break'}
          </button>
        ))}
      </div>

      <div className="timer-display text-7xl font-bold text-white">{formatTime(remaining)}</div>

      <div className="flex gap-3">
        <button onClick={running ? pause : start} className="btn btn-primary w-28">
          {running ? 'Pause' : 'Start'}
        </button>
        <button onClick={() => reset()} className="btn btn-secondary">
          Reset
        </button>
      </div>

      <div className="card w-full flex gap-4">
        {(['work', 'break'] as const).map((p) => (
          <label key={p} className="flex-1 flex flex-col gap-1 text-sm text-gray-400">
            {p === 'work' ? 'Focus' : 'Break'} (min)
            <input
              type="number"
              min={1}
              max={180}
              value={state[p]}
              disabled={running}
              onChange={(e) => setLength(p, e.target.valueAsNumber)}
              className="input"
            />
          </label>
        ))}
      </div>
    </div>
  );
}
