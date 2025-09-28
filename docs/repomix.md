This file is a merged representation of a subset of the codebase, containing specifically included files, combined into a single document by Repomix.

# File Summary

## Purpose
This file contains a packed representation of the entire repository's contents.
It is designed to be easily consumable by AI systems for analysis, code review,
or other automated processes.

## File Format
The content is organized as follows:
1. This summary section
2. Repository information
3. Directory structure
4. Repository files (if enabled)
5. Multiple file entries, each consisting of:
  a. A header with the file path (## File: path/to/file)
  b. The full contents of the file in a code block

## Usage Guidelines
- This file should be treated as read-only. Any changes should be made to the
  original repository files, not this packed version.
- When processing this file, use the file path to distinguish
  between different files in the repository.
- Be aware that this file may contain sensitive information. Handle it with
  the same level of security as you would the original repository.

## Notes
- Some files may have been excluded based on .gitignore rules and Repomix's configuration
- Binary files are not included in this packed representation. Please refer to the Repository Structure section for a complete list of file paths, including binary files
- Only files matching these patterns are included: package.json, README.md, index.ts, tsconfig.json
- Files matching patterns in .gitignore are excluded
- Files matching default ignore patterns are excluded
- Files are sorted by Git change count (files with more changes are at the bottom)

# Directory Structure
```
index.ts
package.json
README.md
tsconfig.json
```

# Files

## File: index.ts
````typescript
console.log("Hello via Bun!");
````

## File: package.json
````json
{
  "name": "pathfish",
  "module": "index.ts",
  "type": "module",
  "private": true,
  "devDependencies": {
    "@types/bun": "latest"
  },
  "peerDependencies": {
    "typescript": "^5"
  }
}
````

## File: README.md
````markdown
# pathfish

> Fuzzy-extract file paths from any blob of text – TypeScript CLI & programmatic API powered by Bun.

## What it does

Drop in compiler logs, linter output, stack traces, Git diffs, chat logs, etc.
`pathfish` finds every **relative** or **absolute** file path that appears in the text and returns them in the format you want (JSON, YAML, plain list).
Optionally **verify** that each file really exists, **copy** the list to your clipboard, or **chain** several commands together.

## Install

```bash
bun add -g pathfish        # global CLI
# or
bun add pathfish           # local dependency
```

## CLI usage

```bash
# read from file
pathfish lint.log

# read from stdin
eslint . | pathfish

# choose output format
pathfish --format yaml lint.log
pathfish --format json lint.log
pathfish --format list lint.log

# pretty-print JSON (default)
pathfish --pretty lint.log

# verify that every file actually exists
pathfish --verify lint.log

# copy the resulting list to clipboard (works in CI too if clipboard available)
pathfish --copy lint.log

# multiple commands in one shot
tsc --noEmit && eslint . | pathfish --verify --copy --format json
```

### CLI flags

| Flag         | Description                          | Default |
|--------------|--------------------------------------|---------|
| `--format`   | `json` `yaml` `list`                 | `json`  |
| `--pretty`   | Pretty-print JSON                    | `true`  |
| `--absolute` | Convert relative → absolute paths    | `false` |
| `--cwd`      | Base directory for conversion        | `process.cwd()` |
| `--verify`   | Keep only paths that exist on disk   | `false` |
| `--copy`     | Copy result to system clipboard      | `false` |
| `--help`     | Show help                            |         |
| `--version`  | Show version                         |         |

## Programmatic API

```ts
import { extractPaths, verifyPaths } from 'pathfish';

const raw = await Bun.file('tsc.log').text();

const paths = extractPaths(raw, {
  absolute: true,
  cwd: import.meta.dir,
});

const existing = await verifyPaths(paths); // skips missing files

console.log(existing);
// ["/home/you/project/src/components/SettingsScreen.tsx", ...]
```

### API signature

```ts
type Options = {
  absolute?: boolean; // make every path absolute
  cwd?: string;       // base for relative→absolute conversion
  unique?: boolean;   // de-duplicate (default: true)
};

function extractPaths(text: string, opts?: Options): string[];

async function verifyPaths(paths: string[]): Promise<string[]>; // keeps only existing
async function copyPathsToClipboard(paths: string[]): Promise<void>; // cross-platform
```

## Use-cases

1. **LLM context injection**
   Agentic CLI tools can instantly feed only the **relevant** source files into an LLM prompt, slashing token cost and improving accuracy.

2. **IDE-agnostic quick-open**
   Pipe any log into `pathfish --copy` and paste into your editor’s quick-open dialogue.

3. **CI hygiene checks**
   Fail the build when referenced files are missing:
   `tsc --noEmit | pathfish --verify --format list | wc -l | xargs test 0 -eq`

4. **Batch refactoring**
   Extract every file that triggered an ESLint warning, then run your codemod only on those files.

5. **Chat-ops**
   Slack-bot receives a stack-trace, runs `pathfish`, and returns clickable links to the exact files in your repo.

## Examples

### TypeScript compiler output

Input
```
src/components/SettingsScreen.tsx:5:10 - error TS6133: 'AI_PROVIDERS' is declared but its value is never read.
```

Output (`--format json --verify`)
```json
[
  "/home/you/project/src/components/SettingsScreen.tsx"
]
```

### ESLint stylish output

Input
```
/home/realme-book/Project/code/relaycode-new/src/components/AiProcessingScreen.tsx
  108:1  warning  This line has a length of 123. Maximum allowed is 120  max-len
```

Output (`--format yaml --copy`)
```yaml
- /home/realme-book/Project/code/relaycode-new/src/components/AiProcessingScreen.tsx
```
(list is now in your clipboard)

### Multiple commands

```bash
# one-lint to copy only real offenders
tsc --noEmit && eslint . | pathfish --verify --copy --format list
```

## Development

```bash
git clone https://github.com/your-name/pathfish.git
cd pathfish
bun install
bun test
bun run build
```

## License

MIT
````

## File: tsconfig.json
````json
{
  "compilerOptions": {
    // Environment setup & latest features
    "lib": ["ESNext"],
    "target": "ESNext",
    "module": "Preserve",
    "moduleDetection": "force",
    "jsx": "react-jsx",
    "allowJs": true,

    // Bundler mode
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "noEmit": true,

    // Best practices
    "strict": true,
    "skipLibCheck": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,

    // Some stricter flags (disabled by default)
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noPropertyAccessFromIndexSignature": false
  }
}
````
