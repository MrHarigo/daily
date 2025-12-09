'use client';

import { useState, useRef, useOptimistic, useTransition, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Habit, HabitCompletion, useHabitStore } from '@/stores/habitStore';
import { Timer } from './Timer';

interface HabitCardProps {
  habit: Habit;
  completion?: HabitCompletion;
  date: string;
  disabled?: boolean;
  onOptimisticUpdate?: (habitId: string, completed: boolean, value: number) => void;
}

// Trigger confetti from a specific element
const triggerConfetti = (element?: HTMLElement | null) => {
  if (element) {
    const rect = element.getBoundingClientRect();
    const x = (rect.left + rect.width / 2) / window.innerWidth;
    const y = (rect.top + rect.height / 2) / window.innerHeight;
    
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { x, y },
      colors: ['#00D9FF', '#00B8D4', '#4DD0E1', '#80DEEA'],
      ticks: 100,
      gravity: 1.2,
      scalar: 0.8,
    });
  } else {
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.6 },
    });
  }
};

export function HabitCard({ habit, completion, date, disabled, onOptimisticUpdate }: HabitCardProps) {
  const { toggleCompletion, incrementCount, setTimeValue, resetTimer } = useHabitStore();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditingTime, setIsEditingTime] = useState(false);
  const [editMinutes, setEditMinutes] = useState('');
  const [editSeconds, setEditSeconds] = useState('');
  const checkboxRef = useRef<HTMLElement>(null);
  const [isPending, startTransition] = useTransition();

  // Local optimistic state for count (simpler than useOptimistic for debouncing)
  const serverValue = completion?.value ?? 0;
  const [localValue, setLocalValue] = useState(serverValue);
  const pendingDeltaRef = useRef(0);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync local value when server value changes (after debounced request completes)
  useEffect(() => {
    // Only sync if we're not in the middle of local edits
    if (pendingDeltaRef.current === 0) {
      setLocalValue(serverValue);
    }
  }, [serverValue]);

  // Optimistic state for toggle (boolean habits)
  const [optimisticCompletion, setOptimisticCompletion] = useOptimistic(
    completion,
    (current, update: Partial<HabitCompletion>) => ({
      habit_id: habit.id,
      date,
      value: current?.value ?? 0,
      completed: current?.completed ?? false,
      ...current,
      ...update,
    })
  );

  // For boolean habits, use optimistic completion
  // For count habits, use local value
  const isCompleted = habit.type === 'count'
    ? localValue >= (habit.target_value || 1)
    : (optimisticCompletion?.completed ?? false);
  const currentValue = habit.type === 'count' ? localValue : (optimisticCompletion?.value ?? 0);

  const handleToggle = () => {
    if (disabled || isPending) return;

    const newCompleted = !isCompleted;
    const newValue = newCompleted ? 1 : 0;

    // Trigger confetti when completing (not when uncompleting)
    if (newCompleted) {
      triggerConfetti(checkboxRef.current);
    }

    // Notify parent for instant filtering
    onOptimisticUpdate?.(habit.id, newCompleted, newValue);

    startTransition(async () => {
      // Optimistically update UI immediately
      setOptimisticCompletion({
        completed: newCompleted,
        value: newValue,
      });
      // Then sync with server
      await toggleCompletion(habit.id, date);
    });
  };

  const handleIncrement = (delta: number) => {
    if (disabled) return;

    // Calculate new value immediately
    const newValue = Math.max(0, localValue + delta);
    const target = habit.target_value || 1;
    const wasCompleted = localValue >= target;
    const willBeCompleted = newValue >= target;

    // Trigger confetti when completing
    if (!wasCompleted && willBeCompleted && delta > 0) {
      triggerConfetti(checkboxRef.current);
    }

    // Update local state immediately (instant UI feedback)
    setLocalValue(newValue);

    // Notify parent for instant filtering
    onOptimisticUpdate?.(habit.id, willBeCompleted, newValue);

    // Accumulate the delta for server
    pendingDeltaRef.current += delta;

    // Clear existing debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new debounce timer - send accumulated delta after 300ms idle
    debounceTimerRef.current = setTimeout(async () => {
      const totalDelta = pendingDeltaRef.current;
      pendingDeltaRef.current = 0; // Reset before async call

      if (totalDelta !== 0) {
        await incrementCount(habit.id, date, totalDelta);
      }
    }, 300);
  };

  const handleEditTime = () => {
    const mins = Math.floor(currentValue / 60);
    const secs = currentValue % 60;
    setEditMinutes(mins.toString());
    setEditSeconds(secs.toString());
    setIsEditingTime(true);
  };

  const handleSaveTime = () => {
    const mins = parseInt(editMinutes) || 0;
    const secs = parseInt(editSeconds) || 0;
    const totalSeconds = mins * 60 + secs;

    const targetSeconds = (habit.target_value || 0) * 60;
    const wasCompleted = currentValue >= targetSeconds;
    const willBeCompleted = totalSeconds >= targetSeconds;

    if (!wasCompleted && willBeCompleted && targetSeconds > 0) {
      triggerConfetti();
    }

    setIsEditingTime(false);

    // Notify parent for instant filtering
    onOptimisticUpdate?.(habit.id, willBeCompleted, totalSeconds);

    startTransition(async () => {
      // Optimistically update UI immediately
      setOptimisticCompletion({
        value: totalSeconds,
        completed: willBeCompleted,
      });
      // Clear any active timer when manually setting time
      await resetTimer(habit.id);
      // Then sync with server
      await setTimeValue(habit.id, date, totalSeconds, habit.target_value);
    });
  };

  const handleCancelEdit = () => {
    setIsEditingTime(false);
  };

  return (
    <div
      className={`card transition-all ${
        disabled
          ? 'opacity-50'
          : isCompleted
          ? 'border-accent/50 bg-accent/5'
          : ''
      }`}
    >
      <div className="flex items-center gap-4">
        {/* Checkbox / Status */}
        {habit.type === 'boolean' && (
          <div 
            className={`w-12 h-12 rounded-lg flex items-center justify-center transition-all ${
              isCompleted ? 'bg-accent/10' : 'bg-surface-700/50'
            }`}
          >
            <button
              ref={checkboxRef as React.RefObject<HTMLButtonElement>}
              onClick={handleToggle}
              disabled={disabled}
              className={`btn-press w-7 h-7 rounded-md border-2 flex items-center justify-center transition-all ${
                isCompleted
                  ? 'bg-accent border-accent text-surface-900'
                  : 'border-surface-500 hover:border-accent'
              } ${disabled ? 'cursor-not-allowed' : 'cursor-pointer active:scale-90'}`}
            >
              {isCompleted && (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          </div>
        )}

        {/* Count display */}
        {habit.type === 'count' && (
          <div
            ref={checkboxRef as React.RefObject<HTMLDivElement>}
            className={`w-12 h-12 rounded-lg flex items-center justify-center font-mono text-lg font-bold transition-all ${
              isCompleted
                ? 'bg-accent text-surface-900'
                : 'bg-surface-700 text-gray-300'
            }`}
          >
            {currentValue}
          </div>
        )}

        {/* Time display */}
        {habit.type === 'time' && (
          <button
            onClick={disabled ? undefined : handleEditTime}
            disabled={disabled}
            className={`w-12 h-12 rounded-lg flex flex-col items-center justify-center font-mono transition-all ${
              isCompleted
                ? 'bg-accent text-surface-900'
                : 'bg-surface-700 text-gray-300'
            } ${!disabled ? 'hover:ring-2 hover:ring-accent/50 cursor-pointer active:scale-90' : ''}`}
            title="Click to edit time"
          >
            <span className="text-sm font-bold leading-none">{Math.floor(currentValue / 60)}</span>
            <span className="text-[10px] opacity-70 leading-none">min</span>
          </button>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className={`font-medium truncate ${isCompleted ? 'text-accent' : ''}`}>
            {habit.name}
          </h3>
          {habit.target_value && (
            <p className="text-sm text-gray-500">
              {habit.type === 'count' && `Goal: ${habit.target_value} times`}
              {habit.type === 'time' && `Goal: ${habit.target_value} min`}
            </p>
          )}
        </div>

        {/* Actions */}
        {habit.type === 'count' && !disabled && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleIncrement(-1)}
              disabled={currentValue <= 0}
              className="btn-press w-10 h-10 rounded-lg bg-surface-700 hover:bg-surface-600 active:scale-90 active:bg-surface-500 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-xl font-bold transition-all"
            >
              −
            </button>
            <button
              onClick={() => handleIncrement(1)}
              className="btn-press w-10 h-10 rounded-lg bg-surface-700 hover:bg-surface-600 active:scale-90 active:bg-surface-500 flex items-center justify-center text-xl font-bold transition-all"
            >
              +
            </button>
          </div>
        )}

        {habit.type === 'time' && !disabled && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="btn-ghost-plain text-sm"
          >
            {isExpanded ? 'Hide' : 'Timer'}
          </button>
        )}
      </div>

      {/* Timer panel for time-based habits */}
      {habit.type === 'time' && isExpanded && !disabled && (
        <div className="mt-4 pt-4 border-t border-surface-600">
          <Timer habit={habit} date={date} onOptimisticUpdate={onOptimisticUpdate} />
        </div>
      )}

      {/* Edit time modal */}
      {isEditingTime && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="card bg-surface-800 p-6 w-80">
            <h3 className="text-lg font-semibold mb-4">Edit Time for {habit.name}</h3>
            <div className="flex items-center gap-2 mb-4">
              <div className="flex-1">
                <label className="block text-sm text-gray-400 mb-1">Minutes</label>
                <input
                  type="number"
                  min="0"
                  value={editMinutes}
                  onChange={(e) => setEditMinutes(e.target.value)}
                  className="input w-full text-center font-mono"
                  autoFocus
                />
              </div>
              <span className="text-2xl text-gray-500 pt-6">:</span>
              <div className="flex-1">
                <label className="block text-sm text-gray-400 mb-1">Seconds</label>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={editSeconds}
                  onChange={(e) => setEditSeconds(e.target.value)}
                  className="input w-full text-center font-mono"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCancelEdit}
                className="btn btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTime}
                className="btn btn-primary flex-1"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

