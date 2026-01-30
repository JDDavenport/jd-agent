/**
 * Ad Exchange Payment Service
 */

import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { adPayments, adSpaces, advertiserAllocations } from '../db/schema';
import { adExchangeAuditService } from './ad-exchange-audit-service';
import { encryptAddress, hashAddress, maskAddress, shouldStorePlaintext } from './ad-exchange-address-crypto';
import { adExchangeWalletService } from './ad-exchange-wallet-service';

export interface CreatePaymentInput {
  paymentType: 'ad_space_ownership' | 'ad_space_weekly_fee' | 'allocation_acquisition' | 'allocation_weekly_fee';
  adSpaceId?: string;
  allocationId?: string;
  payerAddress: string;
  amount: number;
  transactionHash?: string;
  status?: 'pending' | 'completed' | 'failed' | 'reverted';
  dueDate?: Date;
  paidAt?: Date;
}

class AdExchangePaymentService {
  async createPayment(input: CreatePaymentInput) {
    if (adExchangeWalletService.requiresMultisig(input.amount, input.paymentType)) {
      const multisigAddress = adExchangeWalletService.getMultisigAddress();
      if (!multisigAddress) {
        throw new Error('Multisig wallet not configured for high-value payment');
      }
      if (!adExchangeWalletService.validateMultisigTransaction(input.transactionHash)) {
        throw new Error('Multisig transaction hash required for high-value payment');
      }
    }

    const distribution = await this.computeRevenueDistribution(input);
    const now = new Date();
    const dueDate = input.dueDate ?? now;
    const storePlaintext = shouldStorePlaintext();
    const payerEncrypted = encryptAddress(input.payerAddress);
    const payerHash = hashAddress(input.payerAddress);

    const [payment] = await db
      .insert(adPayments)
      .values({
        paymentType: input.paymentType,
        adSpaceId: input.adSpaceId,
        allocationId: input.allocationId,
        payerAddress: storePlaintext ? input.payerAddress : maskAddress(input.payerAddress),
        payerAddressEncrypted: payerEncrypted,
        payerAddressHash: payerHash,
        amount: input.amount,
        transactionHash: input.transactionHash,
        revenueDistribution: distribution,
        status: input.status ?? 'completed',
        dueDate,
        paidAt: input.paidAt ?? now,
      })
      .returning();

    if (input.paymentType === 'ad_space_weekly_fee' && input.adSpaceId) {
      const nextDue = new Date(dueDate.getTime() + 7 * 24 * 60 * 60 * 1000);
      await db
        .update(adSpaces)
        .set({ lastPaymentAt: now, nextPaymentDue: nextDue })
        .where(eq(adSpaces.id, input.adSpaceId));
    }

    if (input.paymentType === 'allocation_weekly_fee' && input.allocationId) {
      const nextDue = new Date(dueDate.getTime() + 7 * 24 * 60 * 60 * 1000);
      await db
        .update(advertiserAllocations)
        .set({ lastPaymentAt: now, nextPaymentDue: nextDue })
        .where(eq(advertiserAllocations.id, input.allocationId));
    }

    await adExchangeAuditService.log('payment', `Payment recorded: ${input.paymentType}`, {
      paymentId: payment.id,
      adSpaceId: input.adSpaceId,
      allocationId: input.allocationId,
      amount: input.amount,
      status: payment.status,
    });

    return payment;
  }

  private async computeRevenueDistribution(input: CreatePaymentInput) {
    let creatorShare = 0;
    let ownerShare = 1;
    let platformShare = 0;

    if (input.paymentType === 'ad_space_ownership' || input.paymentType === 'allocation_acquisition') {
      platformShare = 0.025;
    }

    if (input.paymentType === 'ad_space_weekly_fee' || input.paymentType === 'allocation_weekly_fee') {
      platformShare = 0.01;
    }

    if (input.adSpaceId) {
      const [space] = await db.select().from(adSpaces).where(eq(adSpaces.id, input.adSpaceId)).limit(1);
      if (space) {
        const percent =
          input.paymentType === 'ad_space_ownership' ? space.creatorSaleSharePercent : space.creatorFeeSharePercent;
        creatorShare = Math.max(0, Math.min(1, Number(percent) / 100));
        ownerShare = 1 - creatorShare - platformShare;
      }
    }

    if (!input.adSpaceId && input.allocationId) {
      const [allocation] = await db
        .select({ adSpaceId: advertiserAllocations.adSpaceId })
        .from(advertiserAllocations)
        .where(eq(advertiserAllocations.id, input.allocationId))
        .limit(1);

      if (allocation?.adSpaceId) {
        const [space] = await db.select().from(adSpaces).where(eq(adSpaces.id, allocation.adSpaceId)).limit(1);
        if (space) {
          const percent =
            input.paymentType === 'allocation_acquisition'
              ? space.creatorSaleSharePercent
              : space.creatorFeeSharePercent;
          creatorShare = Math.max(0, Math.min(1, Number(percent) / 100));
          ownerShare = 1 - creatorShare - platformShare;
        }
      }
    }

    return {
      ad_space_owner: Number(Math.max(0, ownerShare).toFixed(4)),
      creator: Number(creatorShare.toFixed(4)),
      platform: Number(platformShare.toFixed(4)),
    };
  }
}

export const adExchangePaymentService = new AdExchangePaymentService();
