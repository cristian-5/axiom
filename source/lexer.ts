
import { Token, TokenType, TypeNames } from "./tree.ts";

const reserved: { [id: string]: string[] } = {
	"type": TypeNames,
	"boolean": [ "false", "true" ],
	"real": [ "infinity", "undefined" ],
	"operator": [
		':', ',', '!', '?', '=', '(', ')', '[', ']', '{', '}', '+', '#', '@',
		'-', '*', '/', '^', '%', '&', '|', '~', '$', '<', '>', '.', ';', 'ƒ',
	]
};

const is_binary = (c: string) => {
	const code = c.charCodeAt(0);
	return code == 48 || code == 49;
}
// const is_digit = (c: string) => /\d/.test(c);
const is_digit = (c: string) => {
	const code = c.charCodeAt(0);
	return code >= 48 && code <= 57;
}
const is_octal = (c: string) => {
	const code = c.charCodeAt(0);
	return code >= 48 && code <= 55;
}
const is_hex = (c: string) => {
	const code = c.charCodeAt(0);
	return code >= 48 && code <= 57 || code >= 65 && code <= 70;
}
// const is_alpha = (c: string) => /[a-zA-Z_]/.test(c);
const is_alpha = (c: string) => {
	const code = c.charCodeAt(0);
	return (code >= 65 && code <=  90) ||
		   (code >= 97 && code <= 122) || code === 95;
}
// const is_alpha_numeric = (c: string) => /\w/.test(c);
const is_alpha_numeric = (c: string) => {
	const code = c.charCodeAt(0);
	return (code >= 48 && code <=  57) ||
		   (code >= 65 && code <=  90) ||
		   (code >= 97 && code <= 122) || code === 95;
}
// const is_whitespace = (c: string) => /\s|\r?\n/.test(c);
const is_whitespace = (c: string) => {
	const code = c.charCodeAt(0);
	return code === 32 || (code >= 9 && code <= 13);
}

const begin_file: Token = { type: TokenType.begin, lexeme: "", position: 0 };
const end_file:   Token = { type: TokenType.end,   lexeme: "", position: 0 };

export const lex = (code: string): Token[] => {
   
	if (code.length === 0) return [ begin_file, end_file ];

	let index = 0, start = 0; const tokens: Token[] = [ begin_file ];

	const advance = () => code[index++], peek = () => code[index];
	const peek_prev = () => code[index - 1], peek_next = () => code[index + 1];
	const is_at_end = () => index >= code.length;
	const match = (c: string) =>
		is_at_end() || peek() !== c ? false : !!advance();
	const match_any = (m: string[]) => m.reduce((a, b) => a || match(b), false);
	const cursor = (n: number) => code.substring(start, start + n);
	const token = (type: TokenType, lexeme: string) =>
		tokens.push({ type, lexeme, position: start });
	const parsed = () => code.substring(start, index);
	const invalid = (n = 1) => {
		const l = tokens[tokens.length - 1];
		if (l.type !== TokenType.invalid) token(TokenType.invalid, cursor(n));
		else tokens[tokens.length - 1].lexeme += cursor(n);
	};

	const scan_operator = (o: string) => {
		const add = () => token(TokenType.operator, parsed());
		switch (o) {
			case '&': case '|': match(o); add(); break;
			case '<': match('='); add(); break;
			case '=': match_any([ '=', '>' ]); add(); break;
			case ':':
				if (match(':')) { match(':'); add(); }
				break;
			case '!': case '>': match('='); add(); break;
			case '-': match('>'); add(); break;
			case '~': match('~'); add(); break;
			case '/': scan_comment(); break;
			default: token(TokenType.operator, cursor(1)); break;
		}
	};
	const scan_string = () => {
		while (!is_at_end() && peek() !== '"') {
			if (match('\\')) match('"');
			else advance();
		}
		if (is_at_end()) {
			invalid(index - start);
			return;
		}
		advance();
		token(TokenType.string, parsed());
	};
	const scan_character = () => {
		if (is_at_end())  { invalid(1); return; }
		advance();
		if (is_at_end()) { invalid(2); return; }
		if (!match("'")) { invalid(3); return; }
		token(TokenType.character, cursor(3));
	};
	const scan_number = () => {
		let type = TokenType.natural;
		if (peek_prev() === '0') {
			// Try to parse base:
			if (match('x')) {
				let x = peek();
				if (!is_hex(x)) {
					// '0xsomething' so we return '0':
					index = start + 1;
					token(TokenType.natural, cursor(1));
					return;
				}
				while (is_hex(x)) { advance(); x = peek();}
				token(TokenType.natural, parsed());
				return;
			} else if (match('b')) {
				let b = peek();
				if (!is_binary(b)) {
					// '0bsomething' so we return '0':
					index = start + 1;
					token(TokenType.natural, cursor(1));
					return;
				}
				while (b === '0' || b === '1') { advance(); b = peek(); }
				token(TokenType.natural, parsed());
				return;
			} else if (match('o')) {
				let o = peek();
				if (!is_octal(o)) {
					// '0osomething' so we return '0':
					index = start + 1;
					token(TokenType.natural, cursor(1));
					return;
				}
				while (is_octal(o)) { advance(); o = peek(); }
				token(TokenType.natural, parsed());
				return;
			} else if (match('d')) {
				let d = peek();
				if (!is_digit(d)) {
					// '0dsomething' so we return '0':
					index = start + 1;
					token(TokenType.natural, cursor(1));
					return;
				}
				while (is_digit(d)) { advance(); d = peek(); }
				token(TokenType.natural, parsed());
				return;
			}
		}
		while (!is_at_end() && is_digit(peek())) advance();
		if (!is_at_end() && peek() === '.' && is_digit(peek_next())) {
			type = TokenType.real;
			advance();
			while (!is_at_end() && is_digit(peek())) advance();
			if (match('e')) {
				match('-');
				if (!is_digit(peek())) {
					// 123.456ea || 123.46e-a:
					invalid(index - start);
					return;
				}
				while (is_digit(peek())) advance();
			}
		}
		token(type, parsed());
	};
	const scan_symbol = () => {
		while (!is_at_end() && is_alpha_numeric(peek())) advance();
		while (match("'")) advance();
		const lexeme = code.substring(start, index);
		for (const type in reserved)
			if (reserved[type].includes(lexeme)) {
				// forced string casting keyof typeof:
				token(TokenType[type as keyof typeof TokenType], lexeme);
				return;
			}
		token(TokenType.symbol, lexeme);
	};
	const scan_comment = () => {
		// while (!is_at_end() && (peek() !== '\n' || peek() !== ';'))
		//     advance();
		if (match('/')) {
			while (peek() != '\n' && !is_at_end()) advance();
			start = index;
		} else token(TokenType.operator, cursor(1));
	};

	while (!is_at_end()) {
		start = index;
		const c = advance();
		if (reserved.operator.includes(c)) scan_operator(c);
		else if (c === '"') scan_string();
		else if (c === "'") scan_character();
		else if (is_digit(c)) scan_number();
		else if (is_alpha(c)) scan_symbol();
		else if (!is_whitespace(c)) invalid();
	}

	tokens.push(end_file);
	return tokens;

};
