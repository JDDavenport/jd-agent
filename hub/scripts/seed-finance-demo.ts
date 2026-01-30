import { db } from '../src/db/client';
import { financeTransactions } from '../src/db/schema';
import { sql } from 'drizzle-orm';
import { financeService } from '../src/services/finance-service';

const now = new Date();
const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 15);
const lastMonthKey = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const toDate = (date: Date) => date.toISOString().split('T')[0];

async function seedFinanceDemo() {
  const existingBudgets = await financeService.getBudgets(true);
  const existingTransactions = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(financeTransactions);

  if (existingBudgets.length > 0 || (existingTransactions[0]?.count || 0) > 0) {
    console.log('Demo data already exists. Skipping seed.');
    return;
  }

  const accountId = await financeService.getOrCreateManualAccount('Demo Bank');

  const budgetDefinitions = [
    {
      name: 'Groceries',
      groupName: 'Everyday Expenses',
      category: 'Groceries',
      amountCents: 55000,
      targetType: 'monthly',
      targetAmountCents: 55000,
    },
    {
      name: 'Dining Out',
      groupName: 'Everyday Expenses',
      category: 'Food & Dining',
      amountCents: 30000,
      targetType: 'monthly',
      targetAmountCents: 30000,
    },
    {
      name: 'Gas & Transit',
      groupName: 'Everyday Expenses',
      category: 'Transportation',
      amountCents: 12000,
      targetType: 'monthly',
      targetAmountCents: 12000,
    },
    {
      name: 'Subscriptions',
      groupName: 'True Expenses',
      category: 'Subscriptions',
      amountCents: 7500,
      targetType: 'monthly',
      targetAmountCents: 7500,
    },
    {
      name: 'Travel Fund',
      groupName: 'True Expenses',
      category: 'Travel',
      amountCents: 20000,
      targetType: 'monthly',
      targetAmountCents: 20000,
    },
    {
      name: 'Emergency Buffer',
      groupName: 'Savings',
      category: 'Savings',
      amountCents: 30000,
      targetType: 'monthly',
      targetAmountCents: 30000,
    },
  ];

  for (const [index, budget] of budgetDefinitions.entries()) {
    const created = await financeService.createBudget({
      name: budget.name,
      groupName: budget.groupName,
      category: budget.category,
      amountCents: budget.amountCents,
      targetType: budget.targetType,
      targetAmountCents: budget.targetAmountCents,
      groupOrder: budget.groupName === 'Everyday Expenses' ? 1 : budget.groupName === 'True Expenses' ? 2 : 3,
      budgetOrder: index,
      alertsEnabled: true,
      month: monthKey,
      carryoverOverspent: true,
    });

    await financeService.setBudgetAllocation(created.id, lastMonthKey, Math.round(budget.amountCents * 0.8));
  }

  const baseDate = new Date(now.getFullYear(), now.getMonth(), 2);
  const transactions = [
    { date: toDate(addDays(baseDate, 1)), description: 'Whole Foods', amount: 124.5, category: 'Groceries' },
    { date: toDate(addDays(baseDate, 3)), description: 'Trader Joe', amount: 86.2, category: 'Groceries' },
    { date: toDate(addDays(baseDate, 5)), description: 'Chipotle', amount: 18.4, category: 'Food & Dining' },
    { date: toDate(addDays(baseDate, 7)), description: 'Uber', amount: 22.1, category: 'Transportation' },
    { date: toDate(addDays(baseDate, 8)), description: 'Chevron', amount: 42.7, category: 'Transportation' },
    { date: toDate(addDays(baseDate, 10)), description: 'Netflix', amount: 15.49, category: 'Subscriptions' },
    { date: toDate(addDays(baseDate, 12)), description: 'Spotify', amount: 11.99, category: 'Subscriptions' },
    { date: toDate(addDays(baseDate, 13)), description: 'Delta Airlines', amount: 210.0, category: 'Travel' },
    { date: toDate(addDays(baseDate, 14)), description: 'Target', amount: 64.22, category: 'Shopping' },
    { date: toDate(addDays(baseDate, 15)), description: 'Paycheck', amount: -3200.0, category: 'Income' },
    { date: toDate(addDays(baseDate, 16)), description: 'Costco', amount: 145.8, category: 'Groceries' },
    { date: toDate(addDays(baseDate, 18)), description: 'Starbucks', amount: 9.75, category: 'Food & Dining' },
    { date: toDate(addDays(baseDate, 20)), description: 'Hilton Hotels', amount: 150.0, category: 'Travel' },
    { date: toDate(addDays(baseDate, 22)), description: 'Venmo Transfer', amount: 75.0, category: 'Transfer' },
  ];

  await financeService.importTransactions(accountId, transactions);

  const lastMonthBase = new Date(lastMonthDate.getFullYear(), lastMonthDate.getMonth(), 5);
  await financeService.importTransactions(accountId, [
    { date: toDate(addDays(lastMonthBase, 2)), description: 'Kroger', amount: 92.5, category: 'Groceries' },
    { date: toDate(addDays(lastMonthBase, 5)), description: 'United Airlines', amount: 120.0, category: 'Travel' },
    { date: toDate(addDays(lastMonthBase, 10)), description: 'Paycheck', amount: -3200.0, category: 'Income' },
  ]);

  console.log('Seeded finance demo data.');
}

seedFinanceDemo().catch((error) => {
  console.error('Failed to seed finance demo data:', error);
  process.exit(1);
});
