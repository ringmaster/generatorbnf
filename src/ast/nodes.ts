// ast/nodes.ts - Clean AST node definitions

import { ExecutionContext, EvaluationResult, EvaluationError } from '../types';

export abstract class ASTNode {
  abstract evaluate(context: ExecutionContext): EvaluationResult;
  abstract toString(): string;
}

// Root grammar containing all rules
export class Grammar extends ASTNode {
  constructor(public rules: Map<string, Rule>) {
    super();
  }

  evaluate(context: ExecutionContext & { grammar?: Grammar }): EvaluationResult {
    const startRule = this.rules.get('start');
    if (!startRule) {
      throw new EvaluationError('No start rule defined');
    }

    // Add grammar to context for rule references
    const grammarContext = { ...context, grammar: this };
    const result = startRule.evaluate(grammarContext);

    // If the result is a number, convert it to a string
    if (typeof result.value === 'number') {
      return {
        value: String(result.value),
        updatedKnowledge: result.updatedKnowledge
      };
    }

    return result;
  }



  toString(): string {
    const ruleStrings = Array.from(this.rules.entries())
      .map(([name, rule]) => `$${name} := ${rule.toString()}`)
      .join('\n');
    return ruleStrings;
  }
}

// Individual rule definition
export class Rule extends ASTNode {
  constructor(
    public name: string,
    public alternatives: Alternative[]
  ) {
    super();
  }

  evaluate(context: ExecutionContext): EvaluationResult {
    if (this.alternatives.length === 0) {
      throw new EvaluationError(`Rule ${this.name} has no alternatives`);
    }

    if (this.alternatives.length === 1) {
      return this.alternatives[0].evaluate(context);
    }

    // Weighted random selection between alternatives
    return this.selectWeightedAlternative(context);
  }

  private selectWeightedAlternative(context: ExecutionContext): EvaluationResult {
    const weights = this.alternatives.map(alt => alt.weight);
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    const random = context.random() * totalWeight;

    let currentWeight = 0;
    for (let i = 0; i < this.alternatives.length; i++) {
      currentWeight += weights[i];
      if (random <= currentWeight) {
        const altContext = { ...context, variables: new Map(context.variables) };
        const result = this.alternatives[i].evaluate(altContext);

        // Ensure variables defined in the alternative are passed back up
        for (const [key, value] of altContext.variables.entries()) {
          context.variables.set(key, value);
        }

        // Handle numeric results
        if (typeof result.value === 'number') {
          return result;
        }

        return result;
      }
    }

    // Fallback to last alternative
    const altContext = { ...context, variables: new Map(context.variables) };
    const result = this.alternatives[this.alternatives.length - 1].evaluate(altContext);

    // Ensure variables defined in the alternative are passed back up
    for (const [key, value] of altContext.variables.entries()) {
      context.variables.set(key, value);
    }

    return result;
  }

  toString(): string {
    return this.alternatives.map(alt => alt.toString()).join(' | ');
  }
}

// Single alternative within a rule
export class Alternative extends ASTNode {
  constructor(
    public elements: ASTNode[],
    public weight: number = 1.0
  ) {
    super();
  }

  evaluate(context: ExecutionContext): EvaluationResult {
    let result = '';
    let currentKnowledge = context.knowledge;
    let needsSpace = false;
    const currentVariables = new Map(context.variables);

    for (const element of this.elements) {
      const elementContext = {
        ...context,
        knowledge: currentKnowledge,
        variables: currentVariables,
      };
      const elementResult = element.evaluate(elementContext);

      // Accumulate text output
      if (elementResult.value !== null && elementResult.value !== undefined && elementResult.value !== '') {
        const valueStr = String(elementResult.value);
        // Add space between elements if needed (but not for newlines)
        if (needsSpace && valueStr !== '\n' && !valueStr.startsWith('\n') && result !== '' && !result.endsWith('\n') && !/^[.,!?;:]/.test(valueStr)) {
          result += ' ';
        }
        result += valueStr;
        needsSpace = true;
      }

      // Update our current state with any changes from this element
      currentKnowledge = elementResult.updatedKnowledge;

      // Copy any new variables from the element context back to our working context
      for (const [key, value] of elementContext.variables.entries()) {
        currentVariables.set(key, value);
      }
    }

    return {
      value: result,
      updatedKnowledge: currentKnowledge
    };
  }

  toString(): string {
    const elementStr = this.elements.map(el => el.toString()).join(' ');
    return this.weight !== 1.0 ? `${elementStr} :: ${this.weight}` : elementStr;
  }
}

// Literal text
export class Literal extends ASTNode {
  constructor(public value: string | number) {
    super();
  }

  evaluate(context: ExecutionContext): EvaluationResult {
    return {
      value: this.value,
      updatedKnowledge: context.knowledge
    };
  }

