interface QuickActionsProps {
  onActionClick: (message: string) => void;
  disabled?: boolean;
}

const quickActions = [
  { label: 'Today', message: 'Show me my tasks for today' },
  { label: 'Due Soon', message: 'What tasks are due soon?' },
  { label: 'Inbox', message: 'Show me my inbox tasks' },
  { label: 'Briefing', message: 'Give me my daily briefing' },
  { label: 'System', message: 'Run a system health check' },
];

function QuickActions({ onActionClick, disabled }: QuickActionsProps) {
  return (
    <div className="px-4 py-3 border-t border-dark-border bg-dark-card">
      <p className="text-xs text-text-muted mb-2">Quick actions:</p>
      <div className="flex flex-wrap gap-2">
        {quickActions.map((action) => (
          <button
            key={action.label}
            onClick={() => onActionClick(action.message)}
            disabled={disabled}
            className="px-3 py-1.5 text-sm bg-dark-bg border border-dark-border rounded-lg hover:border-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default QuickActions;
