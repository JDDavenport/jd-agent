/**
 * StatsCards
 *
 * Dashboard metric cards section displaying 6 interactive cards:
 * - Tasks Today
 * - Events Today
 * - Goals & Progress
 * - Habits Today
 * - Vault Entries
 * - Recovery/Wellness
 */

import { useDashboardEnhanced } from '../../hooks/useDashboardEnhanced';
import {
  TasksMetricCard,
  EventsMetricCard,
  GoalsMetricCard,
  HabitsMetricCard,
  VaultMetricCard,
  WellnessMetricCard,
} from './metrics';

function StatsCards() {
  const { data: dashboard, isLoading, error } = useDashboardEnhanced();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      <TasksMetricCard
        data={dashboard?.tasks}
        isLoading={isLoading}
        error={error}
      />
      <EventsMetricCard
        data={dashboard?.events}
        isLoading={isLoading}
        error={error}
      />
      <GoalsMetricCard
        data={dashboard?.goals}
        isLoading={isLoading}
        error={error}
      />
      <HabitsMetricCard
        data={dashboard?.habits}
        isLoading={isLoading}
        error={error}
      />
      <VaultMetricCard
        data={dashboard?.vault}
        isLoading={isLoading}
        error={error}
      />
      <WellnessMetricCard
        data={dashboard?.wellness}
        isLoading={isLoading}
        error={error}
      />
    </div>
  );
}

export default StatsCards;
