import { useState } from 'react';
import type { ClassReviewData, ClassReflection } from '@jd-agent/types';
import {
  AcademicCapIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';

interface Props {
  classes: ClassReviewData[];
  reflections: ClassReflection[];
  onReflection: (classId: string, className: string, note: string) => void;
}

export function ClassesReview({ classes, reflections, onReflection }: Props) {
  const [expandedClass, setExpandedClass] = useState<string | null>(null);

  const getReflection = (classId: string) => {
    return reflections.find((r) => r.classId === classId)?.reflectionNote || '';
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Classes Review</h2>
        <p className="text-sm text-gray-500 mt-1">
          {classes.length} class{classes.length !== 1 ? 'es' : ''} attended today
        </p>
      </div>

      {classes.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <AcademicCapIcon className="w-12 h-12 mx-auto text-gray-300 mb-4" />
          <p>No classes recorded for today.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {classes.map((cls) => {
            const isExpanded = expandedClass === cls.id;
            const reflection = getReflection(cls.id);

            return (
              <div
                key={cls.id}
                className="bg-white rounded-lg border border-gray-200 overflow-hidden"
              >
                <button
                  onClick={() => setExpandedClass(isExpanded ? null : cls.id)}
                  className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                      <AcademicCapIcon className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{cls.className}</p>
                      <p className="text-sm text-gray-500">{cls.pageTitle}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {reflection && (
                      <span className="text-xs text-blue-500">Has note</span>
                    )}
                    {isExpanded ? (
                      <ChevronUpIcon className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDownIcon className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-4">
                    {/* Summary */}
                    {cls.summaryContent && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-1">
                          Summary
                        </h4>
                        <p className="text-sm text-gray-600">{cls.summaryContent}</p>
                      </div>
                    )}

                    {/* Key takeaways */}
                    {cls.keyTakeaways.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-2">
                          Key Takeaways
                        </h4>
                        <ul className="space-y-1">
                          {cls.keyTakeaways.map((takeaway, idx) => (
                            <li
                              key={idx}
                              className="text-sm text-gray-600 flex items-start gap-2"
                            >
                              <span className="text-blue-500 mt-1">•</span>
                              {takeaway}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Link to full notes */}
                    <a
                      href={`/vault/pages/${cls.pageId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-blue-500 hover:underline"
                    >
                      View full notes
                      <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                    </a>

                    {/* Reflection */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Reflection (optional)
                      </label>
                      <textarea
                        value={reflection}
                        onChange={(e) =>
                          onReflection(cls.id, cls.className, e.target.value)
                        }
                        placeholder="What stood out to you from this class?"
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                        rows={2}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
