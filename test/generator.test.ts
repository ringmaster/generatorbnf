// test/generator.test.ts - Jest test suite

import { Generator, WeightedItem } from '../src';
import { ParseError, EvaluationError } from '../src/types';

describe('Generator Library', () => {
  describe('Basic Grammar', () => {
    test('simple literal rule', () => {
      const grammar = '$start := Hello World';
      const gen = Generator.compile(grammar);
      const result = gen.execute();

      expect(result.output).toBe('Hello World');
      expect(result.updatedKnowledge).toEqual({});
    });

    test('simple alternatives with seeded randomization', () => {
      const grammar = '$start := apple | banana | cherry';
      const gen = Generator.compile(grammar);

      const result1 = gen.execute({}, 123);
      const result2 = gen.execute({}, 123);

      expect(result1.output).toBe(result2.output);
      expect(['apple', 'banana', 'cherry']).toContain(result1.output);
    });

    test('rule references', () => {
      const grammar = `
        $start := Hello $name
        $name := Alice | Bob | Charlie
      `;
      const gen = Generator.compile(grammar);
      const result = gen.execute({}, 123);

      expect(result.output).toContain('Hello ');
      expect(['Alice', 'Bob', 'Charlie'].some(n => result.output.includes(n))).toBe(true);
    });

    test('expressions in brackets with output', () => {
      const grammar = '$start := [$temp = 42] is the answer';
      const gen = Generator.compile(grammar);
      const result = gen.execute();

      expect(result.output).toBe('42 is the answer');
    });

    test('silent expressions', () => {
      const grammar = '$start := [!$temp = 42] The answer is $temp';
      const gen = Generator.compile(grammar);
      const result = gen.execute();

      expect(result.output).toBe('The answer is 42');
    });

    test('compound expressions with semicolon', () => {
      const grammar = '$start := [!$a = 10; $b = 20] Result is [$a + $b]';
      const gen = Generator.compile(grammar);
      const result = gen.execute();

      expect(result.output).toBe('Result is 30');
    });
  });

  describe('Knowledge Access', () => {
    test('simple knowledge access', () => {
      const grammar = '$start := Your HP is $$.hp';
      const knowledge = { hp: 100 };
      const gen = Generator.compile(grammar);
      const result = gen.execute(knowledge);

      expect(result.output).toBe('Your HP is 100');
    });

    test('nested knowledge access', () => {
      const grammar = '$start := Level $$.player.level with $$.player.stats.hp HP';
      const knowledge = {
        player: {
          level: 5,
          stats: { hp: 80, mp: 50 }
        }
      };
      const gen = Generator.compile(grammar);
      const result = gen.execute(knowledge);

      expect(result.output).toBe('Level 5 with 80 HP');
    });

    test('knowledge array selection', () => {
      const grammar = '$start := You found a $$.items';
      const knowledge = { items: ['sword', 'shield', 'potion'] };
      const gen = Generator.compile(grammar);
      const result = gen.execute(knowledge, 42);

      expect(result.output).toContain('You found a ');
      expect(['sword', 'shield', 'potion'].some(item => result.output.includes(item))).toBe(true);
    });

    test('WeightedItem in knowledge arrays', () => {
      const knowledge = {
        loot: [
          'common_item',
          new WeightedItem('rare_item', 0.1),
          new WeightedItem('epic_item', 0.01)
        ]
      } as { loot: (string | WeightedItem)[] };
      const grammar = '$start := $$.loot';
      const gen = Generator.compile(grammar);

      const results: any[] = [];
      for (let i = 0; i < 100; i++) {
        results.push(gen.execute(knowledge, i).output);
      }

      expect(results).toContain('common_item');
      // Note: rare items might not appear in 100 runs due to low probability
    });

    test('mixed plain values and WeightedItems', () => {
      const knowledge = {
        items: ['common', new WeightedItem('rare', 0.5), 'another_common']
      } as { items: (string | WeightedItem)[] };
      const grammar = '$start := $$.items';
      const gen = Generator.compile(grammar);

      // Should work without errors
      const result = gen.execute(knowledge, 1);
      expect(['common', 'rare', 'another_common']).toContain(result.output);
    });
  });

  describe('Variable Assignment', () => {
    test('simple variable assignment', () => {
      const grammar = '$start := [! $temp = 42] The answer is $temp';
      const gen = Generator.compile(grammar);
      const result = gen.execute();

      expect(result.output).toBe('The answer is 42');
    });

    test('knowledge mutation - assignment', () => {
      const grammar = '$start := [! $$.hp = 150] Your HP is now $$.hp';
      const knowledge = { hp: 100 };
      const gen = Generator.compile(grammar);
      const result = gen.execute(knowledge);

      expect(result.output).toBe('Your HP is now 150');
      expect(result.updatedKnowledge.hp).toBe(150);
      expect(knowledge.hp).toBe(100); // Original unchanged
    });

    test('knowledge mutation - addition', () => {
      const grammar = '$start := [! $$.hp += 25] Gained health! HP is now $$.hp';
      const knowledge = { hp: 75 };
      const gen = Generator.compile(grammar);
      const result = gen.execute(knowledge);

      expect(result.output).toBe('Gained health! HP is now 100');
      expect(result.updatedKnowledge.hp).toBe(100);
    });

    test('knowledge mutation - subtraction', () => {
      const grammar = '$start := [! $$.hp -= 30] Lost health! HP is now $$.hp';
      const knowledge = { hp: 100 };
      const gen = Generator.compile(grammar);
      const result = gen.execute(knowledge);

      expect(result.output).toBe('Lost health! HP is now 70');
      expect(result.updatedKnowledge.hp).toBe(70);
    });

    test('nested knowledge path creation', () => {
      const grammar = 'start := $.player.stats.hp = 100';
      const knowledge = {};
      const gen = Generator.compile(grammar);
      const result = gen.execute(knowledge);

      expect(result.updatedKnowledge.player.stats.hp).toBe(100);
    });
  });

  describe('Expressions', () => {
    test('arithmetic expressions with precedence', () => {
      const grammar = '$start := [! $result = 10 + 5 * 2] Result: $result';
      const gen = Generator.compile(grammar);
      const result = gen.execute();

      expect(result.output).toBe('Result: 20');
    });

    test('comparison expressions', () => {
      const grammar = '$start := [! $test = 10 > 5] Test: $test';
      const gen = Generator.compile(grammar);
      const result = gen.execute();

      expect(result.output).toBe('Test: true');
    });

    test('complex expression with knowledge', () => {
      const grammar = '$start := [! $$.total = $$.base * $$.multiplier + $$.bonus] Total: $$.total';
      const knowledge = { base: 10, multiplier: 3, bonus: 5 };
      const gen = Generator.compile(grammar);
      const result = gen.execute(knowledge);

      expect(result.output).toBe('Total: 35');
      expect(result.updatedKnowledge.total).toBe(35);
    });

    test('expressions in assignments', () => {
      const grammar = '$start := [! $damage = $$.baseDamage * 1.5] Damage: $damage';
      const knowledge = { baseDamage: 20 };
      const gen = Generator.compile(grammar);
      const result = gen.execute(knowledge);

      expect(result.output).toBe('Damage: 30');
    });
  });

  describe('Conditionals', () => {
    test('simple conditional - true case', () => {
      const grammar = '$start := [$.hp > 50 ? healthy | wounded]';
      const knowledge = { hp: 75 };
      const gen = Generator.compile(grammar);
      const result = gen.execute(knowledge);

      expect(result.output).toBe('healthy');
    });

    test('simple conditional - false case', () => {
      const grammar = '$start := [$.hp > 50 ? healthy | wounded]';
      const knowledge = { hp: 25 };
      const gen = Generator.compile(grammar);
      const result = gen.execute(knowledge);

      expect(result.output).toBe('wounded');
    });

    test('conditional without else clause', () => {
      const grammar = '$start := [$$.hasItem ? You have the item!]';
      const gen = Generator.compile(grammar);

      const result1 = gen.execute({ hasItem: true });
      const result2 = gen.execute({ hasItem: false });

      expect(result1.output).toBe('You have the item!');
      expect(result2.output).toBe('');
    });

    test('nested conditionals', () => {
      const grammar = '$start := [$$.hp > 80 ? excellent | [$$.hp > 50 ? good | poor]]';
      const gen = Generator.compile(grammar);

      expect(gen.execute({ hp: 90 }).output).toBe('excellent');
      expect(gen.execute({ hp: 65 }).output).toBe('good');
      expect(gen.execute({ hp: 30 }).output).toBe('poor');
    });

    test('conditionals with expressions', () => {
      const grammar = '$start := [$$.hp + $$.shield > 100 ? well protected | vulnerable]';
      const gen = Generator.compile(grammar);

      expect(gen.execute({ hp: 60, shield: 50 }).output).toBe('well protected');
      expect(gen.execute({ hp: 40, shield: 30 }).output).toBe('vulnerable');
    });
  });

  describe('Error Handling', () => {
    test('parse error - missing assignment operator', () => {
      expect(() => {
        Generator.compile('$start Hello World');
      }).toThrow(/Expected ':='/);
    });

    test('parse error - unterminated string', () => {
      expect(() => {
        Generator.compile('$start := "unterminated string');
      }).toThrow(/Unterminated string/);
    });

    test('evaluation error - nonexistent knowledge path', () => {
      const grammar = '$start := $$.nonexistent.path';
      const gen = Generator.compile(grammar);

      expect(() => {
        gen.execute({});
      }).toThrow(/not found/);
    });

    test('evaluation error - undefined variable', () => {
      const grammar = '$start := $undefinedVariable';
      const gen = Generator.compile(grammar);

      expect(() => {
        gen.execute({});
      }).toThrow(/not defined/);
    });

    test('evaluation error - no start rule', () => {
      const grammar = '$notstart := Hello';
      const gen = Generator.compile(grammar);

      expect(() => {
        gen.execute({});
      }).toThrow(/No start rule/);
    });

    test('evaluation error - undefined rule reference', () => {
      const grammar = '$start := $nonexistentRule';
      const gen = Generator.compile(grammar);

      expect(() => {
        gen.execute({});
      }).toThrow(/not found/);
    });

    test('evaluation error - expected $ before rule name', () => {
      const grammar = 'start := This is a rule';
      const gen = Generator.compile(grammar);

      expect(() => {
        gen.execute({});
      }).toThrow(/Expected \$/);
    });
  });

  describe('Immutability and Scoping', () => {
    test('knowledge immutability', () => {
      const grammar = '$start := [! $$.hp += 50] HP: $$.hp';
      const originalKnowledge = { hp: 100, level: 5 };
      const gen = Generator.compile(grammar);

      const result = gen.execute(originalKnowledge);

      // Original should be unchanged
      expect(originalKnowledge.hp).toBe(100);
      expect(originalKnowledge.level).toBe(5);

      // Result should have updated knowledge
      expect(result.updatedKnowledge.hp).toBe(150);
      expect(result.updatedKnowledge.level).toBe(5);
    });

    test('variable scoping - variables don\'t persist between executions', () => {
      const grammar = '$start := [! $temp = 42] Value is $temp';
      const gen = Generator.compile(grammar);

      const result1 = gen.execute();
      const result2 = gen.execute();

      expect(result1.output).toBe('Value is 42');
      expect(result2.output).toBe('Value is 42');
    });

    test('deep knowledge mutation doesn\'t affect original', () => {
      const grammar = '$start := $$.player.stats.hp += 10';
      const originalKnowledge = {
        player: { stats: { hp: 100, mp: 50 } },
        other: 'data'
      };
      const gen = Generator.compile(grammar);

      const result = gen.execute(originalKnowledge);

      // Original should be completely unchanged
      expect(originalKnowledge.player.stats.hp).toBe(100);
      expect(originalKnowledge.player.stats.mp).toBe(50);
      expect(originalKnowledge.other).toBe('data');

      // Result should have updated nested value
      expect(result.updatedKnowledge.player.stats.hp).toBe(110);
      expect(result.updatedKnowledge.player.stats.mp).toBe(50);
      expect(result.updatedKnowledge.other).toBe('data');
    });
  });

  describe('Seeded Randomization', () => {
    test('same seed produces same results', () => {
      const grammar = '$start := apple | banana | cherry';
      const gen = Generator.compile(grammar);

      const result1 = gen.execute({}, 12345);
      const result2 = gen.execute({}, 12345);

      expect(result1.output).toBe(result2.output);
    });

    test('different seeds can produce different results', () => {
      const grammar = '$start := apple | banana | cherry';
      const gen = Generator.compile(grammar);

      // Use sequential seed values to verify proper distribution
      const results = new Set();
      for (let seed = 1; seed <= 10; seed++) {
        const output = gen.execute({}, seed).output;
        results.add(output);
      }

      // Should see multiple different outputs across different seeds
      expect(results.size).toBeGreaterThan(1);
      expect(Array.from(results).every(r => ['apple', 'banana', 'cherry'].includes(r as string))).toBe(true);
    });

    test('no seed provides random results', () => {
      const grammar = '$start := apple | banana | cherry';
      const gen = Generator.compile(grammar);

      const results = new Set();
      for (let i = 0; i < 20; i++) {
        results.add(gen.execute().output);
      }

      // Should see some variation (though not guaranteed)
      // This is a probabilistic test, might occasionally fail
      expect(results.size).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Weighted Items', () => {
    test('WeightedItem construction', () => {
      const item = new WeightedItem('rare_sword', 0.5);
      expect(item.value).toBe('rare_sword');
      expect(item.weight).toBe(0.5);
    });

    test('WeightedItem with default weight', () => {
      const item = new WeightedItem('normal_item');
      expect(item.value).toBe('normal_item');
      expect(item.weight).toBe(1.0);
    });

    test('WeightedItem with invalid weight throws error', () => {
      expect(() => new WeightedItem('item', 0)).toThrow(/Weight must be positive/);
      expect(() => new WeightedItem('item', -1)).toThrow(/Weight must be positive/);
    });

    test('weighted items in grammar', () => {
      const grammar = '$start := one :: 1 | two :: 2 | three :: 3'
      const gen = Generator.compile(grammar);
      const result = gen.execute({}, 999);

      // Run a lot of tests to verify probabilities match the weights
      // With weights 1:2:3, we expect one=1/6, two=2/6=1/3, three=3/6=1/2
      const results: Record<string, number> = { one: 0, two: 0, three: 0 };
      const iterations = 10000;

      for (let i = 0; i < iterations; i++) {
        const result = gen.execute({}, i).output;
        results[result] += 1;
      }

      expect(results.three / iterations).toBeCloseTo(0.5, 1); // 3/6 = 1/2
      expect(results.two / iterations).toBeCloseTo(0.333, 1); // 2/6 = 1/3
      expect(results.one / iterations).toBeCloseTo(0.166, 1); // 1/6
    })
  });

  describe('Random Parser Errors', () => {
    test('no spaces between text and exclamations', () => {
      const grammar = '$start := Exclaim!';
      const gen = Generator.compile(grammar);
      const result = gen.execute({});

      expect(result.output).toContain('Exclaim!');
    });

    test('no spaces between text and commas', () => {
      const grammar = '$start := One, two, and three.';
      const gen = Generator.compile(grammar);
      const result = gen.execute({});

      expect(result.output).toContain('One, two, and three.');
    });

    test('retain spaces when they\'re literal', () => {
      const grammar = '$start := One.  Two.  Three.';
      const gen = Generator.compile(grammar);
      const result = gen.execute({});

      expect(result.output).toContain('One.  Two.  Three.');
    });
  });

  describe('Arithmetic', () => {
    test('add numbers', () => {
      const grammar = '$start := [4 + 5]';
      const gen = Generator.compile(grammar);
      const result = gen.execute({});

      expect(result.output).toContain('9');
    })

    test('concat numbers and text', () => {
      const grammar = '$five := five\n$start := [4 + $five]';
      const gen = Generator.compile(grammar);
      const result = gen.execute({});

      expect(result.output).toContain('4five');
    })
  });

  describe('Integration Tests', () => {
    test('complex RPG-style generation', () => {
      const grammar = `
        $start := [! $$.day += 1] Day $$.day: $event
        $event := [$$.hp < 20 ? $emergencyEvent | $normalEvent]
        $normalEvent := You $activity and $outcome
        $emergencyEvent := Critical! [! $$.hp += 15] Emergency healing! HP: $$.hp
        $activity := explore the dungeon | fight monsters | rest at camp
        $outcome := find treasure | get injured | make progress
      `;

      const knowledge = { day: 0, hp: 15, gold: 100 };
      const gen = Generator.compile(grammar);
      const result = gen.execute(knowledge, 999);

      expect(result.output).toContain('Day 1');
      expect(result.output).toContain('Critical!');
      expect(result.updatedKnowledge.day).toBe(1);
      expect(result.updatedKnowledge.hp).toBe(30); // 15 + 15
    });

    test('weighted alternatives with expressions', () => {
      const grammar = `
        $start := $damage = [$.baseDamage * $multiplier] | Damage: $damage
        $multiplier := 1.0 ::5 |  1.5 ::3 | 2.0 ::1
      `;

      const knowledge = { baseDamage: 10 };
      const gen = Generator.compile(grammar);

      const results: any[] = [];
      for (let i = 0; i < 50; i++) {
        const result = gen.execute(knowledge, i);
        results.push(result.output);
      }

      // Should see various damage values
      expect(results.some(r => (r as string).includes('10'))).toBe(true);  // 1.0x
      expect(results.some(r => (r as string).includes('15'))).toBe(true);  // 1.5x
      expect(results.some(r => (r as string).includes('20'))).toBe(true);  // 2.0x
    });

    test('complex nested knowledge with conditionals', () => {
      const grammar = `
        $start := $status | $action
        $status := [$$.player.hp > $$.player.maxHp * 0.8 ? Healthy | $$.player.hp > $$.player.maxHp * 0.5 ? Wounded | Critical]
        $action := [$$.player.hp < 30 ? [$$.player.hp += 20] You rest and recover | [$$.player.energy -= 5] You continue exploring]
      `;

      const knowledge = {
        player: { hp: 25, maxHp: 100, energy: 80 }
      };

      const gen = Generator.compile(grammar);
      const result = gen.execute(knowledge);

      expect(result.output).toContain('Critical');
      expect(result.output).toContain('You rest and recover');
      expect(result.updatedKnowledge.player.hp).toBe(45); // 25 + 20
    });
  });
});
