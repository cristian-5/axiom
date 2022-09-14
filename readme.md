
# Axiom

> ***functional high level programming language made with lots of***
  ❤️ ***and passion.***

🚸 **WARNING!** This project is in early stages of development.

### Why, and most importantly, why not?

The goal of this project is to create a programming language that is
the purest expression of functional programming algorithms. Everything
needs to be built from the ground up, using the basic building blocks
of the language and *Category Theory*. The language is designed to be
used for ***demonstrations***, ***proofs*** and ***reductions***.

## Syntax

**Axiom** syntax is very similar to `Haskell`, however there are some
differences. There are no keywords in **Axiom**, only functions (morphisms,
lambdas, clojures), variables and expressions.
Conditional staments are written using the ternary operator.
Cycles can be achieved using recursion.
Variables cannot be reassigned, function parameters are immutable.

The optimisation layer allows you to output very efficient code, even if
what you write is intricate recursion. It automatically recognises
primitive recursion and reduces it to a loop; it can apply advanced
optimisations techniques such as *tail call optimisation* and *memoisation*.
You can, of course, turn it off to get a `1:1` correspondence between
your code and the `assembly` / `bytecode` output.

``` swift
/// fibonacci function
/// time  complexity: O(2^n)
/// space complexity: O(2^n)
/// memoised tail-call space-time complexity: O(n)
fibonacci :: nat -> nat
fibonacci = n -> n < 2 ? n : ƒ(n - 1) + ƒ(n - 2)
```

``` swift
/// bubble sort, heap sort reduction
/// time  complexity: O(T(n)) = O(n * (n + 1) / 2) ~ O(n^2)
/// space complexity: O(T(n)) = O(n * (n + 1) / 2) ~ O(n^2)
/// tail-call space complexity: O(n)
bubble :: ([<T>], [<T>]) -> [<T>]
bubble = (A, N) -> # A == 0 ? N : ƒ(A - [max(A)], N + [max(A)])
bubble :: [<T>] -> [<T>]
bubble = A -> ƒ(A, [])
```

## Extensions

**Axiom** has been designed in `TypeScript` and aims to be extremely
extensible. Everyone can write their own **Compiler Module** following
the specifications of the ones already implemented. The compiler
makes sure the code makes sense and is type safe, then handles the
*Abstract Syntax Tree* to the custom compiler module to generate assembly
or bytecode. Right now we're aiming to compile for `webassembly`.

## Requirements

* `deno@v1.25.2` **Deno**, secure `JavaScript` and `TypeScript` runtime,
				 https://deno.land/
* `wabt@v1.0.29` The **WebAssembly Binary Toolkit**,
				 https://github.com/WebAssembly/wabt
