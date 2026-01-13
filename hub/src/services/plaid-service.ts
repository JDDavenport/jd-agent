/**
 * Plaid Service
 *
 * Integration with Plaid for bank account linking and transaction sync.
 * Handles OAuth flow, token management, and transaction fetching.
 */

import {
  Configuration,
  PlaidApi,
  PlaidEnvironments,
  Products,
  CountryCode,
  type AccountBase,
  type Transaction as PlaidTransaction,
} from 'plaid';
import { db } from '../db/client';
import { plaidAccounts, financeTransactions } from '../db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { encrypt, decrypt, isEncryptionConfigured } from '../lib/encryption';

// ============================================
// Types
// ============================================

export interface LinkTokenResponse {
  linkToken: string;
  expiration: string;
}

export interface ExchangeTokenResult {
  itemId: string;
  accounts: Array<{
    id: string;
    accountId: string;
    name: string;
    type: string;
    mask: string | null;
  }>;
}

export interface SyncResult {
  added: number;
  modified: number;
  removed: number;
}

export interface PlaidAccountInfo {
  id: string;
  itemId: string;
  accountId: string;
  institutionId: string | null;
  institutionName: string;
  accountName: string | null;
  accountType: string | null;
  accountSubtype: string | null;
  accountMask: string | null;
  currentBalanceCents: number | null;
  availableBalanceCents: number | null;
  limitCents: number | null;
  isoCurrencyCode: string | null;
  lastSyncAt: Date | null;
  syncStatus: string | null;
  displayName: string | null;
}

// ============================================
// Plaid Service Class
// ============================================

class PlaidService {
  private client: PlaidApi | null = null;

  private getClient(): PlaidApi {
    if (!this.client) {
      const clientId = process.env.PLAID_CLIENT_ID;
      const secret = process.env.PLAID_SECRET;
      const env = (process.env.PLAID_ENV || 'sandbox') as 'sandbox' | 'development' | 'production';

      if (!clientId || !secret) {
        throw new Error('Plaid credentials not configured. Set PLAID_CLIENT_ID and PLAID_SECRET.');
      }

      const configuration = new Configuration({
        basePath: PlaidEnvironments[env],
        baseOptions: {
          headers: {
            'PLAID-CLIENT-ID': clientId,
            'PLAID-SECRET': secret,
          },
        },
      });

      this.client = new PlaidApi(configuration);
    }

    return this.client;
  }

  /**
   * Check if Plaid is configured
   */
  isConfigured(): boolean {
    return !!(process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET);
  }

  /**
   * Check if encryption is configured (required for storing tokens)
   */
  isFullyConfigured(): boolean {
    return this.isConfigured() && isEncryptionConfigured();
  }

  /**
   * Create a link token for Plaid Link initialization
   */
  async createLinkToken(userId: string): Promise<LinkTokenResponse> {
    const client = this.getClient();

    const response = await client.linkTokenCreate({
      user: { client_user_id: userId },
      client_name: 'JD Agent',
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: 'en',
    });

    return {
      linkToken: response.data.link_token,
      expiration: response.data.expiration,
    };
  }

  /**
   * Exchange public token for access token after Plaid Link success
   */
  async exchangePublicToken(publicToken: string): Promise<ExchangeTokenResult> {
    if (!isEncryptionConfigured()) {
      throw new Error('ENCRYPTION_KEY not configured. Cannot securely store access tokens.');
    }

    const client = this.getClient();

    // Exchange token
    const exchangeResponse = await client.itemPublicTokenExchange({
      public_token: publicToken,
    });

    const accessToken = exchangeResponse.data.access_token;
    const itemId = exchangeResponse.data.item_id;

    // Get account info
    const accountsResponse = await client.accountsGet({
      access_token: accessToken,
    });

    const item = accountsResponse.data.item;
    const accounts = accountsResponse.data.accounts;

    // Encrypt access token
    const { encrypted, iv } = encrypt(accessToken);

    // Get institution name
    let institutionName = 'Unknown';
    if (item.institution_id) {
      try {
        const instResponse = await client.institutionsGetById({
          institution_id: item.institution_id,
          country_codes: [CountryCode.Us],
        });
        institutionName = instResponse.data.institution.name;
      } catch (error) {
        console.error('[Plaid] Failed to get institution name:', error);
      }
    }

    // Store each account
    const storedAccounts: ExchangeTokenResult['accounts'] = [];

    for (const account of accounts) {
      const [inserted] = await db
        .insert(plaidAccounts)
        .values({
          itemId,
          accountId: account.account_id,
          institutionId: item.institution_id,
          institutionName,
          accessTokenEncrypted: encrypted,
          accessTokenIv: iv,
          accountMask: account.mask,
          accountName: account.official_name || account.name,
          accountType: account.type,
          accountSubtype: account.subtype || undefined,
          currentBalanceCents: account.balances.current
            ? Math.round(account.balances.current * 100)
            : null,
          availableBalanceCents: account.balances.available
            ? Math.round(account.balances.available * 100)
            : null,
          limitCents: account.balances.limit ? Math.round(account.balances.limit * 100) : null,
          isoCurrencyCode: account.balances.iso_currency_code || 'USD',
          lastSyncAt: new Date(),
        })
        .onConflictDoUpdate({
          target: plaidAccounts.accountId,
          set: {
            accessTokenEncrypted: encrypted,
            accessTokenIv: iv,
            accountName: account.official_name || account.name,
            currentBalanceCents: account.balances.current
              ? Math.round(account.balances.current * 100)
              : null,
            availableBalanceCents: account.balances.available
              ? Math.round(account.balances.available * 100)
              : null,
            limitCents: account.balances.limit ? Math.round(account.balances.limit * 100) : null,
            lastSyncAt: new Date(),
            updatedAt: new Date(),
          },
        })
        .returning();

      storedAccounts.push({
        id: inserted.id,
        accountId: account.account_id,
        name: account.official_name || account.name,
        type: account.type,
        mask: account.mask,
      });
    }

    return {
      itemId,
      accounts: storedAccounts,
    };
  }

