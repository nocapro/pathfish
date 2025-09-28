# Directory Structure
```
src/
  cli.ts
  core.ts
  index.ts
  utils.ts
package.json
README.md
tsconfig.json
```

# Files

## File: src/cli.ts
````typescript
#!/usr/bin/env bun

import mri from 'mri';
import { extractPaths, verifyPaths, type Options } from './core';
import { createFormatter, copyToClipboard, type Format } from './utils';
import { version } from '../package.json' with { type: 'json' };

const HELP_TEXT = `
pathfish v${version}
Fuzzy-extract file paths from any blob of text.

Usage:
  pathfish [file] [options]
  cat [file] | pathfish [options]

Options:
  --format <format>  Output format: json, yaml, list (default: json)
  --pretty           Pretty-print JSON output (default: true)
  --absolute         Convert all paths to absolute
  --cwd <dir>        Base directory for resolving paths (default: process.cwd())
  --verify           Filter out paths that do not exist on disk
  --copy             Copy the final output to the clipboard
  --help, -h         Show this help message
  --version, -v      Show version number
`;

type CliArgs = {
  _: string[];
  help?: boolean;
  version?: boolean;
  pretty?: boolean;
  absolute?: boolean;
  verify?: boolean;
  copy?: boolean;
  format?: string;
  cwd?: string;
};

/**
 * Creates a pipeline of operations to be performed on the input text.
 * This functional approach makes the process clear and configurable.
 * @param args Parsed CLI arguments.
 * @returns An async function that executes the full path extraction and formatting pipeline.
 */
const createCliPipeline = (args: CliArgs) => async (inputText: string) => {
  const options: Options = {
    absolute: args.absolute,
    cwd: args.cwd || process.cwd(),
    unique: true, // Unique is always true for CLI
  };

  // 1. A function to extract paths from text using the specified options.
  const extract = (text: string) => extractPaths(text, options);

  // 2. An async function to optionally verify the extracted paths.
  const verify = async (paths: string[]) =>
    args.verify ? verifyPaths(paths) : paths;

  // 3. A function to format the paths into the desired output string.
  const format = createFormatter(args.format as Format, args.pretty ?? true);

  // 4. An async function to optionally copy the formatted string to the clipboard.
  const copy = async (formattedText: string) => {
    if (args.copy) {
      await copyToClipboard(formattedText);
    }
    return formattedText;
  };

  // Execute the pipeline by composing the functions.
  const initialPaths = extract(inputText);
  const verifiedPaths = await verify(initialPaths);
  const formattedOutput = format(verifiedPaths);
  const finalOutput = await copy(formattedOutput);

  return finalOutput;
};

/**
 * Main CLI entry point.
 * This function orchestrates the entire process from argument parsing to final output.
 */
async function run() {
  const args: CliArgs = mri(process.argv.slice(2), {
    boolean: ['help', 'version', 'pretty', 'absolute', 'verify', 'copy'],
    string: ['format', 'cwd'],
    alias: { h: 'help', v: 'version' },
    default: {
      pretty: true,
      format: 'json',
    },
  });

  if (args.help) {
    console.log(HELP_TEXT);
    return;
  }

  if (args.version) {
    console.log(`v${version}`);
    return;
  }

  const inputFile = args._[0];
  const inputText = inputFile
    ? await Bun.file(inputFile).text()
    : await Bun.stdin.text();

  const pipeline = createCliPipeline(args);
  const result = await pipeline(inputText);

  console.log(result);
}

run().catch(err => {
  const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
  // Use console.error to write to stderr
  console.error(`\x1b[31mError: ${errorMessage}\x1b[0m`);
  process.exit(1);
});
````

## File: src/core.ts
````typescript
import path from 'node:path';

/**
 * Options for path extraction.
 */
export type Options = {
  /**
   * Convert all found paths to absolute paths.
   * @default false
   */
  absolute?: boolean;
  /**
   * The base directory for resolving relative paths.
   * @default process.cwd()
   */
  cwd?: string;
  /**
   * Ensure the returned list contains only unique paths.
   * @default true
   */
  unique?: boolean;
};

// This regex finds file paths, including optional line/column numbers.
// It supports Windows, Unix, absolute, and relative paths.
// It's designed to find paths with extensions in a larger body of text.
const PATH_REGEX = /(?:(?:[a-zA-Z]:[\\\/]|\.{1,2}[\\\/]|\/))?(?:[\w.-]+[\\\/])*(?:[\w.-]+\.\w+)(?::\d+)?(?::\d+)?/g;

