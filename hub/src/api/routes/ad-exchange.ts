/**
 * Gadz.io Ad Exchange API Routes
 *
 * Endpoints for ad spaces and advertiser allocations.
 */

import { Hono } from 'hono';
import { db } from '../../db/client';
import {
  adSpaces,
  advertiserAllocations,
  adPayments,
  marketListings,
  ownershipTransfers,
  performanceMetrics,
  adSpacePriceHistory,
} from '../../db/schema';
import { and, desc, eq, ilike, sql, gte } from 'drizzle-orm';
import { adExchangePaymentService } from '../../services/ad-exchange-payment-service';
import { adExchangeMarketplaceService } from '../../services/ad-exchange-marketplace-service';
import { adExchangeAnalyticsService } from '../../services/ad-exchange-analytics-service';
import { adExchangeCreativeDeliveryService } from '../../services/ad-exchange-creative-delivery-service';
import { adExchangeMarketIntelligenceService } from '../../services/ad-exchange-market-intelligence-service';
import { adExchangeLiquidityService } from '../../services/ad-exchange-liquidity-service';
import {
  encryptAddress,
  hashAddress,
  maskAddress,
  resolveAddress,
  shouldStorePlaintext,
} from '../../services/ad-exchange-address-crypto';

const adExchangeRouter = new Hono();

const hydrateAdSpace = (space: typeof adSpaces.$inferSelect) => ({
  ...space,
  creatorAddress: resolveAddress(space.creatorAddress, space.creatorAddressEncrypted),
  currentOwnerAddress: resolveAddress(space.currentOwnerAddress, space.currentOwnerAddressEncrypted),
  previousOwnerAddress: resolveAddress(space.previousOwnerAddress, space.previousOwnerAddressEncrypted),
});

const hydrateAllocation = (allocation: typeof advertiserAllocations.$inferSelect) => ({
  ...allocation,
  currentOwnerAddress: resolveAddress(
    allocation.currentOwnerAddress,
    allocation.currentOwnerAddressEncrypted
  ),
  previousOwnerAddress: resolveAddress(
    allocation.previousOwnerAddress,
    allocation.previousOwnerAddressEncrypted
  ),
});

const hydratePayment = (payment: typeof adPayments.$inferSelect) => ({
  ...payment,
  payerAddress: resolveAddress(payment.payerAddress, payment.payerAddressEncrypted),
});

const hydrateTransfer = (transfer: typeof ownershipTransfers.$inferSelect) => ({
  ...transfer,
  fromAddress: resolveAddress(transfer.fromAddress, transfer.fromAddressEncrypted),
  toAddress: resolveAddress(transfer.toAddress, transfer.toAddressEncrypted),
});

const hydrateListing = (listing: typeof marketListings.$inferSelect) => ({
  ...listing,
  sellerAddress: resolveAddress(listing.sellerAddress, listing.sellerAddressEncrypted),
});

const parseBoolean = (value?: string) => {
  if (value === undefined) return undefined;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
};

const parseOptionalDate = (value?: string) => (value ? new Date(value) : undefined);
const adminToken = process.env.AD_EXCHANGE_ADMIN_TOKEN;

const rateLimits = new Map<string, { count: number; resetAt: number }>();

const enforceRateLimit = (c: { req: { header: (name: string) => string | undefined } }, limit = 30, windowMs = 60_000) => {
  const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';
  const now = Date.now();
  const record = rateLimits.get(ip);

  if (!record || record.resetAt <= now) {
    rateLimits.set(ip, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  if (record.count >= limit) {
    return { allowed: false, retryAfterMs: record.resetAt - now };
  }

  record.count += 1;
  return { allowed: true };
};

const requireAdmin = (c: { req: { header: (name: string) => string | undefined } }) => {
  if (!adminToken) return true;
  const token = c.req.header('x-admin-token');
  return token === adminToken;
};

const blocklist = ['porn', 'xxx', 'adult', 'sex'];
const isBlockedCreative = (urls: string[] = [], clickThroughUrl?: string) => {
  const values = [...urls, clickThroughUrl].filter(Boolean).join(' ').toLowerCase();
  return blocklist.some((word) => values.includes(word));
};

// ============================================
// Ad Spaces
// ============================================

adExchangeRouter.get('/ad-spaces', async (c) => {
  const limit = parseInt(c.req.query('limit') || '25', 10);
  const offset = parseInt(c.req.query('offset') || '0', 10);
  const search = c.req.query('search');
  const category = c.req.query('category');
  const isActive = parseBoolean(c.req.query('active'));
  const owner = c.req.query('owner');
  const creator = c.req.query('creator');

  try {
    const conditions = [];
    if (search) conditions.push(ilike(adSpaces.name, `%${search}%`));
    if (category) conditions.push(eq(adSpaces.category, category));
    if (isActive !== undefined) conditions.push(eq(adSpaces.isActive, isActive));
    if (owner) {
      const ownerHash = hashAddress(owner);
      if (ownerHash) conditions.push(eq(adSpaces.currentOwnerAddressHash, ownerHash));
    }
    if (creator) {
      const creatorHash = hashAddress(creator);
      if (creatorHash) conditions.push(eq(adSpaces.creatorAddressHash, creatorHash));
    }

    const data = await db
      .select()
      .from(adSpaces)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(adSpaces.createdAt))
      .limit(limit)
      .offset(offset);

    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(adSpaces)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const total = Number(countResult[0]?.count || 0);

    return c.json({
      success: true,
      data: data.map(hydrateAdSpace),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + data.length < total,
      },
    });
  } catch (error) {
    console.error('[Ad Exchange API] Error listing ad spaces:', error);
    return c.json(
      {
        success: false,
        error: { code: 'LIST_ERROR', message: String(error) },
      },
      500
    );
  }
});

