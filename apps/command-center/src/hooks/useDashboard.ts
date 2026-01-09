import { useQuery } from '@tanstack/react-query';
import { getDashboardData } from '../api/analytics';

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboardData,
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
  });
}
