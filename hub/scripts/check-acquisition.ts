import { db } from '../src/db/client';
import { acquisitionLeads } from '../src/db/schema';

async function main() {
  const leads = await db.select().from(acquisitionLeads);
  console.log('Total leads:', leads.length);
  console.log('\nLeads:');
  leads.forEach(l => console.log(`- ${l.businessName} (${l.businessAge} yrs) - ${l.pipelineStage}`));
  process.exit(0);
}

main().catch(console.error);
