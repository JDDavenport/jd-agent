import Card from '../components/common/Card';
import Button from '../components/common/Button';
import { useChecklist, type ChecklistItem, type ChecklistStatus } from '../hooks/useChecklist';

const ITEMS: ChecklistItem[] = [
  {
    id: 'coins-list',
    title: 'PoW-only coin list',
    description: 'Seed 15+ PoW coins and keep list curated.',
  },
  {
    id: 'market-metrics',
    title: 'Market metrics table',
    description: 'Price, 24h/7d change, market cap, volume, ATH, supply.',
  },
  {
    id: 'hashrate-metrics',
    title: 'Hashrate metrics + history',
    description: 'Current hashrate, difficulty, and charts (30d/90d/1y).',
  },
  {
    id: 'pool-distribution',
    title: 'Mining pool distribution',
    description: 'Top pools + decentralization score based on share.',
  },
  {
    id: 'cypherpunk-score',
    title: 'Cypherpunk alignment score',
    description: 'Privacy, decentralization, censorship resistance, dev activity.',
  },
  {
    id: 'filters',
    title: 'Filters',
    description: 'Privacy focus, algorithm, market cap range, age range.',
  },
  {
    id: 'detail-view',
    title: 'Coin detail view',
    description: 'Charts, resources, mining calculator, markets list.',
  },
  {
    id: 'watchlist',
    title: 'Personal watchlist',
    description: 'Add/remove coins; track invested USD and coin count.',
  },
  {
    id: 'alerts',
    title: 'Network health alerts',
    description: 'Hashrate drops, block stalls, stale feeds.',
  },
  {
    id: 'bug-report',
    title: 'Bug report inbox',
    description: 'UI form + GoDaddy SMTP delivery.',
  },
  {
    id: 'refresh-cadence',
    title: 'Pricing refresh cadence',
    description: 'Market data refresh schedule + manual refresh.',
  },
  {
    id: 'auth-admin',
    title: 'Admin sign-on',
    description: 'Optional: restrict management actions with auth.',
  },
  {
    id: 'portfolio',
    title: 'Portfolio option',
    description: 'Optional: multi-entry portfolio vs watchlist only.',
  },
];

const STATUS_LABELS: Record<ChecklistStatus, string> = {
  todo: 'Todo',
  in_progress: 'In progress',
  blocked: 'Blocked',
  done: 'Done',
};

const STATUS_CLASSES: Record<ChecklistStatus, string> = {
  todo: 'badge-neutral',
  in_progress: 'badge-warning',
  blocked: 'badge-error',
  done: 'badge-success',
};

export default function Plan() {
  const { state, setStatus, setNotes, progress } = useChecklist(ITEMS);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">PRD Delivery Plan</h1>
          <p className="text-text-muted">
            Track every requirement to make sure it lands in the app.
          </p>
        </div>
        <div className="text-sm text-text-muted">
          {progress.done}/{progress.total} complete · {progress.percent}%
        </div>
      </div>

      <Card>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ITEMS.map((item) => {
            const status = state[item.id]?.status || 'todo';
            return (
              <div key={item.id} className="p-4 rounded-lg bg-dark-bg border border-dark-border">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-text">{item.title}</div>
                    <div className="text-sm text-text-muted">{item.description}</div>
                  </div>
                  <span className={`badge ${STATUS_CLASSES[status]}`}>
                    {STATUS_LABELS[status]}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 mt-3">
                  {(['todo', 'in_progress', 'blocked', 'done'] as ChecklistStatus[]).map(
                    (value) => (
                      <Button
                        key={value}
                        size="sm"
                        variant={status === value ? 'primary' : 'secondary'}
                        onClick={() => setStatus(item.id, value)}
                      >
                        {STATUS_LABELS[value]}
                      </Button>
                    )
                  )}
                </div>

                <textarea
                  value={state[item.id]?.notes || ''}
                  onChange={(e) => setNotes(item.id, e.target.value)}
                  placeholder="Notes, blockers, owner..."
                  rows={2}
                  className="mt-3 w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-sm"
                />
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
