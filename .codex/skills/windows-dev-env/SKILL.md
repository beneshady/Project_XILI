# Windows Dev Env

Use when commands, paths, encodings, or local tooling behave differently on Windows.

Rules:
- Prefer PowerShell examples.
- Quote paths with spaces.
- Use `-LiteralPath` for file operations involving user-provided paths.
- Avoid POSIX-only assumptions like `rm -rf`, `cp -r`, and `export VAR=value`.
- Prefer package scripts for cross-platform commands.
- Keep files UTF-8 and avoid changing line endings across unrelated files.

Common equivalents:
- Delete folder: `Remove-Item -Recurse -Force -LiteralPath "path"`
- Set env var: `$env:NODE_ENV = "production"`
- Search files: `Get-ChildItem -Recurse -Filter *.js`
- Find text: `rg "pattern"`