  toString(): string {
    return String(this.value);
  }
}

// Variable reference ($variable, $$.path)
export class VariableReference extends ASTNode {
  constructor(
    public path: string[],
    public isKnowledge: boolean = false
  ) {
    super();
  }

  evaluate(context: ExecutionContext): EvaluationResult {
    try {
      if (this.isKnowledge) {
        return this.evaluateKnowledgePath(context);
      } else {
        return this.evaluateVariable(context);
      }
    } catch (error) {
      const typedError = error instanceof Error
        ? error
        : new Error(String(error));

      throw new EvaluationError(
        `Failed to resolve variable ${this.toString()}: ${typedError.message}`,
        this.toString()
      );
    }
  }

  private evaluateKnowledgePath(context: ExecutionContext): EvaluationResult {
    const [root, ...pathParts] = this.path;
    if (root !== '$') {
      throw new EvaluationError(`Expected '$$' but got '${root}'`);
    }

    let current: any = context.knowledge;
    const resolvedPath = ['$$'];

    for (const part of pathParts) {
      if (current === null || current === undefined) {
        throw new EvaluationError(`Cannot access property '${part}' of ${current}`);
      }

      if (typeof current !== 'object' || !(part in current)) {
        const availableKeys = typeof current === 'object' ? Object.keys(current) : [];
        throw new EvaluationError(
          `Property '${part}' not found at ${resolvedPath.join('.')}. Available: [${availableKeys.join(', ')}]`
        );
      }

      current = current[part];
      resolvedPath.push(part);
    }

    // If current is an array, select random element
    if (Array.isArray(current)) {
      return this.selectFromArray(current, context);
    }

    return {
      value: current,
      updatedKnowledge: context.knowledge
    };
  }

  private evaluateVariable(context: ExecutionContext & { grammar?: Grammar }): EvaluationResult {
    const varName = this.path[0];

    // First try to look up as a variable
    if (context.variables.has(varName)) {
      let value = context.variables.get(varName);

      // Handle dot notation for complex variables
      for (let i = 1; i < this.path.length; i++) {
        if (value === null || value === undefined || typeof value !== 'object') {
          throw new EvaluationError(`Cannot access property '${this.path[i]}' of ${value}`);
        }
        value = value[this.path[i]];
      }

      // If value is a string and looks like a number, convert it
      if (typeof value === 'string' && !isNaN(Number(value)) && value.trim() !== '') {
        value = Number(value);
      }

      return { value, updatedKnowledge: context.knowledge };
    }

    // If not a variable, try to look up as a rule
    if (context.grammar && this.path.length === 1) {
      const rule = context.grammar.rules.get(varName);
      if (rule) {
        const result = rule.evaluate(context);

        // If the result is a string, trim whitespace
        if (typeof result.value === 'string') {
          return {
            value: result.value.trim(),
            updatedKnowledge: result.updatedKnowledge
          };
        }

        // Pass any variables defined in the rule back to the parent context
        return result;
      }
    }

    throw new EvaluationError(`Variable or rule '${varName}' not defined`);
  }

  private selectFromArray(array: any[], context: ExecutionContext): EvaluationResult {
    if (array.length === 0) {
      return { value: '', updatedKnowledge: context.knowledge };
    }

    // Handle weighted items
    const hasWeights = array.some(item => item && typeof item === 'object' && 'weight' in item);

    if (hasWeights) {
      const totalWeight = array.reduce((sum, item) => {
        const weight = (item && typeof item === 'object' && 'weight' in item) ? item.weight : 1.0;
        return sum + weight;
      }, 0);

      const random = context.random() * totalWeight;
      let currentWeight = 0;

      for (const item of array) {
        const weight = (item && typeof item === 'object' && 'weight' in item) ? item.weight : 1.0;
        currentWeight += weight;

        if (random <= currentWeight) {
          const value = (item && typeof item === 'object' && 'value' in item) ? item.value : item;
          return { value, updatedKnowledge: context.knowledge };
        }
      }
    }

    // Simple random selection
    const index = Math.floor(context.random() * array.length);
    const selected = array[index];
    const value = (selected && typeof selected === 'object' && 'value' in selected) ? selected.value : selected;

    return { value, updatedKnowledge: context.knowledge };
  }

  toString(): string {
    if (this.isKnowledge) {
      return '$$.' + this.path.slice(1).join('.');
    }
    return '$' + this.path.join('.');
  }
}

// Rule reference ($ruleName)
export class RuleReference extends ASTNode {
  constructor(public ruleName: string) {
    super();
  }

