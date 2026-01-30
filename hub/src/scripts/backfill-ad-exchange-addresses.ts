/**
 * Backfill encrypted ad exchange addresses.
 */

import { db } from '../db/client';
import {
  adSpaces,
  advertiserAllocations,
  adPayments,
  ownershipTransfers,
  marketListings,
} from '../db/schema';
import { eq } from 'drizzle-orm';
import {
  encryptAddress,
  hashAddress,
  isAdExchangeEncryptionEnabled,
  maskAddress,
  shouldStorePlaintext,
} from '../services/ad-exchange-address-crypto';

async function backfillAdSpaces() {
  const rows = await db
    .select({
      id: adSpaces.id,
      creatorAddress: adSpaces.creatorAddress,
      creatorAddressEncrypted: adSpaces.creatorAddressEncrypted,
      currentOwnerAddress: adSpaces.currentOwnerAddress,
      currentOwnerAddressEncrypted: adSpaces.currentOwnerAddressEncrypted,
      previousOwnerAddress: adSpaces.previousOwnerAddress,
      previousOwnerAddressEncrypted: adSpaces.previousOwnerAddressEncrypted,
    })
    .from(adSpaces);

  const storePlaintext = shouldStorePlaintext();

  for (const row of rows) {
    const updates: Partial<typeof adSpaces.$inferInsert> = {};

    if (!row.creatorAddressEncrypted) {
      updates.creatorAddressEncrypted = encryptAddress(row.creatorAddress);
    }
    if (!row.creatorAddressHash) {
      updates.creatorAddressHash = hashAddress(row.creatorAddress);
    }
    if (!row.currentOwnerAddressEncrypted) {
      updates.currentOwnerAddressEncrypted = encryptAddress(row.currentOwnerAddress);
    }
    if (!row.currentOwnerAddressHash) {
      updates.currentOwnerAddressHash = hashAddress(row.currentOwnerAddress);
    }
    if (row.previousOwnerAddress && !row.previousOwnerAddressEncrypted) {
      updates.previousOwnerAddressEncrypted = encryptAddress(row.previousOwnerAddress);
    }
    if (row.previousOwnerAddress && !row.previousOwnerAddressHash) {
      updates.previousOwnerAddressHash = hashAddress(row.previousOwnerAddress);
    }

    if (!storePlaintext) {
      updates.creatorAddress = maskAddress(row.creatorAddress) ?? row.creatorAddress;
      updates.currentOwnerAddress = maskAddress(row.currentOwnerAddress) ?? row.currentOwnerAddress;
      updates.previousOwnerAddress = row.previousOwnerAddress
        ? maskAddress(row.previousOwnerAddress)
        : row.previousOwnerAddress;
    }

    if (Object.keys(updates).length > 0) {
      await db.update(adSpaces).set(updates).where(eq(adSpaces.id, row.id));
    }
  }
}

async function backfillAllocations() {
  const rows = await db
    .select({
      id: advertiserAllocations.id,
      currentOwnerAddress: advertiserAllocations.currentOwnerAddress,
      currentOwnerAddressEncrypted: advertiserAllocations.currentOwnerAddressEncrypted,
      previousOwnerAddress: advertiserAllocations.previousOwnerAddress,
      previousOwnerAddressEncrypted: advertiserAllocations.previousOwnerAddressEncrypted,
    })
    .from(advertiserAllocations);

  const storePlaintext = shouldStorePlaintext();

  for (const row of rows) {
    const updates: Partial<typeof advertiserAllocations.$inferInsert> = {};

    if (!row.currentOwnerAddressEncrypted) {
      updates.currentOwnerAddressEncrypted = encryptAddress(row.currentOwnerAddress);
    }
    if (!row.currentOwnerAddressHash) {
      updates.currentOwnerAddressHash = hashAddress(row.currentOwnerAddress);
    }
    if (row.previousOwnerAddress && !row.previousOwnerAddressEncrypted) {
      updates.previousOwnerAddressEncrypted = encryptAddress(row.previousOwnerAddress);
    }
    if (row.previousOwnerAddress && !row.previousOwnerAddressHash) {
      updates.previousOwnerAddressHash = hashAddress(row.previousOwnerAddress);
    }

    if (!storePlaintext) {
      updates.currentOwnerAddress = maskAddress(row.currentOwnerAddress) ?? row.currentOwnerAddress;
      updates.previousOwnerAddress = row.previousOwnerAddress
        ? maskAddress(row.previousOwnerAddress)
        : row.previousOwnerAddress;
    }

    if (Object.keys(updates).length > 0) {
      await db.update(advertiserAllocations).set(updates).where(eq(advertiserAllocations.id, row.id));
    }
  }
}