/**
 * A higher-order function that creates a path extraction pipeline.
 * This functional approach makes the process clear, configurable, and extensible.
 * @param opts Configuration options for the pipeline.
 * @returns A function that takes text and returns an array of paths.
 */
const createPathExtractionPipeline = (opts: Options = {}) => {
  const { absolute = false, cwd = process.cwd(), unique = true } = opts;

  return (text: string): string[] => {
    // 1. Find all potential paths using the regex.
    const matches = Array.from(text.matchAll(PATH_REGEX), m => m[0]);

    // 2. Clean up the matches by removing trailing line/column numbers.
    const cleanedPaths = matches.map(p => p.replace(/(?::\d+)+$/, ''));

    // 3. (Optional) Filter for unique paths.
    const uniquePaths = unique ? Array.from(new Set(cleanedPaths)) : cleanedPaths;

    // 4. (Optional) Resolve paths to be absolute.
    const resolvedPaths = absolute
      ? uniquePaths.map(p => path.resolve(cwd, p))
      : uniquePaths;

    return resolvedPaths;
  };
};

/**
 * Extracts potential file paths from a blob of text using a configurable pipeline.
 * @param text The text to search within.
 * @param opts Configuration options for extraction.
 * @returns An array of found file paths.
 */
export function extractPaths(text: string, opts: Options = {}): string[] {
  const extractor = createPathExtractionPipeline(opts);
  return extractor(text);
}

/**
 * Filters a list of paths, keeping only the ones that exist on disk.
 * @param paths An array of file paths to check.
 * @returns A promise that resolves to an array of existing file paths.
 */
export async function verifyPaths(paths: string[]): Promise<string[]> {
  // Concurrently check for the existence of each file.
  const existenceChecks = await Promise.all(
    paths.map(p => Bun.file(p).exists()),
  );

  // Filter the original paths array based on the results of the existence checks.
  const existingPaths = paths.filter((_, i) => existenceChecks[i]);

  return existingPaths;
}
````

## File: src/index.ts
````typescript
// Re-export core functions and types for programmatic use.
export { extractPaths, verifyPaths, type Options } from './core';

// Import the low-level clipboard utility.
import { copyToClipboard } from './utils';

/**
 * Asynchronously copies an array of paths to the system clipboard,
 * formatting them as a newline-separated list.
 * It gracefully handles errors in environments without a clipboard (e.g., CI).
 * @param paths The array of path strings to copy.
 * @returns A promise that resolves when the operation is complete.
 */
export async function copyPathsToClipboard(paths: string[]): Promise<void> {
  const textToCopy = paths.join('\n');
  await copyToClipboard(textToCopy);
}
````

## File: src/utils.ts
````typescript
import yaml from 'js-yaml';
import clipboardy from 'clipboardy';

export type Format = 'json' | 'yaml' | 'list';

/**
 * A higher-order function that returns a formatting function based on the desired format.
 * This keeps the formatting logic separate and easy to test.
 * @param format The output format.
 * @param pretty Whether to pretty-print (for JSON).
 * @returns A function that takes an array of strings and returns a formatted string.
 */
export const createFormatter = (format: Format, pretty: boolean) => {
  return (paths: string[]): string => {
    switch (format) {
      case 'json':
        return JSON.stringify(paths, null, pretty ? 2 : undefined);
      case 'yaml':
        return yaml.dump(paths);
      case 'list':
        return paths.join('\n');
      default:
        // This case should be unreachable if argument parsing is correct.
        throw new Error(`Unknown format: ${format}`);
    }
  };
};

/**
 * Asynchronously copies a given string to the system clipboard.
 * It gracefully handles errors in environments without a clipboard (e.g., CI).
 * @param text The text to copy.
 * @returns A promise that resolves when the operation is complete.
 */
export async function copyToClipboard(text: string): Promise<void> {
  try {
    await clipboardy.write(text);
  } catch (error) {
    // Suppress errors in environments without a clipboard. Copying is a
    // "nice-to-have" side effect, not a critical function.
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

## File: package.json
````json
{
  "name": "pathfish",
  "version": "0.1.0",
  "module": "src/index.ts",
  "type": "module",
  "private": true,
  "bin": {
    "pathfish": "src/cli.ts"
  },
  "files": [
    "src"
  ],
  "dependencies": {
    "clipboardy": "^4.0.0",
    "js-yaml": "^4.1.0",
    "mri": "^1.2.0"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "@types/js-yaml": "^4.0.9",
    "@types/mri": "^1.1.5"
  },
  "peerDependencies": {
    "typescript": "^5"
  }
}
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
    "verbatimModuleSyntax": true,
    "noEmit": false,
    "outDir": "dist",

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
  },
  "include": ["src"]
}
````
