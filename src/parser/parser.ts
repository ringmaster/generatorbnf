// parser/parser.ts - Clean recursive descent parser for new syntax

import {
  Token,
  TokenType,
  ParseError
} from '../types';
import { Lexer } from './lexer';
import {
  Grammar,
  Rule,
  Alternative,
  Literal,
  VariableReference,
  Assignment,
  BinaryExpression,
  ConditionalExpression,
  SilentExpression,
  CompoundExpression,
  RuleReference,
  ASTNode
} from '../ast/nodes';

export class Parser {
  private tokens: Token[];
  private current: number = 0;

  constructor(input: string) {
    const lexer = new Lexer(input);
    this.tokens = lexer.tokenize();
  }

  parse(): Grammar {
    const rules = new Map<string, Rule>();

    while (!this.isAtEnd()) {
      this.skipNewlines();
      if (this.isAtEnd()) break;

      const rule = this.parseRule();
      rules.set(rule.name, rule);
    }

    if (rules.size === 0) {
      throw new ParseError('No rules found', 1, 1);
    }

    return new Grammar(rules);
  }

  private parseRule(): Rule {
    // Expect: $ruleName := alternatives
    this.consume(TokenType.DOLLAR, 'Expected $ before rule name');
    const nameToken = this.consume(TokenType.IDENTIFIER, 'Expected rule name after $');
    const name = nameToken.value;

    this.consume(TokenType.ASSIGN_OP, "Expected ':=' after rule name");

    const alternatives = this.parseAlternatives();

    return new Rule(name, alternatives);
  }

  private parseAlternatives(): Alternative[] {
    const alternatives: Alternative[] = [];

    alternatives.push(this.parseAlternative());

    while (this.match(TokenType.PIPE)) {
      alternatives.push(this.parseAlternative());
    }

    return alternatives;
  }

  private parseAlternative(): Alternative {
    const elements: ASTNode[] = [];
    let weight = 1.0;

    // Parse elements until we hit | or end of rule
    while (!this.isAtEnd() &&
      !this.check(TokenType.PIPE) &&
      !this.isStartOfNextRule()) {

      // Skip newlines within alternatives
      if (this.match(TokenType.NEWLINE)) {
        elements.push(new Literal('\n'));
        continue;
      }

      const element = this.parseElement();
      elements.push(element);

      // Check for weight syntax (element::weight) - only double colon is allowed
      if (this.match(TokenType.DOUBLE_COLON) && this.check(TokenType.NUMBER)) {
        weight = parseFloat(this.advance().value);
        break; // Weight applies to this whole alternative
      }
    }

    if (elements.length === 0) {
      throw new ParseError('Empty alternative', this.peek().line, this.peek().column);
    }

    return new Alternative(elements, weight);
  }

  private parseElement(): ASTNode {
    // Bracketed expressions [...]
    if (this.match(TokenType.LBRACKET)) {
      return this.parseBracketedExpression();
    }

    // Dollar variables/rules $...
    if (this.match(TokenType.DOLLAR)) {
      return this.parseDollarExpression();
    }

    // String literals
    if (this.check(TokenType.STRING)) {
      return new Literal(this.advance().value);
    }

    // Number literals
    if (this.check(TokenType.NUMBER)) {
      return new Literal(this.advance().value);
    }

    // Identifiers (literal text)
    if (this.check(TokenType.IDENTIFIER)) {
      return new Literal(this.advance().value);
    }

    // Everything else is literal text
    const token = this.advance();
    if (token.type !== TokenType.EOF) {
      return new Literal(token.value);
    }

    throw new ParseError(
      `Unexpected token: ${this.peek().value}`,
      this.peek().line,
      this.peek().column
    );
  }

  private parseBracketedExpression(): ASTNode {
    // Check for silent expression [!...]
    const isSilent = this.match(TokenType.EXCLAMATION);

    // Parse compound expressions separated by semicolons
    const expressions: ASTNode[] = [];

    do {
      const expr = this.parseExpression();
      expressions.push(expr);
    } while (this.match(TokenType.SEMICOLON));

    this.consume(TokenType.RBRACKET, "Expected ']' after bracketed expression");

    let result: ASTNode;
    if (expressions.length === 1) {
      result = expressions[0];
    } else {
      result = new CompoundExpression(expressions);
    }

    return isSilent ? new SilentExpression(result) : result;
  }

  private parseDollarExpression(): ASTNode {
    // Already consumed the first $

    // Check for $$ (knowledge access)
    if (this.match(TokenType.DOLLAR)) {
      this.consume(TokenType.DOT, 'Expected . after $$');
      const path = ['$']; // Special marker for knowledge

      path.push(this.consume(TokenType.IDENTIFIER, 'Expected property name after $$.').value);

      while (this.match(TokenType.DOT)) {
        path.push(this.consume(TokenType.IDENTIFIER, 'Expected property name after .').value);
      }

      return new VariableReference(path, true);
    }

    // Regular $identifier (rule reference or variable)
    const identifier = this.consume(TokenType.IDENTIFIER, 'Expected identifier after $').value;

    // Check if this has dot notation (variable path)
    if (this.match(TokenType.DOT)) {
      const path = [identifier];
      do {
        path.push(this.consume(TokenType.IDENTIFIER, 'Expected property name after .').value);
      } while (this.match(TokenType.DOT));

      return new VariableReference(path, false);
    }

    // If we're in an expression context, treat as variable reference
    if (this.isInExpressionContext()) {
      return new VariableReference([identifier], false);
    }
    
    // Simple rule reference
    return new RuleReference(identifier);
  }

