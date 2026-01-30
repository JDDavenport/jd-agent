#!/usr/bin/env bun
import * as fs from 'fs';

async function checkPDFText() {
  const pdfPath = '/Users/jddavenport/Projects/JD Agent/hub/storage/remarkable/Cases_8f8aeced-05f4-4dbd-823a-5e28d6467f22.pdf';

  console.log('Checking PDF for embedded text...\n');

  const buffer = fs.readFileSync(pdfPath);
  const pdfParseModule = await import('pdf-parse');
  const pdfParse = (pdfParseModule as any).default || pdfParseModule;
  const pdfData = await pdfParse(buffer);

  console.log(`Pages: ${pdfData.numpages}`);
  console.log(`Total text length: ${pdfData.text.length}`);
  console.log(`Word count: ${pdfData.text.split(/\s+/).filter(w => w.length > 0).length}`);
  console.log(`Words per page: ${(pdfData.text.split(/\s+/).filter(w => w.length > 0).length / pdfData.numpages).toFixed(1)}`);
  console.log(`\nFirst 500 characters:\n${pdfData.text.slice(0, 500)}`);
  console.log(`\nLast 500 characters:\n${pdfData.text.slice(-500)}`);
}

checkPDFText();