adExchangeRouter.get('/ad-spaces/:id', async (c) => {
  const id = c.req.param('id');

  try {
    const [adSpace] = await db.select().from(adSpaces).where(eq(adSpaces.id, id)).limit(1);

    if (!adSpace) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Ad space not found' } },
        404
      );
    }

    const allocations = await db
      .select()
      .from(advertiserAllocations)
      .where(eq(advertiserAllocations.adSpaceId, id))
      .orderBy(desc(advertiserAllocations.createdAt));

    return c.json({
      success: true,
      data: { adSpace: hydrateAdSpace(adSpace), allocations: allocations.map(hydrateAllocation) },
    });
  } catch (error) {
    console.error('[Ad Exchange API] Error fetching ad space:', error);
    return c.json(
      { success: false, error: { code: 'FETCH_ERROR', message: String(error) } },
      500
    );
  }
});

adExchangeRouter.patch('/ad-spaces/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();

  try {
    const [current] = await db.select().from(adSpaces).where(eq(adSpaces.id, id)).limit(1);
    if (!current) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Ad space not found' } },
        404
      );
    }

    const updates = {
      name: body.name ?? current.name,
      description: body.description ?? current.description,
      category: body.category ?? current.category,
      tags: body.tags ?? current.tags,
      currentReservePrice:
        body.currentReservePrice !== undefined ? Number(body.currentReservePrice) : current.currentReservePrice,
      weeklyHoldingFee:
        body.weeklyHoldingFee !== undefined ? Number(body.weeklyHoldingFee) : current.weeklyHoldingFee,
      weeklyImpressions:
        body.weeklyImpressions !== undefined ? Number(body.weeklyImpressions) : current.weeklyImpressions,
      isActive: body.isActive ?? current.isActive,
      isAdultAllowed: body.isAdultAllowed ?? current.isAdultAllowed,
      customContractTerms: body.customContractTerms ?? current.customContractTerms,
    };

    const [updated] = await db.update(adSpaces).set(updates).where(eq(adSpaces.id, id)).returning();

    if (updates.currentReservePrice !== current.currentReservePrice) {
      await db.insert(adSpacePriceHistory).values({
        adSpaceId: id,
        priceType: 'reserve',
        price: updates.currentReservePrice,
      });
    }

    return c.json({ success: true, data: hydrateAdSpace(updated) });
  } catch (error) {
    console.error('[Ad Exchange API] Error updating ad space:', error);
    return c.json(
      { success: false, error: { code: 'UPDATE_ERROR', message: String(error) } },
      500
    );
  }
});

adExchangeRouter.get('/ad-spaces/:id/price-history', async (c) => {
  const id = c.req.param('id');
  try {
    const data = await db
      .select()
      .from(adSpacePriceHistory)
      .where(eq(adSpacePriceHistory.adSpaceId, id))
      .orderBy(desc(adSpacePriceHistory.recordedAt))
      .limit(120);

    return c.json({ success: true, data });
  } catch (error) {
    console.error('[Ad Exchange API] Error fetching price history:', error);
    return c.json(
      { success: false, error: { code: 'FETCH_ERROR', message: String(error) } },
      500
    );
  }
});

