
import {
	Block, Declaration, Expression, Prefix, Postfix, Infix,
	Primary, Identifier, Morphism, Call, Void, Multiple,
	Token, TokenType, Type, Category,
	ProductType, CoproductType, MorphismType, Order, GenericType,
	BasicType, ListType, VoidType, Product, Alias, LANGUAGE, Assignment
} from "./tree.ts";

/* variardic replacement of $ with arguments.
declare global { interface String { $(...args: string[]): String; } }
String.prototype.$ = function(...args: string[]) {
    return args.reduce((s, a) => s.replace('$', a), this);
};*/

const errors: { [code: string]: string } = {
	// ==== type ========================================================
	"ITD": "invalid type declaration",
	"DTC": "duplicate type in coproduct declaration",
	"NTC": "forbidden nested coproduct declaration",
	"MTP": "missing a round parenthesis '(...)' in type declaration",
	"MTB": "missing a square bracket '[...]' in type declaration",
	"MAB": "missing an angular bracket '<...>' in type declaration",
	"IGD": "invalid generic declaration is missing a typename",
	"IMO": "invalid morphism operator order",
	// ==== expression ==================================================
	"MID": "missing identifier in declaration",
	"ANS": "assignment of non symbol type",
	"IEX": "invalid expression",
	"MEP": "missing a round parenthesis '(...)' in expression",
	"MEB": "missing a curly brace '{...}' in expression",
	// ==== statement ===================================================
	"EID": "expected identifier in declaration",
	"IDC": "unassigned declaration must specify a prototype",
};

const LF = '\n'.charCodeAt(0);

class SyntaxError {

	message = "";
	bounds: number[] = [ 0, 0 ];

	constructor(message: string, bounds: number[]) {
		this.message = message;
		this.bounds = bounds;
	}

	print(code: string) {
		const N = 40 - 4;
		const H = (d: string) => `${LANGUAGE}: syntax error on [${d}]`;
		const lines = (from: number, to: number) => {
			let lines = 1;
			for (let i = from; i < to; i++)
				if (code.charCodeAt(i) == LF) lines++;
			return lines;
		};
		const beginning = (of: number) => {
			let i = of;
			while (i > 0 && code.charCodeAt(i) != LF) i--;
			return i + 1;
		};
		const ending = (of: number) => {
			let i = of;
			while (i < code.length && code.charCodeAt(i) != LF) i++;
			return i;
		};
		const from = beginning(this.bounds[0]);
		const to = ending(this.bounds[1]);
		const l = [
			lines(0, this.bounds[0]), lines(this.bounds[0], this.bounds[1])
		];
		if (l[1] == 1) {
			// error on one line,
			// show the partial string if <= N characters
			if (to - from <= N) {
				console.log(H(`${l[0]}:${this.bounds[0]}:${this.bounds[1]}`));
				console.log("    " + code.substring(from, to));
				console.log("    " + '~'.repeat(from - to));
			} else {
				// the line is too long, try to only show the error
				// if error alone is > N characters, show the error
				// shortened to N characters
			}
			console.log(H + `[${l[0]}:${this.bounds[0]}:${this.bounds[1]}]:`);
		}
		
	}

	/*private range(code: string) {
		for (let i = 0; i < this.bounds[0]; i++) {
			const c = code.charCodeAt(i);
			if (c === 10) {
				this.startLine++; this.startColumn = 1;
			} else this.startColumn++;
		}
		this.endColumn = this.startColumn;
		for (let i = this.bounds[0]; i < this.bounds[1]; i++) {
			const c = code.charCodeAt(i);
			if (c === 10) { this.endLine++; this.endColumn = 1;}
			this.endColumn++;
		}
	}*/

}

