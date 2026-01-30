/**
 * Ad Exchange Audit Service
 */

import { db } from '../db/client';
import { systemLogs } from '../db/schema';

type AuditType = 'payment' | 'transfer' | 'listing' | 'enforcement';

class AdExchangeAuditService {
  async log(eventType: AuditType, message: string, details?: Record<string, unknown>) {
    await db.insert(systemLogs).values({
      logType: 'audit',
      component: 'ad-exchange',
      message,
      details: details ?? {},
      createdAt: new Date(),
    });
  }
}

export const adExchangeAuditService = new AdExchangeAuditService();
