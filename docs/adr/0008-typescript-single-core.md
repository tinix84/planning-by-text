# One TypeScript core for CLI and browser

Parser, model and views are written once in TypeScript and run in Node (CLI, CI) and in the browser (HTML report now, live split-pane editor later). Python was rejected for the core because running it in the browser needs Pyodide (a large download, slow for per-keystroke re-rendering) or a server; a parser generator was rejected because the grammar is line-oriented and the hard part, the semantics, would still be written twice. The code uses only type syntax Node can strip natively, so it runs without a build step.