  /**
   * Sync transactions for all connected accounts
   */
  async syncAllAccounts(): Promise<SyncResult> {
    const accounts = await db
      .select()
      .from(plaidAccounts)
      .where(and(eq(plaidAccounts.syncStatus, 'active'), eq(plaidAccounts.isHidden, false)));

    let totalAdded = 0;
    let totalModified = 0;
    let totalRemoved = 0;

    // Group accounts by itemId (same access token)
    const itemGroups = new Map<string, (typeof accounts)[number][]>();
    for (const account of accounts) {
      const existing = itemGroups.get(account.itemId) || [];
      existing.push(account);
      itemGroups.set(account.itemId, existing);
    }

    for (const [itemId, itemAccounts] of itemGroups) {
      try {
        const account = itemAccounts[0];
        const accessToken = decrypt(account.accessTokenEncrypted, account.accessTokenIv);

        const result = await this.syncItemTransactions(
          accessToken,
          account.lastSyncCursor,
          itemAccounts
        );
        totalAdded += result.added;
        totalModified += result.modified;
        totalRemoved += result.removed;

        // Update sync status for all accounts in this item
        await db
          .update(plaidAccounts)
          .set({
            lastSyncAt: new Date(),
            lastSyncCursor: result.cursor,
            syncStatus: 'active',
            errorCode: null,
            errorMessage: null,
            updatedAt: new Date(),
          })
          .where(eq(plaidAccounts.itemId, itemId));
      } catch (error: unknown) {
        console.error(`[Plaid] Sync failed for item ${itemId}:`, error);

        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorCode =
          error && typeof error === 'object' && 'code' in error
            ? String((error as { code: unknown }).code)
            : 'UNKNOWN';

        await db
          .update(plaidAccounts)
          .set({
            syncStatus: 'error',
            errorCode,
            errorMessage,
            updatedAt: new Date(),
          })
          .where(eq(plaidAccounts.itemId, itemId));
      }
    }

    return { added: totalAdded, modified: totalModified, removed: totalRemoved };
  }

  /**
   * Sync transactions for a specific account
   */
  async syncAccount(accountId: string): Promise<SyncResult> {
    const [account] = await db.select().from(plaidAccounts).where(eq(plaidAccounts.id, accountId));

    if (!account) {
      throw new Error('Account not found');
    }

    const accessToken = decrypt(account.accessTokenEncrypted, account.accessTokenIv);
    const result = await this.syncItemTransactions(accessToken, account.lastSyncCursor, [account]);

    await db
      .update(plaidAccounts)
      .set({
        lastSyncAt: new Date(),
        lastSyncCursor: result.cursor,
        syncStatus: 'active',
        errorCode: null,
        errorMessage: null,
        updatedAt: new Date(),
      })
      .where(eq(plaidAccounts.id, accountId));

    return result;
  }

