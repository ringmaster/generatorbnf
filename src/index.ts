// index.ts - Main library exports and usage examples

export { Generator, WeightedItem } from './generator';
export type { KnowledgeObject, ExecutionResult } from './types';

// Export AST node types for advanced usage
export {
  Grammar,
  Rule,
  Alternative,
  Literal,
  VariableReference,
  Assignment,
  BinaryExpression,
  SilentExpression,
  RuleReference,
  ConditionalExpression,
  CompoundExpression
} from './ast/nodes';

// Export error types
export { ParseError, EvaluationError } from './types';

/*
USAGE EXAMPLES:

// Basic usage
import { Generator, WeightedItem } from './text-generator';

const grammar = `
start := Hello $name, you have $.hp health points!
name := Alice | Bob | Charlie
`;

const knowledge = {
  hp: 100,
  items: ["sword", "shield", new WeightedItem("magic_ring", 0.1)]
};

const generator = Generator.compile(grammar);
const result = generator.execute(knowledge, 12345); // seed for deterministic output

console.log(result.output);
// Output: "Hello Alice, you have 100 health points!"

// Advanced usage with mutations
const advancedGrammar = `
start := $.hp += 10 | You gained health! Now you have $.hp HP.
combat := $damage = $.level * 2 | $.hp -= $damage | You took $damage damage!
levelup := $.level += 1 | $.hp += $.level * 5 | Level up!
`;

const gameState = {
  hp: 50,
  level: 3,
  experience: 150
};

const gameGen = Generator.compile(advancedGrammar);
const combatResult = gameGen.execute(gameState);

console.log(combatResult.output);
console.log('Updated state:', combatResult.updatedKnowledge);

// Conditional expressions
const conditionalGrammar = `
start := [$.hp < 20 ? You are badly wounded! | You feel fine.]
status := Your health is [$.hp > 80 ? excellent | $.hp > 50 ? good | $.hp > 20 ? poor | critical]
`;

// Weighted selections
const weightedKnowledge = {
  loot: [
    "gold coin",
    new WeightedItem("silver coin", 2.0), // 2x more likely
    new WeightedItem("rare gem", 0.1),    // Very rare
    "iron ore"
  ]
};

const lootGrammar = `
start := You found a $.loot!
`;

// Complex expressions
const complexGrammar = `
start := $totalDamage = $.baseDamage * ($.strength / 10) + $bonusDamage
bonusDamage := $.level >= 10 ? $.level * 2 | 0
result := You deal $totalDamage damage!
`;

// Nested knowledge access
const nestedKnowledge = {
  player: {
    stats: {
      hp: 100,
      mp: 50
    },
    inventory: {
      weapons: ["sword", "bow"],
      armor: "leather"
    }
  },
  game: {
    difficulty: "normal",
    chapter: 3
  }
};

const nestedGrammar = `
start := Chapter $.game.chapter: Your HP is $.player.stats.hp
inventory := You are wearing $.player.inventory.armor armor
weapon := You wield a $.player.inventory.weapons
`;

// Error handling
try {
  const badGrammar = Generator.compile("invalid := $.nonexistent.path");
  const badResult = badGrammar.execute({}); // Will throw EvaluationError
} catch (error) {
  console.error('Generation failed:', error.message);
}

// Deterministic output with seeds
const deterministicGen = Generator.compile("start := [heads | tails]");

console.log(deterministicGen.execute({}, 123).output); // Always same result for seed 123
console.log(deterministicGen.execute({}, 123).output); // Same as above
console.log(deterministicGen.execute({}, 456).output); // Different result for different seed
*/