adExchangeRouter.post('/ad-spaces', async (c) => {
  const body = await c.req.json();
  const rate = enforceRateLimit(c, 10);
  if (!rate.allowed) {
    return c.json(
      { success: false, error: { code: 'RATE_LIMIT', message: 'Too many requests' } },
      429
    );
  }

  const required = [
    'name',
    'creatorAddress',
    'currentOwnerAddress',
    'weeklyImpressions',
    'currentReservePrice',
    'weeklyHoldingFee',
    'creatorSaleSharePercent',
    'creatorFeeSharePercent',
  ];

  for (const key of required) {
    if (body[key] === undefined || body[key] === null || body[key] === '') {
      return c.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `Missing ${key}` } },
        400
      );
    }
  }

  const weeklyImpressions = Number(body.weeklyImpressions);
  const currentReservePrice = Number(body.currentReservePrice);
  const weeklyHoldingFee = Number(body.weeklyHoldingFee);
  const creatorSaleSharePercent = Number(body.creatorSaleSharePercent);
  const creatorFeeSharePercent = Number(body.creatorFeeSharePercent);

  if (
    !Number.isFinite(weeklyImpressions) ||
    !Number.isFinite(currentReservePrice) ||
    !Number.isFinite(weeklyHoldingFee) ||
    !Number.isFinite(creatorSaleSharePercent) ||
    !Number.isFinite(creatorFeeSharePercent)
  ) {
    return c.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid numeric values' } },
      400
    );
  }

  try {
    const now = new Date();
    const defaultNextPayment = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const storePlaintext = shouldStorePlaintext();
    const creatorEncrypted = encryptAddress(body.creatorAddress);
    const creatorHash = hashAddress(body.creatorAddress);
    const ownerEncrypted = encryptAddress(body.currentOwnerAddress);
    const ownerHash = hashAddress(body.currentOwnerAddress);
    const previousEncrypted = encryptAddress(body.previousOwnerAddress);
    const previousHash = hashAddress(body.previousOwnerAddress);
    const [created] = await db
      .insert(adSpaces)
      .values({
        name: body.name,
        creatorAddress: storePlaintext ? body.creatorAddress : maskAddress(body.creatorAddress),
        creatorAddressEncrypted: creatorEncrypted,
        creatorAddressHash: creatorHash,
        currentOwnerAddress: storePlaintext ? body.currentOwnerAddress : maskAddress(body.currentOwnerAddress),
        currentOwnerAddressEncrypted: ownerEncrypted,
        currentOwnerAddressHash: ownerHash,
        previousOwnerAddress: storePlaintext ? body.previousOwnerAddress : maskAddress(body.previousOwnerAddress),
        previousOwnerAddressEncrypted: previousEncrypted,
        previousOwnerAddressHash: previousHash,
        weeklyImpressions,
        currentReservePrice,
        ownershipTransferPrice: body.ownershipTransferPrice ? Number(body.ownershipTransferPrice) : undefined,
        weeklyHoldingFee,
        creatorSaleSharePercent,
        creatorFeeSharePercent,
        customContractTerms: body.customContractTerms,
        description: body.description,
        category: body.category,
        tags: body.tags,
        isActive: body.isActive ?? true,
        isAdultAllowed: body.isAdultAllowed ?? false,
        ownershipAcquiredAt: parseOptionalDate(body.ownershipAcquiredAt),
        lastPaymentAt: parseOptionalDate(body.lastPaymentAt),
        nextPaymentDue: parseOptionalDate(body.nextPaymentDue) ?? defaultNextPayment,
      })
      .returning();

    return c.json({ success: true, data: hydrateAdSpace(created) }, 201);
  } catch (error) {
    console.error('[Ad Exchange API] Error creating ad space:', error);
    return c.json(
      { success: false, error: { code: 'CREATE_ERROR', message: String(error) } },
      500
    );
  }
});

// ============================================
// Allocations
// ============================================

adExchangeRouter.post('/ad-spaces/:id/allocations', async (c) => {
  const adSpaceId = c.req.param('id');
  const body = await c.req.json();
  const rate = enforceRateLimit(c, 20);
  if (!rate.allowed) {
    return c.json(
      { success: false, error: { code: 'RATE_LIMIT', message: 'Too many requests' } },
      429
    );
  }

  const required = ['currentOwnerAddress', 'allocationUnits', 'weeklyFee'];
  for (const key of required) {
    if (body[key] === undefined || body[key] === null || body[key] === '') {
      return c.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `Missing ${key}` } },
        400
      );
    }
  }

  const allocationUnits = Number(body.allocationUnits);
  const weeklyFee = Number(body.weeklyFee);
  if (!Number.isFinite(allocationUnits) || !Number.isFinite(weeklyFee)) {
    return c.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid numeric values' } },
      400
    );
  }

  if (allocationUnits < 1 || allocationUnits > 8) {
    return c.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'allocationUnits must be 1-8' } },
      400
    );
  }

  try {
    const [adSpace] = await db.select().from(adSpaces).where(eq(adSpaces.id, adSpaceId)).limit(1);
    if (!adSpace) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Ad space not found' } },
        404
      );
    }

    const creativeValidation = adExchangeCreativeDeliveryService.validateCreativeAssets(
      body.creativeAssetUrls,
      body.clickThroughUrl
    );
    if (!creativeValidation.valid) {
      return c.json(
        {
          success: false,
          error: {
            code: 'CREATIVE_INVALID',
            message: creativeValidation.reasons.join(' '),
          },
        },
        400
      );
    }

    if (isBlockedCreative(body.creativeAssetUrls, body.clickThroughUrl)) {
      return c.json(
        {
          success: false,
          error: { code: 'CONTENT_BLOCKED', message: 'Creative content blocked by policy.' },
        },
        400
      );
    }

    const usedUnitsResult = await db
      .select({ used: sql<number>`coalesce(sum(${advertiserAllocations.allocationUnits}), 0)` })
      .from(advertiserAllocations)
      .where(and(eq(advertiserAllocations.adSpaceId, adSpaceId), eq(advertiserAllocations.isActive, true)));

    const usedUnits = Number(usedUnitsResult[0]?.used || 0);
    if (usedUnits + allocationUnits > 8) {
      return c.json(
        { success: false, error: { code: 'ALLOCATION_FULL', message: 'Allocation units exceeded' } },
        400
      );
    }

    const impressionsPerWeek = Math.floor((adSpace.weeklyImpressions * allocationUnits) / 8);
    const now = new Date();
    const defaultNextPayment = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const storePlaintext = shouldStorePlaintext();
    const ownerEncrypted = encryptAddress(body.currentOwnerAddress);
    const ownerHash = hashAddress(body.currentOwnerAddress);
    const prevEncrypted = encryptAddress(body.previousOwnerAddress);
    const prevHash = hashAddress(body.previousOwnerAddress);

    const isAdult = Boolean(body.isAdult);
    if (isAdult && !adSpace.isAdultAllowed) {
      return c.json(
        { success: false, error: { code: 'CONTENT_BLOCKED', message: 'Adult content not allowed.' } },
        400
      );
    }

    const [created] = await db
      .insert(advertiserAllocations)
      .values({
        adSpaceId,
        currentOwnerAddress: storePlaintext ? body.currentOwnerAddress : maskAddress(body.currentOwnerAddress),
        currentOwnerAddressEncrypted: ownerEncrypted,
        currentOwnerAddressHash: ownerHash,
        previousOwnerAddress: storePlaintext ? body.previousOwnerAddress : maskAddress(body.previousOwnerAddress),
        previousOwnerAddressEncrypted: prevEncrypted,
        previousOwnerAddressHash: prevHash,
        allocationUnits,
        impressionsPerWeek,
        acquisitionPrice: body.acquisitionPrice ? Number(body.acquisitionPrice) : undefined,
        weeklyFee,
        creativeAssetUrls: body.creativeAssetUrls,
        clickThroughUrl: body.clickThroughUrl,
        contentCategory: body.contentCategory,
        isAdult,
        moderationStatus: 'pending',
        isActive: body.isActive ?? true,
        allocationAcquiredAt: parseOptionalDate(body.allocationAcquiredAt),
        lastPaymentAt: parseOptionalDate(body.lastPaymentAt),
        nextPaymentDue: parseOptionalDate(body.nextPaymentDue) ?? defaultNextPayment,
      })
      .returning();

    return c.json({ success: true, data: hydrateAllocation(created) }, 201);
  } catch (error) {
    console.error('[Ad Exchange API] Error creating allocation:', error);
    return c.json(
      { success: false, error: { code: 'CREATE_ERROR', message: String(error) } },
      500
    );
  }
});

