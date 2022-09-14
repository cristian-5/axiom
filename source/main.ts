
// import { lex } from "./lexer.ts";
// import { parse } from "./parser.ts";

/*console.dir(parse(lex(`

	A ::: int
	a :: A
	a = 1 - 2 * (3 - 4) - 5

`)), { depth: 10 } );*/

/// wat2wasm test.wat -o test.wasm --enable-memory64

const code = Deno.readFileSync('./test.wasm');
const module = new WebAssembly.Module(code);
const instance = new WebAssembly.Instance(module, { js: {
	print: (s: number, e: number) => {
		if (s > e) return 0;
		const memory = (instance.exports.memory as WebAssembly.Memory).buffer;
		const str = new TextDecoder().decode(new Uint8Array(memory, s, e - s));
		console.log(str);
		return 0;
	}
}});
const main = instance.exports.hello_world as CallableFunction;
main();