async function backfillPayments() {
  const rows = await db
    .select({
      id: adPayments.id,
      payerAddress: adPayments.payerAddress,
      payerAddressEncrypted: adPayments.payerAddressEncrypted,
    })
    .from(adPayments);

  const storePlaintext = shouldStorePlaintext();

  for (const row of rows) {
    const updates: Partial<typeof adPayments.$inferInsert> = {};

    if (!row.payerAddressEncrypted) {
      updates.payerAddressEncrypted = encryptAddress(row.payerAddress);
    }
    if (!row.payerAddressHash) {
      updates.payerAddressHash = hashAddress(row.payerAddress);
    }

    if (!storePlaintext) {
      updates.payerAddress = maskAddress(row.payerAddress) ?? row.payerAddress;
    }

    if (Object.keys(updates).length > 0) {
      await db.update(adPayments).set(updates).where(eq(adPayments.id, row.id));
    }
  }
}

async function backfillTransfers() {
  const rows = await db
    .select({
      id: ownershipTransfers.id,
      fromAddress: ownershipTransfers.fromAddress,
      fromAddressEncrypted: ownershipTransfers.fromAddressEncrypted,
      toAddress: ownershipTransfers.toAddress,
      toAddressEncrypted: ownershipTransfers.toAddressEncrypted,
    })
    .from(ownershipTransfers);

  const storePlaintext = shouldStorePlaintext();

  for (const row of rows) {
    const updates: Partial<typeof ownershipTransfers.$inferInsert> = {};

    if (!row.fromAddressEncrypted) {
      updates.fromAddressEncrypted = encryptAddress(row.fromAddress);
    }
    if (!row.fromAddressHash) {
      updates.fromAddressHash = hashAddress(row.fromAddress);
    }
    if (!row.toAddressEncrypted) {
      updates.toAddressEncrypted = encryptAddress(row.toAddress);
    }
    if (!row.toAddressHash) {
      updates.toAddressHash = hashAddress(row.toAddress);
    }

    if (!storePlaintext) {
      updates.fromAddress = maskAddress(row.fromAddress) ?? row.fromAddress;
      updates.toAddress = maskAddress(row.toAddress) ?? row.toAddress;
    }

    if (Object.keys(updates).length > 0) {
      await db.update(ownershipTransfers).set(updates).where(eq(ownershipTransfers.id, row.id));
    }
  }
}

async function backfillListings() {
  const rows = await db
    .select({
      id: marketListings.id,
      sellerAddress: marketListings.sellerAddress,
      sellerAddressEncrypted: marketListings.sellerAddressEncrypted,
    })
    .from(marketListings);

  const storePlaintext = shouldStorePlaintext();

  for (const row of rows) {
    const updates: Partial<typeof marketListings.$inferInsert> = {};

    if (!row.sellerAddressEncrypted) {
      updates.sellerAddressEncrypted = encryptAddress(row.sellerAddress);
    }
    if (!row.sellerAddressHash) {
      updates.sellerAddressHash = hashAddress(row.sellerAddress);
    }

    if (!storePlaintext) {
      updates.sellerAddress = maskAddress(row.sellerAddress) ?? row.sellerAddress;
    }

    if (Object.keys(updates).length > 0) {
      await db.update(marketListings).set(updates).where(eq(marketListings.id, row.id));
    }
  }
}

async function main() {
  if (!isAdExchangeEncryptionEnabled()) {
    console.error(
      '[Ad Exchange] Encryption is not enabled. Set ENCRYPTION_KEY and AD_EXCHANGE_ENCRYPTION_ENABLED.'
    );
    process.exit(1);
  }

  console.log('[Ad Exchange] Backfilling encrypted addresses...');
  await backfillAdSpaces();
  await backfillAllocations();
  await backfillPayments();
  await backfillTransfers();
  await backfillListings();
  console.log('[Ad Exchange] Backfill complete.');
  process.exit(0);
}

main().catch((error) => {
  console.error('[Ad Exchange] Backfill failed:', error);
  process.exit(1);
});
