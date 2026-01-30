/**
 * Ad Exchange Marketplace Operations Service
 */

import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import {
  adSpaces,
  advertiserAllocations,
  marketListings,
  ownershipTransfers,
  adSpacePriceHistory,
} from '../db/schema';
import { adExchangePaymentService } from './ad-exchange-payment-service';
import { adExchangeAuditService } from './ad-exchange-audit-service';
import { encryptAddress, hashAddress, maskAddress, shouldStorePlaintext } from './ad-exchange-address-crypto';

export interface CreateListingInput {
  listingType: 'ad_space' | 'allocation';
  sellerAddress: string;
  askPrice: number;
  minPrice?: number;
  adSpaceId?: string;
  allocationId?: string;
  expiresAt?: Date;
}

export interface PurchaseListingInput {
  listingId: string;
  buyerAddress: string;
  purchasePrice: number;
  transactionHash?: string;
}

class AdExchangeMarketplaceService {
  async createListing(input: CreateListingInput) {
    if (input.listingType === 'ad_space' && input.adSpaceId) {
      const [space] = await db.select().from(adSpaces).where(eq(adSpaces.id, input.adSpaceId)).limit(1);
      if (!space) throw new Error('Ad space not found');
      if (Number(input.askPrice) < Number(space.currentReservePrice)) {
        throw new Error('Ask price below reserve price');
      }
    }

    const storePlaintext = shouldStorePlaintext();
    const sellerEncrypted = encryptAddress(input.sellerAddress);
    const sellerHash = hashAddress(input.sellerAddress);
    const [listing] = await db
      .insert(marketListings)
      .values({
        listingType: input.listingType,
        sellerAddress: storePlaintext ? input.sellerAddress : maskAddress(input.sellerAddress),
        sellerAddressEncrypted: sellerEncrypted,
        sellerAddressHash: sellerHash,
        askPrice: input.askPrice,
        minPrice: input.minPrice,
        adSpaceId: input.adSpaceId,
        allocationId: input.allocationId,
        status: 'active',
        expiresAt: input.expiresAt,
      })
      .returning();

    if (listing.listingType === 'ad_space' && listing.adSpaceId) {
      await db.insert(adSpacePriceHistory).values({
        adSpaceId: listing.adSpaceId,
        priceType: 'listing',
        price: listing.askPrice,
        metadata: { listingId: listing.id },
      });
    }

    await adExchangeAuditService.log('listing', `Listing created: ${listing.listingType}`, {
      listingId: listing.id,
      adSpaceId: listing.adSpaceId,
      allocationId: listing.allocationId,
      askPrice: listing.askPrice,
    });

    return listing;
  }

