

import {
	Compiler, AST,
	Prefix, Infix, Postfix, Call, Product, Morphism, Block, List,
	Primary, Void, Identifier, Declaration, Alias, Multiple, Assignment
} from "../tree.ts";

export class JSCompiler implements Compiler {

	assignment(a: Assignment) { }
	prefix(p: Prefix) { }
	infix(i: Infix) { }
	postfix(p: Postfix) { }
	call(c: Call) { }
	product(p: Product) { }
	morphism(m: Morphism) { }
	list(l: List) { }
	primary(p: Primary) { }
	void(v: Void) { }
	identifier(i: Identifier) { }
	declaration(d: Declaration) { }
	block(b: Block): void { }
	alias(a: Alias) { }
	multiple(m: Multiple) { }

	compile(ast: AST[]): string {
		//ast[0].accept(this);
		return "";
	}

}
