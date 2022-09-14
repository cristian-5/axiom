
export const LANGUAGE = "factorial";

// ==== TOKENS =================================================================

export enum TokenType {
	begin, character, string, boolean, natural, real,
	keyword, operator, symbol, type, invalid, end,
}

export type Token = { type: TokenType, lexeme: string, position: number };

// ==== EXPRESSIONS ============================================================

export class Expression {
	start = 0; end = 0;
	get bounds() { return [ this.start, this.end ]; }
	public accept?(visitor: ASTVisitor): void;
}

export class Assignment extends Expression {
	lhs: Expression; rhs: Expression; equal: Token;
	constructor(lhs: Identifier, e: Token, rhs: Expression) {
		super();
		this.equal = e;
		this.start = lhs.start;
		this.end = rhs.end;
		this.lhs = lhs;
		this.rhs = rhs;
	}
	accept(visitor: ASTVisitor) { visitor.assignment(this); }
}

export class Block extends Expression {
	instructions: Expression[];
	constructor(instructions: Expression[]) {
		super();
		this.instructions = instructions;
		if (instructions.length == 0) return;
		this.start = instructions[0].start;
		this.end = instructions[instructions.length - 1].end;
	}
}

export class Prefix extends Expression {
	expression: Expression; operator: Token;
	constructor(operator: Token, rhs: Expression) {
		super();
		this.operator = operator;
		this.start = operator.position;
		this.end = rhs.end;
		this.expression = rhs;
	}
}

export class Infix extends Expression {
	lhs: Expression; rhs: Expression; operator: Token;
	constructor(lhs: Expression, o: Token, rhs: Expression) {
		super();
		this.operator = o;
		this.start = lhs.start;
		this.end = rhs.end;
		this.lhs = lhs;
		this.rhs = rhs;
	}
	accept(visitor: ASTVisitor) { visitor.infix(this); }
}

export class Postfix extends Expression {
	expression: Expression; operator: Token;
	constructor(lhs: Expression, operator: Token) {
		super();
		this.operator = operator;
		this.start = lhs.start;
		this.end = operator.position + operator.lexeme.length;
		this.expression = lhs;
	}
}

export class Call extends Expression {
	callee: Expression;
	parameters: Expression;
	constructor(callee: Expression, parameters: Expression, t: Token) {
		super();
		// info: the bounds are calculated from the callee to
		//       the closing round parenthesis of the call.
		this.callee = callee;
		this.parameters = parameters;
		this.start = this.callee.start;
		this.end = t.position + t.lexeme.length;
	}
}

export class Product extends Expression {
	expressions: Expression[] = [];
	constructor(expressions?: Expression[] | Expression) {
		super();
		if (expressions === undefined) return;
		if (!Array.isArray(expressions))
			this.expressions = [ expressions ];
		if ((expressions as Array<Expression>).length === 0) return;
		this.start = this.expressions[0].start;
		this.end = this.expressions[this.expressions.length].end;
	}
	extend(expression: Expression) {
		this.expressions.push(expression);
		this.end = expression.end;
	}
}

export class Morphism extends Expression {
	lhs: Expression; rhs: Expression;
	constructor(lhs: Expression, rhs: Expression) {
		super();
		this.lhs = lhs; this.rhs = rhs;
		this.start = this.lhs.start;
		this.end = this.rhs.end;
	}
	/// info: right now partial morphisms are not supported
	/* partial() {
		if (this.lhs instanceof Product) {
			const expressions = (this.lhs as Product).expressions;
			for (const e of expressions)
				if (!(e instanceof Identifier)) return true;
			return false;
		}
		return !(this.lhs instanceof Identifier);
	} */
}

export class List extends Expression {
	expressions: Expression[] = [];
	constructor(expressions?: Expression[] | Expression) {
		super();
		if (expressions === undefined) return;
		if (!Array.isArray(expressions))
			this.expressions = [ expressions ];
		if ((expressions as Array<Expression>).length === 0) return;
		this.start = this.expressions[0].start;
		this.end = this.expressions[this.expressions.length].end;
	}
	extend(expression: Expression) {
		this.expressions.push(expression);
		this.end = expression.end;
	}
}

