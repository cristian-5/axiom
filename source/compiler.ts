
import { lex } from "./lexer.ts";
import { parse } from "./parser.ts";
import { check } from "./checker.ts";

import { Compiler } from "./tree.ts";

export const compile =
	(code: string, compiler: Compiler /* = new WASMCompiler() */): string =>
		compiler.compile(check(parse(lex(code))));