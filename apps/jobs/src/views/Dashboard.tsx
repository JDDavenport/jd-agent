import { Header } from '@/components/layout/Header';
import { StatsCards } from '@/components/dashboard/StatsCards';
import { JobCard } from '@/components/jobs/JobCard';
import { useJobStats, useJobs, useFollowUps } from '@/hooks/useJobs';
import { CalendarIcon, ClockIcon } from '@heroicons/react/24/outline';
import { format } from 'date-fns';

export function Dashboard() {
  const { data: statsData, isLoading: statsLoading } = useJobStats();
  const { data: jobsData } = useJobs({ statuses: 'applied,interviewing,phone_screen' });
  const { data: followUpsData } = useFollowUps();

  const stats = statsData?.data;
  const recentJobs = jobsData?.data?.slice(0, 5) || [];
  const followUps = followUpsData?.data?.slice(0, 5) || [];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header
        title="Dashboard"
        subtitle="Overview of your job search progress"
      />

      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        <StatsCards stats={stats || null} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Activity */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Active Applications</h2>
              <span className="text-sm text-gray-500">{recentJobs.length} jobs</span>
            </div>

            <div className="space-y-3">
              {recentJobs.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-8">
                  No active applications yet
                </p>
              ) : (
                recentJobs.map((job: any) => (
                  <JobCard key={job.id} job={job} />
                ))
              )}
            </div>
          </div>

          {/* Follow-ups */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Upcoming Follow-ups</h2>
              <CalendarIcon className="w-5 h-5 text-gray-400" />
            </div>

            <div className="space-y-3">
              {followUps.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-8">
                  No upcoming follow-ups
                </p>
              ) : (
                followUps.map((job: any) => (
                  <div
                    key={job.id}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                  >
                    <ClockIcon className="w-5 h-5 text-orange-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{job.title}</p>
                      <p className="text-sm text-gray-500 truncate">{job.company}</p>
                    </div>
                    {job.nextFollowUp && (
                      <span className="text-sm text-orange-600 font-medium">
                        {format(new Date(job.nextFollowUp), 'MMM d')}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Performance Metrics */}
        {stats && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Performance</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-3xl font-bold text-blue-600">
                  {stats.responseRate?.toFixed(0) || 0}%
                </p>
                <p className="text-sm text-gray-500">Response Rate</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-green-600">
                  {stats.interviewRate?.toFixed(0) || 0}%
                </p>
                <p className="text-sm text-gray-500">Interview Rate</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-purple-600">
                  {stats.thisMonth?.applied || 0}
                </p>
                <p className="text-sm text-gray-500">Applied This Month</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-amber-600">
                  {stats.averageMatchScore?.toFixed(0) || 0}%
                </p>
                <p className="text-sm text-gray-500">Avg Match Score</p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
