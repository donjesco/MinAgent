# Tests

This directory contains the test suite for MinAgent.

## Structure

```
tests/
├── unit/              # Unit tests - individual components
├── integration/       # Integration tests - component interactions
├── e2e/              # End-to-end tests - full workflows
├── cli/              # CLI lifecycle tests
├── fixtures/         # Test fixtures and mocks
└── helpers/          # Test utilities
```

## Categories

### Unit Tests
- Individual function tests
- Pure function isolation
- Mock dependencies
- Fast execution (< 1s each)

### Integration Tests
- Component interactions
- API integration
- Database connections
- Middleware testing

### E2E Tests
- Full user workflows
- CLI commands
- End-to-end scenarios
- Longer execution

### CLI Tests
- Command line interface
- Input/output validation
- Error handling
- User prompts

## Running Tests

### Run all tests
```bash
npm test
```

### Run specific test categories
```bash
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:cli
```

### Run tests with coverage
```bash
npm run test:coverage
```

### Run all checks
```bash
npm run check-all
```

## Test Coverage

### Thresholds
- Lines: 80%
- Functions: 80%
- Branches: 80%
- Statements: 80%

### Generate Coverage Report
```bash
npm run test:coverage
```

Coverage report will be generated in:
- `coverage/index.html` - HTML report
- `coverage/coverage-final.json` - JSON data

## Writing Tests

### Test File Structure
```javascript
import { strict as assert } from 'assert';
import { describe, it } from 'node:test';
import { deepEqual, equal, ok } from 'node:assert';

describe('Test Suite Name', () => {
  it('should test something', () => {
    // Test code
    equal(result, expected);
  });
});
```

### Best Practices
- Use `node:test` built-in test runner
- Keep tests fast and isolated
- Use fixtures in `tests/fixtures/`
- Use helpers in `tests/helpers/`
- Test one thing at a time
- Include error handling

## CI/CD

Tests are run automatically on:
- Push to main/develop branches
- Pull requests

See `.github/workflows/ci.yml` for details.

## Adding New Tests

1. Create test file in appropriate directory
2. Use `node:test` assertions
3. Include fixtures if needed
4. Run tests locally before committing
5. Ensure coverage threshold is met

## Test Helpers

Available helpers in `tests/helpers/`:
- `mockTool()` - Mock tool calls
- `mockFile()` - Mock file operations
- `mockMCP()` - Mock MCP connections

## Fixtures

Available fixtures in `tests/fixtures/`:
- Sample files
- Test data
- Mock configurations

## Notes

- Tests must pass before merging
- Coverage threshold: 80%
- All tests must be deterministic
- No flaky tests allowed