  async purchaseListing(input: PurchaseListingInput) {
    const [listing] = await db
      .select()
      .from(marketListings)
      .where(eq(marketListings.id, input.listingId))
      .limit(1);

    if (!listing) {
      throw new Error('Listing not found');
    }

    if (listing.status !== 'active') {
      throw new Error('Listing is not active');
    }

    if (listing.minPrice && input.purchasePrice < listing.minPrice) {
      throw new Error('Purchase price below minimum');
    }

    const now = new Date();

    if (listing.listingType === 'ad_space' && listing.adSpaceId) {
      const [adSpace] = await db.select().from(adSpaces).where(eq(adSpaces.id, listing.adSpaceId)).limit(1);
      if (!adSpace) throw new Error('Ad space not found');
      const buyerEncrypted = encryptAddress(input.buyerAddress);
      const buyerHash = hashAddress(input.buyerAddress);
      const prevEncrypted = adSpace.currentOwnerAddressEncrypted ?? encryptAddress(adSpace.currentOwnerAddress);
      const prevHash = adSpace.currentOwnerAddressHash ?? hashAddress(adSpace.currentOwnerAddress);
      const storePlaintext = shouldStorePlaintext();

      await db
        .update(adSpaces)
        .set({
          previousOwnerAddress: storePlaintext
            ? adSpace.currentOwnerAddress
            : maskAddress(adSpace.currentOwnerAddress),
          previousOwnerAddressEncrypted: prevEncrypted,
          previousOwnerAddressHash: prevHash,
          currentOwnerAddress: storePlaintext ? input.buyerAddress : maskAddress(input.buyerAddress),
          currentOwnerAddressEncrypted: buyerEncrypted,
          currentOwnerAddressHash: buyerHash,
          ownershipTransferPrice: input.purchasePrice,
          ownershipAcquiredAt: now,
        })
        .where(eq(adSpaces.id, listing.adSpaceId));

      await db.insert(ownershipTransfers).values({
        transferType: 'ad_space',
        adSpaceId: listing.adSpaceId,
        fromAddress: storePlaintext
          ? adSpace.currentOwnerAddress
          : maskAddress(adSpace.currentOwnerAddress),
        fromAddressEncrypted: prevEncrypted,
        fromAddressHash: prevHash,
        toAddress: storePlaintext ? input.buyerAddress : maskAddress(input.buyerAddress),
        toAddressEncrypted: buyerEncrypted,
        toAddressHash: buyerHash,
        transferPrice: input.purchasePrice,
        reason: 'sale',
        transactionHash: input.transactionHash,
      });

      await db.insert(adSpacePriceHistory).values({
        adSpaceId: listing.adSpaceId,
        priceType: 'transfer',
        price: input.purchasePrice,
        metadata: { listingId: listing.id },
      });

      await adExchangePaymentService.createPayment({
        paymentType: 'ad_space_ownership',
        adSpaceId: listing.adSpaceId,
        payerAddress: input.buyerAddress,
        amount: input.purchasePrice,
        transactionHash: input.transactionHash,
        status: 'completed',
        dueDate: now,
        paidAt: now,
      });

      await adExchangeAuditService.log('transfer', 'Ad space transfer completed', {
        adSpaceId: listing.adSpaceId,
        fromAddress: adSpace.currentOwnerAddress,
        toAddress: input.buyerAddress,
        price: input.purchasePrice,
      });
    }

    if (listing.listingType === 'allocation' && listing.allocationId) {
      const [allocation] = await db
        .select()
        .from(advertiserAllocations)
        .where(eq(advertiserAllocations.id, listing.allocationId))
        .limit(1);

      if (!allocation) throw new Error('Allocation not found');
      const buyerEncrypted = encryptAddress(input.buyerAddress);
      const buyerHash = hashAddress(input.buyerAddress);
      const prevEncrypted = allocation.currentOwnerAddressEncrypted ?? encryptAddress(allocation.currentOwnerAddress);
      const prevHash = allocation.currentOwnerAddressHash ?? hashAddress(allocation.currentOwnerAddress);
      const storePlaintext = shouldStorePlaintext();

      await db
        .update(advertiserAllocations)
        .set({
          previousOwnerAddress: storePlaintext
            ? allocation.currentOwnerAddress
            : maskAddress(allocation.currentOwnerAddress),
          previousOwnerAddressEncrypted: prevEncrypted,
          previousOwnerAddressHash: prevHash,
          currentOwnerAddress: storePlaintext ? input.buyerAddress : maskAddress(input.buyerAddress),
          currentOwnerAddressEncrypted: buyerEncrypted,
          currentOwnerAddressHash: buyerHash,
          acquisitionPrice: input.purchasePrice,
          allocationAcquiredAt: now,
        })
        .where(eq(advertiserAllocations.id, listing.allocationId));

      await db.insert(ownershipTransfers).values({
        transferType: 'allocation',
        allocationId: listing.allocationId,
        fromAddress: storePlaintext
          ? allocation.currentOwnerAddress
          : maskAddress(allocation.currentOwnerAddress),
        fromAddressEncrypted: prevEncrypted,
        fromAddressHash: prevHash,
        toAddress: storePlaintext ? input.buyerAddress : maskAddress(input.buyerAddress),
        toAddressEncrypted: buyerEncrypted,
        toAddressHash: buyerHash,
        transferPrice: input.purchasePrice,
        reason: 'sale',
        transactionHash: input.transactionHash,
      });

      await adExchangePaymentService.createPayment({
        paymentType: 'allocation_acquisition',
        allocationId: listing.allocationId,
        payerAddress: input.buyerAddress,
        amount: input.purchasePrice,
        transactionHash: input.transactionHash,
        status: 'completed',
        dueDate: now,
        paidAt: now,
      });

      await adExchangeAuditService.log('transfer', 'Allocation transfer completed', {
        allocationId: listing.allocationId,
        fromAddress: allocation.currentOwnerAddress,
        toAddress: input.buyerAddress,
        price: input.purchasePrice,
      });
    }

    const [updated] = await db
      .update(marketListings)
      .set({
        status: 'sold',
        soldAt: now,
      })
      .where(eq(marketListings.id, listing.id))
      .returning();

    return updated;
  }

  async createLiquidityListing(input: CreateListingInput) {
    return this.createListing({
      ...input,
      minPrice: input.minPrice ?? input.askPrice,
    });
  }
}

export const adExchangeMarketplaceService = new AdExchangeMarketplaceService();