  private isInExpressionContext(): boolean {
    // Check if we're inside a bracketed expression or after an operator
    // that would indicate we're in an expression context
    const nextToken = this.peek();
    return nextToken.type === TokenType.PLUS || 
           nextToken.type === TokenType.MINUS || 
           nextToken.type === TokenType.MULTIPLY || 
           nextToken.type === TokenType.DIVIDE ||
           nextToken.type === TokenType.EQUALS ||
           nextToken.type === TokenType.NOT_EQUALS ||
           nextToken.type === TokenType.GREATER_THAN ||
           nextToken.type === TokenType.LESS_THAN ||
           nextToken.type === TokenType.GREATER_EQUAL ||
           nextToken.type === TokenType.LESS_EQUAL ||
           nextToken.type === TokenType.RPAREN ||
           nextToken.type === TokenType.ASSIGN ||
           nextToken.type === TokenType.PLUS_ASSIGN ||
           nextToken.type === TokenType.MINUS_ASSIGN;
  }

  private parseExpression(): ASTNode {
    return this.parseConditional();
  }

  private parseConditional(): ASTNode {
    let expr = this.parseAssignment();

    if (this.match(TokenType.QUESTION)) {
      const trueValue = this.parseAssignment();

      let falseValue: ASTNode | undefined;
      if (this.match(TokenType.PIPE)) {
        falseValue = this.parseAssignment();
      }

      return new ConditionalExpression(expr, trueValue, falseValue);
    }

    return expr;
  }

  private parseAssignment(): ASTNode {
    let expr = this.parseComparison();

    if (this.match(TokenType.ASSIGN, TokenType.PLUS_ASSIGN, TokenType.MINUS_ASSIGN)) {
      const operator = this.previous().value as '=' | '+=' | '-=';
      const right = this.parseAssignment();

      // Create a variable reference if needed for assignment
      if (!(expr instanceof VariableReference)) {
        // When we encounter non-variable targets in assignment contexts,
        // create a new variable reference
        const tempVarName = `temp_${this.current}`;
        expr = new VariableReference([tempVarName], false);
      }

      return new Assignment(expr as VariableReference, operator, right);
    }

    return expr;
  }

  private parseComparison(): ASTNode {
    let expr = this.parseAddition();

    while (this.match(TokenType.EQUALS, TokenType.NOT_EQUALS,
      TokenType.GREATER_THAN, TokenType.GREATER_EQUAL,
      TokenType.LESS_THAN, TokenType.LESS_EQUAL)) {
      const operator = this.previous().value as any;
      const right = this.parseAddition();
      expr = new BinaryExpression(expr, operator, right);
    }

    return expr;
  }

  private parseAddition(): ASTNode {
    let expr = this.parseMultiplication();

    while (this.match(TokenType.PLUS, TokenType.MINUS)) {
      const operator = this.previous().value as '+' | '-';
      const right = this.parseMultiplication();
      expr = new BinaryExpression(expr, operator, right);
    }

    return expr;
  }

  private parseMultiplication(): ASTNode {
    let expr = this.parsePrimary();

    while (this.match(TokenType.MULTIPLY, TokenType.DIVIDE)) {
      const operator = this.previous().value as '*' | '/';
      const right = this.parsePrimary();
      expr = new BinaryExpression(expr, operator, right);
    }

    return expr;
  }

  private parsePrimary(): ASTNode {
    if (this.match(TokenType.NUMBER)) {
      return new Literal(this.previous().value);
    }

    if (this.match(TokenType.STRING)) {
      return new Literal(this.previous().value);
    }

    if (this.match(TokenType.DOLLAR)) {
      return this.parseDollarExpression();
    }

    if (this.match(TokenType.IDENTIFIER)) {
      return new Literal(this.previous().value);
    }

    if (this.match(TokenType.LPAREN)) {
      const expr = this.parseExpression();
      this.consume(TokenType.RPAREN, "Expected ')' after expression");
      return expr;
    }

    throw new ParseError(
      `Unexpected token in expression: ${this.peek().value}`,
      this.peek().line,
      this.peek().column
    );
  }

  // Utility methods
  private match(...types: TokenType[]): boolean {
    for (const type of types) {
      if (this.check(type)) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  private check(type: TokenType): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }

  private isAtEnd(): boolean {
    return this.peek().type === TokenType.EOF;
  }

  private peek(): Token {
    return this.tokens[this.current];
  }

  private previous(): Token {
    return this.tokens[this.current - 1];
  }

  private consume(type: TokenType, message: string): Token {
    if (this.check(type)) return this.advance();

    const current = this.peek();
    throw new ParseError(message, current.line, current.column, current);
  }

  private skipNewlines(): void {
    while (this.match(TokenType.NEWLINE)) {
      // Skip newlines between rules
    }
  }

  private isStartOfNextRule(): boolean {
    return this.check(TokenType.DOLLAR) &&
      this.tokens[this.current + 1]?.type === TokenType.IDENTIFIER &&
      this.tokens[this.current + 2]?.type === TokenType.ASSIGN_OP;
  }
}
