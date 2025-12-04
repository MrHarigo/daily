interface DateSelectorProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
}

export function DateSelector({ selectedDate, onDateChange }: DateSelectorProps) {
  const today = new Date().toISOString().split('T')[0];

  const goToPrevDay = () => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() - 1);
    onDateChange(date.toISOString().split('T')[0]);
  };

  const goToNextDay = () => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + 1);
    onDateChange(date.toISOString().split('T')[0]);
  };

  const goToToday = () => {
    onDateChange(today);
  };

  const isToday = selectedDate === today;

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={goToPrevDay}
        className="w-10 h-10 rounded-lg bg-surface-700 hover:bg-surface-600 flex items-center justify-center transition-colors"
        aria-label="Previous day"
      >
        ←
      </button>

      <button
        onClick={goToToday}
        disabled={isToday}
        className={`px-4 h-10 rounded-lg font-mono text-sm transition-colors ${
          isToday
            ? 'bg-accent/20 text-accent cursor-default'
            : 'bg-surface-700 hover:bg-surface-600'
        }`}
      >
        {isToday ? 'Today' : 'Go to Today'}
      </button>

      <button
        onClick={goToNextDay}
        disabled={selectedDate >= today}
        className="w-10 h-10 rounded-lg bg-surface-700 hover:bg-surface-600 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
        aria-label="Next day"
      >
        →
      </button>
    </div>
  );
}

