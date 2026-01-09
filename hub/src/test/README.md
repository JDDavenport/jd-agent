# Testing Guide

This document describes testing patterns and conventions for the JD Agent Hub backend.

## Running Tests

```bash
# Run all tests in watch mode
bun run test

# Run all tests once
bun run test:run

# Run with coverage report
bun run test:coverage

# Open Vitest UI (interactive browser-based runner)
bun run test:ui

# Run specific test file
bun run test:run src/services/goals-service.test.ts
```

## Writing Tests

### Service Tests Pattern

See `goals-service.test.ts` for the standard pattern:

1. **Mock database dependencies** at the top of the file
2. **Test happy paths** (valid inputs produce expected outputs)
3. **Test error cases** (invalid inputs, missing data)
4. **Test edge cases** (null values, empty arrays, boundaries)
5. **Verify database calls** are made with correct arguments

### Test File Structure

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { myService } from './my-service';
import { db } from '../db/client';

// Mock dependencies
vi.mock('../db/client', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('MyService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('methodName', () => {
    it('should do expected behavior with valid input', async () => {
      // Arrange: Set up test data and mocks
      const mockData = { id: '1', name: 'Test' };
      vi.mocked(db.select).mockReturnValue(/* mock chain */);

      // Act: Call the method
      const result = await myService.methodName('1');

      // Assert: Verify results
      expect(result).toEqual(mockData);
      expect(db.select).toHaveBeenCalled();
    });

    it('should return null when not found', async () => {
      // Test error/edge cases
    });
  });
});
```

### Mocking Drizzle ORM

Drizzle uses chainable query builders. Create a helper to mock chains:

```typescript
function createChainableMock(finalValue: unknown) {
  const chain: Record<string, Mock> = {};
  
  chain.returning = vi.fn().mockReturnValue(Promise.resolve(finalValue));
  chain.limit = vi.fn().mockReturnValue(Promise.resolve(finalValue));
  chain.orderBy = vi.fn().mockReturnValue({ limit: chain.limit });
  chain.where = vi.fn().mockReturnValue({
    returning: chain.returning,
    limit: chain.limit,
    orderBy: chain.orderBy,
  });
  chain.from = vi.fn().mockReturnValue({
    where: chain.where,
    orderBy: chain.orderBy,
  });
  
  return chain;
}

// Usage
const chain = createChainableMock([mockData]);
vi.mocked(db.select).mockReturnValue({ from: chain.from } as any);
```

## Coverage Goals

| Component Type | Target Coverage |
|----------------|-----------------|
| Services       | 60%+ statements |
| Integrations   | 40%+ statements |
| Critical paths | 80%+ statements |
| Utilities      | 80%+ statements |

## Test Categories

### Unit Tests (`.test.ts`)
- Test individual functions/methods in isolation
- Mock all external dependencies
- Fast execution (<100ms per test)
- Located next to the source file

### Integration Tests (future)
- Test multiple components together
- May use test database
- Located in `src/test/integration/`

## Best Practices

1. **One assertion per test** - When possible, keep tests focused
2. **Descriptive test names** - Use "should [expected behavior]" format
3. **Arrange-Act-Assert** - Structure tests clearly
4. **Don't test implementation** - Test behavior, not internals
5. **Mock at boundaries** - Mock database, external APIs, not internal functions
6. **Reset mocks between tests** - Use `beforeEach(() => vi.clearAllMocks())`

## Common Patterns

### Testing async functions
```typescript
it('should handle async operation', async () => {
  const result = await service.asyncMethod();
  expect(result).toBeDefined();
});
```

### Testing error conditions
```typescript
it('should throw on invalid input', async () => {
  await expect(service.method(null)).rejects.toThrow();
});
```

### Testing with different inputs
```typescript
it.each([
  ['input1', 'expected1'],
  ['input2', 'expected2'],
])('should transform %s to %s', async (input, expected) => {
  expect(await service.transform(input)).toBe(expected);
});
```

## Running Legacy Tests

The project also has legacy integration tests:

```bash
# Run legacy test suite
bun run test:legacy

# Run VIP pipeline tests
bun run test:vip

# Run AI model tests
bun run test:ai
```
