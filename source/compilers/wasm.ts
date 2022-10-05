
import {
	Compiler, AST,
	Prefix, Infix, Postfix, Call, Product, Morphism, Block, List, Primary,
	Void, Identifier, Declaration, Alias, Multiple, Assignment, ASTVisitor, Category
} from "../tree.ts";

export class WASMCompiler implements Compiler {

	instructions: string[] = [];
	indentaion = 0;

	precision: 32 | 64 = 64;

	get i() { return "i" + this.precision; }
	get f() { return "f" + this.precision; }

	begin(s: string) { this.push("(" + s); this.indentaion++; }
	end() { this.indentaion--; this.push(")"); }
	push(s: string) {
		this.instructions.push("\t".repeat(this.indentaion) + s);
	}

	assignment(a: Assignment) { }
	prefix(p: Prefix) {
		switch (p.operator.lexeme) {

		}
	}
	infix(i: Infix) {
		let z = "";
		if (i.type?.description() == "rea") z = this.f;
		else z = this.i;
		switch (i.operator.lexeme) {
			case "+": this.push(z + ".add"); break;
			case "-": this.push(z + ".sub"); break;
			case "*": this.push(z + ".mul"); break;
			case "/": this.push(z + ".div_s"); break;
			case "%": this.push(z + ".rem_s"); break;
			case "&": this.push(z + ".and"); break;
			case "|": this.push(z + ".or"); break;
			case "$": this.push(z + ".xor"); break;
		}
	}
	postfix(p: Postfix) { }
	call(c: Call) { }
	product(p: Product) { }
	morphism(m: Morphism) { }
	list(l: List) { }
	primary(p: Primary) {
		switch (p.type?.description()) {
			case "bln": this.push(this.i + ".const" + (
				p.literal.lexeme == "true" ? "1" : "0"
			)); break;
			case "nat": this.push(this.i + ".const" + p.literal.lexeme); break;
			case "rea": this.push(this.f + ".const" + p.literal.lexeme); break;
			case "chr": this.push(
				this.i + ".const" + p.literal.lexeme.charCodeAt(0)
			); break;
			case "str": break; // todo: string table
		}
	}
	void(v: Void) { }
	identifier(i: Identifier) { }
	declaration(d: Declaration) { }
	block(b: Block): void { }
	alias(a: Alias) { }
	multiple(m: Multiple) { }

	compile(ast: AST): string {
		this.begin("module");
		for (const node of ast.ast) node.accept!(this);
		this.end();
		return this.instructions.join("\n");
	}

}
