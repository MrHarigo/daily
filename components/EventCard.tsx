'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  differenceInCalendarDays,
  differenceInYears,
  differenceInMonths,
  differenceInWeeks,
  differenceInDays,
  addYears,
  addMonths,
  addWeeks,
} from 'date-fns'
import { EventRow } from '@/stores/eventStore'

const PRESETS: Record<string, { gradient: string; accent: string; badge: string }> = {
  violet:  { gradient: 'from-violet-500/10',  accent: 'text-violet-300',  badge: 'text-violet-400'  },
  rose:    { gradient: 'from-rose-500/10',     accent: 'text-rose-300',    badge: 'text-rose-400'    },
  amber:   { gradient: 'from-amber-500/10',    accent: 'text-amber-300',   badge: 'text-amber-400'   },
  sky:     { gradient: 'from-sky-500/10',      accent: 'text-sky-300',     badge: 'text-sky-400'     },
  emerald: { gradient: 'from-emerald-500/10',  accent: 'text-emerald-300', badge: 'text-emerald-400' },
}

function isHex(color: string) { return color.startsWith('#') }

function getCountdown(targetDate: string) {
  const target = new Date(targetDate + 'T00:00:00')
  const todayMidnight = new Date()
  todayMidnight.setHours(0, 0, 0, 0)

  // Calendar-day based: an event is "today" only on its actual date, "past"
  // strictly after it. Avoids the elapsed-milliseconds drift of the original.
  const dayDiff = differenceInCalendarDays(target, todayMidnight)
  return {
    isToday: dayDiff === 0,
    isPast: dayDiff < 0,
    units: dayDiff > 0 ? breakdownUnits(todayMidnight, target) : [],
  }
}

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  })
}

interface EventCardProps {
  event: EventRow
  index: number
  onEdit: (event: EventRow) => void
}

// Calendar-accurate breakdown via successive subtraction, so month/year
// lengths (and leap years) are respected instead of fixed 30/365-day buckets.
function breakdownUnits(from: Date, to: Date) {
  const years = differenceInYears(to, from)
  let cursor = addYears(from, years)
  const months = differenceInMonths(to, cursor)
  cursor = addMonths(cursor, months)
  const weeks = differenceInWeeks(to, cursor)
  cursor = addWeeks(cursor, weeks)
  const days = differenceInDays(to, cursor)
  return [
    { value: years,  unit: '年' },
    { value: months, unit: '月' },
    { value: weeks,  unit: '週' },
    { value: days,   unit: '日' },
  ].filter(({ value }) => value > 0)
}

export default function EventCard({ event, index, onEdit }: EventCardProps) {
  const [countdown, setCountdown] = useState(() => getCountdown(event.target_date))
  const preset = PRESETS[event.color]
  const hex = isHex(event.color)

  useEffect(() => {
    // Once an event is today or in the past the display is static — no need
    // to keep re-evaluating. Only tick while it's still counting down, and
    // stop as soon as it crosses into "today".
    if (countdown.isPast || countdown.isToday) return
    const interval = setInterval(() => {
      const next = getCountdown(event.target_date)
      setCountdown(next)
      if (next.isPast || next.isToday) clearInterval(interval)
    }, 1000)
    return () => clearInterval(interval)
  }, [event.target_date, countdown.isPast, countdown.isToday])

  const cardStyle = hex
    ? { background: `linear-gradient(to right, ${event.color}18, transparent), rgb(24 24 27 / 0.5)` }
    : undefined
  const accentStyle = hex ? { color: event.color } : undefined
  const badgeStyle  = hex ? { color: event.color } : undefined

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06, ease: [0.23, 1, 0.32, 1] }}
      className={`
        group relative flex items-center justify-between
        rounded-2xl px-6 h-20 backdrop-blur-sm
        ${hex ? '' : `bg-gradient-to-r ${preset?.gradient ?? 'from-violet-500/10'} to-transparent bg-zinc-900/50`}
        transition-colors duration-200 hover:bg-zinc-900/70
      `}
      style={cardStyle}
    >
      {/* Left: emoji + title + meta */}
      <div className="flex items-center gap-4 min-w-0">
        <span className="text-2xl flex-shrink-0">{event.emoji}</span>
        <div className="min-w-0">
          <h3 className="font-semibold text-white leading-tight truncate text-xl group-hover:text-base transition-all duration-500 ease-in-out">{event.title}</h3>
          <div className="overflow-hidden max-h-0 group-hover:max-h-8 transition-all duration-500 ease-in-out">
            <div className="flex items-center gap-3 mt-1">
              <span
                className={`text-xs opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-150 ${!hex ? (preset?.badge ?? 'text-violet-400') : ''}`}
                style={badgeStyle}
              >{formatDate(event.target_date)}</span>
              {event.note && (
                <span className="text-xs text-zinc-600 truncate opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-150">{event.note}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Right: countdown */}
      <div className="flex items-center gap-3 flex-shrink-0 ml-6">
        {countdown.isToday ? (
          <span className="text-3xl font-black text-white">TODAY</span>
        ) : countdown.isPast ? (
          <span className="text-2xl font-bold text-zinc-600">Past</span>
        ) : (
          <>
            {countdown.units.map(({ value, unit }, i, arr) => (
                <div key={unit} className="flex items-center gap-4">
                  <div className="flex items-center gap-1">
                    <span
                      className={`text-4xl font-black tabular-nums leading-none ${!hex ? (preset?.accent ?? 'text-violet-300') : ''}`}
                      style={accentStyle}
                    >{value}</span>
                    <span className="text-zinc-500 text-sm">{unit}</span>
                  </div>
                  {i < arr.length - 1 && <span className="text-zinc-700 leading-none">·</span>}
                </div>
              ))}
          </>
        )}

        {/* Pencil edit */}
        <button
          onClick={() => onEdit(event)}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-600 hover:text-zinc-300 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/5"
          aria-label="Edit"
        >
          <PencilIcon />
        </button>
      </div>
    </motion.div>
  )
}

function PencilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
    </svg>
  )
}
