import { Header } from '@/components/layout/Header';
import { useQuery } from '@tanstack/react-query';
import { resumesApi } from '@/lib/api';
import { DocumentTextIcon, StarIcon, PlusIcon } from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';
import { format } from 'date-fns';
import clsx from 'clsx';

export function Resumes() {
  const { data: resumesData, isLoading } = useQuery({
    queryKey: ['resumes'],
    queryFn: () => resumesApi.list(),
  });

  const resumes = resumesData?.data || [];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header
        title="Resumes"
        subtitle="Manage your resume variants"
      />

      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl">
          <div className="flex justify-between items-center mb-6">
            <p className="text-gray-600">{resumes.length} resume{resumes.length !== 1 ? 's' : ''}</p>
            <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              <PlusIcon className="w-5 h-5" />
              Upload Resume
            </button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : resumes.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <DocumentTextIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No resumes yet</h3>
              <p className="text-gray-500 mb-4">Upload your first resume to get started</p>
            </div>
          ) : (
            <div className="space-y-4">
              {resumes.map((resume: any) => (
                <div
                  key={resume.id}
                  className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <DocumentTextIcon className="w-6 h-6 text-blue-600" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">{resume.name}</h3>
                        {resume.isDefault && (
                          <StarSolidIcon className="w-4 h-4 text-amber-400" />
                        )}
                      </div>

                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                        {resume.variant && (
                          <span className="px-2 py-0.5 bg-gray-100 rounded text-xs font-medium">
                            {resume.variant}
                          </span>
                        )}
                        <span>{resume.fileType?.toUpperCase() || 'PDF'}</span>
                        {resume.lastUsed && (
                          <span>Last used {format(new Date(resume.lastUsed), 'MMM d, yyyy')}</span>
                        )}
                      </div>

                      {resume.extractedSkills && resume.extractedSkills.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {resume.extractedSkills.slice(0, 5).map((skill: string) => (
                            <span
                              key={skill}
                              className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full"
                            >
                              {skill}
                            </span>
                          ))}
                          {resume.extractedSkills.length > 5 && (
                            <span className="text-xs text-gray-400">
                              +{resume.extractedSkills.length - 5} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {!resume.isDefault && (
                        <button className="p-2 text-gray-400 hover:text-amber-500 transition-colors">
                          <StarIcon className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