adExchangeRouter.get('/allocations', async (c) => {
  const adSpaceId = c.req.query('adSpaceId');
  const owner = c.req.query('owner');
  const isActive = parseBoolean(c.req.query('active'));
  const limit = parseInt(c.req.query('limit') || '50', 10);
  const offset = parseInt(c.req.query('offset') || '0', 10);
  const moderationStatus = c.req.query('moderationStatus');

  try {
    const conditions = [];
    if (adSpaceId) conditions.push(eq(advertiserAllocations.adSpaceId, adSpaceId));
    if (owner) {
      const ownerHash = hashAddress(owner);
      if (ownerHash) conditions.push(eq(advertiserAllocations.currentOwnerAddressHash, ownerHash));
    }
    if (isActive !== undefined) conditions.push(eq(advertiserAllocations.isActive, isActive));
    if (moderationStatus) conditions.push(eq(advertiserAllocations.moderationStatus, moderationStatus));

    const data = await db
      .select()
      .from(advertiserAllocations)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(advertiserAllocations.createdAt))
      .limit(limit)
      .offset(offset);

    return c.json({ success: true, data: data.map(hydrateAllocation) });
  } catch (error) {
    console.error('[Ad Exchange API] Error listing allocations:', error);
    return c.json(
      { success: false, error: { code: 'LIST_ERROR', message: String(error) } },
      500
    );
  }
});

// ============================================
// Payments
// ============================================

adExchangeRouter.get('/payments', async (c) => {
  const status = c.req.query('status');
  const type = c.req.query('type');
  const adSpaceId = c.req.query('adSpaceId');
  const allocationId = c.req.query('allocationId');

  try {
    const conditions = [];
    if (status) conditions.push(eq(adPayments.status, status));
    if (type) conditions.push(eq(adPayments.paymentType, type));
    if (adSpaceId) conditions.push(eq(adPayments.adSpaceId, adSpaceId));
    if (allocationId) conditions.push(eq(adPayments.allocationId, allocationId));

    const data = await db
      .select()
      .from(adPayments)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(adPayments.dueDate));

    return c.json({ success: true, data: data.map(hydratePayment) });
  } catch (error) {
    console.error('[Ad Exchange API] Error listing payments:', error);
    return c.json(
      { success: false, error: { code: 'LIST_ERROR', message: String(error) } },
      500
    );
  }
});

