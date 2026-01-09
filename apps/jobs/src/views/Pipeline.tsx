import { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { JobCard } from '@/components/jobs/JobCard';
import { useJobs, useUpdateJob } from '@/hooks/useJobs';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import clsx from 'clsx';

const COLUMNS = [
  { id: 'discovered', label: 'Discovered', color: 'gray' },
  { id: 'saved', label: 'Saved', color: 'blue' },
  { id: 'applied', label: 'Applied', color: 'green' },
  { id: 'interviewing', label: 'Interviewing', color: 'purple' },
  { id: 'offered', label: 'Offered', color: 'amber' },
];

interface SortableJobProps {
  job: any;
}

function SortableJob({ job }: SortableJobProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: job.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={clsx(
        isDragging && 'opacity-50'
      )}
    >
      <JobCard job={job} />
    </div>
  );
}

export function Pipeline() {
  const { data: jobsData, isLoading } = useJobs();
  const updateJob = useUpdateJob();
  const [activeJob, setActiveJob] = useState<any>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const jobs = jobsData?.data || [];

  const jobsByStatus = COLUMNS.reduce((acc, column) => {
    acc[column.id] = jobs.filter((job: any) =>
      column.id === 'interviewing'
        ? ['phone_screen', 'interviewing'].includes(job.status)
        : job.status === column.id
    );
    return acc;
  }, {} as Record<string, any[]>);

  const handleDragStart = (event: DragStartEvent) => {
    const job = jobs.find((j: any) => j.id === event.active.id);
    setActiveJob(job);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveJob(null);

    if (!over) return;

    const activeJob = jobs.find((j: any) => j.id === active.id);
    if (!activeJob) return;

    // Check if dropped on a column
    const targetColumn = COLUMNS.find((col) => col.id === over.id);
    if (targetColumn && activeJob.status !== targetColumn.id) {
      updateJob.mutate({
        id: activeJob.id,
        data: { status: targetColumn.id },
      });
    }
  };

  const columnColors: Record<string, { header: string; bg: string }> = {
    gray: { header: 'bg-gray-100 text-gray-700', bg: 'bg-gray-50' },
    blue: { header: 'bg-blue-100 text-blue-700', bg: 'bg-blue-50' },
    green: { header: 'bg-green-100 text-green-700', bg: 'bg-green-50' },
    purple: { header: 'bg-purple-100 text-purple-700', bg: 'bg-purple-50' },
    amber: { header: 'bg-amber-100 text-amber-700', bg: 'bg-amber-50' },
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header
        title="Pipeline"
        subtitle="Drag and drop to update job status"
      />

      <main className="flex-1 overflow-x-auto p-6">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 min-w-max h-full">
            {COLUMNS.map((column) => {
              const columnJobs = jobsByStatus[column.id] || [];
              const colors = columnColors[column.color];

              return (
                <div
                  key={column.id}
                  id={column.id}
                  className={clsx(
                    'w-72 flex-shrink-0 rounded-xl border border-gray-200',
                    colors.bg
                  )}
                >
                  <div className={clsx('px-4 py-3 rounded-t-xl', colors.header)}>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{column.label}</span>
                      <span className="text-sm opacity-75">{columnJobs.length}</span>
                    </div>
                  </div>

                  <div className="p-3 space-y-3 min-h-[200px]">
                    <SortableContext
                      items={columnJobs.map((j: any) => j.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {columnJobs.map((job: any) => (
                        <SortableJob key={job.id} job={job} />
                      ))}
                    </SortableContext>

                    {columnJobs.length === 0 && (
                      <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
                        Drop jobs here
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <DragOverlay>
            {activeJob && (
              <div className="opacity-90">
                <JobCard job={activeJob} />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </main>
    </div>
  );
}
