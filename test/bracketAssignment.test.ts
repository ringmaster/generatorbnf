import { Generator } from '../src/generator';

describe('Bracket Assignment Tests', () => {
  test('assignments in brackets should return their value', () => {
    // The original failing test
    const grammar = '$start := [$temp = 42] is the answer';
    const gen = Generator.compile(grammar);
    const result = gen.execute();

    expect(result.output).toBe('42 is the answer');
  });

  test('assignments in brackets with expressions', () => {
    const grammar = '$start := [$value = 5 * 7] is the result';
    const gen = Generator.compile(grammar);
    const result = gen.execute();

    expect(result.output).toBe('35 is the result');
  });

  test('variable vs rule handling', () => {
    // Mimic the example provided:
    // $x := 4
    // $y := [$x + 3]
    // $foo := [$z = $y * 2]
    const grammar = '$x := 4\n$y := [$x + 3]\n$foo := [$z = $y * 2]\n$start := $foo';
    const gen = Generator.compile(grammar);
    const result = gen.execute();

    expect(result.output).toBe('14');
  });

  test('silent assignments', () => {
    const grammar = '$start := [!$x = 42] is hidden';
    const gen = Generator.compile(grammar);
    const result = gen.execute();

    expect(result.output).toBe('is hidden');
  });

  test('rule references in expressions', () => {
    const grammar = '$value := 5\n$start := The value is [$value * 2]';
    const gen = Generator.compile(grammar);
    const result = gen.execute();

    expect(result.output).toBe('The value is 10');
  });

  test('nested rule and variable references', () => {
    const grammar = '$x := 4\n$y := [$x + 3]\n$start := Result: $y';
    const gen = Generator.compile(grammar);
    const result = gen.execute();

    expect(result.output).toBe('Result: 7');
  });
});
