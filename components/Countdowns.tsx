'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import EventCard from './EventCard'
import AddEventModal from './AddEventModal'
import { useEventStore, EventRow, EventInput } from '@/stores/eventStore'

export function Countdowns() {
  const { events, isLoading, fetchEvents, createEvent, updateEvent, deleteEvent } = useEventStore()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<EventRow | null>(null)

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  function handleAddClick() {
    setEditingEvent(null)
    setModalOpen(true)
  }

  function handleEdit(event: EventRow) {
    setEditingEvent(event)
    setModalOpen(true)
  }

  async function handleDelete(id: string) {
    await deleteEvent(id)
  }

  async function handleSubmit(data: EventInput) {
    if (editingEvent) {
      await updateEvent(editingEvent.id, data)
    } else {
      await createEvent(data)
    }
  }

  return (
    // `dark` keeps the shadcn-token primitives (dialog/popover/calendar render
    // in portals) on the countdown palette regardless of the host theme.
    <div className="dark">
      {isLoading && events.length === 0 ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : events.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center justify-center gap-4 py-24 text-center"
        >
          <div className="text-5xl">🗓️</div>
          <div>
            <p className="text-xl font-semibold text-white">No milestones yet</p>
            <p className="text-zinc-500 mt-1 text-sm">Add your first big moment to start counting down.</p>
          </div>
          <button
            onClick={handleAddClick}
            aria-label="Add milestone"
            className="mt-2 w-full rounded-2xl border border-dashed border-white/8 py-4 text-zinc-700 hover:text-zinc-400 hover:border-white/15 transition-all text-sm"
          >
            +
          </button>
        </motion.div>
      ) : (
        <div className="flex flex-col gap-3">
          <AnimatePresence mode="popLayout">
            {events.map((event, index) => (
              <EventCard
                key={event.id}
                event={event}
                index={index}
                onEdit={handleEdit}
              />
            ))}
          </AnimatePresence>
          <button
            onClick={handleAddClick}
            aria-label="Add milestone"
            className="w-full rounded-2xl border border-dashed border-white/8 py-4 text-zinc-700 hover:text-zinc-400 hover:border-white/15 transition-all text-sm"
          >
            +
          </button>
        </div>
      )}

      <AddEventModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        editingEvent={editingEvent}
        onSubmit={handleSubmit}
        onDelete={handleDelete}
      />
    </div>
  )
}