export class Primary extends Expression {
	literal: Token;
	constructor(literal: Token) {
		super();
		this.literal = literal;
		this.start = literal.position;
		this.end = literal.position + literal.lexeme.length;
	}
}

export class Void extends Expression {
	o: Token; c: Token;
	constructor(o: Token, c: Token) {
		super();
		this.o = o; this.c = c;
		this.start = o.position;
		this.end = c.position + c.lexeme.length;
	}
}

export class Identifier extends Expression {
	symbol: Token;
	constructor(symbol: Token) {
		super();
		this.symbol = symbol;
		this.start = symbol.position;
		this.end = symbol.position + symbol.lexeme.length;
	}
}

export class Declaration extends Expression {
	id: Identifier; prototype: Type; expression?: Expression;
	constructor(id: Identifier, prototype: Type, expression?: Expression) {
		super();
		this.id = id;
		this.expression = expression;
		this.prototype = prototype;
		this.start = id.start;
		this.end = (expression || prototype)!.end;
	}
}

export class Alias extends Expression {
	id: Identifier; prototype: Type;
	constructor(id: Identifier, prototype: Type) {
		super();
		this.id = id;
		this.prototype = prototype;
		this.start = id.start;
		this.end = prototype.end;
	}
}

export class Multiple extends Expression {
	expressions: Expression[] = [];
	constructor(expressions?: Expression[] | Expression) {
		super();
		if (expressions === undefined) return;
		if (!Array.isArray(expressions))
			this.expressions = [ expressions ];
		if ((expressions as Array<Expression>).length === 0) return;
		this.start = this.expressions[0].start;
		this.end = this.expressions[this.expressions.length].end;
	}
	extend(expression: Expression) {
		this.expressions.push(expression);
		this.end = expression.end;
	}
}

// ==== TYPES ==================================================================

export const TypeNames = [ "bln", "byt", "nat", "int", "rea" ];

export enum Category {
	basic, product, coproduct, array, morphism, generic, void
}

export interface Type {
	start: number; end: number;
	readonly category: Category;
	get bounds(): number[];
	matches(other: Type): boolean;
	contains(category: Category): boolean;
	description(): string;
}

export class ProductType implements Type {
	start = 0; end = 0;
	types: Type[];
	readonly category = Category.product;
	get bounds() { return [ this.start, this.end ]; }
	constructor(types: Type[]) {
		this.types = types;
		this.start = types[0].start;
		this.end = types[types.length - 1].end;
	}
	extend(type: Type) {
		this.types.push(type);
		this.end = type.end;
	}
	matches(other: Type): boolean {
		if (other.category !== Category.product) return false;
		if (this.types.length !== (other as ProductType).types.length)
			return false;
		for (let i = 0; i < this.types.length; i++)
			if (!this.types[i].matches((other as ProductType).types[i]))
				return false;
		return true;
	}
	contains(category: Category): boolean {
		for (const type of this.types)
			if (type.contains(category)) return true;
		return false;
	}
	description() {
		return this.types.map(t => t.description()).join(" , ");
	}
}

export class CoproductType implements Type {
	start = 0; end = 0;
	types: Type[];
	readonly category = Category.coproduct;
	get bounds() { return [ this.start, this.end ]; }
	constructor(types: Type[]) {
		this.types = types;
		this.start = types[0].start;
		this.end = types[types.length - 1].end;
	}
	extend(type: Type) {
		this.types.push(type);
		this.end = type.end;
	}
	matches(other: Type): boolean {
		if (other.category !== Category.coproduct) return false;
		if (this.types.length !== (other as CoproductType).types.length)
			return false;
		for (let i = 0; i < this.types.length; i++)
			if (!this.types[i].matches((other as CoproductType).types[i]))
				return false;
		return true;
	}
	contains(category: Category): boolean {
		for (const type of this.types)
			if (type.contains(category)) return true;
		return false;
	}
	description() {
		return this.types.map(type => type.description()).join(" | ");
	}
}

export const Order = { high: true, low: false };

