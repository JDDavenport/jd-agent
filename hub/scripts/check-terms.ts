const apiToken = process.env.CANVAS_TOKEN;
const baseUrl = process.env.CANVAS_BASE_URL;

async function checkTerms() {
  // Fetch all courses with enrollment terms
  const response = await fetch(`${baseUrl}/api/v1/courses?enrollment_state=active&include[]=term&per_page=50`, {
    headers: { 'Authorization': `Bearer ${apiToken}` },
  });

  const courses = await response.json() as Array<{
    id: number;
    name: string;
    enrollment_term_id: number;
    term?: { id: number; name: string; start_at?: string; end_at?: string };
  }>;

  console.log("Current courses with term info:\n");

  const termGroups = new Map<string, typeof courses>();

  for (const course of courses) {
    const termName = course.term?.name || `Term ${course.enrollment_term_id}`;
    if (!termGroups.has(termName)) {
      termGroups.set(termName, []);
    }
    termGroups.get(termName)!.push(course);
  }

  for (const [termName, termCourses] of termGroups) {
    console.log(`=== ${termName} ===`);
    const term = termCourses[0].term;
    if (term) {
      console.log(`  Start: ${term.start_at || 'N/A'}`);
      console.log(`  End: ${term.end_at || 'N/A'}`);
    }
    console.log('  Courses:');
    for (const course of termCourses) {
      console.log(`    - ${course.name} (ID: ${course.id})`);
    }
    console.log('');
  }
}

checkTerms();
