'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  ChevronRight,
  Rocket,
  Layers,
  BookOpen,
  Settings,
} from 'lucide-react';
import clsx from 'clsx';

export interface NavItem {
  title: string;
  href: string;
  icon?: string;
  children?: NavItem[];
}

interface SidebarProps {
  items: NavItem[];
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  rocket: Rocket,
  layers: Layers,
  book: BookOpen,
  settings: Settings,
};

function NavLink({
  item,
  depth = 0,
}: {
  item: NavItem;
  depth?: number;
}) {
  const pathname = usePathname();
  const isActive = pathname === item.href;
  const hasChildren = item.children && item.children.length > 0;
  const isParentActive = pathname.startsWith(item.href + '/');
  const [expanded, setExpanded] = useState(isActive || isParentActive);

  const Icon = item.icon ? iconMap[item.icon] : null;

  return (
    <div>
      <div className="flex items-center">
        {hasChildren && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 text-muted-foreground hover:text-foreground rounded"
          >
            <ChevronRight
              className={clsx(
                'h-4 w-4 transition-transform',
                expanded && 'rotate-90'
              )}
            />
          </button>
        )}
        <Link
          href={item.href}
          className={clsx(
            'flex-1 flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors',
            !hasChildren && 'ml-6',
            isActive
              ? 'bg-primary/10 text-primary font-medium'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          )}
        >
          {Icon && <Icon className="h-4 w-4" />}
          {item.title}
        </Link>
      </div>

      {hasChildren && expanded && (
        <div className="ml-4 mt-1 space-y-1 border-l border-border pl-2">
          {item.children!.map((child) => (
            <NavLink key={child.href} item={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function Sidebar({ items }: SidebarProps) {
  return (
    <aside className="w-64 flex-shrink-0 border-r border-border">
      <div className="sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto py-6 px-4">
        <nav className="space-y-1">
          {items.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
        </nav>
      </div>
    </aside>
  );
}
