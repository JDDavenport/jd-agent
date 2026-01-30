import type { CommunicationMonitorStatus, ChannelStatus } from '../../types/health';

interface Props {
  status: CommunicationMonitorStatus;
  isLoading?: boolean;
  onRunCheck?: () => void;
  isRunningCheck?: boolean;
}

function ChannelCard({ name, icon, channel }: { name: string; icon: string; channel: ChannelStatus }) {
  const getStatusColor = () => {
    if (!channel.enabled) return 'bg-gray-500';
    switch (channel.status) {
      case 'healthy':
        return 'bg-green-500';
      case 'degraded':
        return 'bg-yellow-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusLabel = () => {
    if (!channel.enabled) return 'Disabled';
    switch (channel.status) {
      case 'healthy':
        return 'Active';
      case 'degraded':
        return 'Degraded';
      case 'error':
        return 'Error';
      default:
        return 'Unknown';
    }
  };

  const formatLastCheck = (lastCheck: string | null) => {
    if (!lastCheck) return 'Never';
    const date = new Date(lastCheck);
    const now = new Date();
    const diffMinutes = Math.round((now.getTime() - date.getTime()) / 60000);

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffMinutes < 1440) return `${Math.round(diffMinutes / 60)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <span className="text-xl">{icon}</span>
          <span className="font-medium">{name}</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
          <span className="text-sm text-text-muted">{getStatusLabel()}</span>
        </div>
      </div>

      {channel.enabled && (
        <div className="text-sm text-text-muted space-y-1">
          <div className="flex justify-between">
            <span>Unread</span>
            <span className={channel.unreadCount > 0 ? 'text-text-primary font-medium' : ''}>
              {channel.unreadCount}
            </span>
          </div>
          {channel.urgentCount > 0 && (
            <div className="flex justify-between">
              <span>Urgent</span>
              <span className="text-red-400 font-medium">{channel.urgentCount}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Last check</span>
            <span>{formatLastCheck(channel.lastCheckAt)}</span>
          </div>
          {channel.sessionValid !== undefined && (
            <div className="flex justify-between">
              <span>Session</span>
              <span className={channel.sessionValid ? 'text-green-400' : 'text-red-400'}>
                {channel.sessionValid ? 'Valid' : 'Expired'}
              </span>
            </div>
          )}
          {channel.hasAccess !== undefined && (
            <div className="flex justify-between">
              <span>Access</span>
              <span className={channel.hasAccess ? 'text-green-400' : 'text-red-400'}>
                {channel.hasAccess ? 'Granted' : 'Denied'}
              </span>
            </div>
          )}
          {channel.error && (
            <div className="text-red-400 text-xs mt-2 truncate" title={channel.error}>
              {channel.error}
            </div>
          )}
        </div>
      )}

      {!channel.enabled && (
        <div className="text-sm text-text-muted">
          Enable in environment configuration
        </div>
      )}
    </div>
  );
}

export default function CommunicationStatus({ status, isLoading, onRunCheck, isRunningCheck }: Props) {
  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-6 bg-bg-tertiary rounded w-48 mb-4" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-bg-tertiary rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Communication Monitoring</h2>
        <div className="flex items-center space-x-4">
          <span className="text-sm text-text-muted">
            {status.alertsSentToday} alerts today
          </span>
          {onRunCheck && (
            <button
              onClick={onRunCheck}
              disabled={isRunningCheck}
              className="px-3 py-1 text-sm bg-bg-tertiary hover:bg-bg-secondary rounded-lg transition-colors disabled:opacity-50"
            >
              {isRunningCheck ? 'Checking...' : 'Check Now'}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <ChannelCard name="Gmail" icon="📧" channel={status.gmail} />
        <ChannelCard name="Outlook" icon="📨" channel={status.outlook} />
        <ChannelCard name="iMessage" icon="💬" channel={status.imessage} />
        <ChannelCard name="Phone" icon="📞" channel={status.phoneCalls} />
      </div>
    </div>
  );
}