export const parse = (tokens: Token[]): Expression[] => {

	// ==== Core ===============================================================

	let current = 1;

	const bounds = (token: Token) => [
		token.position, token.position + token.lexeme.length
	];

	const error = (code: string, bounds: number[] = []) =>
		new SyntaxError(errors[code], bounds);
	const advance = () => { if (!is_at_end()) current++; return prev(); };
	const peek = () => tokens[current], prev = () => tokens[current - 1];
	const is_at_end = () => peek().type === TokenType.end;
	const check = (t: TokenType) => is_at_end() ? false : peek().type === t;
	const precise_check = (t: TokenType, l: string) =>
		check(t) && peek().lexeme === l;
	const match = (type: TokenType, lexemes: string[] | string) => {
		if (lexemes === undefined) {
			if (!check(type)) return false;
			advance(); return true;
		}
		if (typeof lexemes === "string") lexemes = [ lexemes ];
		if (!check(type)) return false;
		const p = peek();
		if (lexemes.includes(p.lexeme)) {
			advance(); return true;
		} else return false;
	};
	const consume = (type: TokenType, lexeme: string, error: SyntaxError) => {
		if (!check(type)) throw error;
		if (lexeme === null || peek().lexeme === lexeme) return advance();
		throw error;
	};

	const is_literal = (t: Token) =>
		t.type === TokenType.boolean || t.type === TokenType.natural ||
		t.type === TokenType.character || t.type === TokenType.string;

	const match_types = (a: Type, b: Type) => a.matches(b);

	// ==== Types ==============================================================

	const aliases: { [name: string]: (token: Token) => Type } = {
		"chr": token => new BasicType(token, "chr"),
		"str": token => new ListType(new BasicType(token, "str")),
		"cpx": token => new ProductType([
			new BasicType(token, "rea"), new BasicType(token, "img")
		]),
	};

	// type = coproduct
	const type = (): Type => {
		// coproduct = product { '|' product }
		// TODO: check if coproduct has isomorphic inner types (not allowed)
		const coproduct = (): Type => {
			const p = product();
			if (peek().type === TokenType.operator && peek().lexeme === '|') {
				const c = new CoproductType([ p ]);
				let duplicate = false, nested = false;
				while (match(TokenType.operator, '|')) {
					const p = product();
					if (p.contains(Category.coproduct)) nested = true;
					for (const node of c.types)
						if (match_types(p, node)) { duplicate = true; break; }
					c.extend(p);
				}
				if (duplicate) throw error("DTC", c.bounds);
				if (nested)    throw error("NTC", c.bounds);
				return c;
			} else return p;
		};
		// product = morphism<high> { ',' morphism<high> }
		const product = (): Type => {
			const m = morphism(Order.high);
			if (peek().type === TokenType.operator && peek().lexeme === ',') {
				const p = new ProductType([ m ]);
				while (match(TokenType.operator, ','))
					p.extend(morphism(Order.high));
				return p;
			} else return m;
		};
		// morphism<high> = morphism<low> [ '=>' morphism<high> ]
		// morphism<low> = optional [ '->' morphism<low> ]
		const morphism = (order: boolean): Type => {
			let t: Type;
			if (order === Order.high) {
				t = morphism(Order.low);
				if (match(TokenType.operator, '=>')) {
					t = new MorphismType(t, morphism(Order.high));
					if ((t as MorphismType).order === Order.low)
						throw error("IMO", t.bounds);
				}
			} else {
				t = optional();
				if (match(TokenType.operator, '->')) {
					t = new MorphismType(t, morphism(Order.low));
					if ((t as MorphismType).order === Order.high)
						throw error("IMO", t.bounds);
				}
			}
			return t;
		};
		// optional = basic { '?' }
		const optional = (): Type => {
			let e = basic();
			if (match(TokenType.operator, '?'))
				e = new CoproductType([ e, new VoidType() ]);
			return e;
		};
		// basic = group | list | generic | alias | <BasicType>
		// group = '(' [ type ] ')'
		// list = '[' type ']'
		// generic = <identifier>
		const basic = (): Type => {
			if (match(TokenType.operator, '(')) {
				const p = prev();
				if (match(TokenType.operator, ')')) {
					const v = new VoidType();
					v.start = p.position;
					v.end = prev().position + 1;
					return v;
				}
				const t = type();
				consume(TokenType.operator, ')', error("MTP", t.bounds));
				return t;
			}
			if (match(TokenType.operator, '[')) {
				const start = prev().position;
				const t = new ListType(type());
				t.start = start;
				consume(TokenType.operator, ']', error("MTB", t.bounds));
				t.end = prev().position + 1;
				return t;
			}
			if (match(TokenType.operator, '<')) {
				const start = prev().position;
				const p = peek();
				if (p.type !== TokenType.symbol) throw error("IGD", bounds(p));
				const t = new GenericType(peek());
				t.start = start;
				consume(TokenType.operator, '>', error("MAB", t.bounds));
				t.end = prev().position + 1;
				return t;
			}
			const p = peek();
			if (p.type === TokenType.type) return new BasicType(advance());
			if (p.type != TokenType.symbol) throw error("ITD", bounds(p));
			if (p.lexeme in aliases) return aliases[p.lexeme](advance());
			throw error("ITD", bounds(p));
		};
		if (is_at_end()) throw error("ITD", bounds(prev()));
		return coproduct();
	};

	// ==== Expressions ========================================================

	const expression = (): Expression => {
		// declaration = multiple [ '::' | ':::' type [ '=' multiple ] ] 
		const declaration = (): Expression => {
			const e: Expression = multiple();
			if (match(TokenType.operator, '::')) {
				if (!(e instanceof Identifier)) throw error("MID", e.bounds);
				const prototype = type();
				let rhs: Expression | undefined = undefined;
				if (match(TokenType.operator, '=')) rhs = multiple();
				return new Declaration(e, prototype, rhs);
			} else if (match(TokenType.operator, ':::')) {
				if (!(e instanceof Identifier)) throw error("MID", e.bounds);
				const prototype = type();
				aliases[(e as Identifier).symbol.lexeme] = _ => prototype;
				return new Alias(e, prototype);
			} else return e;
		};
		// multiple = assignment { ';' assignment }
		const multiple = (): Expression => {
			let e: Expression = assignment();
			if (precise_check(TokenType.operator, ';')) {
				e = new Multiple(e);
				while (match(TokenType.operator, ';'))
					(e as Multiple).extend(assignment());
			}
			return e;
		};
		// assignment = product [ [ ':' ] '=' assignment ]
		const assignment = (): Expression => {
			const e: Expression = product();
			if (match(TokenType.operator, '=')) {
				if (!(e instanceof Identifier))
					throw error("ANS", e.bounds);
				return new Assignment(e, prev(), assignment());
			} else return e;
		};
		// product = morphism<high> { ( ',' ) morphism<high> }
		const product = (): Expression => {
			let e: Expression = morphism(Order.high);
			if (precise_check(TokenType.operator, ',')) {
				e = new Product(e);
				while (match(TokenType.operator, ','))
					(e as Product).extend(morphism(Order.high));
			}
			return e;
		};
		// morphism<high> = morphism<low> { ( '=>' ) morphism<low> }
		// morphism<low> = short-or { ( '->' ) short-or }
		const morphism = (order: boolean): Expression => {
			let e: Expression;
			if (order === Order.high) {
				e = morphism(Order.low);
				if (match(TokenType.operator, '=>'))
					return new Morphism(e, morphism(Order.high));
			} else {
				e = short_or();
				if (match(TokenType.operator, '->'))
					return new Morphism(e, morphism(Order.low));
			}
			return e;
		};
		// short-or = short-and { ( '||' ) short-and }
		const short_or = (): Expression => {
			let e: Expression = short_and();
			while (match(TokenType.operator, '||'))
				e = new Infix(e, prev(), short_and());
			return e;
		};
		// short-and = equality { ( '&&' ) equality }
		const short_and = (): Expression => {
			let e: Expression = equality();
			while (match(TokenType.operator, '&&'))
				e = new Infix(e, prev(), equality());
			return e;
		};
		// equality = comparison { ( '==' | '!=' ) comparison }
		const equality = (): Expression => {
			let e: Expression = comparison();
			while (match(TokenType.operator, [ '==', '!=' ]))
				e = new Infix(e, prev(), comparison());
			return e;
		};
		// comparison = term { ( '<' | '<=' | '>' | '>=' ) term }
		const comparison = (): Expression => {
			let e: Expression = term();
			while (match(TokenType.operator, [ '<', '<=', '>', '>=' ]))
				e = new Infix(e, prev(), term());
			return e;
		};
		// term = factor { ( '+' | '-', '|' ) factor }
		const term = (): Expression => {
			let e: Expression = factor();
			while (match(TokenType.operator, [ '+', '-', '|' ]))
				e = new Infix(e, prev(), factor());
			return e;
		};
		// factor = power { ( '/' | '*' | '%' | '&' | '$', '.' ) power }
		const factor = (): Expression => {
			let e: Expression = power();
			while (match(TokenType.operator, ['/', '*', '%', '&', '$', '.']))
				e = new Infix(e, prev(), power());
			return e;
		};
		// power = postfix { '^' postfix }
		const power = (): Expression => {
			let e: Expression = postfix();
			while (match(TokenType.operator, '^'))
				e = new Infix(e, prev(), postfix());
			return e;
		};
		// postfix = prefix { '!' }
		const postfix = (): Expression => {
			let e: Expression = prefix();
			while (match(TokenType.operator, '!'))
				e = new Postfix(e, prev());
			return e;
		};
		// prefix = ( ( '+' | '-' | '!' | '~' | '#' ) prefix ) | call
		const prefix = (): Expression => {
			if (match(TokenType.operator, [ '+', '-', '!', '~', '#' ]))
				return new Prefix(prev(), call());
			return call();
		};
		// call = primary [ '(' [ expression ] ')' ]
		const call = (callee?: Expression): Expression => {
			if (callee === undefined) {
				let e: Expression = primary();
				while (match(TokenType.operator, '(')) e = call(e);
				return e;
			} else {
				const o: Token = prev();
				let p: Expression, c: Token;
				if (!match(TokenType.operator, ')')) {
					p = expression();
					c = consume(
						TokenType.operator, ')', error("MEP", bounds(prev()))
					);
				} else { c = prev(); p = new Void(o, c); }
				// todo: what if instead of having to parse this thing by
				//       force we used the product as a postfix operator?
				return new Call(callee, p, o);
			}
		};
		// primary = ( '(' expression ')' ) | symbol | literal
		const primary = (): Expression => {
			const literal = peek();
			if (is_literal(literal)) return new Primary(advance());
			else if (literal.type === TokenType.symbol)
				return new Identifier(advance());
			else if (match(TokenType.operator, '(')) {
				const e = expression();
				consume(TokenType.operator, ')', error("MEP", bounds(literal)));
				return e;
			} else if (match(TokenType.operator, '[')) {
				// todo: parse array literal
			} else if (match(TokenType.operator, '{')) {
				const o: Token = prev(), e: Expression = block();
				return new Morphism(new Void(o, prev()), e);
			} else if (match(TokenType.operator, 'ƒ')) {
				return new Identifier(prev());
			}
			throw error("IEX", bounds(literal));
		};
		// block = '{' [ expression ] '}'
		const block = (): Expression => {
			const s: Expression[] = [];
			while (!is_at_end() && !precise_check(TokenType.operator, '}'))
				s.push(expression());
			consume(TokenType.operator, '}', error("MEB", bounds(prev())));
			return new Block(s);
		};
		return declaration();
	};

	const instructions: Expression[] = [];
	while (!is_at_end()) instructions.push(expression());
	return instructions;

};
