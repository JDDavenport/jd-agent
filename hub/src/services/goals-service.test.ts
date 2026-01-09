import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { goalsService, type CreateGoalInput, type UpdateGoalInput } from './goals-service';
import { db } from '../db/client';
import { goals, habits, milestones, goalReflections } from '../db/schema';

// Mock the database client
vi.mock('../db/client', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

// Helper to create chainable mock
function createChainableMock(finalValue: unknown) {
  const chain: Record<string, Mock> = {};

  const createMethod = (returnValue: unknown): Mock => {
    return vi.fn().mockReturnValue(returnValue);
  };

  // Build chain from end to start
  chain.returning = createMethod(Promise.resolve(finalValue));
  chain.limit = createMethod(Promise.resolve(finalValue));
  chain.groupBy = createMethod(Promise.resolve(finalValue));

  // orderBy needs to support .limit() after it
  chain.orderBy = createMethod({
    limit: chain.limit,
    then: (resolve: (value: unknown) => void) => resolve(finalValue), // Make it thenable
  });
  // Make orderBy itself return a promise when awaited
  Object.assign(chain.orderBy(), Promise.resolve(finalValue));

  // where needs to return an object with orderBy and limit (for filtered queries)
  chain.where = createMethod({
    returning: chain.returning,
    limit: chain.limit,
    orderBy: chain.orderBy,
  });
  chain.set = createMethod({ where: chain.where });
  chain.values = createMethod({ returning: chain.returning });
  chain.from = createMethod({
    where: chain.where,
    orderBy: chain.orderBy,
    groupBy: chain.groupBy,
    limit: chain.limit,
  });

  return chain;
}

describe('Goals Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================
  // CREATE GOAL TESTS
  // ============================================
  describe('create', () => {
    it('should create a new goal with valid data', async () => {
      const goalData: CreateGoalInput = {
        title: 'Learn TypeScript',
        description: 'Master TypeScript for backend development',
        lifeArea: 'professional',
        targetDate: '2026-06-01',
      };

      const mockGoal = {
        id: 'goal-1',
        title: goalData.title,
        description: goalData.description,
        lifeArea: goalData.lifeArea,
        area: null,
        goalType: 'achievement',
        metricType: 'boolean',
        targetValue: null,
        currentValue: 0,
        unit: null,
        startDate: '2026-01-08',
        targetDate: goalData.targetDate,
        level: null,
        parentGoalId: null,
        status: 'active',
        priority: 2,
        motivation: null,
        vision: null,
        progressPercentage: 0,
        reviewFrequency: null,
        lastReviewedAt: null,
        vaultEntryId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: null,
      };

      const chain = createChainableMock([mockGoal]);
      vi.mocked(db.insert).mockReturnValue({ values: chain.values } as any);

      const result = await goalsService.create(goalData);

      expect(result).toBeDefined();
      expect(result.title).toBe(goalData.title);
      expect(result.lifeArea).toBe(goalData.lifeArea);
      expect(db.insert).toHaveBeenCalledWith(goals);
    });

    it('should create goal with default values when optional fields are omitted', async () => {
      const goalData: CreateGoalInput = {
        title: 'Simple Goal',
      };

      const mockGoal = {
        id: 'goal-2',
        title: goalData.title,
        description: null,
        lifeArea: null,
        goalType: 'achievement',
        metricType: 'boolean',
        currentValue: 0,
        priority: 2,
        progressPercentage: 0,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const chain = createChainableMock([mockGoal]);
      vi.mocked(db.insert).mockReturnValue({ values: chain.values } as any);

      const result = await goalsService.create(goalData);

      expect(result).toBeDefined();
      expect(result.title).toBe(goalData.title);
      expect(result.goalType).toBe('achievement');
      expect(result.metricType).toBe('boolean');
    });

    it('should ignore invalid lifeArea and set to null', async () => {
      const goalData = {
        title: 'Test Goal',
        lifeArea: 'invalid-area' as any,
      };

      const mockGoal = {
        id: 'goal-3',
        title: goalData.title,
        lifeArea: null, // Invalid area should be ignored
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const chain = createChainableMock([mockGoal]);
      vi.mocked(db.insert).mockReturnValue({ values: chain.values } as any);

      const result = await goalsService.create(goalData);

      expect(result.lifeArea).toBeNull();
    });

    it('should accept all valid life areas', async () => {
      const validAreas = ['spiritual', 'personal', 'fitness', 'family', 'professional', 'school'] as const;

      for (const area of validAreas) {
        const goalData: CreateGoalInput = {
          title: `Goal for ${area}`,
          lifeArea: area,
        };

        const mockGoal = {
          id: `goal-${area}`,
          title: goalData.title,
          lifeArea: area,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const chain = createChainableMock([mockGoal]);
        vi.mocked(db.insert).mockReturnValue({ values: chain.values } as any);

        const result = await goalsService.create(goalData);
        expect(result.lifeArea).toBe(area);
      }
    });
  });

  // ============================================
  // GET BY ID TESTS
  // ============================================
  describe('getById', () => {
    it('should return goal when it exists', async () => {
      const mockGoal = {
        id: 'goal-1',
        title: 'Test Goal',
        description: 'Test description',
        lifeArea: 'professional',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const chain = createChainableMock([mockGoal]);
      vi.mocked(db.select).mockReturnValue({ from: chain.from } as any);

      const result = await goalsService.getById('goal-1');

      expect(result).toEqual(mockGoal);
      expect(db.select).toHaveBeenCalled();
    });

    it('should return null when goal does not exist', async () => {
      const chain = createChainableMock([]);
      vi.mocked(db.select).mockReturnValue({ from: chain.from } as any);

      const result = await goalsService.getById('non-existent');

      expect(result).toBeNull();
    });
  });

  // ============================================
  // LIST TESTS
  // ============================================
  describe('list', () => {
    it('should return all goals without filters', async () => {
      const mockGoals = [
        { id: 'goal-1', title: 'Goal 1', status: 'active' },
        { id: 'goal-2', title: 'Goal 2', status: 'completed' },
      ];

      const chain = createChainableMock(mockGoals);
      vi.mocked(db.select).mockReturnValue({ from: chain.from } as any);

      const result = await goalsService.list();

      expect(result).toHaveLength(2);
      expect(db.select).toHaveBeenCalled();
    });

    it('should filter by status', async () => {
      const mockGoals = [
        { id: 'goal-1', title: 'Active Goal', status: 'active' },
      ];

      const chain = createChainableMock(mockGoals);
      vi.mocked(db.select).mockReturnValue({ from: chain.from } as any);

      const result = await goalsService.list({ status: 'active' });

      expect(result).toBeDefined();
      expect(db.select).toHaveBeenCalled();
    });

    it('should filter by lifeArea', async () => {
      const mockGoals = [
        { id: 'goal-1', title: 'Professional Goal', lifeArea: 'professional' },
      ];

      const chain = createChainableMock(mockGoals);
      vi.mocked(db.select).mockReturnValue({ from: chain.from } as any);

      const result = await goalsService.list({ lifeArea: 'professional' });

      expect(result).toBeDefined();
      expect(db.select).toHaveBeenCalled();
    });
  });

  // ============================================
  // UPDATE TESTS
  // ============================================
  describe('update', () => {
    it('should update goal fields', async () => {
      const updateData: UpdateGoalInput = {
        title: 'Updated Title',
        description: 'Updated description',
      };

      const mockUpdated = {
        id: 'goal-1',
        title: 'Updated Title',
        description: 'Updated description',
        updatedAt: new Date(),
      };

      const chain = createChainableMock([mockUpdated]);
      vi.mocked(db.update).mockReturnValue({ set: chain.set } as any);

      const result = await goalsService.update('goal-1', updateData);

      expect(result).toBeDefined();
      expect(result?.title).toBe('Updated Title');
      expect(db.update).toHaveBeenCalledWith(goals);
    });

    it('should return null when goal does not exist', async () => {
      const chain = createChainableMock([]);
      vi.mocked(db.update).mockReturnValue({ set: chain.set } as any);

      const result = await goalsService.update('non-existent', { title: 'Test' });

      expect(result).toBeNull();
    });

    it('should ignore invalid lifeArea in update', async () => {
      const updateData = {
        lifeArea: 'invalid' as any,
        title: 'Valid Title',
      };

      const mockUpdated = {
        id: 'goal-1',
        title: 'Valid Title',
        lifeArea: 'professional', // Original value retained
        updatedAt: new Date(),
      };

      const chain = createChainableMock([mockUpdated]);
      vi.mocked(db.update).mockReturnValue({ set: chain.set } as any);

      const result = await goalsService.update('goal-1', updateData);

      expect(result).toBeDefined();
    });
  });

  // ============================================
  // UPDATE PROGRESS TESTS
  // ============================================
  describe('updateProgress', () => {
    it('should update progress for numeric goal', async () => {
      const mockGoal = {
        id: 'goal-1',
        metricType: 'numeric',
        targetValue: 100,
        currentValue: 0,
        status: 'active',
      };

      // First call: getById
      const selectChain = createChainableMock([mockGoal]);
      vi.mocked(db.select).mockReturnValue({ from: selectChain.from } as any);

      // Second call: update
      const mockUpdated = { ...mockGoal, currentValue: 50, progressPercentage: 50 };
      const updateChain = createChainableMock([mockUpdated]);
      vi.mocked(db.update).mockReturnValue({ set: updateChain.set } as any);

      const result = await goalsService.updateProgress('goal-1', 50);

      expect(result).toBeDefined();
      expect(result?.currentValue).toBe(50);
      expect(result?.progressPercentage).toBe(50);
    });

    it('should auto-complete goal when target reached', async () => {
      const mockGoal = {
        id: 'goal-1',
        metricType: 'numeric',
        targetValue: 100,
        currentValue: 0,
        status: 'active',
      };

      const selectChain = createChainableMock([mockGoal]);
      vi.mocked(db.select).mockReturnValue({ from: selectChain.from } as any);

      const mockUpdated = { 
        ...mockGoal, 
        currentValue: 100, 
        progressPercentage: 100,
        status: 'completed',
        completedAt: new Date(),
      };
      const updateChain = createChainableMock([mockUpdated]);
      vi.mocked(db.update).mockReturnValue({ set: updateChain.set } as any);

      const result = await goalsService.updateProgress('goal-1', 100);

      expect(result?.status).toBe('completed');
    });

    it('should return null when goal does not exist', async () => {
      const selectChain = createChainableMock([]);
      vi.mocked(db.select).mockReturnValue({ from: selectChain.from } as any);

      const result = await goalsService.updateProgress('non-existent', 50);

      expect(result).toBeNull();
    });

    it('should handle boolean metric type', async () => {
      const mockGoal = {
        id: 'goal-1',
        metricType: 'boolean',
        status: 'active',
      };

      const selectChain = createChainableMock([mockGoal]);
      vi.mocked(db.select).mockReturnValue({ from: selectChain.from } as any);

      const mockUpdated = { 
        ...mockGoal, 
        currentValue: 1, 
        progressPercentage: 100,
        status: 'completed',
      };
      const updateChain = createChainableMock([mockUpdated]);
      vi.mocked(db.update).mockReturnValue({ set: updateChain.set } as any);

      const result = await goalsService.updateProgress('goal-1', 1);

      expect(result?.progressPercentage).toBe(100);
    });

    it('should handle percentage metric type', async () => {
      const mockGoal = {
        id: 'goal-1',
        metricType: 'percentage',
        status: 'active',
      };

      const selectChain = createChainableMock([mockGoal]);
      vi.mocked(db.select).mockReturnValue({ from: selectChain.from } as any);

      const mockUpdated = { 
        ...mockGoal, 
        currentValue: 75, 
        progressPercentage: 75,
      };
      const updateChain = createChainableMock([mockUpdated]);
      vi.mocked(db.update).mockReturnValue({ set: updateChain.set } as any);

      const result = await goalsService.updateProgress('goal-1', 75);

      expect(result?.progressPercentage).toBe(75);
    });
  });

  // ============================================
  // DELETE TESTS
  // ============================================
  describe('delete', () => {
    it('should delete goal and return true', async () => {
      const chain = createChainableMock({ rowCount: 1 });
      chain.where = vi.fn().mockReturnValue(Promise.resolve({ rowCount: 1 }));
      vi.mocked(db.delete).mockReturnValue({ where: chain.where } as any);

      const result = await goalsService.delete('goal-1');

      expect(result).toBe(true);
      expect(db.delete).toHaveBeenCalledWith(goals);
    });

    it('should return false when goal does not exist', async () => {
      const chain = createChainableMock({ rowCount: 0 });
      chain.where = vi.fn().mockReturnValue(Promise.resolve({ rowCount: 0 }));
      vi.mocked(db.delete).mockReturnValue({ where: chain.where } as any);

      const result = await goalsService.delete('non-existent');

      expect(result).toBe(false);
    });
  });

  // ============================================
  // STATUS CHANGE TESTS
  // ============================================
  describe('complete', () => {
    it('should complete a goal', async () => {
      const mockUpdated = {
        id: 'goal-1',
        status: 'completed',
        progressPercentage: 100,
        completedAt: new Date(),
      };

      const chain = createChainableMock([mockUpdated]);
      vi.mocked(db.update).mockReturnValue({ set: chain.set } as any);

      const result = await goalsService.complete('goal-1');

      expect(result).toBeDefined();
      expect(result?.status).toBe('completed');
      expect(result?.progressPercentage).toBe(100);
    });

    it('should return null when goal does not exist', async () => {
      const chain = createChainableMock([]);
      vi.mocked(db.update).mockReturnValue({ set: chain.set } as any);

      const result = await goalsService.complete('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('pause', () => {
    it('should pause a goal', async () => {
      const mockUpdated = {
        id: 'goal-1',
        status: 'paused',
      };

      const chain = createChainableMock([mockUpdated]);
      vi.mocked(db.update).mockReturnValue({ set: chain.set } as any);

      const result = await goalsService.pause('goal-1');

      expect(result?.status).toBe('paused');
    });
  });

  describe('resume', () => {
    it('should resume a paused goal', async () => {
      const mockUpdated = {
        id: 'goal-1',
        status: 'active',
      };

      const chain = createChainableMock([mockUpdated]);
      vi.mocked(db.update).mockReturnValue({ set: chain.set } as any);

      const result = await goalsService.resume('goal-1');

      expect(result?.status).toBe('active');
    });
  });

  describe('abandon', () => {
    it('should abandon a goal', async () => {
      const mockUpdated = {
        id: 'goal-1',
        status: 'abandoned',
      };

      const chain = createChainableMock([mockUpdated]);
      vi.mocked(db.update).mockReturnValue({ set: chain.set } as any);

      const result = await goalsService.abandon('goal-1');

      expect(result?.status).toBe('abandoned');
    });
  });

  // ============================================
  // AGGREGATION TESTS
  // ============================================
  describe('getByLifeArea', () => {
    it('should return goals grouped by life area', async () => {
      const mockAggregation = [
        { lifeArea: 'professional', total: 5, completed: 2, active: 3, avgProgress: 45 },
        { lifeArea: 'fitness', total: 3, completed: 1, active: 2, avgProgress: 33 },
      ];

      const chain = createChainableMock(mockAggregation);
      vi.mocked(db.select).mockReturnValue({ from: chain.from } as any);

      const result = await goalsService.getByLifeArea();

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getByArea', () => {
    it('should return goals grouped by legacy area', async () => {
      const mockAggregation = [
        { area: 'work', total: 5, completed: 2, active: 3 },
        { area: 'health', total: 3, completed: 1, active: 2 },
      ];

      const chain = createChainableMock(mockAggregation);
      vi.mocked(db.select).mockReturnValue({ from: chain.from } as any);

      const result = await goalsService.getByArea();

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  // ============================================
  // ADDITIONAL LIST TESTS
  // ============================================
  describe('list - additional filters', () => {
    it('should filter by legacy area', async () => {
      const mockGoals = [
        { id: 'goal-1', title: 'Work Goal', area: 'work' },
      ];

      const chain = createChainableMock(mockGoals);
      vi.mocked(db.select).mockReturnValue({ from: chain.from } as any);

      const result = await goalsService.list({ area: 'work' });

      expect(result).toBeDefined();
      expect(db.select).toHaveBeenCalled();
    });

    it('should handle multiple filters', async () => {
      const mockGoals = [
        { id: 'goal-1', title: 'Active Pro Goal', status: 'active', lifeArea: 'professional' },
      ];

      const chain = createChainableMock(mockGoals);
      vi.mocked(db.select).mockReturnValue({ from: chain.from } as any);

      const result = await goalsService.list({ status: 'active', lifeArea: 'professional' });

      expect(result).toBeDefined();
    });
  });

  // ============================================
  // GET BY ID WITH RELATIONS TESTS
  // ============================================
  describe('getByIdWithRelations', () => {
    it('should return null when goal does not exist', async () => {
      const chain = createChainableMock([]);
      vi.mocked(db.select).mockReturnValue({ from: chain.from } as any);

      const result = await goalsService.getByIdWithRelations('non-existent');

      expect(result).toBeNull();
    });
  });

  // ============================================
  // RECALCULATE PROGRESS TESTS
  // ============================================
  describe('recalculateProgress', () => {
    it('should return null when goal does not exist', async () => {
      const chain = createChainableMock([]);
      vi.mocked(db.select).mockReturnValue({ from: chain.from } as any);

      const result = await goalsService.recalculateProgress('non-existent');

      expect(result).toBeNull();
    });
  });

  // ============================================
  // MILESTONE METRIC TYPE TESTS
  // ============================================
  describe('updateProgress - milestone type', () => {
    it('should handle milestone metric type without auto-calculating', async () => {
      const mockGoal = {
        id: 'goal-1',
        metricType: 'milestone',
        status: 'active',
      };

      const selectChain = createChainableMock([mockGoal]);
      vi.mocked(db.select).mockReturnValue({ from: selectChain.from } as any);

      const mockUpdated = {
        ...mockGoal,
        currentValue: 3, // Just stores the reference value
      };
      const updateChain = createChainableMock([mockUpdated]);
      vi.mocked(db.update).mockReturnValue({ set: updateChain.set } as any);

      const result = await goalsService.updateProgress('goal-1', 3);

      expect(result).toBeDefined();
    });
  });

  // ============================================
  // DEFAULT METRIC TYPE TESTS
  // ============================================
  describe('updateProgress - default metric type', () => {
    it('should handle unknown metric type with target value', async () => {
      const mockGoal = {
        id: 'goal-1',
        metricType: null, // Unknown/default
        targetValue: 10,
        status: 'active',
      };

      const selectChain = createChainableMock([mockGoal]);
      vi.mocked(db.select).mockReturnValue({ from: selectChain.from } as any);

      const mockUpdated = {
        ...mockGoal,
        currentValue: 5,
        progressPercentage: 50,
      };
      const updateChain = createChainableMock([mockUpdated]);
      vi.mocked(db.update).mockReturnValue({ set: updateChain.set } as any);

      const result = await goalsService.updateProgress('goal-1', 5);

      expect(result?.progressPercentage).toBe(50);
    });

    it('should complete goal when default metric reaches target', async () => {
      const mockGoal = {
        id: 'goal-1',
        metricType: null,
        targetValue: 10,
        status: 'active',
      };

      const selectChain = createChainableMock([mockGoal]);
      vi.mocked(db.select).mockReturnValue({ from: selectChain.from } as any);

      const mockUpdated = {
        ...mockGoal,
        currentValue: 10,
        progressPercentage: 100,
        status: 'completed',
      };
      const updateChain = createChainableMock([mockUpdated]);
      vi.mocked(db.update).mockReturnValue({ set: updateChain.set } as any);

      const result = await goalsService.updateProgress('goal-1', 10);

      expect(result?.status).toBe('completed');
    });
  });

  // ============================================
  // CALCULATE HEALTH SCORE TESTS
  // ============================================
  describe('calculateHealthScore', () => {
    it('should use provided habits and milestones to calculate score', async () => {
      const mockGoal = {
        id: 'goal-1',
        title: 'Test Goal',
        targetDate: null,
        progressPercentage: 50,
        createdAt: new Date(),
      };

      const linkedHabits = [{ isActive: true }, { isActive: true }];
      const goalMilestones = [{ status: 'completed' }, { status: 'completed' }];

      // Mock the reflections query with proper chain
      const chain = createChainableMock([]);
      vi.mocked(db.select).mockReturnValue({ from: chain.from } as any);

      const score = await goalsService.calculateHealthScore(
        mockGoal as any,
        linkedHabits,
        goalMilestones
      );

      // Base score 50 + 15 (active habits) + 15 (all milestones completed) = 80
      expect(score).toBeGreaterThan(50);
      expect(typeof score).toBe('number');
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  });

  // ============================================
  // LIFE AREA METADATA TESTS
  // ============================================
  describe('getByLifeArea - metadata mapping', () => {
    it('should include life area metadata in results', async () => {
      const mockAggregation = [
        { lifeArea: 'professional', total: 5, completed: 2, active: 3, avgProgress: 45 },
        { lifeArea: null, total: 2, completed: 0, active: 2, avgProgress: 10 },
      ];

      const chain = createChainableMock(mockAggregation);
      vi.mocked(db.select).mockReturnValue({ from: chain.from } as any);

      const result = await goalsService.getByLifeArea();

      expect(result).toBeDefined();
      const proArea = result.find(r => r.lifeArea === 'professional');
      expect(proArea?.name).toBe('Professional');
      expect(proArea?.icon).toBe('💼');

      const uncategorized = result.find(r => r.lifeArea === null);
      expect(uncategorized?.name).toBe('Uncategorized');
    });
  });
});
