# pathfish 🐠

> **Fuzzy-extract file paths from any blob of text** – Cross-platform CLI & programmatic API for Node.js and Bun.

`pathfish` finds every **relative** or **absolute** file path that appears in text. By default, it **verifies** that each path exists on disk, giving you a clean, reliable list.

## 🚀 What it does

Drop in compiler logs, linter output, stack traces, Git diffs, or chat logs. `pathfish` intelligently extracts all file paths and returns them in the format you want (JSON, YAML, plain list).

-   ✅ **Verifies paths by default**: Only returns paths that actually exist.
-   🧠 **Fuzzy matching**: Catches paths with or without extensions, with line/column numbers, and in various formats (Unix, Windows, relative, absolute).
-   🎨 **Multiple formats**: Output as JSON, YAML, or a simple list.
-   📋 **Smart clipboard**: Automatically copies output to your clipboard when piping from another command.
-   🔗 **Chainable**: Designed to be a powerful part of your shell pipelines.

## 📦 Install

**For CLI usage:**
```bash
# Global CLI (recommended)
npm install -g pathfish

# Or with Bun
bun add -g pathfish
```

**For programmatic use:**
```bash
# With npm
npm install pathfish

# With Bun
bun add pathfish

# With yarn
yarn add pathfish

# With pnpm
pnpm add pathfish
```

## 💻 CLI usage

```bash
# Read from a file (only shows paths that exist)
pathfish lint.log

# Read from stdin
eslint . | pathfish

# It's also automatically copied to your clipboard!

# Choose an output format
pathfish --format yaml lint.log
pathfish --format list lint.log

# Include paths that DON'T exist on disk
pathfish --no-verify lint.log

# Convert all paths to be absolute
pathfish --absolute lint.log

# A powerful pipeline: find all paths from TS and ESLint, make them
# absolute, and copy the list to the clipboard. It's copied by default!
(tsc --noEmit && eslint .) | pathfish --absolute --format list
```

## 🚩 CLI flags

| Flag                | Description                                                          | Default         |
| ------------------- | -------------------------------------------------------------------- | --------------- |
| `--format <format>` | Output format: `json`, `yaml`, `list`.                               | `json`          |
| `--pretty`          | Pretty-print JSON output.                                            | `true`          |
| `--absolute`        | Convert all paths to be absolute.                                    | `false`         |
| `--cwd <dir>`       | Base directory for resolving paths.                                  | `process.cwd()` |
| `--no-verify`       | **Disable verification**; include paths that don't exist on disk.    | (not set)       |
| `--copy`/`--no-copy`| Control clipboard. By default, output is copied when piping input. Use `--copy` to force or `--no-copy` to disable. | (smart)   |
| `--help`, `-h`      | Show this help message.                                              |                 |
| `--version`, `-v`   | Show the version number.                                             |                 |

## 🛠️ Programmatic API

You can also use `pathfish` as a library in your own projects. Works with both Node.js and Bun!

```ts
import { extractPaths, verifyPaths } from 'pathfish';

// For Node.js
import { readFileSync } from 'fs';
const raw = readFileSync('tsc.log', 'utf8');

// For Bun
// const raw = await Bun.file('tsc.log').text();

// 1. Extract all potential path-like strings from text
const potentialPaths = await extractPaths(raw, {
  absolute: true,
  strategy: 'both', // use both regex and fuzzy matching
  cwd: process.cwd(), // or import.meta.dir for Bun
});

// 2. Filter the list to only include paths that exist
const existingPaths = await verifyPaths(potentialPaths);

console.log(existingPaths);
// ["/home/user/project/src/components/SettingsScreen.tsx", ...]
```

### API Signature

```ts
type Options = {
  absolute?: boolean; // make every path absolute
  cwd?: string;       // base for relative→absolute conversion
  unique?: boolean;   // de-duplicate (default: true)
  strategy?: 'regex' | 'fuzzy' | 'both'; // (default: 'fuzzy')
};

async function extractPaths(text: string, opts?: Options): Promise<string[]>;

async function verifyPaths(paths: string[]): Promise<string[]>; // keeps only existing
async function copyPathsToClipboard(paths: string[]): Promise<void>; // cross-platform
```

*(Note: The main `pathfish` CLI command runs `extractPaths` and `verifyPaths` together by default.)*

## ✨ Use-cases

1.  **🤖 LLM Context Injection**
    Pipe linter or compiler output to `pathfish` to get a list of relevant files, then feed their contents into an LLM prompt for more accurate, context-aware responses.

2.  **⚡ IDE-Agnostic Quick-Open**
    Pipe any log into `pathfish --copy --format list` and paste the result directly into your editor’s quick-open dialog to instantly open all referenced files.

3.  **✅ CI Sanity Checks**
    Fail a CI build if logs reference files that have been moved or deleted.
    ```bash
    # Get all paths mentioned in linter output
    eslint . | pathfish --no-verify --format list > all_paths.txt

    # Get only the paths that actually exist
    eslint . | pathfish --format list > existing_paths.txt

    # If the files don't match, there's a missing reference. Fail the build.
    diff all_paths.txt existing_paths.txt && exit 1 || echo "All paths are valid!"
    ```

4.  **🎯 Batch Refactoring**
    Extract every file that triggered an ESLint warning, then run a codemod or script only on that specific list of files.
    `eslint . | pathfish --format list | xargs your-codemod-script`

5.  **💬 Chat-Ops**
    Have a Slack bot receive a stack trace, run `pathfish` on it, and reply with clickable links to the exact files in your repository.

## 📜 Examples

### TypeScript Compiler Output

**Input:**
```
src/components/SettingsScreen.tsx:5:10 - error TS6133: 'AI_PROVIDERS' is declared but its value is never read.
src/utils/non-existent.ts:1:1 - error TS2307: Cannot find module './fake'.
```

**Command:** `pathfish`

**Output:** (Only `SettingsScreen.tsx` is returned because it exists)
```json
[
  "src/components/SettingsScreen.tsx"
]
```

### Dockerfile Commands

**Input:**
```
COPY --from=builder /app/dist/server /usr/local/bin/server
```

**Command:** `pathfish --no-verify --format list` (using `--no-verify` because paths are in a container)

**Output:**
```
/app/dist/server
/usr/local/bin/server
```

### ESLint Stylish Output

**Input:**
```
/home/user/project/src/components/Button.tsx
  108:1  warning  This line has a length of 123  max-len
```

**Command:** `pathfish --format yaml --copy`

**Output:** (and copied to your clipboard)
```yaml
- /home/user/project/src/components/Button.tsx
```

## 🏗️ Development

```bash
git clone https://github.com/your-name/pathfish.git
cd pathfish

# Install dependencies
npm install
# or bun install

# Run tests
npm test
# or bun test

# Build the project
npm run build
# or bun run build

# Lint the code
npm run lint

# Type check
npm run typecheck
```

## ✅ Quality Assurance

- **62+ automated tests** covering all core functionality
- **ESLint** enforced code style
- **TypeScript** strict mode enabled
- **Cross-platform** testing (Node.js + Bun)
- **Zero dependencies** in production (only 3 lightweight dev dependencies)
- **Comprehensive error handling** with graceful degradation

## 📄 License

MIT
