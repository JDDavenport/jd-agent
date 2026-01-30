const pdfParse = require('pdf-parse');
const fs = require('fs');

// Simulate the improved detectBusinessCases method
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
      continue;
    }

    // Look backwards to confirm this is a case start (should have "HARVARD BUSINESS SCHOOL" nearby)
    let isValidCaseStart = false;
    for (let j = Math.max(0, i - 5); j < i; j++) {
      if (lines[j].includes('HARVARD BUSINESS SCHOOL') || lines[j].includes('Harvard Business School')) {
        isValidCaseStart = true;
        break;
      }
    }

    // If no HBS header found above, skip this (it's likely a page header/footer)
    if (!isValidCaseStart) {
      console.log(`  [SKIP] ${caseNumber} at line ${i} - no HBS header found nearby`);
      continue;
    }

    // Look for the case title in lines after the case number
    let title = 'Untitled Case';
    const publisher = 'Harvard Business School';

    for (let j = i + 1; j < Math.min(i + 15, lines.length); j++) {
      const titleCandidate = lines[j].trim();

      // Skip empty lines, dates, author names, and metadata
      if (titleCandidate.length === 0 ||
          titleCandidate.length < 3 ||
          /^\d+$/.test(titleCandidate) || // Just numbers
          /^(Rev\.|REV:|Revised|Copyright|Only for|PKT\d+)/.test(titleCandidate) || // Metadata
          /^[A-Z\s]{2,50}$/.test(titleCandidate) && titleCandidate.split(' ').length <= 4 || // Author names (all caps, short)
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
          titleCandidate.includes('OCTOBER')
      ) {
        continue;
      }

      // Found a candidate title - use it
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
  }

  return cases;
}

// Test the detection
const pdfPath = 'storage/read-help/books/bf889019-dd5d-4a58-96f2-3b4e6204c7b2/original.pdf';
const buffer = fs.readFileSync(pdfPath);

pdfParse(buffer).then(data => {
  const lines = data.text.split('\n');

  console.log('='.repeat(80));
  console.log('TESTING IMPROVED BUSINESS CASE DETECTION');
  console.log('='.repeat(80));
  console.log(`Total lines in PDF: ${lines.length}\n`);

  const cases = detectBusinessCases(lines);

  console.log('\n' + '='.repeat(80));
  console.log(`DETECTED ${cases.length} BUSINESS CASES`);
  console.log('='.repeat(80));

  for (let i = 0; i < cases.length; i++) {
    console.log(`\n[Case ${i + 1}]`);
    console.log(`  Number: ${cases[i].caseNumber}`);
    console.log(`  Title: ${cases[i].title}`);
    console.log(`  Publisher: ${cases[i].publisher}`);
    console.log(`  Line: ${cases[i].lineNum}`);
  }

  // Verify we can find "Ryanair"
  console.log('\n' + '='.repeat(80));
  console.log('SEARCHING FOR "RYANAIR"...');
  console.log('='.repeat(80));
  const ryanairCase = cases.find(c => c.title.toLowerCase().includes('ryanair'));
  if (ryanairCase) {
    console.log(`\n✓ FOUND: ${ryanairCase.caseNumber} - ${ryanairCase.title}`);
  } else {
    console.log(`\n✗ NOT FOUND in case titles`);
    // Search in content
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes('ryanair') && lines[i].toLowerCase().includes('dogfight')) {
        console.log(`  Found at line ${i}: ${lines[i].substring(0, 100)}`);
        break;
      }
    }
  }
});
