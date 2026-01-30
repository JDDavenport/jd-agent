/**
 * Ad Exchange Enforcement Service (Gadz.io)
 *
 * Handles weekly payment enforcement and contract state checks.
 * Initial implementation is read-only and returns a summary.
 */

import { and, lt, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { adPayments, adSpaces, advertiserAllocations, ownershipTransfers } from '../db/schema';
import { adExchangeAuditService } from './ad-exchange-audit-service';
import { encryptAddress, hashAddress, maskAddress, shouldStorePlaintext } from './ad-exchange-address-crypto';

export interface EnforcementSummary {
  checked: number;
  overdue: number;
  reverted: number;
}

class AdExchangeEnforcementService {
  async runWeeklyEnforcement(now: Date = new Date()): Promise<EnforcementSummary> {
    if (process.env.AD_EXCHANGE_ENFORCEMENT_DISABLED === 'true') {
      return { checked: 0, overdue: 0, reverted: 0 };
    }

    const graceHours = Number(process.env.AD_EXCHANGE_GRACE_HOURS || 48);
    const graceCutoff = new Date(now.getTime() - graceHours * 60 * 60 * 1000);

    const overduePayments = await db
      .select({ id: adPayments.id })
      .from(adPayments)
      .where(and(eq(adPayments.status, 'pending'), lt(adPayments.dueDate, graceCutoff)));

    let reverted = 0;

    for (const payment of overduePayments) {
      const [full] = await db.select().from(adPayments).where(eq(adPayments.id, payment.id)).limit(1);
      if (!full) continue;

      if (full.paymentType === 'ad_space_weekly_fee' && full.adSpaceId) {
        const [space] = await db.select().from(adSpaces).where(eq(adSpaces.id, full.adSpaceId)).limit(1);
        if (space?.previousOwnerAddress) {
          const storePlaintext = shouldStorePlaintext();
          const prevEncrypted = space.previousOwnerAddressEncrypted ?? encryptAddress(space.previousOwnerAddress);
          const currEncrypted = space.currentOwnerAddressEncrypted ?? encryptAddress(space.currentOwnerAddress);
          const prevHash = space.previousOwnerAddressHash ?? hashAddress(space.previousOwnerAddress);
          const currHash = space.currentOwnerAddressHash ?? hashAddress(space.currentOwnerAddress);
          await db
            .update(adSpaces)
            .set({
              currentOwnerAddress: storePlaintext
                ? space.previousOwnerAddress
                : maskAddress(space.previousOwnerAddress),
              currentOwnerAddressEncrypted: prevEncrypted,
              currentOwnerAddressHash: prevHash,
              previousOwnerAddress: storePlaintext
                ? space.currentOwnerAddress
                : maskAddress(space.currentOwnerAddress),
              previousOwnerAddressEncrypted: currEncrypted,
              previousOwnerAddressHash: currHash,
              ownershipAcquiredAt: now,
            })
            .where(eq(adSpaces.id, space.id));

          await db.insert(ownershipTransfers).values({
            transferType: 'ad_space',
            adSpaceId: space.id,
            fromAddress: storePlaintext ? space.currentOwnerAddress : maskAddress(space.currentOwnerAddress),
            fromAddressEncrypted: currEncrypted,
            fromAddressHash: currHash,
            toAddress: storePlaintext ? space.previousOwnerAddress : maskAddress(space.previousOwnerAddress),
            toAddressEncrypted: prevEncrypted,
            toAddressHash: prevHash,
            reason: 'non_payment_reversion',
          });

          reverted += 1;
          await adExchangeAuditService.log('enforcement', 'Ad space reverted for non-payment', {
            adSpaceId: space.id,
            paymentId: full.id,
          });
        } else {
          this.triggerDisputeWorkflow(full.id, 'ad_space');
        }
      }

      if (full.paymentType === 'allocation_weekly_fee' && full.allocationId) {
        const [allocation] = await db
          .select()
          .from(advertiserAllocations)
          .where(eq(advertiserAllocations.id, full.allocationId))
          .limit(1);
        if (allocation?.previousOwnerAddress) {
          const storePlaintext = shouldStorePlaintext();
          const prevEncrypted = allocation.previousOwnerAddressEncrypted ?? encryptAddress(allocation.previousOwnerAddress);
          const currEncrypted = allocation.currentOwnerAddressEncrypted ?? encryptAddress(allocation.currentOwnerAddress);
          const prevHash = allocation.previousOwnerAddressHash ?? hashAddress(allocation.previousOwnerAddress);
          const currHash = allocation.currentOwnerAddressHash ?? hashAddress(allocation.currentOwnerAddress);
          await db
            .update(advertiserAllocations)
            .set({
              currentOwnerAddress: storePlaintext
                ? allocation.previousOwnerAddress
                : maskAddress(allocation.previousOwnerAddress),
              currentOwnerAddressEncrypted: prevEncrypted,
              currentOwnerAddressHash: prevHash,
              previousOwnerAddress: storePlaintext
                ? allocation.currentOwnerAddress
                : maskAddress(allocation.currentOwnerAddress),
              previousOwnerAddressEncrypted: currEncrypted,
              previousOwnerAddressHash: currHash,
              allocationAcquiredAt: now,
            })
            .where(eq(advertiserAllocations.id, allocation.id));

          await db.insert(ownershipTransfers).values({
            transferType: 'allocation',
            allocationId: allocation.id,
            fromAddress: storePlaintext ? allocation.currentOwnerAddress : maskAddress(allocation.currentOwnerAddress),
            fromAddressEncrypted: currEncrypted,
            fromAddressHash: currHash,
            toAddress: storePlaintext ? allocation.previousOwnerAddress : maskAddress(allocation.previousOwnerAddress),
            toAddressEncrypted: prevEncrypted,
            toAddressHash: prevHash,
            reason: 'non_payment_reversion',
          });

          reverted += 1;
          await adExchangeAuditService.log('enforcement', 'Allocation reverted for non-payment', {
            allocationId: allocation.id,
            paymentId: full.id,
          });
        } else {
          this.triggerDisputeWorkflow(full.id, 'allocation');
        }
      }

      await db
        .update(adPayments)
        .set({ status: 'reverted' })
        .where(eq(adPayments.id, full.id));
    }

    return {
      checked: overduePayments.length,
      overdue: overduePayments.length,
      reverted,
    };
  }

  private triggerDisputeWorkflow(paymentId: string, contractType: 'ad_space' | 'allocation') {
    console.warn(
      `[Ad Exchange Enforcement] Dispute workflow triggered for ${contractType} payment ${paymentId}`
    );
  }
}

export const adExchangeEnforcementService = new AdExchangeEnforcementService();
