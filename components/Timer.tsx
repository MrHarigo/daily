'use client';

import { useEffect, useState, useRef } from 'react';
import confetti from 'canvas-confetti';
import { Habit, ActiveTimer, useHabitStore } from '@/stores/habitStore';

interface TimerProps {
  habit: Habit;
  date: string;
  onOptimisticUpdate?: (habitId: string, completed: boolean, value: number) => void;
}

export function Timer({ habit, date, onOptimisticUpdate }: TimerProps) {
  const { activeTimers, completions, startTimer, pauseTimer, stopTimer, resetTimer } = useHabitStore();
  // Only use the timer if it matches the current date (prevents showing paused timers from previous days)
  const rawTimer = activeTimers[habit.id];
  const timer = rawTimer?.date === date ? rawTimer : undefined;

  const [displayTime, setDisplayTime] = useState(0);
  const intervalRef = useRef<number | null>(null);
  const [stoppedTime, setStoppedTime] = useState<number | null>(null); // Remember time when stopped
  const pendingStopRef = useRef(false); // Tracks if stop operation is in flight

  // Local optimistic timer state (immediate updates, no startTransition delay)
  const [localTimer, setLocalTimer] = useState<ActiveTimer | null>(null);
  const isLocalOverride = useRef(false);

  // Sync local timer with server timer when server responds
  useEffect(() => {
    if (!isLocalOverride.current) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional: syncing local state with server timer
      setLocalTimer(timer ?? null);
    }
  }, [timer]);

  // Use local timer for display (immediate), falls back to server timer
  const optimisticTimer = localTimer;

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

  // Clear stoppedTime when server value catches up (and stop operation completed)
  useEffect(() => {
    if (stoppedTime !== null && existingValue >= stoppedTime && !pendingStopRef.current) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional: clearing temporary state when server catches up
      setStoppedTime(null);
    }
  }, [existingValue, stoppedTime]);

  // When timer is active, show displayTime
  // When stopped, show stoppedTime (until server catches up) or existingValue
  const totalTime = optimisticTimer
    ? displayTime
    : (stoppedTime ?? existingValue);
  const progress = targetSeconds > 0 ? Math.min((totalTime / targetSeconds) * 100, 100) : 0;

  const handleStartTimer = async () => {
    // If resuming a paused timer, use its accumulated time
    // If starting fresh, use existingValue (saved completion) or stoppedTime
    const accumulatedSeconds = optimisticTimer?.accumulated_seconds
      ?? stoppedTime
      ?? existingValue;

    // Set displayTime immediately to prevent flicker on first click
    setDisplayTime(accumulatedSeconds);

    // Update timer state immediately (no startTransition delay)
    isLocalOverride.current = true;
    setLocalTimer({
      habit_id: habit.id,
      date,
      started_at: new Date().toISOString(),
      accumulated_seconds: accumulatedSeconds,
      is_running: true,
    });
    setStoppedTime(null);

    // Sync with server
    await startTimer(habit.id, date);
    isLocalOverride.current = false;
  };

  const handlePauseTimer = async () => {
    if (!optimisticTimer) return;

    // Update immediately
    isLocalOverride.current = true;
    setLocalTimer({
      ...optimisticTimer,
      is_running: false,
      accumulated_seconds: displayTime,
    });

    // Sync with server
    await pauseTimer(habit.id);
    isLocalOverride.current = false;
  };

  const handleStopTimer = async () => {
    const wasCompleted = existingValue >= targetSeconds;
    const willComplete = targetSeconds > 0 && totalTime >= targetSeconds && !wasCompleted;

    // Remember the current time so it doesn't flash back to old value
    setStoppedTime(displayTime);
    pendingStopRef.current = true;

    // Update immediately
    isLocalOverride.current = true;
    setLocalTimer(null);

    // Notify parent for instant filtering (before server call)
    onOptimisticUpdate?.(habit.id, willComplete || wasCompleted, displayTime);

    // Fire confetti immediately (before server call)
    if (willComplete) {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#00D9FF', '#00B8D4', '#4DD0E1', '#80DEEA'],
      });
    }

    // Sync with server
    await stopTimer(habit.id);
    pendingStopRef.current = false;
    isLocalOverride.current = false;
  };

  const handleResetTimer = async () => {
    // Update immediately
    isLocalOverride.current = true;
    setLocalTimer(null);

    // Sync with server
    await resetTimer(habit.id);
    isLocalOverride.current = false;
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
            className="btn btn-primary px-8"
          >
            {optimisticTimer ? 'Resume' : 'Start'}
          </button>
        ) : (
          <button
            onClick={handlePauseTimer}
            className="btn btn-secondary px-8"
          >
            Pause
          </button>
        )}

        {optimisticTimer && (
          <>
            <button
              onClick={handleStopTimer}
              className="btn btn-ghost text-accent"
            >
              Save & Stop
            </button>
            <button
              onClick={handleResetTimer}
              className="btn btn-ghost text-danger"
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

