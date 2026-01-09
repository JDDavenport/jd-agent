/**
 * CollapsibleSection
 *
 * A collapsible section with header and content.
 */

import { useState } from 'react';
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

interface CollapsibleSectionProps {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  headerColor?: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
}

export function CollapsibleSection({
  title,
  count,
  defaultOpen = true,
  headerColor = 'text-text-muted',
  children,
  icon,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="space-y-2">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 w-full text-left min-h-[44px] py-2 -my-2 ${headerColor} hover:text-text transition-colors rounded-lg`}
        aria-expanded={isOpen}
        aria-controls={`section-${title.toLowerCase().replace(/\s+/g, '-')}`}
      >
        {isOpen ? (
          <ChevronDownIcon className="w-5 h-5" aria-hidden="true" />
        ) : (
          <ChevronRightIcon className="w-5 h-5" aria-hidden="true" />
        )}
        {icon && <span aria-hidden="true">{icon}</span>}
        <span className="text-sm font-medium">{title}</span>
        {count !== undefined && count > 0 && (
          <span className="text-xs bg-dark-border px-1.5 py-0.5 rounded" aria-label={`${count} items`}>
            {count}
          </span>
        )}
      </button>
      {isOpen && (
        <div
          id={`section-${title.toLowerCase().replace(/\s+/g, '-')}`}
          className="pl-6 space-y-1"
        >
          {children}
        </div>
      )}
    </div>
  );
}

export default CollapsibleSection;
