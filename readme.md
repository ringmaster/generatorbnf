# Text Generator BNF Library

A portable TypeScript/JavaScript library for BNF-style text generation with knowledge integration, inspired by Perchance.

## Features

- ✅ **Two-step API**: Compile once, execute many times
- ✅ **Knowledge Integration**: `$knowledge.path.to.value` syntax
- ✅ **Immutable Operations**: Returns new knowledge objects
- ✅ **Weighted Selection**: Support for `WeightedItem` in knowledge
- ✅ **Perchance-like Conditionals**: `[condition ? trueValue | falseValue]`
- ✅ **Full Expression Support**: Math, comparisons, complex assignments
- ✅ **Seeded Randomization**: Deterministic output with seeds
- ✅ **TypeScript Support**: Full type safety throughout

## Installation

```bash
npm install text-generator-bnf
```

## Quick Start

```typescript
import { Generator, WeightedItem } from 'text-generator-bnf';

// Define your grammar
const grammar = `
  start := Hello $name, you have $.hp health!
  name := Alice | Bob | Charlie
`;

// Prepare knowledge
const knowledge = {
  hp: 100,
  items: ["sword", new WeightedItem("magic_ring", 0.1)]
};

// Compile and execute
const generator = Generator.compile(grammar);
const result = generator.execute(knowledge, 12345); // Optional seed

console.log(result.output);
// "Hello Alice, you have 100 health!"

console.log(result.updatedKnowledge);
// { hp: 100, items: [...] }
```

## Grammar Syntax

### Basic Rules
```
rulename := alternative1 | alternative2 | alternative3
start := Hello World
```

### Weighted Alternatives
```
loot := common_item:10 | rare_item:2 | epic_item:1
```

### Knowledge Access
```
status := Your HP is $.player.hp
nested := $.game.level.current
```

### Variable Assignment
```
calculation := $temp = $.base * 2 | Result: $temp
mutation := $.hp += 10 | Healed! HP: $.hp
```

### Conditionals
```
health := [$.hp > 50 ? healthy | wounded]
complex := [$.level >= 10 ? $highLevel | $lowLevel]
```

### Expressions
```
damage := $.damage = $.base * ($.strength / 10)
comparison := [$.hp + $.armor > 100 ? safe | danger]
```

## API Reference

### Generator.compile(grammar: string)
Compiles a grammar string into an executable AST.

### generator.execute(knowledge?, seed?)
Executes the compiled grammar with optional knowledge and seed.

**Parameters:**
- `knowledge`: Object containing data accessible via `$knowledge.path`
- `seed`: Optional number for deterministic randomization

**Returns:**
```typescript
{
  output: string | any,           // Generated result
  updatedKnowledge: KnowledgeObject  // Modified knowledge object
}
```

### WeightedItem(value, weight)
Creates a weighted item for knowledge arrays.

```typescript
new WeightedItem("rare_item", 0.1)  // 10% weight
```

## Development

### Setup
```bash
npm install
```

### Build
```bash
npm run build
```

### Testing
```bash
# Run all tests
npm test

# Watch mode for development
npm run test:watch

# Coverage report
npm run test:coverage
```

### Test Structure

Our comprehensive test suite covers:

- **Basic Grammar**: Literals, alternatives, weighted selection
- **Knowledge Access**: Simple and nested paths, array selection
- **Variable Assignment**: Temporary variables and knowledge mutation
- **Expressions**: Arithmetic, comparisons, operator precedence
- **Conditionals**: Simple and nested conditional logic
- **Error Handling**: Parse errors and evaluation errors
- **Immutability**: Ensuring original knowledge isn't modified
- **Seeded Randomization**: Deterministic behavior
- **Integration Tests**: Complex real-world scenarios

### Running Specific Tests

```bash
# Run a specific test file
npm test -- generator.test.ts

# Run tests matching a pattern
npm test -- --testNamePattern="Knowledge"

# Run tests in watch mode with coverage
npm run test:watch -- --coverage
```

### Example Test Results

```
 PASS  test/generator.test.ts
  Generator Library
    Basic Grammar
      ✓ simple literal rule (2ms)
      ✓ simple alternatives with seeded randomization (3ms)
      ✓ weighted alternatives (12ms)
    Knowledge Access
      ✓ simple knowledge access (1ms)
      ✓ nested knowledge access (1ms)
      ✓ knowledge array selection (2ms)
    Variable Assignment
      ✓ knowledge mutation - addition (1ms)
      ✓ complex expression in assignment (2ms)
    ...

Test Suites: 1 passed, 1 total
Tests:       45 passed, 45 total
Snapshots:   0 total
Time:        2.345s
```

## Advanced Usage

### Complex RPG Example
```typescript
const rpgGrammar = `
  start := Day $.day: $event
  event := [$.hp < 20 ? $emergency | $normal]
  emergency := $.hp += 15 | Emergency healing! HP: $.hp
  normal := You $activity and $outcome
  activity := explore | fight | rest
  outcome := [$.luck > 7 ? succeed greatly | succeed | struggle]
`;

const gameState = { day: 1, hp: 15, luck: 8 };
const result = rpgGenerator.execute(gameState);
```

### Weighted Knowledge Arrays
```typescript
const knowledge = {
  loot: [
    "gold",
    new WeightedItem("silver", 2.0),     // 2x more likely
    new WeightedItem("gem", 0.1),        // Very rare
    "copper"                             // Default weight 1.0
  ]
};
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass: `npm test`
5. Submit a pull request

## License

MIT License - see LICENSE file for details.