  /**
   * Sync transactions for a specific Plaid item using cursor-based sync
   */
  private async syncItemTransactions(
    accessToken: string,
    cursor: string | null,
    accounts: Array<{ id: string; accountId: string }>
  ): Promise<SyncResult & { cursor: string }> {
    const client = this.getClient();

    let added = 0;
    let modified = 0;
    let removed = 0;
    let hasMore = true;
    let nextCursor = cursor || '';

    // Create account mapping
    const accountMap = new Map(accounts.map((a) => [a.accountId, a.id]));

    while (hasMore) {
      const response = await client.transactionsSync({
        access_token: accessToken,
        cursor: nextCursor || undefined,
      });

      const data = response.data;

      // Process added transactions
      for (const txn of data.added) {
        const plaidAccountId = accountMap.get(txn.account_id);
        if (!plaidAccountId) continue;

        await db
          .insert(financeTransactions)
          .values({
            plaidAccountId,
            plaidTransactionId: txn.transaction_id,
            amountCents: Math.round(txn.amount * 100), // Plaid uses positive for debits
            isoCurrencyCode: txn.iso_currency_code || 'USD',
            date: txn.date,
            datetime: txn.datetime ? new Date(txn.datetime) : null,
            merchantName: txn.merchant_name,
            name: txn.name,
            plaidCategory: txn.category,
            plaidCategoryId: txn.category_id,
            pending: txn.pending,
            paymentChannel: txn.payment_channel,
            location: txn.location
              ? {
                  address: txn.location.address,
                  city: txn.location.city,
                  region: txn.location.region,
                  postalCode: txn.location.postal_code,
                  country: txn.location.country,
                  lat: txn.location.lat,
                  lon: txn.location.lon,
                }
              : null,
          })
          .onConflictDoNothing();

        added++;
      }

      // Process modified transactions
      for (const txn of data.modified) {
        await db
          .update(financeTransactions)
          .set({
            amountCents: Math.round(txn.amount * 100),
            date: txn.date,
            datetime: txn.datetime ? new Date(txn.datetime) : null,
            merchantName: txn.merchant_name,
            name: txn.name,
            plaidCategory: txn.category,
            plaidCategoryId: txn.category_id,
            pending: txn.pending,
            updatedAt: new Date(),
          })
          .where(eq(financeTransactions.plaidTransactionId, txn.transaction_id));

        modified++;
      }

      // Process removed transactions
      for (const txn of data.removed) {
        if (txn.transaction_id) {
          await db
            .delete(financeTransactions)
            .where(eq(financeTransactions.plaidTransactionId, txn.transaction_id));
          removed++;
        }
      }

      hasMore = data.has_more;
      nextCursor = data.next_cursor;
    }

    return { added, modified, removed, cursor: nextCursor };
  }

  /**
   * Get all connected accounts
   */
  async getAccounts(): Promise<PlaidAccountInfo[]> {
    const accounts = await db
      .select()
      .from(plaidAccounts)
      .where(eq(plaidAccounts.isHidden, false));

    return accounts.map((a) => ({
      id: a.id,
      itemId: a.itemId,
      accountId: a.accountId,
      institutionId: a.institutionId,
      institutionName: a.institutionName,
      accountName: a.accountName,
      accountType: a.accountType,
      accountSubtype: a.accountSubtype,
      accountMask: a.accountMask,
      currentBalanceCents: a.currentBalanceCents,
      availableBalanceCents: a.availableBalanceCents,
      limitCents: a.limitCents,
      isoCurrencyCode: a.isoCurrencyCode,
      lastSyncAt: a.lastSyncAt,
      syncStatus: a.syncStatus,
      displayName: a.displayName,
    }));
  }

  /**
   * Disconnect a Plaid item (removes all accounts from one institution)
   */
  async disconnectItem(itemId: string): Promise<void> {
    const accounts = await db.select().from(plaidAccounts).where(eq(plaidAccounts.itemId, itemId));

    if (accounts.length === 0) return;

    const account = accounts[0];

    try {
      const accessToken = decrypt(account.accessTokenEncrypted, account.accessTokenIv);
      const client = this.getClient();
      await client.itemRemove({ access_token: accessToken });
    } catch (error) {
      console.error('[Plaid] Failed to remove item from Plaid:', error);
    }

    // Delete from our database (cascade will delete transactions)
    await db.delete(plaidAccounts).where(eq(plaidAccounts.itemId, itemId));
  }

  /**
   * Update account display name
   */
  async updateAccountDisplayName(accountId: string, displayName: string): Promise<void> {
    await db
      .update(plaidAccounts)
      .set({ displayName, updatedAt: new Date() })
      .where(eq(plaidAccounts.id, accountId));
  }

  /**
   * Hide/unhide an account
   */
  async setAccountHidden(accountId: string, isHidden: boolean): Promise<void> {
    await db
      .update(plaidAccounts)
      .set({ isHidden, updatedAt: new Date() })
      .where(eq(plaidAccounts.id, accountId));
  }
}

export const plaidService = new PlaidService();
