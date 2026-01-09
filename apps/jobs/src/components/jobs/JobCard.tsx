import { format } from 'date-fns';
import {
  BuildingOfficeIcon,
  MapPinIcon,
  CurrencyDollarIcon,
  CalendarIcon,
  EllipsisVerticalIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

interface Job {
  id: string;
  company: string;
  title: string;
  location?: string;
  locationType?: string;
  salaryMin?: number;
  salaryMax?: number;
  status: string;
  matchScore?: number;
  appliedAt?: string;
  platform?: string;
}

interface JobCardProps {
  job: Job;
  onClick?: () => void;
  onStatusChange?: (status: string) => void;
}

const statusColors: Record<string, { bg: string; text: string }> = {
  discovered: { bg: 'bg-gray-100', text: 'text-gray-700' },
  saved: { bg: 'bg-blue-100', text: 'text-blue-700' },
  applying: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  applied: { bg: 'bg-green-100', text: 'text-green-700' },
  phone_screen: { bg: 'bg-purple-100', text: 'text-purple-700' },
  interviewing: { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  offered: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  rejected: { bg: 'bg-red-100', text: 'text-red-700' },
  withdrawn: { bg: 'bg-gray-100', text: 'text-gray-700' },
  accepted: { bg: 'bg-teal-100', text: 'text-teal-700' },
};

const statusLabels: Record<string, string> = {
  discovered: 'Discovered',
  saved: 'Saved',
  applying: 'Applying',
  applied: 'Applied',
  phone_screen: 'Phone Screen',
  interviewing: 'Interviewing',
  offered: 'Offered',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
  accepted: 'Accepted',
};

export function JobCard({ job, onClick }: JobCardProps) {
  const colors = statusColors[job.status] || statusColors.discovered;

  return (
    <div
      onClick={onClick}
      className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">{job.title}</h3>
          <div className="flex items-center gap-2 mt-1 text-sm text-gray-600">
            <BuildingOfficeIcon className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">{job.company}</span>
          </div>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
          }}
          className="p-1 text-gray-400 hover:text-gray-600"
        >
          <EllipsisVerticalIcon className="w-5 h-5" />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <span className={clsx('px-2 py-1 text-xs font-medium rounded-full', colors.bg, colors.text)}>
          {statusLabels[job.status] || job.status}
        </span>

        {job.matchScore && (
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-50 text-blue-700">
            {job.matchScore}% match
          </span>
        )}

        {job.locationType && (
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
            {job.locationType}
          </span>
        )}
      </div>

      <div className="mt-3 space-y-1.5 text-sm text-gray-500">
        {job.location && (
          <div className="flex items-center gap-2">
            <MapPinIcon className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">{job.location}</span>
          </div>
        )}

        {(job.salaryMin || job.salaryMax) && (
          <div className="flex items-center gap-2">
            <CurrencyDollarIcon className="w-4 h-4 flex-shrink-0" />
            <span>
              ${job.salaryMin || '?'}k - ${job.salaryMax || '?'}k
            </span>
          </div>
        )}

        {job.appliedAt && (
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 flex-shrink-0" />
            <span>Applied {format(new Date(job.appliedAt), 'MMM d, yyyy')}</span>
          </div>
        )}
      </div>
    </div>
  );
}
