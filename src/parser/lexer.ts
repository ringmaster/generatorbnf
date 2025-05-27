// parser/lexer.ts - Tokenization logic

import { Token, TokenType, ParseError } from '../types';

export class Lexer {
  private input: string;
  private position: number = 0;
  private line: number = 1;
  private column: number = 1;

  constructor(input: string) {
    this.input = input;
  }

  tokenize(): Token[] {
    const tokens: Token[] = [];
    
    while (!this.isAtEnd()) {
      this.skipWhitespace();
      
      if (this.isAtEnd()) break;
      
      const token = this.nextToken();
      if (token) {
        tokens.push(token);
      }
    }
    
    tokens.push(this.createToken(TokenType.EOF, ''));
    return tokens;
  }

  private nextToken(): Token | null {
    const start = this.position;
    const startLine = this.line;
    const startColumn = this.column;
    
    const char = this.advance();
    
    switch (char) {
      case '\n':
        return this.createToken(TokenType.NEWLINE, char, startLine, startColumn);
      case '(':
        return this.createToken(TokenType.LPAREN, char, startLine, startColumn);
      case ')':
        return this.createToken(TokenType.RPAREN, char, startLine, startColumn);
      case '[':
        return this.createToken(TokenType.LBRACKET, char, startLine, startColumn);
      case ']':
        return this.createToken(TokenType.RBRACKET, char, startLine, startColumn);
      case '.':
        return this.createToken(TokenType.DOT, char, startLine, startColumn);
      case ',':
        return this.createToken(TokenType.COMMA, char, startLine, startColumn);
      case '|':
        return this.createToken(TokenType.PIPE, char, startLine, startColumn);
      case '?':
        return this.createToken(TokenType.QUESTION, char, startLine, startColumn);
      case ';':
        return this.createToken(TokenType.SEMICOLON, char, startLine, startColumn);
      case '$':
        return this.createToken(TokenType.DOLLAR, char, startLine, startColumn);
      case '+':
        if (this.match('=')) {
          return this.createToken(TokenType.PLUS_ASSIGN, '+=', startLine, startColumn);
        }
        return this.createToken(TokenType.PLUS, char, startLine, startColumn);
      case '-':
        if (this.match('=')) {
          return this.createToken(TokenType.MINUS_ASSIGN, '-=', startLine, startColumn);
        }
        return this.createToken(TokenType.MINUS, char, startLine, startColumn);
      case '*':
        return this.createToken(TokenType.MULTIPLY, char, startLine, startColumn);
      case '/':
        return this.createToken(TokenType.DIVIDE, char, startLine, startColumn);
      case '=':
        if (this.match('=')) {
          return this.createToken(TokenType.EQUALS, '==', startLine, startColumn);
        }
        return this.createToken(TokenType.ASSIGN, char, startLine, startColumn);
      case '!':
        if (this.match('=')) {
          return this.createToken(TokenType.NOT_EQUALS, '!=', startLine, startColumn);
        }
        return this.createToken(TokenType.EXCLAMATION, char, startLine, startColumn);
      case '<':
        if (this.match('=')) {
          return this.createToken(TokenType.LESS_EQUAL, '<=', startLine, startColumn);
        }
        return this.createToken(TokenType.LESS_THAN, char, startLine, startColumn);
      case '>':
        if (this.match('=')) {
          return this.createToken(TokenType.GREATER_EQUAL, '>=', startLine, startColumn);
        }
        return this.createToken(TokenType.GREATER_THAN, char, startLine, startColumn);
      case ':':
        if (this.match('=')) {
          return this.createToken(TokenType.ASSIGN_OP, ':=', startLine, startColumn);
        }
        if (this.match(':')) {
          return this.createToken(TokenType.DOUBLE_COLON, '::', startLine, startColumn);
        }
        return this.createToken(TokenType.COLON, char, startLine, startColumn);
      case '"':
      case "'":
        return this.string(char, startLine, startColumn);
      default:
        if (this.isDigit(char)) {
          return this.number(startLine, startColumn);
        } else if (this.isAlpha(char)) {
          return this.identifier(startLine, startColumn);
        } else {
          throw new ParseError(`Unexpected character '${char}'`, startLine, startColumn);
        }
    }
  }

