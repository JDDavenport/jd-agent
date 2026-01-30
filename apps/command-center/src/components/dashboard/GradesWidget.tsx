/**
 * Grades Widget
 *
 * Canvas Complete Phase 5: Grade tracking dashboard widget
 * - Overall GPA/average
 * - Course averages
 * - Recent grades
 * - Pending grades notification
 */


import {
  useGradeSummary,
  useGradeCheck,
  getGradeColor,
  getGradeBgColor,
  formatGrade,
  percentageToGrade,
} from '../../hooks/useGrades';

interface GradesWidgetProps {
  compact?: boolean;
}

export function GradesWidget({ compact = false }: GradesWidgetProps) {
  const { data: summary, isLoading: summaryLoading, error: summaryError } = useGradeSummary();
  const { data: gradeCheck } = useGradeCheck();

  if (summaryLoading) {
    return (
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xl">🎓</span>
          <h3 className="text-lg font-semibold text-white">Grades</h3>
        </div>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  if (summaryError || !summary) {
    return (
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xl">🎓</span>
          <h3 className="text-lg font-semibold text-white">Grades</h3>
        </div>
        <div className="text-slate-400 text-sm text-center py-4">
          No grade data available
        </div>
      </div>
    );
  }

  // Compact mode for smaller widgets
  if (compact) {
    return (
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">🎓</span>
            <h3 className="text-lg font-semibold text-white">Grades</h3>
          </div>
          {gradeCheck?.hasNewGrades && (
            <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs font-medium rounded-full animate-pulse">
              {gradeCheck.count} new
            </span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className={`text-2xl font-bold ${getGradeColor(summary.averageScore)}`}>
              {summary.averageScore !== null ? `${summary.averageScore}%` : '-'}
            </div>
            <div className="text-xs text-slate-400">Average</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-white">{summary.totalGraded}</div>
            <div className="text-xs text-slate-400">Graded</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-white">{summary.totalPending}</div>
            <div className="text-xs text-slate-400">Pending</div>
          </div>
        </div>

        {summary.averageScore !== null && (
          <div className="mt-3 pt-3 border-t border-slate-700 text-center">
            <span className={`text-lg font-semibold ${getGradeColor(summary.averageScore)}`}>
              {percentageToGrade(summary.averageScore)}
            </span>
            <span className="text-slate-400 text-sm ml-2">Overall</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <span className="text-xl">🎓</span>
          <h3 className="text-lg font-semibold text-white">Grades</h3>
        </div>
        {gradeCheck?.hasNewGrades && (
          <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs font-medium rounded-full animate-pulse">
            {gradeCheck.count} new grade{gradeCheck.count !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Overall Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className={`p-3 rounded-lg ${getGradeBgColor(summary.averageScore)}`}>
            <div className={`text-2xl font-bold ${getGradeColor(summary.averageScore)}`}>
              {summary.averageScore !== null ? (
                <>
                  {summary.averageScore}%
                  <span className="text-sm ml-1">
                    ({percentageToGrade(summary.averageScore)})
                  </span>
                </>
              ) : (
                '-'
              )}
            </div>
            <div className="text-xs text-slate-400 mt-1">Overall Average</div>
          </div>
          <div className="bg-slate-700/30 p-3 rounded-lg">
            <div className="text-2xl font-bold text-white">{summary.totalGraded}</div>
            <div className="text-xs text-slate-400 mt-1">Graded</div>
          </div>
          <div className="bg-slate-700/30 p-3 rounded-lg">
            <div className="text-2xl font-bold text-yellow-400">{summary.totalPending}</div>
            <div className="text-xs text-slate-400 mt-1">Pending</div>
          </div>
        </div>

        {/* Course Averages */}
        {summary.courseAverages.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              By Course
            </h4>
            <div className="space-y-2">
              {summary.courseAverages.map((course) => (
                <div
                  key={course.courseName}
                  className="flex items-center justify-between p-2 bg-slate-700/30 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{course.courseName}</p>
                    <p className="text-xs text-slate-500">
                      {course.gradedAssignments}/{course.totalAssignments} graded
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`text-lg font-semibold ${getGradeColor(course.averageScore)}`}>
                      {course.averageScore}%
                    </span>
                    <span className={`text-xs ml-1 ${getGradeColor(course.averageScore)}`}>
                      ({percentageToGrade(course.averageScore)})
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Grades */}
        {summary.recentGrades.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Recent Grades
            </h4>
            <div className="space-y-2">
              {summary.recentGrades.slice(0, 5).map((grade) => (
                <div
                  key={grade.canvasItemId}
                  className="flex items-center justify-between p-2 bg-slate-700/30 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{grade.assignmentTitle}</p>
                    <p className="text-xs text-slate-500">{grade.courseName}</p>
                  </div>
                  <div className="text-right">
                    <span className={`text-sm font-medium ${getGradeColor(grade.percentageScore)}`}>
                      {formatGrade(grade.newGrade, grade.newScore, grade.pointsPossible)}
                    </span>
                    {grade.percentageScore !== null && (
                      <span className="text-xs text-slate-500 ml-1">
                        ({grade.percentageScore}%)
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No grades message */}
        {summary.totalGraded === 0 && summary.totalPending === 0 && (
          <div className="text-center py-4">
            <p className="text-slate-400">No grades yet this semester</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default GradesWidget;
