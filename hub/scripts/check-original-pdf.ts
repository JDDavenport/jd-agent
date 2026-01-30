#!/usr/bin/env bun
import * as fs from 'fs';

async function checkOriginalPDF() {
  // Check the original "Searchable" PDF
  const pdfPath = '/Users/jddavenport/Projects/JD Agent/hub/storage/read-help/books/bf889019-dd5d-4a58-96f2-3b4e6204c7b2/original.pdf';

  console.log('Checking original "Searchable" PDF for text...\n');

  const buffer = fs.readFileSync(pdfPath);
  const pdfParseModule = await import('pdf-parse');
  const pdfParse = (pdfParseModule as any).default || pdfParseModule;
  const pdfData = await pdfParse(buffer);

  console.log(`Pages: ${pdfData.numpages}`);
  console.log(`Total text length: ${pdfData.text.length}`);
  console.log(`Word count: ${pdfData.text.split(/\s+/).filter(w => w.length > 0).length}`);
  console.log(`Words per page: ${(pdfData.text.split(/\s+/).filter(w => w.length > 0).length / pdfData.numpages).toFixed(1)}`);
  console.log(`\nFirst 1000 characters:\n${pdfData.text.slice(0, 1000)}`);

  // Check for "Harvard Business School" and case numbers
  const hasHBS = pdfData.text.includes('Harvard Business School');
  const caseNumbers = pdfData.text.match(/\b\d{1,2}-\d{2,3}-\d{1,3}\b/g);

  console.log(`\n\nHas "Harvard Business School": ${hasHBS}`);
  console.log(`Case numbers found: ${caseNumbers ? caseNumbers.length : 0}`);
  if (caseNumbers) {
    console.log(`Sample case numbers: ${caseNumbers.slice(0, 5).join(', ')}`);
  }
}

checkOriginalPDF();
