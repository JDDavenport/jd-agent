import {
  BriefcaseIcon,
  PaperAirplaneIcon,
  ChatBubbleLeftRightIcon,
  TrophyIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

interface StatsCardsProps {
  stats: {
    total: number;
    thisWeek: {
      applied: number;
      interviews: number;
      offers: number;
    };
    responseRate: number;
    interviewRate: number;
  } | null;
}

export function StatsCards({ stats }: StatsCardsProps) {
  const cards = [
    {
      label: 'Total Jobs',
      value: stats?.total || 0,
      icon: BriefcaseIcon,
      color: 'blue',
    },
    {
      label: 'Applied This Week',
      value: stats?.thisWeek?.applied || 0,
      icon: PaperAirplaneIcon,
      color: 'green',
    },
    {
      label: 'Interviews',
      value: stats?.thisWeek?.interviews || 0,
      icon: ChatBubbleLeftRightIcon,
      color: 'purple',
    },
    {
      label: 'Offers',
      value: stats?.thisWeek?.offers || 0,
      icon: TrophyIcon,
      color: 'amber',
    },
  ];

  const colorClasses: Record<string, { bg: string; icon: string; text: string }> = {
    blue: { bg: 'bg-blue-50', icon: 'text-blue-600', text: 'text-blue-900' },
    green: { bg: 'bg-green-50', icon: 'text-green-600', text: 'text-green-900' },
    purple: { bg: 'bg-purple-50', icon: 'text-purple-600', text: 'text-purple-900' },
    amber: { bg: 'bg-amber-50', icon: 'text-amber-600', text: 'text-amber-900' },
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        const colors = colorClasses[card.color];

        return (
          <div
            key={card.label}
            className="bg-white rounded-xl border border-gray-200 p-5"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{card.label}</p>
                <p className={clsx('text-3xl font-bold mt-1', colors.text)}>
                  {card.value}
                </p>
              </div>
              <div className={clsx('p-3 rounded-xl', colors.bg)}>
                <Icon className={clsx('w-6 h-6', colors.icon)} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
