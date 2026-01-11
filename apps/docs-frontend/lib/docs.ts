import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

// Path to docs directory (relative to project root)
const DOCS_PATH = path.join(process.cwd(), '../../docs');

export interface DocMeta {
  title: string;
  description?: string;
  slug: string;
  path: string;
  order?: number;
  lastUpdated?: string;
}

export interface DocContent extends DocMeta {
  content: string;
  headings: Heading[];
}

export interface Heading {
  level: number;
  text: string;
  id: string;
}

export interface NavItem {
  title: string;
  href: string;
  icon?: string;
  children?: NavItem[];
  order?: number;
}

/**
 * Get all markdown files from a directory recursively
 */
function getMarkdownFiles(dir: string, basePath: string = ''): string[] {
  const files: string[] = [];

  if (!fs.existsSync(dir)) {
    return files;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.join(basePath, entry.name);

    if (entry.isDirectory()) {
      files.push(...getMarkdownFiles(fullPath, relativePath));
    } else if (entry.name.endsWith('.md')) {
      files.push(relativePath);
    }
  }

  return files;
}

/**
 * Extract headings from markdown content
 */
function extractHeadings(content: string): Heading[] {
  const headingRegex = /^(#{1,6})\s+(.+)$/gm;
  const headings: Heading[] = [];
  let match;

  while ((match = headingRegex.exec(content)) !== null) {
    const level = match[1].length;
    const text = match[2].trim();
    const id = text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-');

    headings.push({ level, text, id });
  }

  return headings;
}

/**
 * Get title from content or filename
 */
function getTitleFromContent(content: string, filename: string): string {
  // Look for first H1
  const h1Match = content.match(/^#\s+(.+)$/m);
  if (h1Match) {
    return h1Match[1].trim();
  }

  // Fall back to filename
  return filename
    .replace('.md', '')
    .replace('index', 'Overview')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Get a single document by slug
 */
export function getDocBySlug(slug: string[]): DocContent | null {
  // Try public docs first
  let filePath = path.join(DOCS_PATH, 'public', ...slug) + '.md';

  // Check if it's a directory with index.md
  if (!fs.existsSync(filePath)) {
    filePath = path.join(DOCS_PATH, 'public', ...slug, 'index.md');
  }

  // Try roadmap docs
  if (!fs.existsSync(filePath)) {
    filePath = path.join(DOCS_PATH, 'roadmap', ...slug) + '.md';
  }

  if (!fs.existsSync(filePath)) {
    filePath = path.join(DOCS_PATH, 'roadmap', ...slug, 'index.md');
  }

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const fileContent = fs.readFileSync(filePath, 'utf8');
  const { data, content } = matter(fileContent);

  const title = data.title || getTitleFromContent(content, path.basename(filePath));
  const headings = extractHeadings(content);

  // Extract last updated from content
  const lastUpdatedMatch = content.match(/\*Last updated:\s*([^*]+)\*/i);
  const lastUpdated = data.lastUpdated || lastUpdatedMatch?.[1]?.trim();

  return {
    title,
    description: data.description,
    slug: slug.join('/'),
    path: filePath,
    content,
    headings,
    lastUpdated,
    order: data.order,
  };
}

/**
 * Get all documentation paths for static generation
 */
export function getAllDocPaths(): string[][] {
  const publicDocs = getMarkdownFiles(path.join(DOCS_PATH, 'public'));
  const roadmapDocs = getMarkdownFiles(path.join(DOCS_PATH, 'roadmap'));

  const paths: string[][] = [];

  for (const doc of publicDocs) {
    const slug = doc
      .replace('.md', '')
      .replace('/index', '')
      .split('/')
      .filter(Boolean);

    if (slug.length > 0) {
      paths.push(slug);
    }
  }

  // Add roadmap paths with prefix
  for (const doc of roadmapDocs) {
    const slug = doc
      .replace('.md', '')
      .replace('/index', '')
      .split('/')
      .filter(Boolean);

    if (slug.length > 0 && slug[0] !== 'index') {
      paths.push(slug);
    }
  }

  return paths;
}

/**
 * Build navigation structure from docs
 */
export function getNavigation(): NavItem[] {
  const nav: NavItem[] = [];

  // Getting Started
  const gettingStarted: NavItem = {
    title: 'Getting Started',
    href: '/docs/getting-started',
    icon: 'rocket',
    children: [],
  };

  const gsPath = path.join(DOCS_PATH, 'public/getting-started');
  if (fs.existsSync(gsPath)) {
    const files = fs.readdirSync(gsPath).filter(f => f.endsWith('.md'));
    for (const file of files) {
      if (file === 'index.md') continue;
      const slug = file.replace('.md', '');
      const content = fs.readFileSync(path.join(gsPath, file), 'utf8');
      const title = getTitleFromContent(content, file);
      gettingStarted.children?.push({
        title,
        href: `/docs/getting-started/${slug}`,
      });
    }
  }
  nav.push(gettingStarted);

  // Features
  const features: NavItem = {
    title: 'Features',
    href: '/docs/features',
    icon: 'layers',
    children: [],
  };

  const featuresPath = path.join(DOCS_PATH, 'public/features');
  if (fs.existsSync(featuresPath)) {
    const dirs = fs.readdirSync(featuresPath, { withFileTypes: true });
    for (const dir of dirs) {
      if (dir.isDirectory()) {
        const indexPath = path.join(featuresPath, dir.name, 'index.md');
        if (fs.existsSync(indexPath)) {
          const content = fs.readFileSync(indexPath, 'utf8');
          const title = getTitleFromContent(content, dir.name);
          const subNav: NavItem = {
            title,
            href: `/docs/features/${dir.name}`,
            children: [],
          };

          // Get sub-pages
          const subFiles = fs.readdirSync(path.join(featuresPath, dir.name))
            .filter(f => f.endsWith('.md') && f !== 'index.md');

          for (const subFile of subFiles) {
            const subSlug = subFile.replace('.md', '');
            const subContent = fs.readFileSync(
              path.join(featuresPath, dir.name, subFile),
              'utf8'
            );
            const subTitle = getTitleFromContent(subContent, subFile);
            subNav.children?.push({
              title: subTitle,
              href: `/docs/features/${dir.name}/${subSlug}`,
            });
          }

          features.children?.push(subNav);
        }
      }
    }
  }
  nav.push(features);

  // Reference
  const reference: NavItem = {
    title: 'Reference',
    href: '/docs/reference',
    icon: 'book',
    children: [],
  };

  const refPath = path.join(DOCS_PATH, 'public/reference');
  if (fs.existsSync(refPath)) {
    const files = fs.readdirSync(refPath).filter(f => f.endsWith('.md'));
    for (const file of files) {
      const slug = file.replace('.md', '');
      const content = fs.readFileSync(path.join(refPath, file), 'utf8');
      const title = getTitleFromContent(content, file);
      reference.children?.push({
        title,
        href: `/docs/reference/${slug}`,
      });
    }
  }
  nav.push(reference);

  return nav;
}

/**
 * Get roadmap items parsed from markdown
 */
export interface RoadmapItem {
  title: string;
  description?: string;
  status: 'complete' | 'in-progress' | 'planned' | 'considering';
  category?: string;
  link?: string;
}

export interface RoadmapColumn {
  title: string;
  items: RoadmapItem[];
}

export function getRoadmapLastUpdated(): string {
  const roadmapPath = path.join(DOCS_PATH, 'roadmap/index.md');

  if (!fs.existsSync(roadmapPath)) {
    return 'Unknown';
  }

  const content = fs.readFileSync(roadmapPath, 'utf8');
  const match = content.match(/\*\*Last Updated:\*\*\s*([^\n|]+)/);
  return match ? match[1].trim() : 'Unknown';
}

export function getRoadmapData(): RoadmapColumn[] {
  const roadmapPath = path.join(DOCS_PATH, 'roadmap/index.md');

  if (!fs.existsSync(roadmapPath)) {
    return [];
  }

  const content = fs.readFileSync(roadmapPath, 'utf8');
  const columns: RoadmapColumn[] = [];

  // Parse Shipped section
  const shippedMatch = content.match(/## Shipped\n\n([\s\S]*?)(?=\n## In Progress|$)/);
  if (shippedMatch) {
    columns.push({
      title: 'Shipped',
      items: parseRoadmapSectionNew(shippedMatch[1], 'complete'),
    });
  }

  // Parse In Progress section
  const inProgressMatch = content.match(/## In Progress\n\n([\s\S]*?)(?=\n## Planned|$)/);
  if (inProgressMatch) {
    columns.push({
      title: 'In Progress',
      items: parseRoadmapSectionNew(inProgressMatch[1], 'in-progress'),
    });
  }

  // Parse Planned section
  const plannedMatch = content.match(/## Planned\n\n([\s\S]*?)(?=\n## Exploring|$)/);
  if (plannedMatch) {
    columns.push({
      title: 'Planned',
      items: parseRoadmapSectionNew(plannedMatch[1], 'planned'),
    });
  }

  // Parse Exploring section
  const exploringMatch = content.match(/## Exploring\n\n([\s\S]*?)(?=\n## Not Planned|$)/);
  if (exploringMatch) {
    columns.push({
      title: 'Exploring',
      items: parseRoadmapSectionNew(exploringMatch[1], 'considering'),
    });
  }

  return columns;
}

function parseRoadmapSection(content: string): RoadmapItem[] {
  const items: RoadmapItem[] = [];

  // Match items like "### Feature Name 🚧" or "### Feature Name 📋"
  const itemRegex = /###\s+(.+?)\s*(✅|🚧|📋|💡)?\n([\s\S]*?)(?=###|$)/g;
  let match;

  while ((match = itemRegex.exec(content)) !== null) {
    const title = match[1].trim();
    const statusIcon = match[2];
    const description = match[3]
      .split('\n')
      .filter(line => line.trim().startsWith('-'))
      .map(line => line.replace(/^-\s*/, '').trim())
      .join('. ');

    let status: RoadmapItem['status'] = 'planned';
    if (statusIcon === '✅') status = 'complete';
    else if (statusIcon === '🚧') status = 'in-progress';
    else if (statusIcon === '📋') status = 'planned';
    else if (statusIcon === '💡') status = 'considering';

    items.push({
      title,
      description: description || undefined,
      status,
    });
  }

  return items;
}

function parseRoadmapSectionNew(content: string, defaultStatus: RoadmapItem['status']): RoadmapItem[] {
  const items: RoadmapItem[] = [];

  // Match items like "### Feature Name" followed by metadata and bullet points
  const itemRegex = /###\s+(.+?)\n([\s\S]*?)(?=###|$)/g;
  let match;

  while ((match = itemRegex.exec(content)) !== null) {
    const title = match[1].trim();
    const bodyContent = match[2];

    // Extract category
    const categoryMatch = bodyContent.match(/\*\*Category:\*\*\s*([^\n]+)/);
    const category = categoryMatch ? categoryMatch[1].trim() : undefined;

    // Extract description from bullet points (skip metadata lines)
    const description = bodyContent
      .split('\n')
      .filter(line => line.trim().startsWith('-') && !line.includes('**'))
      .map(line => line.replace(/^-\s*/, '').trim())
      .slice(0, 3)
      .join('. ');

    items.push({
      title,
      description: description || undefined,
      status: defaultStatus,
      category,
    });
  }

  return items;
}

/**
 * Get changelog entries
 */
export interface ChangelogEntry {
  version: string;
  date: string;
  changes: {
    type: 'added' | 'changed' | 'fixed' | 'removed' | 'deprecated' | 'security';
    items: string[];
  }[];
}

export function getChangelog(): ChangelogEntry[] {
  const changelogPath = path.join(DOCS_PATH, 'roadmap/changelog.md');

  if (!fs.existsSync(changelogPath)) {
    return [];
  }

  const content = fs.readFileSync(changelogPath, 'utf8');
  const entries: ChangelogEntry[] = [];

  // Match version headers like "## [0.3.0] - 2026-01-07"
  const versionRegex = /## \[([^\]]+)\] - (\d{4}-\d{2}-\d{2})([\s\S]*?)(?=## \[|$)/g;
  let match;

  while ((match = versionRegex.exec(content)) !== null) {
    const version = match[1];
    const date = match[2];
    const sectionContent = match[3];

    const changes: ChangelogEntry['changes'] = [];

    // Parse each change type
    const typeRegex = /### (Added|Changed|Fixed|Removed|Deprecated|Security)\n([\s\S]*?)(?=###|$)/gi;
    let typeMatch;

    while ((typeMatch = typeRegex.exec(sectionContent)) !== null) {
      const type = typeMatch[1].toLowerCase() as ChangelogEntry['changes'][0]['type'];
      const items = typeMatch[2]
        .split('\n')
        .filter(line => line.trim().startsWith('-'))
        .map(line => line.replace(/^-\s*/, '').trim());

      if (items.length > 0) {
        changes.push({ type, items });
      }
    }

    entries.push({ version, date, changes });
  }

  return entries;
}

/**
 * Get backlog items
 */
export interface BacklogItem {
  id: string;
  description: string;
  severity?: string;
  priority?: string;
  status: string;
  category: 'issue' | 'enhancement' | 'feature';
}

export function getBacklog(): { issues: BacklogItem[]; enhancements: BacklogItem[]; features: BacklogItem[] } {
  const backlogPath = path.join(DOCS_PATH, 'roadmap/backlog.md');

  if (!fs.existsSync(backlogPath)) {
    return { issues: [], enhancements: [], features: [] };
  }

  const content = fs.readFileSync(backlogPath, 'utf8');

  // Parse tables from markdown
  const parseTable = (section: string, category: BacklogItem['category']): BacklogItem[] => {
    const items: BacklogItem[] = [];
    const rows = section.split('\n').filter(line => line.startsWith('|') && !line.includes('---'));

    // Skip header row
    for (let i = 1; i < rows.length; i++) {
      const cells = rows[i].split('|').map(c => c.trim()).filter(Boolean);
      if (cells.length >= 3) {
        items.push({
          id: cells[0],
          description: cells[1],
          severity: cells[2],
          priority: cells[3],
          status: cells[cells.length - 1],
          category,
        });
      }
    }

    return items;
  };

  // Find each section
  const issuesMatch = content.match(/## Known Issues([\s\S]*?)(?=## Enhancements|$)/);
  const enhancementsMatch = content.match(/## Enhancements([\s\S]*?)(?=## Feature Requests|$)/);
  const featuresMatch = content.match(/## Feature Requests([\s\S]*?)(?=## Recently|$)/);

  return {
    issues: issuesMatch ? parseTable(issuesMatch[1], 'issue') : [],
    enhancements: enhancementsMatch ? parseTable(enhancementsMatch[1], 'enhancement') : [],
    features: featuresMatch ? parseTable(featuresMatch[1], 'feature') : [],
  };
}

/**
 * Search through all docs
 */
export interface SearchResult {
  title: string;
  href: string;
  excerpt: string;
  category: string;
}

export function searchDocs(query: string): SearchResult[] {
  if (!query || query.length < 2) return [];

  const results: SearchResult[] = [];
  const lowerQuery = query.toLowerCase();

  const searchDir = (dir: string, category: string, baseHref: string) => {
    if (!fs.existsSync(dir)) return;

    const files = getMarkdownFiles(dir);

    for (const file of files) {
      const filePath = path.join(dir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const lowerContent = content.toLowerCase();

      if (lowerContent.includes(lowerQuery)) {
        const title = getTitleFromContent(content, path.basename(file));
        const slug = file.replace('.md', '').replace('/index', '');

        // Find excerpt around match
        const matchIndex = lowerContent.indexOf(lowerQuery);
        const start = Math.max(0, matchIndex - 50);
        const end = Math.min(content.length, matchIndex + query.length + 100);
        let excerpt = content.slice(start, end).replace(/\n/g, ' ').trim();
        if (start > 0) excerpt = '...' + excerpt;
        if (end < content.length) excerpt = excerpt + '...';

        results.push({
          title,
          href: `${baseHref}/${slug}`,
          excerpt,
          category,
        });
      }
    }
  };

  searchDir(path.join(DOCS_PATH, 'public/getting-started'), 'Getting Started', '/docs/getting-started');
  searchDir(path.join(DOCS_PATH, 'public/features'), 'Features', '/docs/features');
  searchDir(path.join(DOCS_PATH, 'public/reference'), 'Reference', '/docs/reference');
  searchDir(path.join(DOCS_PATH, 'roadmap'), 'Roadmap', '/roadmap');

  return results.slice(0, 10);
}
