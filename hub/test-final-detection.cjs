const pdfParse = require('pdf-parse');
const fs = require('fs');

// Final version matching the service implementation
function detectBusinessCases(lines) {
  const cases = [];
  const seenCaseNumbers = new Set();

  const caseNumberPattern = /\b(\d{1,2}-\d{2,3}-\d{1,3})\b/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    const match = caseNumberPattern.exec(line);
    if (!match) {
      continue;
    }

    const caseNumber = match[1];

    if (seenCaseNumbers.has(caseNumber)) {
      continue;
    }

    let isValidCaseStart = false;

    // Format 1: "Harvard Business School X-XXX-XXX" on same line
    if (line.includes('Harvard Business School')) {
      isValidCaseStart = true;
    }
    // Format 2: Case number on its own line, with HBS header above
    else if (line === caseNumber) {
      for (let j = Math.max(0, i - 10); j < i; j++) {
        if (lines[j].includes('HARVARD BUSINESS SCHOOL') || lines[j].includes('Harvard Business School')) {
          isValidCaseStart = true;
          break;
        }
      }
      if (!isValidCaseStart) {
        for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
          const nextLine = lines[j].trim();
          if (nextLine.length > 15 && !nextLine.startsWith('Only for') && !nextLine.startsWith('Copyright')) {
            isValidCaseStart = true;
            break;
          }
        }
      }
    }

    if (!isValidCaseStart) {
      continue;
    }

    // Look for title
    let title = 'Untitled Case';
    const publisher = 'Harvard Business School';

    for (let j = i + 1; j < Math.min(i + 20, lines.length); j++) {
      const titleCandidate = lines[j].trim();

      if (titleCandidate.length === 0 ||
          titleCandidate.length < 5 ||
          /^\d+$/.test(titleCandidate) ||
          /^(Rev\.|REV:|Revised|;|Copyright|Only for|PKT\d+|Reprinted by)/.test(titleCandidate) ||
          titleCandidate.includes('SEPTEMBER') ||
          titleCandidate.includes('NOVEMBER') ||
          titleCandidate.includes('DECEMBER') ||
          titleCandidate.includes('JANUARY') ||
          titleCandidate.includes('FEBRUARY') ||
          titleCandidate.includes('MARCH') ||
          titleCandidate.includes('APRIL') ||
          titleCandidate.includes('MAY ') ||
          titleCandidate.includes('JUNE') ||
          titleCandidate.includes('JULY') ||
          titleCandidate.includes('AUGUST') ||
          titleCandidate.includes('OCTOBER') ||
          titleCandidate.includes('BYU in MBA')
      ) {
        continue;
      }

      const isAllCaps = titleCandidate === titleCandidate.toUpperCase() &&
                       titleCandidate.length < 40 &&
                       !titleCandidate.includes(':');

      if (isAllCaps) {
        continue;
      }

      if (titleCandidate.length >= 5 && titleCandidate.length <= 120) {
        title = titleCandidate;
        break;
      }
    }

    seenCaseNumbers.add(caseNumber);
    cases.push({
      lineNum: i,
      caseNumber,
      title,
      publisher,
    });
  }

  return cases;
}

// Test
const pdfPath = 'storage/read-help/books/bf889019-dd5d-4a58-96f2-3b4e6204c7b2/original.pdf';
const buffer = fs.readFileSync(pdfPath);

pdfParse(buffer).then(data => {
  const lines = data.text.split('\n');

  console.log('='.repeat(80));
  console.log('FINAL BUSINESS CASE DETECTION TEST');
  console.log('='.repeat(80));

  const cases = detectBusinessCases(lines);

  console.log(`\nDetected ${cases.length} cases:\n`);

  for (let i = 0; i < cases.length; i++) {
    console.log(`${i + 1}. [${cases[i].caseNumber}] ${cases[i].title}`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('SEARCH VERIFICATION');
  console.log('='.repeat(80));

  const expectedCases = [
    'ryanair',
    'a2 milk',
    'freemark',
    'netflix',
    'ducati',
    'aldi',
    'cola wars',
    'disney',
    'uber',
    'cirque'
  ];

  let foundCount = 0;
  for (const term of expectedCases) {
    const found = cases.find(c => c.title.toLowerCase().includes(term));
    if (found) {
      console.log(`✓ ${term.toUpperCase().padEnd(15)} → ${found.caseNumber}: ${found.title}`);
      foundCount++;
    } else {
      console.log(`✗ ${term.toUpperCase().padEnd(15)} → NOT FOUND`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log(`SUCCESS RATE: ${foundCount}/${expectedCases.length} expected cases found`);
  console.log('='.repeat(80));
});
