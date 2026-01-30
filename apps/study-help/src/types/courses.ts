// Course definitions for BYU MBA Winter 2026
export interface Course {
  id: string;
  code: string;
  name: string;
  shortName: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: string;
}

export const COURSES: Course[] = [
  {
    id: 'mba560',
    code: 'MBA 560',
    name: 'Business Analytics',
    shortName: 'Analytics',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    icon: '📊',
  },
  {
    id: 'mba580',
    code: 'MBA 580',
    name: 'Business Strategy',
    shortName: 'Strategy',
    color: 'text-purple-700',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    icon: '🎯',
  },
  {
    id: 'entrepreneurial-innovation',
    code: 'ENT',
    name: 'Entrepreneurial Innovation',
    shortName: 'Innovation',
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    icon: '💡',
  },
  {
    id: 'mba664',
    code: 'MBA 664',
    name: 'Venture Capital / Private Equity',
    shortName: 'VC/PE',
    color: 'text-green-700',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    icon: '💰',
  },
  {
    id: 'mba677',
    code: 'MBA 677R',
    name: 'Entrepreneurship Through Acquisition',
    shortName: 'ETA',
    color: 'text-rose-700',
    bgColor: 'bg-rose-50',
    borderColor: 'border-rose-200',
    icon: '🏢',
  },
  {
    id: 'mba654',
    code: 'MBA 654',
    name: 'Strategic Client Acquisition/Retention',
    shortName: 'Client Acq.',
    color: 'text-cyan-700',
    bgColor: 'bg-cyan-50',
    borderColor: 'border-cyan-200',
    icon: '🤝',
  },
  {
    id: 'mba693r',
    code: 'MBA 693R',
    name: 'Post-MBA Career Strategy',
    shortName: 'Career',
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    icon: '🚀',
  },
];

// Canvas course ID mapping
export const CANVAS_COURSE_IDS: Record<string, string> = {
  'mba560': '32991',
  'mba580': '33202',
  'entrepreneurial-innovation': '33259',
  'mba664': '34638',
  'mba677': '34458',
  'mba654': '34642',
  'mba693r': '34634',
};

// Helper to get course by ID
export function getCourseById(id: string): Course | undefined {
  return COURSES.find(c => c.id === id);
}

// Helper to match a task/reading context to a course
export function matchCourse(context: string, labels?: string[]): Course | undefined {
  const searchText = (context || '').toLowerCase() + ' ' + (labels || []).join(' ').toLowerCase();
  
  // First pass: Look for exact MBA course code matches (most specific)
  // Format: "MBA 560", "MBA 664", etc.
  for (const course of COURSES) {
    if (course.code.startsWith('MBA')) {
      // Match "mba 664" or "mba664" at word boundary
      const codeWithSpace = course.code.toLowerCase();
      const codeNoSpace = codeWithSpace.replace(/\s+/g, '');
      
      // Use regex for word boundary matching
      const codeRegex = new RegExp(`\\b${codeWithSpace.replace(' ', '\\s*')}\\b`, 'i');
      if (codeRegex.test(searchText)) {
        return course;
      }
    }
  }
  
  // Second pass: Look for other identifying keywords
  for (const course of COURSES) {
    const nameMatch = course.name.toLowerCase();
    const shortMatch = course.shortName.toLowerCase();
    
    // Special case matching
    if (
      (course.id === 'mba560' && searchText.includes('analytics')) ||
      (course.id === 'mba580' && /\bstrategy\b/.test(searchText)) ||
      (course.id === 'mba664' && (/\bvc\b/.test(searchText) || /\bventure capital\b/.test(searchText) || /\bprivate equity\b/.test(searchText))) ||
      (course.id === 'mba677' && (/\beta\b/.test(searchText) || /\bacquisition\b/.test(searchText))) ||
      (course.id === 'mba654' && (/\bclient\b/.test(searchText) || /\bretention\b/.test(searchText))) ||
      (course.id === 'mba693r' && /\bcareer\b/.test(searchText)) ||
      (course.id === 'entrepreneurial-innovation' && (/\binnovation\b/.test(searchText) || /\bentrepreneurial\b/.test(searchText)))
    ) {
      return course;
    }
    
    // Check for full course name match
    if (searchText.includes(nameMatch)) {
      return course;
    }
  }
  
  return undefined;
}
