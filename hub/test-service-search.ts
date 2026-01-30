import { readHelpService } from './src/services/read-help-service';

async function testServiceSearch() {
  console.log('\n=== Testing ReadHelpService.search() ===\n');

  const bookId = 'bf889019-dd5d-4a58-96f2-3b4e6204c7b2';

  // Test 1: Search without book filter
  console.log('Test 1: Search for "ryanair" across all books...');
  const results1 = await readHelpService.search('ryanair', { limit: 10 });
  console.log(`  Results: ${results1.length}`);

  // Test 2: Search with book filter
  console.log('\nTest 2: Search for "ryanair" in specific book...');
  const results2 = await readHelpService.search('ryanair', { bookId, limit: 10 });
  console.log(`  Results: ${results2.length}`);

  // Test 3: Search for "milk"
  console.log('\nTest 3: Search for "milk"...');
  const results3 = await readHelpService.search('milk', { limit: 10 });
  console.log(`  Results: ${results3.length}`);

  if (results3.length > 0) {
    console.log(`\n  First result:`);
    console.log(`    Book: ${results3[0].bookTitle}`);
    console.log(`    Chapter: ${results3[0].chapterTitle}`);
    console.log(`    Preview: ${results3[0].content.substring(0, 100)}...`);
  }

  process.exit(0);
}

testServiceSearch();