adExchangeRouter.post('/payments', async (c) => {
  const body = await c.req.json();
  const rate = enforceRateLimit(c, 30);
  if (!rate.allowed) {
    return c.json(
      { success: false, error: { code: 'RATE_LIMIT', message: 'Too many requests' } },
      429
    );
  }

  const required = ['paymentType', 'payerAddress', 'amount'];
  for (const key of required) {
    if (body[key] === undefined || body[key] === null || body[key] === '') {
      return c.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `Missing ${key}` } },
        400
      );
    }
  }

  try {
    const payment = await adExchangePaymentService.createPayment({
      paymentType: body.paymentType,
      adSpaceId: body.adSpaceId,
      allocationId: body.allocationId,
      payerAddress: body.payerAddress,
      amount: Number(body.amount),
      transactionHash: body.transactionHash,
      status: body.status,
      dueDate: parseOptionalDate(body.dueDate),
      paidAt: parseOptionalDate(body.paidAt),
    });

    return c.json({ success: true, data: hydratePayment(payment) }, 201);
  } catch (error) {
    console.error('[Ad Exchange API] Error creating payment:', error);
    return c.json(
      { success: false, error: { code: 'CREATE_ERROR', message: String(error) } },
      500
    );
  }
});

// ============================================
// Market Listings
// ============================================

adExchangeRouter.get('/listings', async (c) => {
  const status = c.req.query('status');
  const listingType = c.req.query('type');

  try {
    const conditions = [];
    if (status) conditions.push(eq(marketListings.status, status));
    if (listingType) conditions.push(eq(marketListings.listingType, listingType));

    const data = await db
      .select()
      .from(marketListings)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(marketListings.listedAt));

    return c.json({ success: true, data: data.map(hydrateListing) });
  } catch (error) {
    console.error('[Ad Exchange API] Error listing listings:', error);
    return c.json(
      { success: false, error: { code: 'LIST_ERROR', message: String(error) } },
      500
    );
  }
});

adExchangeRouter.get('/orderbook', async (c) => {
  const listingType = c.req.query('type');
  try {
    const conditions = [eq(marketListings.status, 'active')];
    if (listingType) conditions.push(eq(marketListings.listingType, listingType));

    const activeListings = await db
      .select()
      .from(marketListings)
      .where(and(...conditions))
      .orderBy(desc(marketListings.askPrice));

    return c.json({ success: true, data: activeListings.map(hydrateListing) });
  } catch (error) {
    console.error('[Ad Exchange API] Error fetching order book:', error);
    return c.json(
      { success: false, error: { code: 'FETCH_ERROR', message: String(error) } },
      500
    );
  }
});

adExchangeRouter.post('/listings', async (c) => {
  const body = await c.req.json();
  const rate = enforceRateLimit(c, 20);
  if (!rate.allowed) {
    return c.json(
      { success: false, error: { code: 'RATE_LIMIT', message: 'Too many requests' } },
      429
    );
  }

  try {
    const listing = await adExchangeMarketplaceService.createListing({
      listingType: body.listingType,
      sellerAddress: body.sellerAddress,
      askPrice: Number(body.askPrice),
      minPrice: body.minPrice ? Number(body.minPrice) : undefined,
      adSpaceId: body.adSpaceId,
      allocationId: body.allocationId,
      expiresAt: parseOptionalDate(body.expiresAt),
    });

    return c.json({ success: true, data: hydrateListing(listing) }, 201);
  } catch (error) {
    console.error('[Ad Exchange API] Error creating listing:', error);
    return c.json(
      { success: false, error: { code: 'CREATE_ERROR', message: String(error) } },
      500
    );
  }
});

adExchangeRouter.post('/listings/liquidity', async (c) => {
  const body = await c.req.json();
  const rate = enforceRateLimit(c, 10);
  if (!rate.allowed) {
    return c.json(
      { success: false, error: { code: 'RATE_LIMIT', message: 'Too many requests' } },
      429
    );
  }

  try {
    const listing = await adExchangeMarketplaceService.createLiquidityListing({
      listingType: body.listingType,
      sellerAddress: body.sellerAddress,
      askPrice: Number(body.askPrice),
      minPrice: body.minPrice ? Number(body.minPrice) : undefined,
      adSpaceId: body.adSpaceId,
      allocationId: body.allocationId,
      expiresAt: parseOptionalDate(body.expiresAt),
    });

    return c.json({ success: true, data: hydrateListing(listing) }, 201);
  } catch (error) {
    console.error('[Ad Exchange API] Error creating liquidity listing:', error);
    return c.json(
      { success: false, error: { code: 'CREATE_ERROR', message: String(error) } },
      500
    );
  }
});

adExchangeRouter.post('/listings/:id/buy', async (c) => {
  const listingId = c.req.param('id');
  const body = await c.req.json();
  const rate = enforceRateLimit(c, 20);
  if (!rate.allowed) {
    return c.json(
      { success: false, error: { code: 'RATE_LIMIT', message: 'Too many requests' } },
      429
    );
  }

  try {
    const listing = await adExchangeMarketplaceService.purchaseListing({
      listingId,
      buyerAddress: body.buyerAddress,
      purchasePrice: Number(body.purchasePrice),
      transactionHash: body.transactionHash,
    });

    return c.json({ success: true, data: hydrateListing(listing) });
  } catch (error) {
    console.error('[Ad Exchange API] Error purchasing listing:', error);
    return c.json(
      { success: false, error: { code: 'PURCHASE_ERROR', message: String(error) } },
      500
    );
  }
});

