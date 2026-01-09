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
        className={`flex items-center gap-2 w-full text-left ${headerColor} hover:text-text transition-colors`}
      >
        {isOpen ? (
          <ChevronDownIcon className="w-4 h-4" />
        ) : (
          <ChevronRightIcon className="w-4 h-4" />
        )}
        {icon && <span>{icon}</span>}
        <span className="text-sm font-medium">{title}</span>
        {count !== undefined && count > 0 && (
          <span className="text-xs bg-dark-border px-1.5 py-0.5 rounded">
            {count}
          </span>
        )}
      </button>
      {isOpen && <div className="pl-6 space-y-1">{children}</div>}
    </div>
  );
}

export default CollapsibleSection;
