const pdfParse = require('pdf-parse');
const fs = require('fs');

// Version 2: More relaxed validation but still filters duplicates
function detectBusinessCases(lines) {
  const cases = [];
  const seenCaseNumbers = new Set();

  // Strict pattern: must be on its own line in HBS format (9-XXX-XXX)
  const caseNumberPattern = /^9-\d{2,3}-\d{1,3}$/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Must match the exact HBS case number format on its own line
    if (!caseNumberPattern.test(line)) {
      continue;
    }

    const caseNumber = line;

    // Skip if we've already seen this case number (avoid duplicates from headers/footers)
    if (seenCaseNumbers.has(caseNumber)) {
      console.log(`  [SKIP] ${caseNumber} at line ${i} - duplicate`);
      continue;
    }

    // Look backwards for HBS header (search further back - up to 10 lines)
    let hasHBSHeader = false;
    let hasREVMarker = false;

    for (let j = Math.max(0, i - 10); j < i; j++) {
      const prevLine = lines[j];
      if (prevLine.includes('HARVARD BUSINESS SCHOOL') || prevLine.includes('Harvard Business School')) {
        hasHBSHeader = true;
      }
      if (prevLine.includes('REV:') || prevLine.includes('Rev.')) {
        hasREVMarker = true;
      }
    }

    // Look forward for more context
    let hasAuthorOrTitle = false;
    for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
      const nextLine = lines[j].trim();
      // If we see substantive content (longer lines), it's likely a real case
      if (nextLine.length > 15 && !nextLine.startsWith('Only for') && !nextLine.startsWith('Copyright')) {
        hasAuthorOrTitle = true;
        break;
      }
    }

    // A valid case start should have either:
    // 1. HBS header above, OR
    // 2. Author/title content below (indicating start of case)
    if (!hasHBSHeader && !hasAuthorOrTitle) {
      console.log(`  [SKIP] ${caseNumber} at line ${i} - no HBS header or content found`);
      continue;
    }

    // Look for the case title
    let title = 'Untitled Case';
    const publisher = 'Harvard Business School';

    // Title is usually 2-6 lines after the case number, after author names
    for (let j = i + 1; j < Math.min(i + 20, lines.length); j++) {
      const titleCandidate = lines[j].trim();

      // Skip metadata, author names (usually all caps), dates
      if (titleCandidate.length === 0 ||
          titleCandidate.length < 5 ||
          /^\d+$/.test(titleCandidate) || // Just numbers
          /^(Rev\.|REV:|Revised|Copyright|Only for|PKT\d+)/.test(titleCandidate) || // Metadata
          titleCandidate.includes('SEPTEMBER') ||
          titleCandidate.includes('NOVEMBER') ||
          titleCandidate.includes('DECEMBER') ||
          titleCandidate.includes('JANUARY') ||
          titleCandidate.includes('FEBRUARY') ||
          titleCandidate.includes('MARCH') ||
          titleCandidate.includes('APRIL') ||
          titleCandidate.includes('MAY') ||
          titleCandidate.includes('JUNE') ||
          titleCandidate.includes('JULY') ||
          titleCandidate.includes('AUGUST') ||
          titleCandidate.includes('OCTOBER') ||
          titleCandidate.includes('BYU in MBA')
      ) {
        continue;
      }

      // Skip lines that are all uppercase and short (likely author names)
      const isAllCaps = titleCandidate === titleCandidate.toUpperCase() &&
                       titleCandidate.length < 40 &&
                       !titleCandidate.includes(':');

      if (isAllCaps) {
        continue; // Skip author names
      }

      // Found a good title candidate
      if (titleCandidate.length >= 5 && titleCandidate.length <= 100) {
        title = titleCandidate;
        break;
      }
    }

    // Add this case
    seenCaseNumbers.add(caseNumber);
    cases.push({
      lineNum: i,
      caseNumber,
      title,
      publisher,
    });

    console.log(`  [FOUND] ${caseNumber} at line ${i}: "${title}"`);
  }

  return cases;
}

// Test the detection
const pdfPath = 'storage/read-help/books/bf889019-dd5d-4a58-96f2-3b4e6204c7b2/original.pdf';
const buffer = fs.readFileSync(pdfPath);

pdfParse(buffer).then(data => {
  const lines = data.text.split('\n');

  console.log('='.repeat(80));
  console.log('TESTING IMPROVED V2 BUSINESS CASE DETECTION');
  console.log('='.repeat(80));
  console.log(`Total lines in PDF: ${lines.length}\n`);

  const cases = detectBusinessCases(lines);

  console.log('\n' + '='.repeat(80));
  console.log(`DETECTED ${cases.length} BUSINESS CASES`);
  console.log('='.repeat(80));

  for (let i = 0; i < cases.length; i++) {
    console.log(`\n${i + 1}. ${cases[i].caseNumber}: ${cases[i].title}`);
  }

  // Verify we can find key cases
  console.log('\n' + '='.repeat(80));
  console.log('VERIFICATION');
  console.log('='.repeat(80));

  const searchTerms = ['ryanair', 'a2 milk', 'netflix', 'ducati', 'aldi', 'freemark', 'cola wars', 'disney', 'uber'];

  for (const term of searchTerms) {
    const found = cases.find(c => c.title.toLowerCase().includes(term));
    if (found) {
      console.log(`✓ ${term.toUpperCase()}: ${found.caseNumber} - ${found.title}`);
    } else {
      console.log(`✗ ${term.toUpperCase()}: NOT FOUND`);
    }
  }
});
