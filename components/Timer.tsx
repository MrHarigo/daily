'use client';

import { useEffect, useState, useRef } from 'react';
import confetti from 'canvas-confetti';
import { Habit, useHabitStore } from '@/stores/habitStore';

interface TimerProps {
  habit: Habit;
  date: string;
}

export function Timer({ habit, date }: TimerProps) {
  const { activeTimers, completions, startTimer, pauseTimer, stopTimer, resetTimer } = useHabitStore();
  const timer = activeTimers[habit.id];

  const [displayTime, setDisplayTime] = useState(0);
  const intervalRef = useRef<number | null>(null);

  // Calculate current display time
  useEffect(() => {
    const updateTime = () => {
      if (!timer) {
        setDisplayTime(0);
        return;
      }

      let elapsed = timer.accumulated_seconds;
      if (timer.is_running) {
        const startedAt = new Date(timer.started_at).getTime();
        const now = Date.now();
        elapsed += Math.floor((now - startedAt) / 1000);
      }
      setDisplayTime(elapsed);
    };

    updateTime();

    if (timer?.is_running) {
      intervalRef.current = window.setInterval(updateTime, 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [timer]);

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
  const isRunning = timer?.is_running ?? false;

  // Get current completion value (previously saved time)
  const completionKey = `${habit.id}-${date}`;
  const currentCompletion = completions[completionKey];
  const existingValue = currentCompletion?.value || 0;
  
  // When timer is active, accumulated_seconds already includes existing value from backend
  // When no timer, show existing saved value
  const totalTime = timer ? displayTime : existingValue;
  const progress = targetSeconds > 0 ? Math.min((totalTime / targetSeconds) * 100, 100) : 0;

  const handleStopTimer = async () => {
    // Check if stopping will complete the goal (totalTime already includes all time)
    const wasCompleted = existingValue >= targetSeconds;
    const willComplete = targetSeconds > 0 && totalTime >= targetSeconds && !wasCompleted;
    
    await stopTimer(habit.id);
    
    if (willComplete) {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#00D9FF', '#00B8D4', '#4DD0E1', '#80DEEA'],
      });
    }
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
        {!timer || !isRunning ? (
          <button
            onClick={() => startTimer(habit.id, date)}
            className="btn btn-primary px-8"
          >
            {timer ? 'Resume' : 'Start'}
          </button>
        ) : (
          <button
            onClick={() => pauseTimer(habit.id)}
            className="btn btn-secondary px-8"
          >
            Pause
          </button>
        )}

        {timer && (
          <>
            <button
              onClick={handleStopTimer}
              className="btn btn-ghost text-accent"
            >
              Save & Stop
            </button>
            <button
              onClick={() => resetTimer(habit.id)}
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