  private string(quote: string, startLine: number, startColumn: number): Token {
    let value = '';
    
    while (!this.isAtEnd() && this.peek() !== quote) {
      if (this.peek() === '\n') {
        this.line++;
        this.column = 0;
      } else if (this.peek() === '\\') {
        this.advance(); // consume backslash
        const escaped = this.advance();
        switch (escaped) {
          case 'n': value += '\n'; break;
          case 't': value += '\t'; break;
          case 'r': value += '\r'; break;
          case '\\': value += '\\'; break;
          case '"': value += '"'; break;
          case "'": value += "'"; break;
          default:
            value += escaped;
        }
      } else {
        value += this.advance();
      }
    }
    
    if (this.isAtEnd()) {
      throw new ParseError('Unterminated string', startLine, startColumn);
    }
    
    this.advance(); // consume closing quote
    return this.createToken(TokenType.STRING, value, startLine, startColumn);
  }

  private number(startLine: number, startColumn: number): Token {
    this.position--; // back up to re-read first digit
    this.column--;
    
    let value = '';
    
    while (!this.isAtEnd() && this.isDigit(this.peek())) {
      value += this.advance();
    }
    
    // Handle decimal point
    if (!this.isAtEnd() && this.peek() === '.' && this.isDigit(this.peekNext())) {
      value += this.advance(); // consume '.'
      while (!this.isAtEnd() && this.isDigit(this.peek())) {
        value += this.advance();
      }
    }
    
    return this.createToken(TokenType.NUMBER, value, startLine, startColumn);
  }

  private identifier(startLine: number, startColumn: number): Token {
    this.position--; // back up to re-read first character
    this.column--;
    
    let value = '';
    
    while (!this.isAtEnd() && this.isAlphaNumeric(this.peek())) {
      value += this.advance();
    }
    
    return this.createToken(TokenType.IDENTIFIER, value, startLine, startColumn);
  }

  private skipWhitespace(): void {
    while (!this.isAtEnd()) {
      const char = this.peek();
      if (char === ' ' || char === '\r' || char === '\t') {
        this.advance();
      } else if (char === '#') {
        // Skip comments until end of line
        while (!this.isAtEnd() && this.peek() !== '\n') {
          this.advance();
        }
      } else {
        break;
      }
    }
  }

  private advance(): string {
    if (this.isAtEnd()) return '\0';
    
    const char = this.input[this.position++];
    if (char === '\n') {
      this.line++;
      this.column = 1;
    } else {
      this.column++;
    }
    return char;
  }

  private match(expected: string): boolean {
    if (this.isAtEnd() || this.input[this.position] !== expected) {
      return false;
    }
    this.position++;
    this.column++;
    return true;
  }

  private peek(): string {
    if (this.isAtEnd()) return '\0';
    return this.input[this.position];
  }

  private peekNext(): string {
    if (this.position + 1 >= this.input.length) return '\0';
    return this.input[this.position + 1];
  }

  private isAtEnd(): boolean {
    return this.position >= this.input.length;
  }

  private isDigit(char: string): boolean {
    return char >= '0' && char <= '9';
  }

  private isAlpha(char: string): boolean {
    return (char >= 'a' && char <= 'z') ||
           (char >= 'A' && char <= 'Z') ||
           char === '_';
  }

  private isAlphaNumeric(char: string): boolean {
    return this.isAlpha(char) || this.isDigit(char);
  }

  private createToken(type: TokenType, value: string, line?: number, column?: number): Token {
    return {
      type,
      value,
      line: line ?? this.line,
      column: column ?? this.column
    };
  }
}