adExchangeRouter.patch('/listings/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const rate = enforceRateLimit(c, 30);
  if (!rate.allowed) {
    return c.json(
      { success: false, error: { code: 'RATE_LIMIT', message: 'Too many requests' } },
      429
    );
  }

  try {
    const [updated] = await db
      .update(marketListings)
      .set({
        askPrice: body.askPrice !== undefined ? Number(body.askPrice) : undefined,
        minPrice: body.minPrice !== undefined ? Number(body.minPrice) : undefined,
        status: body.status ?? undefined,
        expiresAt: parseOptionalDate(body.expiresAt),
      })
      .where(eq(marketListings.id, id))
      .returning();

    if (!updated) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Listing not found' } },
        404
      );
    }

    return c.json({ success: true, data: hydrateListing(updated) });
  } catch (error) {
    console.error('[Ad Exchange API] Error updating listing:', error);
    return c.json(
      { success: false, error: { code: 'UPDATE_ERROR', message: String(error) } },
      500
    );
  }
});

// ============================================
// Transfers & Performance
// ============================================

adExchangeRouter.get('/transfers', async (c) => {
  const adSpaceId = c.req.query('adSpaceId');
  const allocationId = c.req.query('allocationId');

  try {
    const conditions = [];
    if (adSpaceId) conditions.push(eq(ownershipTransfers.adSpaceId, adSpaceId));
    if (allocationId) conditions.push(eq(ownershipTransfers.allocationId, allocationId));

    const data = await db
      .select()
      .from(ownershipTransfers)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(ownershipTransfers.createdAt));

    return c.json({ success: true, data });
  } catch (error) {
    console.error('[Ad Exchange API] Error listing transfers:', error);
    return c.json(
      { success: false, error: { code: 'LIST_ERROR', message: String(error) } },
      500
    );
  }
});

// ============================================
// User Views
// ============================================

adExchangeRouter.get('/user/:address/ads', async (c) => {
  const address = c.req.param('address');
  const addressHash = hashAddress(address);

  if (!addressHash) {
    return c.json({ success: false, error: 'Invalid address' }, 400);
  }

  try {
    const spaces = await db
      .select()
      .from(adSpaces)
      .where(eq(adSpaces.currentOwnerAddressHash, addressHash));

    const allocations = await db
      .select()
      .from(advertiserAllocations)
      .where(eq(advertiserAllocations.currentOwnerAddressHash, addressHash));

    return c.json({
      success: true,
      data: {
        adSpaces: spaces.map(hydrateAdSpace),
        allocations: allocations.map(hydrateAllocation),
      },
    });
  } catch (error) {
    console.error('[Ad Exchange API] Error fetching user ads:', error);
    return c.json(
      { success: false, error: { code: 'FETCH_ERROR', message: String(error) } },
      500
    );
  }
});

adExchangeRouter.get('/user/:address/stats', async (c) => {
  const address = c.req.param('address');
  const addressHash = hashAddress(address);

  if (!addressHash) {
    return c.json({ success: false, error: 'Invalid address' }, 400);
  }

  try {
    const [spaces] = await db
      .select({ count: sql<number>`count(*)` })
      .from(adSpaces)
      .where(eq(adSpaces.currentOwnerAddressHash, addressHash));

    const [allocations] = await db
      .select({ count: sql<number>`count(*)` })
      .from(advertiserAllocations)
      .where(eq(advertiserAllocations.currentOwnerAddressHash, addressHash));

    const [payments] = await db
      .select({ sum: sql<number>`coalesce(sum(${adPayments.amount}), 0)` })
      .from(adPayments)
      .where(eq(adPayments.payerAddressHash, addressHash));

    return c.json({
      success: true,
      data: {
        ownedSpaces: Number(spaces?.count || 0),
        ownedAllocations: Number(allocations?.count || 0),
        totalPaid: Number(payments?.sum || 0),
      },
    });
  } catch (error) {
    console.error('[Ad Exchange API] Error fetching user stats:', error);
    return c.json(
      { success: false, error: { code: 'FETCH_ERROR', message: String(error) } },
      500
    );
  }
});

// ============================================
// Admin Moderation
// ============================================

adExchangeRouter.get('/admin/allocations', async (c) => {
  if (!requireAdmin(c)) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Unauthorized' } }, 403);
  }

  const status = c.req.query('status') || 'pending';
  const data = await db
    .select()
    .from(advertiserAllocations)
    .where(eq(advertiserAllocations.moderationStatus, status))
    .orderBy(desc(advertiserAllocations.createdAt));

  return c.json({ success: true, data: data.map(hydrateAllocation) });
});

adExchangeRouter.patch('/admin/allocations/:id', async (c) => {
  if (!requireAdmin(c)) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Unauthorized' } }, 403);
  }

  const id = c.req.param('id');
  const body = await c.req.json();
  const status = body.moderationStatus;

  const [updated] = await db
    .update(advertiserAllocations)
    .set({
      moderationStatus: status,
      moderationReason: body.moderationReason,
      flaggedAt: status === 'rejected' ? new Date() : null,
    })
    .where(eq(advertiserAllocations.id, id))
    .returning();

  if (!updated) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Allocation not found' } }, 404);
  }

  return c.json({ success: true, data: hydrateAllocation(updated) });
});

