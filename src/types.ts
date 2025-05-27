// types.ts - Core type definitions

// Weighted item for knowledge arrays
export class WeightedItem {
  constructor(
    public value: any,
    public weight: number = 1.0
  ) {
    if (weight <= 0) {
      throw new Error('Weight must be positive');
    }
  }
}

// Define KnowledgeValue to include any to support dynamic properties
export type KnowledgeValue = string | number | boolean | WeightedItem | KnowledgeValue[] | { [key: string]: any };

// Use a more flexible index signature for KnowledgeObject
export interface KnowledgeObject {
  [key: string]: any;
}

export interface ExecutionResult {
  output: string | any; // Support both string and structured output
  updatedKnowledge: KnowledgeObject;
}

export interface ExecutionContext {
  knowledge: KnowledgeObject;
  variables: Map<string, any>; // Temporary variables scoped to execution
  random: () => number; // Seeded random number generator
}

export interface EvaluationResult {
  value: any;
  updatedKnowledge: KnowledgeObject;
}

// Token types for lexer
export enum TokenType {
  // Literals
  STRING = 'STRING',
  NUMBER = 'NUMBER',
  IDENTIFIER = 'IDENTIFIER',
  
  // Operators
  ASSIGN = '=',
  PLUS_ASSIGN = '+=',
  MINUS_ASSIGN = '-=',
  PLUS = '+',
  MINUS = '-',
  MULTIPLY = '*',
  DIVIDE = '/',
  
  // Comparison
  EQUALS = '==',
  NOT_EQUALS = '!=',
  LESS_THAN = '<',
  GREATER_THAN = '>',
  LESS_EQUAL = '<=',
  GREATER_EQUAL = '>=',
  
  // Punctuation
  DOT = '.',
  COMMA = ',',
  PIPE = '|',
  COLON = ':',
  DOUBLE_COLON = '::',
  QUESTION = '?',
  EXCLAMATION = '!',
  SEMICOLON = ';',
  
  // Grouping
  LPAREN = '(',
  RPAREN = ')',
  LBRACKET = '[',
  RBRACKET = ']',
  
  // Special
  DOLLAR = '$',
  NEWLINE = 'NEWLINE',
  EOF = 'EOF',
  
  // Keywords
  ASSIGN_OP = ':=',
}

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
}

// Parser error for better debugging
export class ParseError extends Error {
  constructor(
    message: string,
    public line: number,
    public column: number,
    public token?: Token
  ) {
    super(`Parse error at line ${line}, column ${column}: ${message}`);
    this.name = 'ParseError';
  }
}

export class EvaluationError extends Error {
  constructor(
    message: string,
    public path?: string
  ) {
    super(path ? `Evaluation error at ${path}: ${message}` : `Evaluation error: ${message}`);
    this.name = 'EvaluationError';
  }
}