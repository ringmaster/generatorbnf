// generator.ts - Main API class

import { Parser } from './parser/parser';
import { Grammar } from './ast/nodes';
import { 
  KnowledgeObject, 
  ExecutionResult, 
  ExecutionContext,
  WeightedItem 
} from './types';

export class Generator {
  private ast: Grammar;

  private constructor(ast: Grammar) {
    this.ast = ast;
  }

  /**
   * Compile a grammar string into an executable AST
   */
  static compile(grammar: string): Generator {
    const parser = new Parser(grammar);
    const ast = parser.parse();
    return new Generator(ast);
  }

  /**
   * Execute the compiled grammar with given knowledge and optional seed
   */
  execute(knowledge: KnowledgeObject = {}, seed?: number): ExecutionResult {
    const context = this.createExecutionContext(knowledge, seed);
    
    try {
      const result = this.ast.evaluate(context);
      
      return {
        output: result.value,
        updatedKnowledge: result.updatedKnowledge
      };
    } catch (error) {
      // Re-throw with additional context if needed
      throw error;
    }
  }

  /**
   * Get a string representation of the compiled AST (for debugging)
   */
  toString(): string {
    return this.ast.toString();
  }

  private createExecutionContext(knowledge: KnowledgeObject, seed?: number): ExecutionContext {
    // Create seeded random number generator
    const random = this.createSeededRandom(seed);
    
    return {
      knowledge: { ...knowledge }, // Shallow copy to prevent accidental mutation
      variables: new Map<string, any>(),
      random
    };
  }

  private createSeededRandom(seed?: number): () => number {
    // If no seed is provided, use Math.random directly
    if (seed === undefined) {
      return Math.random;
    }
    
    // Mix the seed with a prime number to avoid sequential patterns
    // Initialize with a scrambled seed value
    let state = seed * 1664525 + 1013904223; // LCG parameters from Numerical Recipes
    
    return (): number => {
      // Use a high-quality mixing function (PCG-inspired)
      state = ((state * 747796405) + 2891336453) >>> 0;
      const word = ((state >>> ((state >>> 28) + 4)) ^ state) * 277803737;
      const result = (word ^ (word >>> 22)) >>> 0;
      
      // Convert to floating point between 0 and 1
      return result / 4294967296;
    };
  }
}

// Re-export commonly used types and classes
export { WeightedItem } from './types';
export type { KnowledgeObject, ExecutionResult } from './types';