  evaluate(context: ExecutionContext & { grammar?: Grammar }): EvaluationResult {
    // First check if this is actually a variable reference
    if (context.variables.has(this.ruleName)) {
      let value = context.variables.get(this.ruleName);

      // Convert string to number if it looks numeric
      if (typeof value === 'string' && !isNaN(Number(value)) && value.trim() !== '') {
        value = Number(value);
      }

      return {
        value: value,
        updatedKnowledge: context.knowledge
      };
    }

    if (!context.grammar) {
      throw new EvaluationError(`Cannot resolve rule reference '${this.ruleName}' - no grammar context`);
    }

    const rule = context.grammar.rules.get(this.ruleName);
    if (!rule) {
      throw new EvaluationError(`Rule '${this.ruleName}' not found`);
    }

    const result = rule.evaluate(context);

    // If the result is a string with numbers, trim whitespace
    if (typeof result.value === 'string') {
      return {
        value: result.value.trim(),
        updatedKnowledge: result.updatedKnowledge
      };
    }

    return result;
  }

  toString(): string {
    return '$' + this.ruleName;
  }
}

// Assignment operation ($var = expression, $$.path += value)
export class Assignment extends ASTNode {
  constructor(
    public target: VariableReference,
    public operator: '=' | '+=' | '-=',
    public expression: ASTNode
  ) {
    super();
  }

  evaluate(context: ExecutionContext): EvaluationResult {
    const exprResult = this.expression.evaluate(context);
    const newContext = { ...context, knowledge: exprResult.updatedKnowledge };

    // Evaluate the assignment and return the value that was assigned
    if (this.target.isKnowledge) {
      return this.assignToKnowledge(newContext, exprResult.value);
    } else {
      return this.assignToVariable(newContext, exprResult.value);
    }
  }

  private assignToKnowledge(context: ExecutionContext, value: any): EvaluationResult {
    const [root, ...pathParts] = this.target.path;
    if (root !== '$') {
      throw new EvaluationError('Knowledge assignment must start with $$');
    }

    // Deep clone knowledge for immutable update
    const newKnowledge = JSON.parse(JSON.stringify(context.knowledge));
    let current = newKnowledge;

    // Navigate to the parent of the target property
    for (let i = 0; i < pathParts.length - 1; i++) {
      const part = pathParts[i];
      if (!(part in current)) {
        current[part] = {};
      }
      current = current[part];
    }

    const finalProp = pathParts[pathParts.length - 1];
    let resultValue;

    switch (this.operator) {
      case '=':
        current[finalProp] = typeof value === 'string' && !isNaN(Number(value)) ? Number(value) : value;
        resultValue = value;
        break;
      case '+=':
        const currentAddValue = current[finalProp] || 0;
        if (!isNaN(Number(currentAddValue)) && !isNaN(Number(value))) {
          resultValue = Number(currentAddValue) + Number(value);
        } else {
          resultValue = currentAddValue + value;
        }
        current[finalProp] = resultValue;
        break;
      case '-=':
        const currentSubValue = current[finalProp] || 0;
        if (!isNaN(Number(currentSubValue)) && !isNaN(Number(value))) {
          resultValue = Number(currentSubValue) - Number(value);
        } else {
          throw new EvaluationError('Subtraction is only valid for numeric values');
        }
        current[finalProp] = resultValue;
        break;
    }

    return {
      value: resultValue,
      updatedKnowledge: newKnowledge
    };
  }

  private assignToVariable(context: ExecutionContext, value: any): EvaluationResult {
    const varName = this.target.path[0];
    let resultValue;

    switch (this.operator) {
      case '=':
        context.variables.set(varName, value);
        resultValue = value;
        break;
      case '+=':
        const currentValue = context.variables.get(varName) || 0;
        resultValue = currentValue + value;
        context.variables.set(varName, resultValue);
        break;
      case '-=':
        const currentVal = context.variables.get(varName) || 0;
        resultValue = currentVal - value;
        context.variables.set(varName, resultValue);
        break;
    }

    return {
      value: resultValue,
      updatedKnowledge: context.knowledge
    };
  }

  toString(): string {
    return `${this.target.toString()} ${this.operator} ${this.expression.toString()}`;
  }
}

// Mathematical/logical expressions
export class BinaryExpression extends ASTNode {
  constructor(
    public left: ASTNode,
    public operator: '+' | '-' | '*' | '/' | '==' | '!=' | '<' | '>' | '<=' | '>=',
    public right: ASTNode
  ) {
    super();
  }

  evaluate(context: ExecutionContext): EvaluationResult {
    const leftResult = this.left.evaluate(context);
    const rightContext = { ...context, knowledge: leftResult.updatedKnowledge };
    const rightResult = this.right.evaluate(rightContext);

    // Clean up values before applying the operator
    let leftValue = leftResult.value;
    let rightValue = rightResult.value;

    // Trim strings
    if (typeof leftValue === 'string') leftValue = leftValue.trim();
    if (typeof rightValue === 'string') rightValue = rightValue.trim();

    // Convert to numbers if both are numeric
    const leftNumeric = !isNaN(Number(leftValue)) && leftValue !== '';
    const rightNumeric = !isNaN(Number(rightValue)) && rightValue !== '';
    if (leftNumeric && rightNumeric) {
      leftValue = Number(leftValue);
      rightValue = Number(rightValue);
    }

    const result = this.applyOperator(leftValue, rightValue);

    return {
      value: result,
      updatedKnowledge: rightResult.updatedKnowledge
    };
  }