adExchangeRouter.get('/performance', async (c) => {
  const adSpaceId = c.req.query('adSpaceId');
  const allocationId = c.req.query('allocationId');
  const range = c.req.query('rangeDays');
  const rangeDays = range ? Number(range) : undefined;

  try {
    const conditions = [];
    if (adSpaceId) conditions.push(eq(performanceMetrics.adSpaceId, adSpaceId));
    if (allocationId) conditions.push(eq(performanceMetrics.allocationId, allocationId));
    if (Number.isFinite(rangeDays)) {
      const cutoff = new Date(Date.now() - Number(rangeDays) * 24 * 60 * 60 * 1000);
      conditions.push(gte(performanceMetrics.periodEnd, cutoff));
    }

    const data = await db
      .select()
      .from(performanceMetrics)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(performanceMetrics.periodEnd));

    return c.json({ success: true, data });
  } catch (error) {
    console.error('[Ad Exchange API] Error listing performance metrics:', error);
    return c.json(
      { success: false, error: { code: 'LIST_ERROR', message: String(error) } },
      500
    );
  }
});

adExchangeRouter.post('/performance/impression', async (c) => {
  const body = await c.req.json();
  const rate = enforceRateLimit(c, 120, 60_000);
  if (!rate.allowed) {
    return c.json(
      { success: false, error: { code: 'RATE_LIMIT', message: 'Too many requests' } },
      429
    );
  }
  if (!body.adSpaceId) {
    return c.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing adSpaceId' } },
      400
    );
  }

  try {
    const metric = await adExchangeCreativeDeliveryService.recordImpression(
      body.adSpaceId,
      body.allocationId
    );
    return c.json({ success: true, data: metric }, 201);
  } catch (error) {
    console.error('[Ad Exchange API] Error recording impression:', error);
    return c.json(
      { success: false, error: { code: 'CREATE_ERROR', message: String(error) } },
      500
    );
  }
});

adExchangeRouter.post('/performance/click', async (c) => {
  const body = await c.req.json();
  const rate = enforceRateLimit(c, 120, 60_000);
  if (!rate.allowed) {
    return c.json(
      { success: false, error: { code: 'RATE_LIMIT', message: 'Too many requests' } },
      429
    );
  }
  if (!body.adSpaceId) {
    return c.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing adSpaceId' } },
      400
    );
  }

  try {
    const metric = await adExchangeCreativeDeliveryService.recordClick(
      body.adSpaceId,
      body.allocationId
    );
    return c.json({ success: true, data: metric }, 201);
  } catch (error) {
    console.error('[Ad Exchange API] Error recording click:', error);
    return c.json(
      { success: false, error: { code: 'CREATE_ERROR', message: String(error) } },
      500
    );
  }
});

// ============================================
// Creative Validation
// ============================================

adExchangeRouter.post('/creative/validate', async (c) => {
  const body = await c.req.json();
  const result = adExchangeCreativeDeliveryService.validateCreativeAssets(
    body.creativeAssetUrls,
    body.clickThroughUrl
  );

  return c.json({ success: result.valid, data: result });
});

adExchangeRouter.get('/creative/fraud-check/:adSpaceId', async (c) => {
  const adSpaceId = c.req.param('adSpaceId');
  try {
    const result = await adExchangeCreativeDeliveryService.detectClickFraud(adSpaceId);
    return c.json({ success: true, data: result });
  } catch (error) {
    console.error('[Ad Exchange API] Error checking fraud:', error);
    return c.json(
      { success: false, error: { code: 'FETCH_ERROR', message: String(error) } },
      500
    );
  }
});

// ============================================
// Analytics
// ============================================

adExchangeRouter.get('/metrics/summary', async (c) => {
  try {
    const summary = await adExchangeAnalyticsService.getSummary();
    return c.json({ success: true, data: summary });
  } catch (error) {
    console.error('[Ad Exchange API] Error fetching summary metrics:', error);
    return c.json(
      { success: false, error: { code: 'FETCH_ERROR', message: String(error) } },
      500
    );
  }
});

adExchangeRouter.get('/metrics/ad-space/:id', async (c) => {
  const id = c.req.param('id');
  const range = c.req.query('rangeDays');
  const rangeDays = range ? Number(range) : undefined;
  try {
    const metrics = await adExchangeAnalyticsService.getAdSpacePerformance(
      id,
      Number.isFinite(rangeDays) ? rangeDays : undefined
    );
    return c.json({ success: true, data: metrics });
  } catch (error) {
    console.error('[Ad Exchange API] Error fetching ad space metrics:', error);
    return c.json(
      { success: false, error: { code: 'FETCH_ERROR', message: String(error) } },
      500
    );
  }
});

adExchangeRouter.get('/metrics/allocation/:id', async (c) => {
  const id = c.req.param('id');
  const range = c.req.query('rangeDays');
  const rangeDays = range ? Number(range) : undefined;
  try {
    const metrics = await adExchangeAnalyticsService.getAllocationPerformance(
      id,
      Number.isFinite(rangeDays) ? rangeDays : undefined
    );
    return c.json({ success: true, data: metrics });
  } catch (error) {
    console.error('[Ad Exchange API] Error fetching allocation metrics:', error);
    return c.json(
      { success: false, error: { code: 'FETCH_ERROR', message: String(error) } },
      500
    );
  }
});

