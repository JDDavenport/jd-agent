import { useState, useEffect, useRef } from 'react';
import { format, parseISO } from 'date-fns';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as calendarApi from '../../api/calendar';
import type { CalendarEvent, EventType, CreateEventInput } from '../../types/calendar';

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: CalendarEvent | null;
  initialSlot: { start: Date; end: Date } | null;
}

const EVENT_TYPES: { value: EventType; label: string; color: string }[] = [
  { value: 'meeting', label: 'Meeting', color: 'bg-purple-500' },
  { value: 'class', label: 'Class', color: 'bg-blue-500' },
  { value: 'deadline', label: 'Deadline', color: 'bg-red-500' },
  { value: 'personal', label: 'Personal', color: 'bg-green-500' },
  { value: 'blocked_time', label: 'Focus Time', color: 'bg-yellow-500' },
];

export default function EventModal({
  isOpen,
  onClose,
  event,
  initialSlot,
}: EventModalProps) {
  const queryClient = useQueryClient();
  const titleRef = useRef<HTMLInputElement>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [allDay, setAllDay] = useState(false);
  const [eventType, setEventType] = useState<EventType>('meeting');
  const [syncToGoogle, setSyncToGoogle] = useState(true);

  const isEditing = !!event;

  // Initialize form when opening
  useEffect(() => {
    if (!isOpen) return;

    if (event) {
      // Editing existing event
      const start = parseISO(event.startTime);
      const end = parseISO(event.endTime);
      setTitle(event.title);
      setDescription(event.description || '');
      setLocation(event.location || '');
      setStartDate(format(start, 'yyyy-MM-dd'));
      setStartTime(format(start, 'HH:mm'));
      setEndDate(format(end, 'yyyy-MM-dd'));
      setEndTime(format(end, 'HH:mm'));
      setAllDay(event.allDay);
      setEventType(event.eventType);
    } else if (initialSlot) {
      // Creating new event from slot
      setTitle('');
      setDescription('');
      setLocation('');
      setStartDate(format(initialSlot.start, 'yyyy-MM-dd'));
      setStartTime(format(initialSlot.start, 'HH:mm'));
      setEndDate(format(initialSlot.end, 'yyyy-MM-dd'));
      setEndTime(format(initialSlot.end, 'HH:mm'));
      setAllDay(false);
      setEventType('meeting');
    } else {
      // Creating new event from button
      const now = new Date();
      setTitle('');
      setDescription('');
      setLocation('');
      setStartDate(format(now, 'yyyy-MM-dd'));
      setStartTime(format(now, 'HH:mm'));
      setEndDate(format(now, 'yyyy-MM-dd'));
      setEndTime(format(new Date(now.getTime() + 60 * 60 * 1000), 'HH:mm'));
      setAllDay(false);
      setEventType('meeting');
    }

    // Focus title input
    setTimeout(() => titleRef.current?.focus(), 100);
  }, [isOpen, event, initialSlot]);

  // Mutations
  const createMutation = useMutation({
    mutationFn: calendarApi.createEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
      onClose();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateEventInput> }) =>
      calendarApi.updateEvent(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
      onClose();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: calendarApi.deleteEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const startDateTime = allDay
      ? `${startDate}T00:00:00`
      : `${startDate}T${startTime}:00`;
    const endDateTime = allDay
      ? `${endDate}T23:59:59`
      : `${endDate}T${endTime}:00`;

    const eventData: CreateEventInput = {
      title,
      description: description || undefined,
      location: location || undefined,
      startTime: new Date(startDateTime).toISOString(),
      endTime: new Date(endDateTime).toISOString(),
      allDay,
      eventType,
      syncToGoogle,
    };

    if (isEditing && event) {
      updateMutation.mutate({ id: event.id, data: eventData });
    } else {
      createMutation.mutate(eventData);
    }
  };

  const handleDelete = () => {
    if (event && confirm('Are you sure you want to delete this event?')) {
      deleteMutation.mutate(event.id);
    }
  };

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isPending = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative bg-dark-card border border-dark-border rounded-xl max-w-lg w-full p-6 animate-scale-in shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">{isEditing ? 'Edit Event' : 'New Event'}</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-dark-card-hover transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-text-muted mb-1">Title</label>
            <input
              ref={titleRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input w-full"
              placeholder="Event title"
              required
            />
          </div>

          {/* Event Type */}
          <div>
            <label className="block text-sm font-medium text-text-muted mb-2">Event Type</label>
            <div className="flex flex-wrap gap-2">
              {EVENT_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setEventType(type.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    eventType === type.value
                      ? `${type.color} text-white ring-2 ring-offset-2 ring-offset-dark-card ring-${type.color.replace('bg-', '')}`
                      : 'bg-dark-bg text-text-muted hover:bg-dark-card-hover'
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          {/* All Day Toggle */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="allDay"
              checked={allDay}
              onChange={(e) => setAllDay(e.target.checked)}
              className="w-4 h-4 rounded border-dark-border bg-dark-bg text-accent focus:ring-accent"
            />
            <label htmlFor="allDay" className="text-sm font-medium">
              All day event
            </label>
          </div>

          {/* Date/Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-muted mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="input w-full"
                required
              />
            </div>
            {!allDay && (
              <div>
                <label className="block text-sm font-medium text-text-muted mb-1">Start Time</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="input w-full"
                  required
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-text-muted mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="input w-full"
                required
              />
            </div>
            {!allDay && (
              <div>
                <label className="block text-sm font-medium text-text-muted mb-1">End Time</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="input w-full"
                  required
                />
              </div>
            )}
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-text-muted mb-1">Location</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="input w-full"
              placeholder="Add location"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-text-muted mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input w-full h-24 resize-none"
              placeholder="Add description"
            />
          </div>

          {/* Sync to Google */}
          {!isEditing && (
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="syncToGoogle"
                checked={syncToGoogle}
                onChange={(e) => setSyncToGoogle(e.target.checked)}
                className="w-4 h-4 rounded border-dark-border bg-dark-bg text-accent focus:ring-accent"
              />
              <label htmlFor="syncToGoogle" className="text-sm font-medium">
                Sync to Google Calendar
              </label>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={isPending || !title.trim()}
              className="btn-primary flex-1"
            >
              {isPending ? 'Saving...' : isEditing ? 'Update Event' : 'Create Event'}
            </button>
            {isEditing && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isPending}
                className="px-4 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
              >
                Delete
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
