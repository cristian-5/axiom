
import {
	Token, Type, TypeNames, BasicType, AST, ASTVisitor, Expression,
	Block, Prefix, Infix, Postfix, Call, Product, Morphism,
	Primary, Void, Identifier, Declaration, Alias, Environment, Kind, Multiple, VoidType, List, Assignment
} from "./tree.ts";

const errors: { [code: string]: string } = {
	"UPR": "unknown prefix operator",
	"UIO": "unknown infix operator",
	"UPO": "unknown postfix operator",
	"IIO": "invalid infix operation between basic types",
	"IPR": "invalid prefix operation with basic type",
	"IPO": "invalid postfix operation with basic type",
	"UTE": "unknown type error",
};

type TypeError = { message: string, bounds: number[] }; 

const bounds = (token: Token) =>
	[ token.position, token.position + token.lexeme.length ];
const error = (code: string, bounds: number[] = []): TypeError =>
	({ message: errors[code], bounds });

/// prime numbers up to 100
const primes = [
	2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41,
	43,	47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97
];

const $ = (...types: string[]): number => types.reduce(
	(r, t) => r * (primes[TypeNames.indexOf(t)] || 0)
, 1);

const prefix_basic: { [op: string]: number } = {
	"!": $("bln"),
	"-": $("byt", "nat", "int", "rea"),
	"~": $("byt", "nat", "int"),
};

const infix_basic: { [op: string]: number } = {
	"+": $("byt", "nat", "int", "rea"),
	"-": $("byt", "nat", "int", "rea"),
	"*": $("byt", "nat", "int", "rea"),
	"/": $("byt", "nat", "int", "rea"),
	"%": $("byt", "nat", "int", "rea"),
	"^": $("nat", "int", "rea"),
};

const postfix_basic: { [op: string]: number } = {
	"!": $("byt", "nat", "int", "rea"),
};

class Checker implements ASTVisitor {

	tree: AST = new AST(); stack: Type[] = [];

	variables = new Environment(); parameter = false;

	top(): Type | undefined { return this.stack[this.stack.length - 1]; }
	pop(): Type | undefined { return this.stack.pop(); }
	push(type: Type) { this.stack.push(type); }

	assignment(a: Assignment) {
		
	}
	prefix(p: Prefix) {
		p.expression.accept!(this);
		const t = this.top();
		if (t === undefined) throw error("UTE", bounds(p.operator));
		// operator between omoegeneous basic types
		if (t instanceof BasicType) {
			const pt = $((t as BasicType).name);
			if (!(p.operator.lexeme in prefix_basic))
				throw error("UPR", bounds(p.operator));
			if (prefix_basic[p.operator.lexeme] % pt !== 0)
				throw error("IPR", p.bounds);
			this.push(t);
		}
		// todo: operation between high-order types
		throw error("UTE", p.bounds);
	}
	infix(i: Infix) {
		// todo: check for assignment
		i.lhs.accept!(this);
		if (this.top() === undefined) throw error("UTE", bounds(i.operator));
		const a = this.pop();
		i.rhs.accept!(this);
		if (this.top() === undefined) throw error("UTE", bounds(i.operator));
		const b = this.pop();
		// operator between omoegeneous basic types
		if (a instanceof BasicType && b instanceof BasicType) {
			const pa = $((a as BasicType).name);
			const pb = $((b as BasicType).name);
			if (!(i.operator.lexeme in infix_basic))
				throw error("UIO", bounds(i.operator));
			if (infix_basic[i.operator.lexeme] % (pa * pb) !== 0)
				throw error("IIO", i.bounds);
			this.push(pa > pb ? a : b);
		}
		// todo: operation between high-order types
		throw error("UTE", i.bounds);
	}
	postfix(p: Postfix) {
		p.expression.accept!(this);
		const t = this.top();
		if (t === undefined) throw error("UTE", bounds(p.operator));
		// operator between omoegeneous basic types
		if (t instanceof BasicType) {
			const pt = $((t as BasicType).name);
			if (!(p.operator.lexeme in postfix_basic))
				throw error("UPO", bounds(p.operator));
			if (postfix_basic[p.operator.lexeme] % pt !== 0)
				throw error("IPO", p.bounds);
			this.push(t);
		}
		// todo: operation between high-order types
		throw error("UTE", p.bounds);
	}
	call(c: Call) { }
	product(p: Product) { }
	block(b: Block) { }
	morphism(m: Morphism) {
		this.parameter = true;
		// whose responsibility is it to transform the parameters
		// into a list of string identifiers? parser? checker?
		this.parameter = false;
	}
	list(l: List) { }
	primary(p: Primary) { }
	void(v: Void) {
		// tofix: where do we throw the error??? which bounds?
		this.push(new VoidType());
	}
	identifier(i: Identifier) { }
	declaration(d: Declaration) {
		this.variables.declare(
			d.id.symbol.lexeme,
			this.parameter ? Kind.parameter : Kind.local
		);
		// todo: is this a function declaration?
		//       is this a lambda or a clojure?
		//       should we create a new environment?
		//       how do we do polymorphism with partials?
	}
	alias(a: Alias) { }
	multiple(m: Multiple) { }

	check(ast: Expression[]) {
		this.tree = new AST(); this.stack = [];
		for (const expression of ast) expression.accept!(this);
		return this.tree;
	}

}

export const check = (ast: Expression[]): AST => new Checker().check(ast);
