'use client';

import { RoadmapColumn } from '@/lib/docs';
import clsx from 'clsx';
import { CheckCircle, Clock, Calendar, Lightbulb } from 'lucide-react';

interface RoadmapBoardProps {
  columns: RoadmapColumn[];
}

const columnConfig: Record<string, { color: string; bgColor: string; icon: React.ReactNode; description: string }> = {
  Shipped: {
    color: 'border-t-green-500',
    bgColor: 'bg-green-500/10',
    icon: <CheckCircle className="h-5 w-5 text-green-500" />,
    description: 'Recently released',
  },
  'In Progress': {
    color: 'border-t-amber-500',
    bgColor: 'bg-amber-500/10',
    icon: <Clock className="h-5 w-5 text-amber-500" />,
    description: 'Actively building',
  },
  Planned: {
    color: 'border-t-blue-500',
    bgColor: 'bg-blue-500/10',
    icon: <Calendar className="h-5 w-5 text-blue-500" />,
    description: 'Coming soon',
  },
  Exploring: {
    color: 'border-t-purple-500',
    bgColor: 'bg-purple-500/10',
    icon: <Lightbulb className="h-5 w-5 text-purple-500" />,
    description: 'Under consideration',
  },
};

const statusStyles = {
  complete: 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300',
  'in-progress': 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300',
  planned: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300',
  considering: 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300',
};

export function RoadmapBoard({ columns }: RoadmapBoardProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {columns.map((column) => {
        const config = columnConfig[column.title] || {
          color: 'border-t-muted',
          bgColor: 'bg-muted/30',
          icon: null,
          description: '',
        };

        return (
          <div
            key={column.title}
            className={clsx(
              'rounded-xl border border-border overflow-hidden border-t-4 shadow-sm',
              config.color
            )}
          >
            {/* Column Header */}
            <div className={clsx('px-4 py-4 border-b border-border', config.bgColor)}>
              <div className="flex items-center gap-2 mb-1">
                {config.icon}
                <h3 className="font-semibold text-lg">{column.title}</h3>
                <span className="ml-auto text-sm font-medium px-2 py-0.5 rounded-full bg-background">
                  {column.items.length}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{config.description}</p>
            </div>

            {/* Column Items */}
            <div className="p-3 space-y-3 max-h-[600px] overflow-y-auto">
              {column.items.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No items
                </p>
              ) : (
                column.items.map((item, index) => (
                  <div
                    key={`${item.title}-${index}`}
                    className="p-4 rounded-lg bg-background border border-border hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group"
                  >
                    <h4 className="font-medium text-sm leading-tight mb-2 group-hover:text-primary transition-colors">
                      {item.title}
                    </h4>
                    {item.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                        {item.description}
                      </p>
                    )}
                    {item.category && (
                      <span
                        className={clsx(
                          'inline-block text-xs px-2 py-1 rounded-full',
                          statusStyles[item.status]
                        )}
                      >
                        {item.category}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