export class MorphismType implements Type {
	start = 0; end = 0;
	lhs: Type; rhs: Type;
	readonly category = Category.morphism;
	get bounds() { return [ this.start, this.end ]; }
	readonly order = Order.low;
	constructor(lhs: Type, rhs: Type) {
		this.start = lhs.start;
		this.end = rhs.end;
		this.lhs = lhs;
		this.rhs = rhs;
	}
	matches(other: Type): boolean {
		if (other.category !== Category.morphism) return false;
		return this.lhs.matches((other as MorphismType).lhs) &&
			   this.rhs.matches((other as MorphismType).rhs) &&
			   this.order === (other as MorphismType).order;
	}
	contains(category: Category): boolean {
		return this.lhs.contains(category) ||
			   this.rhs.contains(category);
	}
	description() {
		return this.lhs.description() +
		(this.order ? " => " : " -> ") +
		this.rhs.description();
	}
}

export class BasicType implements Type {
	start = 0; end = 0;
	readonly category = Category.basic;
	readonly name: string;
	get bounds() { return [ this.start, this.end ]; }
	constructor(token: Token, alias?: string) {
		if (alias !== undefined) this.name = alias;
		else this.name = token.lexeme;
		this.start = token.position;
		this.end = token.position + token.lexeme.length;
	}
	matches(other: Type): boolean {
		if (other.category !== Category.basic) return false;
		return this.name === (other as BasicType).name;
	}
	contains(category: Category): boolean {
		return category === Category.basic;
	}
	description() { return this.name; }
}

export class GenericType implements Type {
	start = 0; end = 0;
	readonly category = Category.generic;
	readonly name: string;
	get bounds() { return [ this.start, this.end ]; }
	constructor(token: Token) {
		this.name = token.lexeme;
		this.start = token.position;
		this.end = token.position + token.lexeme.length;
	}
	matches(other: Type): boolean {
		return other.category === Category.generic &&
			   this.name === (other as GenericType).name;
	}
	contains(category: Category): boolean {
		return category === Category.generic;
	}
	description() { return `<${this.name}>`; }
}

export class ListType implements Type {
	start = 0; end = 0;
	inner: Type;
	readonly category = Category.void;
	get bounds() { return [ this.start, this.end ]; }
	constructor(inner: Type) {
		this.start = inner.start;
		this.end = inner.end;
		this.inner = inner;
	}
	matches(other: Type): boolean {
		if (other.category !== Category.basic) return false;
		return this.inner.matches((other as ListType).inner);
	}
	contains(category: Category): boolean {
		return this.inner.contains(category);
	}
	description() { return `[${this.inner.description()}]`; }
}

export class VoidType implements Type {
	start = 0; end = 0;
	readonly category = Category.void;
	get bounds() { return [ this.start, this.end ]; }
	constructor() { }
	matches(other: Type): boolean {
		return other.category === Category.void;
	}
	contains(_: Category): boolean { return false; }
	description() { return '()'; }
}

// ==== Environment ============================================================

export enum Kind { local, global, parameter }

export class Environment {

	upper: Environment | undefined;
	variables: { [name: string]: Kind } = { };

	constructor(upper?: Environment) {
		this.upper = upper;
	}

	lookup(name: string): Kind | undefined {
		if (name in this.variables) return this.variables[name];
		if (this.upper !== undefined) return this.upper.lookup(name);
		return undefined;
	}

	declare(name: string, kind: Kind) {
		this.variables[name] = kind;
	}

}

// ==== AST ====================================================================

export interface ASTVisitor {
	assignment(a: Assignment): void;
	block(b: Block): void;
	prefix(p: Prefix): void;
	infix(i: Infix): void;
	postfix(p: Postfix): void;
	call(c: Call): void;
	product(p: Product): void;
	morphism(m: Morphism): void;
	list(l: List): void;
	primary(p: Primary): void;
	void(v: Void): void;
	identifier(i: Identifier): void;
	declaration(d: Declaration): void;
	alias(a: Alias): void;
	multiple(m: Multiple): void;
}

export class AST {

	// warnings: string[];
	// ast: Statement[];

}

export interface Compiler extends ASTVisitor {
	compile(ast: AST): string;
}

export interface Checker extends ASTVisitor {
	check(ast: Expression[]): AST;
}

// ==== COMPILER ===============================================================
