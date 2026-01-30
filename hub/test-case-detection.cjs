const pdfParse = require('pdf-parse');
const fs = require('fs');

const pdfPath = 'storage/read-help/books/bf889019-dd5d-4a58-96f2-3b4e6204c7b2/original.pdf';
const buffer = fs.readFileSync(pdfPath);

pdfParse(buffer).then(data => {
  const lines = data.text.split('\n');

  console.log('==== FINDING ALL CASE NUMBERS ====\n');

  const caseMatches = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Look for case number pattern: X-XXX-XXX or similar
    if (line.match(/^9-\d{2,3}-\d{1,3}$/) || line.match(/^\d{1,2}-\d{2,3}-\d{1,3}$/)) {
      console.log(`\n[CASE ${caseMatches.length + 1}] Line ${i}: ${line}`);

      // Look ahead for title
      for (let j = 1; j <= 15; j++) {
        if (i + j < lines.length) {
          console.log(`  +${j}: ${lines[i + j].substring(0, 100)}`);
        }
      }

      caseMatches.push({
        lineNum: i,
        caseNumber: line
      });
    }

    // Also look for "HARVARD BUSINESS SCHOOL" followed by case number
    if (line.match(/HARVARD BUSINESS SCHOOL/i)) {
      console.log(`\n[HBS HEADER] Line ${i}: ${line}`);
      for (let j = 1; j <= 10; j++) {
        if (i + j < lines.length) {
          console.log(`  +${j}: ${lines[i + j].substring(0, 100)}`);
        }
      }
    }
  }

  console.log(`\n\n==== SUMMARY ====`);
  console.log(`Total lines in PDF: ${lines.length}`);
  console.log(`Case numbers found: ${caseMatches.length}`);
  console.log(`\nCase numbers: ${caseMatches.map(c => c.caseNumber).join(', ')}`);
});