adExchangeRouter.get('/metrics/roi/allocation/:id', async (c) => {
  const id = c.req.param('id');
  try {
    const roi = await adExchangeAnalyticsService.getAllocationRoi(id);
    return c.json({ success: true, data: roi });
  } catch (error) {
    console.error('[Ad Exchange API] Error fetching ROI:', error);
    return c.json(
      { success: false, error: { code: 'FETCH_ERROR', message: String(error) } },
      500
    );
  }
});

adExchangeRouter.get('/metrics/yield/ad-space/:id', async (c) => {
  const id = c.req.param('id');
  try {
    const result = await adExchangeAnalyticsService.getAdSpaceYield(id);
    return c.json({ success: true, data: result });
  } catch (error) {
    console.error('[Ad Exchange API] Error fetching yield:', error);
    return c.json(
      { success: false, error: { code: 'FETCH_ERROR', message: String(error) } },
      500
    );
  }
});

adExchangeRouter.get('/metrics/market-activity', async (c) => {
  const adSpaceId = c.req.query('adSpaceId');
  try {
    const summary = await adExchangeAnalyticsService.getMarketActivity(adSpaceId || undefined);
    return c.json({ success: true, data: summary });
  } catch (error) {
    console.error('[Ad Exchange API] Error fetching market activity:', error);
    return c.json(
      { success: false, error: { code: 'FETCH_ERROR', message: String(error) } },
      500
    );
  }
});

// ============================================
// Market Intelligence
// ============================================

adExchangeRouter.get('/intelligence/snapshot', async (c) => {
  try {
    const snapshot = await adExchangeMarketIntelligenceService.getSnapshot();
    return c.json({ success: true, data: snapshot });
  } catch (error) {
    console.error('[Ad Exchange API] Error fetching snapshot:', error);
    return c.json(
      { success: false, error: { code: 'FETCH_ERROR', message: String(error) } },
      500
    );
  }
});

adExchangeRouter.get('/intelligence/anomalies', async (c) => {
  try {
    const anomalies = await adExchangeMarketIntelligenceService.detectAnomalies();
    return c.json({ success: true, data: anomalies });
  } catch (error) {
    console.error('[Ad Exchange API] Error fetching anomalies:', error);
    return c.json(
      { success: false, error: { code: 'FETCH_ERROR', message: String(error) } },
      500
    );
  }
});

adExchangeRouter.get('/intelligence/valuations', async (c) => {
  try {
    const valuations = await adExchangeMarketIntelligenceService.estimateValuations();
    return c.json({ success: true, data: valuations });
  } catch (error) {
    console.error('[Ad Exchange API] Error fetching valuations:', error);
    return c.json(
      { success: false, error: { code: 'FETCH_ERROR', message: String(error) } },
      500
    );
  }
});

adExchangeRouter.get('/intelligence/opportunities', async (c) => {
  const discount = c.req.query('discount');
  try {
    const threshold = discount ? Number(discount) / 100 : undefined;
    const opportunities = await adExchangeMarketIntelligenceService.findUnderpricedSpaces(
      Number.isFinite(threshold) ? (threshold as number) : 0.25
    );
    return c.json({ success: true, data: opportunities });
  } catch (error) {
    console.error('[Ad Exchange API] Error fetching opportunities:', error);
    return c.json(
      { success: false, error: { code: 'FETCH_ERROR', message: String(error) } },
      500
    );
  }
});

adExchangeRouter.get('/liquidity/recommendations', async (c) => {
  const max = c.req.query('max');
  try {
    const limit = max ? Number(max) : undefined;
    const recommendations = await adExchangeLiquidityService.getRecommendations(
      Number.isFinite(limit) ? (limit as number) : 5
    );
    return c.json({ success: true, data: recommendations });
  } catch (error) {
    console.error('[Ad Exchange API] Error fetching liquidity recommendations:', error);
    return c.json(
      { success: false, error: { code: 'FETCH_ERROR', message: String(error) } },
      500
    );
  }
});

// ============================================
// Data Export
// ============================================

adExchangeRouter.get('/export', async (c) => {
  try {
    const spaces = await db.select().from(adSpaces);
    const allocations = await db.select().from(advertiserAllocations);
    const listings = await db.select().from(marketListings);
    const payments = await db.select().from(adPayments);
    const transfers = await db.select().from(ownershipTransfers);
    const metrics = await db.select().from(performanceMetrics);

    return c.json({
      success: true,
      data: {
        adSpaces: spaces.map(hydrateAdSpace),
        allocations: allocations.map(hydrateAllocation),
        listings: listings.map(hydrateListing),
        payments: payments.map(hydratePayment),
        transfers: transfers.map(hydrateTransfer),
        performance: metrics,
      },
    });
  } catch (error) {
    console.error('[Ad Exchange API] Error exporting data:', error);
    return c.json(
      { success: false, error: { code: 'EXPORT_ERROR', message: String(error) } },
      500
    );
  }
});

export default adExchangeRouter;
