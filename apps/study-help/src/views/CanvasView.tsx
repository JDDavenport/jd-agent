import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  DocumentTextIcon,
  FolderIcon,
  DocumentIcon,
  PlayCircleIcon,
  ArrowLeftIcon,
  ChevronRightIcon,
  CalendarDaysIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

interface CourseIndex {
  id: number;
  slug: string;
  name: string;
  tag: string;
  hasSyllabus: boolean;
  assignmentCount: number;
  pageCount: number;
  moduleCount: number;
  fileCount: number;
}

interface Assignment {
  id: number;
  name: string;
  description: string;
  due_at: string | null;
  points_possible: number;
  html_url: string;
}

interface Module {
  id: number;
  name: string;
  position: number;
  items: ModuleItem[];
}

interface ModuleItem {
  id: number;
  title: string;
  type: string;
  html_url?: string;
  external_url?: string;
}

interface FileInfo {
  id: number;
  name: string;
  size: number;
  contentType: string;
  localPath?: string;
  folder?: string;
}

interface Page {
  page_id: number;
  url: string;
  title: string;
}

export function CanvasView() {
  const { courseSlug, section } = useParams();
  const [courses, setCourses] = useState<CourseIndex[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/data/index.json')
      .then(res => res.json())
      .then(data => {
        setCourses(data.courses || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (courseSlug) {
    const course = courses.find(c => c.slug === courseSlug);
    if (!course) {
      return (
        <div className="p-6">
          <Link to="/canvas" className="text-blue-600 hover:underline flex items-center gap-1 mb-4">
            <ArrowLeftIcon className="h-4 w-4" />
            Back to courses
          </Link>
          <p className="text-gray-500">Course not found</p>
        </div>
      );
    }
    return <CourseContentView course={course} section={section} />;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Canvas Content</h1>
      <p className="text-gray-500 mb-6">All synced course materials in one place</p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {courses.map(course => (
          <Link
            key={course.slug}
            to={`/canvas/${course.slug}`}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-semibold text-gray-900">{course.name}</h2>
                <p className="text-sm text-gray-500">{course.tag}</p>
              </div>
              <ChevronRightIcon className="h-5 w-5 text-gray-400" />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {course.hasSyllabus && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                  Syllabus
                </span>
              )}
              {course.assignmentCount > 0 && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                  {course.assignmentCount} assignments
                </span>
              )}
              {course.moduleCount > 0 && (
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                  {course.moduleCount} modules
                </span>
              )}
              {course.fileCount > 0 && (
                <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full">
                  {course.fileCount} files
                </span>
              )}
              {course.pageCount > 0 && (
                <span className="text-xs bg-teal-100 text-teal-700 px-2 py-1 rounded-full">
                  {course.pageCount} pages
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

interface CourseContentViewProps {
  course: CourseIndex;
  section?: string;
}

function CourseContentView({ course, section }: CourseContentViewProps) {
  const [activeTab, setActiveTab] = useState(section || 'overview');
  const [syllabus, setSyllabus] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const basePath = `/data/files/${course.slug}`;
      
      try {
        // Fetch syllabus
        if (course.hasSyllabus) {
          const syllabusRes = await fetch(`${basePath}/syllabus.html`);
          if (syllabusRes.ok) {
            setSyllabus(await syllabusRes.text());
          }
        }

        // Fetch assignments
        const assignmentsRes = await fetch(`${basePath}/assignments.json`);
        if (assignmentsRes.ok) {
          setAssignments(await assignmentsRes.json());
        }

        // Fetch modules
        const modulesRes = await fetch(`${basePath}/modules.json`);
        if (modulesRes.ok) {
          setModules(await modulesRes.json());
        }

        // Fetch files
        const filesRes = await fetch(`${basePath}/files.json`);
        if (filesRes.ok) {
          setFiles(await filesRes.json());
        }

        // Fetch pages
        const pagesRes = await fetch(`${basePath}/pages.json`);
        if (pagesRes.ok) {
          setPages(await pagesRes.json());
        }
      } catch (e) {
        console.error('Error loading course data:', e);
      }
      
      setLoading(false);
    };

    fetchData();
  }, [course.slug, course.hasSyllabus]);

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'syllabus', label: 'Syllabus', disabled: !course.hasSyllabus },
    { id: 'assignments', label: `Assignments (${course.assignmentCount})`, disabled: course.assignmentCount === 0 },
    { id: 'modules', label: `Modules (${course.moduleCount})`, disabled: course.moduleCount === 0 },
    { id: 'files', label: `Files (${course.fileCount})`, disabled: course.fileCount === 0 },
    { id: 'pages', label: `Pages (${course.pageCount})`, disabled: course.pageCount === 0 },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <Link to="/canvas" className="text-blue-600 hover:underline flex items-center gap-1 mb-4">
        <ArrowLeftIcon className="h-4 w-4" />
        All Courses
      </Link>
      
      <h1 className="text-2xl font-bold text-gray-900 mb-1">{course.name}</h1>
      <p className="text-gray-500 mb-6">{course.tag}</p>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6 overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => !tab.disabled && setActiveTab(tab.id)}
              disabled={tab.disabled}
              className={clsx(
                'px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors',
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : tab.disabled
                  ? 'border-transparent text-gray-300 cursor-not-allowed'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : (
        <>
          {activeTab === 'overview' && (
            <OverviewTab course={course} assignments={assignments} modules={modules} />
          )}
          {activeTab === 'syllabus' && syllabus && (
            <SyllabusTab syllabus={syllabus} />
          )}
          {activeTab === 'assignments' && (
            <AssignmentsTab assignments={assignments} />
          )}
          {activeTab === 'modules' && (
            <ModulesTab modules={modules} />
          )}
          {activeTab === 'files' && (
            <FilesTab files={files} courseSlug={course.slug} />
          )}
          {activeTab === 'pages' && (
            <PagesTab pages={pages} courseSlug={course.slug} />
          )}
        </>
      )}
    </div>
  );
}

function OverviewTab({ course, assignments, modules }: { course: CourseIndex; assignments: Assignment[]; modules: Module[] }) {
  // Get upcoming assignments (due in next 14 days)
  const now = new Date();
  const upcoming = assignments
    .filter(a => a.due_at && new Date(a.due_at) > now)
    .sort((a, b) => new Date(a.due_at!).getTime() - new Date(b.due_at!).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-2xl font-bold text-blue-600">{course.assignmentCount}</p>
          <p className="text-sm text-gray-500">Assignments</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-2xl font-bold text-purple-600">{course.moduleCount}</p>
          <p className="text-sm text-gray-500">Modules</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-2xl font-bold text-orange-600">{course.fileCount}</p>
          <p className="text-sm text-gray-500">Files</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-2xl font-bold text-teal-600">{course.pageCount}</p>
          <p className="text-sm text-gray-500">Pages</p>
        </div>
      </div>

      {/* Upcoming assignments */}
      {upcoming.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <CalendarDaysIcon className="h-5 w-5 text-blue-600" />
              Upcoming Assignments
            </h2>
          </div>
          <div className="divide-y divide-gray-100">
            {upcoming.map(assignment => (
              <a
                key={assignment.id}
                href={assignment.html_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors"
              >
                <div>
                  <p className="font-medium text-gray-900">{assignment.name}</p>
                  <p className="text-sm text-gray-500">
                    Due {new Date(assignment.due_at!).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
                {assignment.points_possible > 0 && (
                  <span className="text-sm text-gray-500">{assignment.points_possible} pts</span>
                )}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* First few modules */}
      {modules.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <FolderIcon className="h-5 w-5 text-purple-600" />
              Course Modules
            </h2>
          </div>
          <div className="divide-y divide-gray-100">
            {modules.slice(0, 5).map(module => (
              <div key={module.id} className="px-5 py-3">
                <p className="font-medium text-gray-900">{module.name}</p>
                <p className="text-sm text-gray-500">{module.items?.length || 0} items</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SyllabusTab({ syllabus }: { syllabus: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div 
        className="prose prose-sm max-w-none"
        dangerouslySetInnerHTML={{ __html: syllabus }}
      />
    </div>
  );
}

function AssignmentsTab({ assignments }: { assignments: Assignment[] }) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Group by due date
  const grouped = assignments.reduce((acc, assignment) => {
    const dueDate = assignment.due_at 
      ? new Date(assignment.due_at).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
      : 'No Due Date';
    if (!acc[dueDate]) acc[dueDate] = [];
    acc[dueDate].push(assignment);
    return acc;
  }, {} as Record<string, Assignment[]>);

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([date, items]) => (
        <div key={date}>
          <h3 className="text-sm font-semibold text-gray-500 mb-3">{date}</h3>
          <div className="space-y-2">
            {items.map(assignment => (
              <div
                key={assignment.id}
                className="bg-white rounded-lg border border-gray-200 overflow-hidden"
              >
                <button
                  onClick={() => setExpandedId(expandedId === assignment.id ? null : assignment.id)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="flex-1 min-w-0 pr-4">
                    <p className="font-medium text-gray-900 truncate">{assignment.name}</p>
                    <p className="text-sm text-gray-500">
                      {assignment.points_possible > 0 ? `${assignment.points_possible} points` : 'No points'}
                    </p>
                  </div>
                  <ChevronRightIcon 
                    className={clsx(
                      'h-5 w-5 text-gray-400 transition-transform',
                      expandedId === assignment.id && 'rotate-90'
                    )}
                  />
                </button>
                {expandedId === assignment.id && assignment.description && (
                  <div className="px-4 pb-4 border-t border-gray-100 pt-4">
                    <div 
                      className="prose prose-sm max-w-none text-gray-600"
                      dangerouslySetInnerHTML={{ __html: assignment.description }}
                    />
                    <a
                      href={assignment.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-4 text-sm text-blue-600 hover:underline"
                    >
                      Open in Canvas
                      <ChevronRightIcon className="h-4 w-4" />
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ModulesTab({ modules }: { modules: Module[] }) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  return (
    <div className="space-y-4">
      {modules.sort((a, b) => a.position - b.position).map(module => (
        <div key={module.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <button
            onClick={() => setExpandedId(expandedId === module.id ? null : module.id)}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <FolderIcon className="h-5 w-5 text-purple-500" />
              <div>
                <p className="font-medium text-gray-900">{module.name}</p>
                <p className="text-sm text-gray-500">{module.items?.length || 0} items</p>
              </div>
            </div>
            <ChevronRightIcon 
              className={clsx(
                'h-5 w-5 text-gray-400 transition-transform',
                expandedId === module.id && 'rotate-90'
              )}
            />
          </button>
          {expandedId === module.id && module.items && (
            <div className="border-t border-gray-100 divide-y divide-gray-100">
              {module.items.map(item => (
                <div key={item.id} className="px-4 py-2 pl-12 flex items-center gap-3">
                  <ItemIcon type={item.type} />
                  {item.html_url ? (
                    <a
                      href={item.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline"
                    >
                      {item.title}
                    </a>
                  ) : item.external_url ? (
                    <a
                      href={item.external_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline"
                    >
                      {item.title}
                    </a>
                  ) : (
                    <span className="text-sm text-gray-700">{item.title}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ItemIcon({ type }: { type: string }) {
  switch (type) {
    case 'File':
      return <DocumentIcon className="h-4 w-4 text-gray-400" />;
    case 'Page':
      return <DocumentTextIcon className="h-4 w-4 text-gray-400" />;
    case 'ExternalUrl':
      return <PlayCircleIcon className="h-4 w-4 text-gray-400" />;
    case 'Assignment':
      return <CalendarDaysIcon className="h-4 w-4 text-gray-400" />;
    default:
      return <DocumentIcon className="h-4 w-4 text-gray-400" />;
  }
}

function FilesTab({ files, courseSlug }: { files: FileInfo[]; courseSlug: string }) {
  // Group by folder
  const grouped = files.reduce((acc, file) => {
    const folder = file.folder || 'Root';
    if (!acc[folder]) acc[folder] = [];
    acc[folder].push(file);
    return acc;
  }, {} as Record<string, FileInfo[]>);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([folder, items]) => (
        <div key={folder}>
          <h3 className="text-sm font-semibold text-gray-500 mb-3 flex items-center gap-2">
            <FolderIcon className="h-4 w-4" />
            {folder}
          </h3>
          <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
            {items.map(file => (
              <div key={file.id} className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <FileTypeIcon contentType={file.contentType} />
                  <div className="min-w-0">
                    {file.localPath ? (
                      <a
                        href={`/data/files/${file.localPath}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-blue-600 hover:underline truncate block"
                      >
                        {file.name}
                      </a>
                    ) : (
                      <span className="font-medium text-gray-900 truncate block">{file.name}</span>
                    )}
                    <p className="text-sm text-gray-500">{formatSize(file.size)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function FileTypeIcon({ contentType }: { contentType: string }) {
  if (contentType.includes('pdf')) {
    return <DocumentTextIcon className="h-5 w-5 text-red-500" />;
  }
  if (contentType.includes('video')) {
    return <PlayCircleIcon className="h-5 w-5 text-purple-500" />;
  }
  if (contentType.includes('image')) {
    return <DocumentIcon className="h-5 w-5 text-green-500" />;
  }
  return <DocumentIcon className="h-5 w-5 text-gray-400" />;
}

function PagesTab({ pages, courseSlug }: { pages: Page[]; courseSlug: string }) {
  const [selectedPage, setSelectedPage] = useState<string | null>(null);
  const [pageContent, setPageContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadPage = async (url: string) => {
    setLoading(true);
    setSelectedPage(url);
    try {
      const safeFilename = url.replace(/[^a-z0-9-]/gi, '_');
      const res = await fetch(`/data/files/${courseSlug}/pages/${safeFilename}.html`);
      if (res.ok) {
        setPageContent(await res.text());
      }
    } catch (e) {
      console.error('Error loading page:', e);
    }
    setLoading(false);
  };

  if (selectedPage && pageContent) {
    return (
      <div>
        <button
          onClick={() => { setSelectedPage(null); setPageContent(null); }}
          className="text-blue-600 hover:underline flex items-center gap-1 mb-4"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to pages
        </button>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div 
            className="prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: pageContent }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
      {pages.map(page => (
        <button
          key={page.page_id}
          onClick={() => loadPage(page.url)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            <DocumentTextIcon className="h-5 w-5 text-teal-500" />
            <span className="font-medium text-gray-900">{page.title}</span>
          </div>
          <ChevronRightIcon className="h-5 w-5 text-gray-400" />
        </button>
      ))}
    </div>
  );
}