  private applyOperator(left: any, right: any): any {
    // Convert string operands to numbers if they look numeric
    const numLeft = typeof left === 'string' && !isNaN(Number(left)) ? Number(left) : left;
    const numRight = typeof right === 'string' && !isNaN(Number(right)) ? Number(right) : right;

    switch (this.operator) {
      case '+':
        // Special handling for addition - if both are numeric, add them as numbers
        if (typeof numLeft === 'number' && typeof numRight === 'number') {
          return numLeft + numRight;
        }
        return left + right;  // String concatenation
      case '-': return numLeft - numRight;
      case '*': return numLeft * numRight;
      case '/': return numLeft / numRight;
      case '==': return left == right;
      case '!=': return left != right;
      case '<': return left < right;
      case '>': return left > right;
      case '<=': return left <= right;
      case '>=': return left >= right;
      default:
        throw new EvaluationError(`Unknown operator: ${this.operator}`);
    }
  }

  toString(): string {
    return `(${this.left.toString()} ${this.operator} ${this.right.toString()})`;
  }
}

// Conditional expression (condition ? trueValue : falseValue)
export class ConditionalExpression extends ASTNode {
  constructor(
    public condition: ASTNode,
    public trueValue: ASTNode,
    public falseValue?: ASTNode
  ) {
    super();
  }

  evaluate(context: ExecutionContext): EvaluationResult {
    const condResult = this.condition.evaluate(context);
    const newContext = { ...context, knowledge: condResult.updatedKnowledge };

    if (condResult.value) {
      return this.evaluateBranch(this.trueValue, newContext);
    } else if (this.falseValue) {
      return this.evaluateBranch(this.falseValue, newContext);
    } else {
      return { value: '', updatedKnowledge: condResult.updatedKnowledge };
    }
  }

  private evaluateBranch(branch: ASTNode, context: ExecutionContext): EvaluationResult {
    if (branch instanceof CompoundExpression) {
      const results = branch.expressions.map(expr => expr.evaluate(context));
      const combinedValue = results.reduce((acc, res) => {
        const value = res.value;

        // Add a space if the previous value doesn't end with a space
        // and the current value doesn't start with punctuation or a space
        if (acc && !acc.endsWith(' ') && !value.startsWith(' ') && !value.match(/^[.,!?]/)) {
          return acc + ' ' + value;
        }

        return acc + value;
      }, '');
      const updatedKnowledge = results.reduce((acc, res) => ({ ...acc, ...res.updatedKnowledge }), context.knowledge);
      return { value: combinedValue, updatedKnowledge };
    }
    return branch.evaluate(context);
  }

  toString(): string {
    const falseStr = this.falseValue ? ` | ${this.falseValue.toString()}` : '';
    return `${this.condition.toString()} ? ${this.trueValue.toString()}${falseStr}`;
  }
}

// Silent expression that evaluates but produces no output
export class SilentExpression extends ASTNode {
  constructor(public expression: ASTNode) {
    super();
  }

  evaluate(context: ExecutionContext): EvaluationResult {
    const result = this.expression.evaluate(context);
    return {
      value: '', // Silent - no output
      updatedKnowledge: result.updatedKnowledge
    };
  }

  toString(): string {
    return `[!${this.expression.toString()}]`;
  }
}

// Compound expression that evaluates multiple expressions in sequence
export class CompoundExpression extends ASTNode {
  constructor(public expressions: ASTNode[]) {
    super();
  }

  evaluate(context: ExecutionContext): EvaluationResult {
    let currentKnowledge = context.knowledge;
    let lastValue: any = '';
    // Create a copy of the variables map to pass between expressions
    let currentVariables = new Map(context.variables);

    for (const expr of this.expressions) {
      const exprContext = {
        ...context,
        knowledge: currentKnowledge,
        variables: currentVariables
      };
      const result = expr.evaluate(exprContext);
      currentKnowledge = result.updatedKnowledge;
      // Update our working variables with any new ones defined in this expression
      for (const [key, value] of exprContext.variables.entries()) {
        currentVariables.set(key, value);
        // Also update the parent context's variables
        context.variables.set(key, value);
      }
      lastValue = result.value; // Last expression's value is returned
    }

    return {
      value: lastValue,
      updatedKnowledge: currentKnowledge
    };
  }

  toString(): string {
    return this.expressions.map(e => e.toString()).join('; ');
  }
}
