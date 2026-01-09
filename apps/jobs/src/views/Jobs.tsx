import { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { JobCard } from '@/components/jobs/JobCard';
import { useJobs } from '@/hooks/useJobs';
import { FunnelIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';

const STATUS_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'discovered', label: 'Discovered' },
  { id: 'saved', label: 'Saved' },
  { id: 'applied', label: 'Applied' },
  { id: 'interviewing', label: 'Interviewing' },
  { id: 'offered', label: 'Offered' },
  { id: 'rejected', label: 'Rejected' },
];

export function Jobs() {
  const [statusFilter, setStatusFilter] = useState('all');
  const filters = statusFilter !== 'all' ? { status: statusFilter } : undefined;
  const { data: jobsData, isLoading } = useJobs(filters);

  const jobs = jobsData?.data || [];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header
        title="All Jobs"
        subtitle={`${jobs.length} jobs total`}
      />

      <div className="border-b border-gray-200 bg-white px-6 py-3">
        <div className="flex items-center gap-4">
          <FunnelIcon className="w-5 h-5 text-gray-400" />
          <div className="flex gap-2">
            {STATUS_FILTERS.map((filter) => (
              <button
                key={filter.id}
                onClick={() => setStatusFilter(filter.id)}
                className={clsx(
                  'px-3 py-1.5 text-sm font-medium rounded-full transition-colors',
                  statusFilter === filter.id
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <p className="text-lg">No jobs found</p>
            <p className="text-sm mt-1">Add jobs manually or let the agent discover them</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {jobs.map((job: any) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
