import {
  HomeIcon,
  RectangleStackIcon,
  TableCellsIcon,
  UserCircleIcon,
  DocumentTextIcon,
  Cog6ToothIcon,
  PlusIcon,
  ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

interface SidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
  onAddJob: () => void;
}

const navItems = [
  { id: 'chat', label: 'Agent Chat', icon: ChatBubbleLeftRightIcon, highlight: true },
  { id: 'dashboard', label: 'Dashboard', icon: HomeIcon },
  { id: 'pipeline', label: 'Pipeline', icon: RectangleStackIcon },
  { id: 'jobs', label: 'All Jobs', icon: TableCellsIcon },
  { id: 'resumes', label: 'Resumes', icon: DocumentTextIcon },
  { id: 'profile', label: 'Profile', icon: UserCircleIcon },
  { id: 'settings', label: 'Settings', icon: Cog6ToothIcon },
];

export function Sidebar({ currentView, onViewChange, onAddJob }: SidebarProps) {
  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col h-screen">
      <div className="p-4 border-b border-gray-200">
        <h1 className="text-xl font-bold text-gray-900">JD Jobs</h1>
        <p className="text-sm text-gray-500">Job Hunting Agent</p>
      </div>

      <div className="p-3">
        <button
          onClick={onAddJob}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          <PlusIcon className="w-5 h-5" />
          Add Job
        </button>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          const isHighlight = 'highlight' in item && item.highlight;

          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={clsx(
                'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? isHighlight
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white'
                    : 'bg-blue-50 text-blue-700'
                  : isHighlight
                    ? 'text-purple-700 bg-purple-50 hover:bg-purple-100'
                    : 'text-gray-700 hover:bg-gray-100'
              )}
            >
              <Icon className={clsx(
                'w-5 h-5',
                isActive
                  ? isHighlight ? 'text-white' : 'text-blue-600'
                  : isHighlight ? 'text-purple-500' : 'text-gray-400'
              )} />
              {item.label}
              {isHighlight && !isActive && (
                <span className="ml-auto text-xs bg-purple-200 text-purple-700 px-1.5 py-0.5 rounded">AI</span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-3 border-t border-gray-200">
        <div className="text-xs text-gray-400 text-center">
          JD Agent v0.3.0
        </div>
      </div>
    </aside>
  );
}
