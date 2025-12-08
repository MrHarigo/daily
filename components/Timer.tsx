'use client';

import { useEffect, useState, useRef, useOptimistic, useTransition } from 'react';
import confetti from 'canvas-confetti';
import { Habit, ActiveTimer, useHabitStore } from '@/stores/habitStore';

interface TimerProps {
  habit: Habit;
  date: string;
}

export function Timer({ habit, date }: TimerProps) {
  const { activeTimers, completions, startTimer, pauseTimer, stopTimer, resetTimer } = useHabitStore();
  const timer = activeTimers[habit.id];

  const [displayTime, setDisplayTime] = useState(0);
  const intervalRef = useRef<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const stoppedTimeRef = useRef<number | null>(null); // Remember time when stopped

  // Optimistic timer state
  const [optimisticTimer, setOptimisticTimer] = useOptimistic<
    ActiveTimer | undefined,
    ActiveTimer | null
  >(timer, (_current, update) => update ?? undefined);

  // Calculate current display time based on optimistic timer
  useEffect(() => {
    const updateTime = () => {
      if (!optimisticTimer) {
        setDisplayTime(0);
        return;
      }

      let elapsed = optimisticTimer.accumulated_seconds;
      if (optimisticTimer.is_running) {
        const startedAt = new Date(optimisticTimer.started_at).getTime();
        const now = Date.now();
        elapsed += Math.floor((now - startedAt) / 1000);
      }
      setDisplayTime(elapsed);
    };

    updateTime();

    if (optimisticTimer?.is_running) {
      intervalRef.current = window.setInterval(updateTime, 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [optimisticTimer]);

  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const targetSeconds = (habit.target_value || 0) * 60;
  const isRunning = optimisticTimer?.is_running ?? false;

  // Get current completion value (previously saved time)
  const completionKey = `${habit.id}-${date}`;
  const currentCompletion = completions[completionKey];
  const existingValue = currentCompletion?.value || 0;

  // Clear stoppedTimeRef when server value catches up
  if (stoppedTimeRef.current !== null && existingValue >= stoppedTimeRef.current) {
    stoppedTimeRef.current = null;
  }

  // When timer is active, show displayTime
  // When stopped, show stoppedTimeRef (until server catches up) or existingValue
  const totalTime = optimisticTimer
    ? displayTime
    : (stoppedTimeRef.current ?? existingValue);
  const progress = targetSeconds > 0 ? Math.min((totalTime / targetSeconds) * 100, 100) : 0;

  const handleStartTimer = () => {
    if (isPending) return;

    // If resuming a paused timer, use its accumulated time
    // If starting fresh, use existingValue (saved completion) or stoppedTimeRef
    const accumulatedSeconds = optimisticTimer?.accumulated_seconds
      ?? stoppedTimeRef.current
      ?? existingValue;

    startTransition(async () => {
      // Optimistically show timer as running
      setOptimisticTimer({
        habit_id: habit.id,
        date,
        started_at: new Date().toISOString(),
        accumulated_seconds: accumulatedSeconds,
        is_running: true,
      });
      // Clear stopped time after optimistic update is applied
      stoppedTimeRef.current = null;
      await startTimer(habit.id, date);
    });
  };

  const handlePauseTimer = () => {
    if (isPending || !optimisticTimer) return;

    startTransition(async () => {
      // Optimistically show timer as paused with current accumulated time
      setOptimisticTimer({
        ...optimisticTimer,
        is_running: false,
        accumulated_seconds: displayTime,
      });
      await pauseTimer(habit.id);
    });
  };

  const handleStopTimer = () => {
    if (isPending) return;

    const wasCompleted = existingValue >= targetSeconds;
    const willComplete = targetSeconds > 0 && totalTime >= targetSeconds && !wasCompleted;

    // Remember the current time so it doesn't flash back to old value
    stoppedTimeRef.current = displayTime;

    startTransition(async () => {
      // Optimistically remove timer (store already does this too)
      setOptimisticTimer(null);
      await stopTimer(habit.id);
    });

    if (willComplete) {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#00D9FF', '#00B8D4', '#4DD0E1', '#80DEEA'],
      });
    }
  };

  const handleResetTimer = () => {
    if (isPending) return;

    startTransition(async () => {
      // Optimistically remove timer
      setOptimisticTimer(null);
      await resetTimer(habit.id);
    });
  };

  return (
    <div className="space-y-4">
      {/* Timer Display */}
      <div className="flex flex-col items-center">
        <div className="relative w-48 h-48">
          {/* Background circle */}
          <svg className="w-full h-full -rotate-90">
            <circle
              cx="96"
              cy="96"
              r="88"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              className="text-surface-600"
            />
            {/* Progress circle */}
            <circle
              cx="96"
              cy="96"
              r="88"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={553}
              strokeDashoffset={553 - (553 * progress) / 100}
              className={`transition-all duration-1000 ${
                progress >= 100 ? 'text-accent' : 'text-accent-dim'
              }`}
            />
          </svg>

          {/* Time display */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="timer-display text-4xl font-mono font-bold">
              {formatTime(totalTime)}
            </span>
            {targetSeconds > 0 && (
              <span className="text-sm text-gray-500 mt-1">
                / {formatTime(targetSeconds)}
              </span>
            )}
          </div>
        </div>

        {/* Running indicator */}
        {isRunning && (
          <div className="flex items-center gap-2 mt-2">
            <span className="w-2 h-2 bg-accent rounded-full animate-pulse" />
            <span className="text-sm text-accent">Running</span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3">
        {!optimisticTimer || !isRunning ? (
          <button
            onClick={handleStartTimer}
            disabled={isPending}
            className="btn btn-primary px-8 disabled:opacity-50"
          >
            {optimisticTimer ? 'Resume' : 'Start'}
          </button>
        ) : (
          <button
            onClick={handlePauseTimer}
            disabled={isPending}
            className="btn btn-secondary px-8 disabled:opacity-50"
          >
            Pause
          </button>
        )}

        {optimisticTimer && (
          <>
            <button
              onClick={handleStopTimer}
              disabled={isPending}
              className="btn btn-ghost text-accent disabled:opacity-50"
            >
              Save & Stop
            </button>
            <button
              onClick={handleResetTimer}
              disabled={isPending}
              className="btn btn-ghost text-danger disabled:opacity-50"
            >
              Reset
            </button>
          </>
        )}
      </div>

      {/* Tip */}
      <p className="text-center text-xs text-gray-500">
        Timer auto-saves when you stop. Feel free to pause anytime.
      </p>
    </div>
  );
}

