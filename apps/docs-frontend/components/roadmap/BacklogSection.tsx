'use client';

import { ReactNode } from 'react';
import { BacklogItem } from '@/lib/docs';
import clsx from 'clsx';

interface BacklogSectionProps {
  title: string;
  icon: ReactNode;
  items: BacklogItem[];
  type: 'issue' | 'enhancement' | 'feature';
}

const severityColors: Record<string, string> = {
  '🔴 Critical': 'text-red-600 dark:text-red-400',
  '🟠 High': 'text-orange-600 dark:text-orange-400',
  '🟡 Medium': 'text-amber-600 dark:text-amber-400',
  '🟢 Low': 'text-green-600 dark:text-green-400',
};

export function BacklogSection({ title, icon, items, type }: BacklogSectionProps) {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-muted/50 border-b border-border">
        {icon}
        <h3 className="font-semibold">{title}</h3>
        <span className="ml-auto text-sm text-muted-foreground">
          {items.length}
        </span>
      </div>

      {/* Items */}
      <div className="divide-y divide-border max-h-96 overflow-y-auto">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No items
          </p>
        ) : (
          items.slice(0, 10).map((item, index) => (
            <div key={`${item.id}-${index}`} className="p-3 hover:bg-muted/30">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-muted-foreground">
                      {item.id}
                    </span>
                    {item.severity && (
                      <span
                        className={clsx(
                          'text-xs',
                          severityColors[item.severity] || 'text-muted-foreground'
                        )}
                      >
                        {item.severity}
                      </span>
                    )}
                  </div>
                  <p className="text-sm line-clamp-2">{item.description}</p>
                </div>
                <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded flex-shrink-0">
                  {item.status}
                </span>
              </div>
            </div>
          ))
        )}
        {items.length > 10 && (
          <div className="p-3 text-center text-sm text-muted-foreground bg-muted/30">
            +{items.length - 10} more items
          </div>
        )}
      </div>
    </div>
  );
}
