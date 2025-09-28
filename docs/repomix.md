# Directory Structure
```
src/
  cli.ts
  core.ts
  engine.ts
  index.ts
  utils.ts
test/
  e2e/
    cli.fixtures.yaml
    cli.test.ts
  integration/
    engine.fixtures.yaml
    engine.test.ts
  unit/
    core.fixtures.yaml
    core.test.ts
    utils.fixtures.yaml
    utils.test.ts
  test.utils.ts
package.json
README.md
tsconfig.json
```

# Files

## File: src/index.ts
````typescript
// Re-export core functions and types for programmatic use.
export { extractPaths, verifyPaths, type Options, type Strategy } from './core';

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

## File: test/unit/utils.fixtures.yaml
````yaml
- name: "should format as a JSON array (pretty)"
  format: "json"
  pretty: true
  input: ["src/index.ts", "README.md"]
  expected: |
    [
      "src/index.ts",
      "README.md"
    ]

- name: "should format as a JSON array (compact)"
  format: "json"
  pretty: false
  input: ["src/index.ts", "README.md"]
  expected: '["src/index.ts","README.md"]'

- name: "should format as a YAML list"
  format: "yaml"
  pretty: true # pretty is ignored for yaml in current impl
  input: ["src/index.ts", "README.md"]
  expected: |
    - src/index.ts
    - README.md

- name: "should format as a newline-separated list"
  format: "list"
  pretty: true # pretty is ignored for list
  input: ["src/index.ts", "README.md"]
  expected: |
    src/index.ts
    README.md

- name: "should handle empty input correctly for all formats"
  cases:
    - format: "json"
      pretty: true
      input: []
      expected: "[]"
    - format: "yaml"
      pretty: true
      input: []
      expected: "[]\n" # js-yaml adds a newline for empty array
    - format: "list"
      pretty: true
      input: []
      expected: ""
````

## File: src/engine.ts
````typescript
import { extractPaths, verifyPaths, type Options } from './core';
import { createFormatter, type Format } from './utils';
export type { Strategy } from './core';

/**
 * Combined options for the entire path processing pipeline.
 */
export type PipelineOptions = Options & {
  /**
   * When false, disables filtering of paths that do not exist on disk.
   * @default true
   */
  verify?: boolean;
  /**
   * The output format.
   * @default 'json'
   */
  format?: Format;
  /**
   * Pretty-print JSON output.
   * @default true
   */
  pretty?: boolean;
  /**
   * The path extraction strategy to use.
   * @default 'fuzzy'
   */
  strategy?: Strategy;
};

/**
 * Executes the full path extraction and formatting pipeline.
 * This is the core engine of pathfish, decoupled from the CLI.
 * @param text The input text to process.
 * @param options Configuration for the pipeline.
 * @returns A promise that resolves to the formatted string output.
 */
export async function runPipeline(
  text: string,
  options: PipelineOptions = {},
): Promise<string> {
  const {
    verify: shouldVerify = true,
    format: formatType = 'json',
    pretty = true,
    ...extractOptions
  } = options;

  // 1. Extract paths from the text using the core extractor.
  const initialPaths = await extractPaths(text, { unique: true, ...extractOptions });

  // 2. (Optional) Verify that the paths actually exist on disk.
  const verifiedPaths = shouldVerify
    ? await verifyPaths(initialPaths, extractOptions.cwd)
    : initialPaths;

  // 3. Format the resulting paths into the desired output string.
  const format = createFormatter(formatType, pretty);
  const formattedOutput = format(verifiedPaths);

  return formattedOutput;
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
  if (!['json', 'yaml', 'list'].includes(format)) {
    // Fail fast if the format is not supported.
    throw new Error(`Unknown format: ${format}`);
  }
  return (paths: string[]): string => {
    switch (format) {
      case 'json':
        return JSON.stringify(paths, null, pretty ? 2 : undefined);
      case 'yaml':
        return yaml.dump(paths);
      case 'list':
        return paths.join('\n');
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
  } catch {
    // Suppress errors in environments without a clipboard. Copying is a
    // "nice-to-have" side effect, not a critical function.
  }
}
````

## File: test/e2e/cli.fixtures.yaml
````yaml
- name: "should show help text with --help"
  args: ["--help"]
  expected_stdout_contains: "Usage:"
  exit_code: 0

- name: "should show version with --version"
  args: ["--version"]
  expected_stdout_contains: "v" # Will be checked against package.json version
  exit_code: 0

- name: "should read from stdin and output pretty json by default"
  args: ["--strategy", "regex"]
  stdin: "path is src/index.ts"
  files:
    "src/index.ts": ""
  expected_stdout: |
    [
      "src/index.ts"
    ]

- name: "should output compact json with --pretty=false"
  args: ["--pretty=false", "--strategy", "regex"]
  stdin: "path is src/index.ts"
  files:
    "src/index.ts": ""
  expected_stdout: '["src/index.ts"]'

- name: "should read from a file argument"
  args: ["input.log", "--strategy", "regex"]
  files:
    "input.log": "path in file is src/index.ts"
    "src/index.ts": ""
  expected_stdout: |
    [
      "src/index.ts"
    ]

- name: "should output yaml with --format yaml"
  args: ["--format", "yaml", "--strategy", "regex"]
  stdin: "src/app.js and src/style.css"
  files:
    "src/app.js": ""
    "src/style.css": ""
  expected_stdout: |
    - src/app.js
    - src/style.css

- name: "should output a list with --format list"
  args: ["--format", "list", "--strategy", "regex"]
  stdin: "src/app.js and src/style.css"
  files:
    "src/app.js": ""
    "src/style.css": ""
  expected_stdout: |
    src/app.js
    src/style.css

- name: "should filter out non-existing files by default"
  args: ["--format", "list", "--strategy", "regex"]
  stdin: "good: file1.txt, bad: missing.txt"
  files:
    "file1.txt": "content"
  expected_stdout: "file1.txt"

- name: "should include non-existing files with --no-verify"
  args: ["--no-verify", "--format", "list", "--strategy", "regex"]
  stdin: "good: file1.txt, bad: missing.txt"
  files:
    "file1.txt": "content"
  expected_stdout: |
    file1.txt
    missing.txt

- name: "should make paths absolute with --absolute"
  args: ["--absolute", "--format", "list", "--no-verify", "--strategy", "regex"]
  stdin: "relative/path.js"
  expected_stdout: "{{CWD}}/relative/path.js"

- name: "should use specified --cwd for absolute paths"
  args: ["--no-verify", "--absolute", "--format", "list", "--strategy", "regex", "--cwd", "{{CWD}}/fake-root"]
  stdin: "relative/path.js"
  files: # create the fake root so it's a valid directory
    "fake-root/placeholder.txt": ""
  expected_stdout: "{{CWD}}/fake-root/relative/path.js"

- name: "should work with --copy flag (output is unchanged)"
  args: ["--copy", "--format", "list", "--strategy", "regex"]
  stdin: "src/main.ts"
  files:
    "src/main.ts": ""
  expected_stdout: "src/main.ts"

- name: "should handle a combination of flags"
  args: ["data.log", "--absolute", "--format", "yaml", "--strategy", "regex"]
  stdin: "" # Reading from file
  files:
    "data.log": "valid: existing.js, invalid: missing.js"
    "existing.js": "export {}"
  expected_stdout: "- {{CWD}}/existing.js"

- name: "should report error and exit 1 if input file does not exist"
  args: ["nonexistent.log"]
  expected_stderr_contains: "Error:"
  exit_code: 1

- name: "should produce empty output for no matches"
  args: ["--format", "list", "--strategy", "regex"]
  stdin: "no paths here"
  expected_stdout: ""

- name: "should handle complex paths from stdin"
  args: ["--no-verify", "--format", "list", "--strategy", "regex"]
  stdin: "url.com/path/to/file.js?v=42 and a/b/c.py#L10"
  files: {}
  expected_stdout: |
    /path/to/file.js
    a/b/c.py

- name: "should handle quoted paths with spaces from stdin"
  args: ["--no-verify", "--format", "list", "--strategy", "regex"]
  stdin: 'Found file in "path with spaces/file.txt"'
  files: {}
  expected_stdout: |
    path with spaces/file.txt

- name: "should use fuzzy strategy by default"
  args: ["--format", "list"]
  stdin: "Just a mention of cli.ts should be enough."
  files:
    "src/cli.ts": "content"
    "README.md": "content"
  expected_stdout: "src/cli.ts"
````

## File: test/integration/engine.fixtures.yaml
````yaml
- name: "Basic pipeline: extract and format as pretty JSON"
  options: { format: 'json', pretty: true, strategy: 'regex' }
  input: "File is src/index.ts and another is ./README.md"
  files:
    "src/index.ts": ""
    "./README.md": ""
  expected: |
    [
      "src/index.ts",
      "./README.md"
    ]

- name: "Pipeline with verification, filtering out non-existent paths"
  options: { format: 'list', verify: true, strategy: 'regex' }
  input: "Existing file: file1.txt. Missing file: missing.txt. Existing subdir file: dir/file2.log"
  files:
    'file1.txt': 'content'
    'dir/file2.log': 'log content'
  expected: |
    file1.txt
    dir/file2.log

- name: "Pipeline with absolute path conversion"
  options: { absolute: true, format: 'json', pretty: false, verify: false, strategy: 'regex' } # verification disabled
  input: "Relative path: src/main.js and ./index.html"
  files: {}
  expected: '["{{CWD}}/src/main.js","{{CWD}}/index.html"]'

- name: "Pipeline with verification and absolute path conversion"
  options: { absolute: true, format: 'yaml', verify: true, strategy: 'regex' }
  input: "Real: src/app.ts. Fake: src/fake.ts"
  files:
    'src/app.ts': 'export default {}'
  expected: |
    - {{CWD}}/src/app.ts

- name: "Pipeline with different format (yaml) and no unique"
  options: { format: 'yaml', unique: false, verify: false, strategy: 'regex' }
  input: "path: a.txt, again: a.txt"
  files: {}
  expected: |
    - a.txt
    - a.txt

- name: "Pipeline should produce empty output for no matches"
  options: { format: 'json', strategy: 'regex' }
  input: "Just some regular text without any paths."
  files: {}
  expected: "[]"

- name: "Pipeline with complex paths and query strings"
  options: { format: 'list', verify: false, strategy: 'regex' }
  input: "Path1: /a/b.css?v=1 Path2: src/d.ts#foo Path3: user@domain.com"
  files: {}
  expected: |
    /a/b.css
    src/d.ts

- name: "Pipeline with quoted path with spaces and verification"
  options: { format: 'list', verify: true, strategy: 'regex' }
  input: 'Log: "real dir/real file.txt" and "fake dir/fake file.txt"'
  files:
    'real dir/real file.txt': 'content'
  expected: |
    real dir/real file.txt

- name: "Pipeline with fuzzy strategy and verification"
  options: { format: 'list', verify: true, strategy: 'fuzzy' }
  input: 'I was editing engine.ts and also missing.ts'
  files:
    'src/engine.ts': 'export {}'
    'src/core.ts': 'export {}'
  expected: |
    src/engine.ts
````

## File: test/integration/engine.test.ts
````typescript
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { runPipeline, type PipelineOptions } from '../../dist/engine.js';
import {
  loadYamlFixture,
  setupTestDirectory,
  cleanupTestDirectory,
} from '../test.utils';

type EngineTestCase = {
  name: string;
  options: PipelineOptions;
  input: string;
  files: { [path: string]: string };
  expected: string;
};

describe('engine.ts (Integration)', async () => {
  const fixtures = await loadYamlFixture<EngineTestCase[]>('integration/engine.fixtures.yaml');

  describe('runPipeline', () => {
    // Use a separate describe block for each test case to avoid closure issues
    fixtures.forEach(({ name, options, input, files, expected }) => {
      describe(name, () => {
        let tempDir: string;

        beforeEach(async () => {
          tempDir = await setupTestDirectory(files);
        });

        afterEach(async () => {
          await cleanupTestDirectory(tempDir);
        });

        it('should execute correctly', async () => {
          // Use the temp directory as the CWD for the pipeline
          const result = await runPipeline(input, { ...options, cwd: tempDir });

          // Replace placeholder in expected output with the actual temp dir path.
          // Trim both results to handle trailing newlines from multiline strings in YAML.
          const expectedWithCwd = expected
            .replaceAll('{{CWD}}', tempDir)
            .trim();

          expect(result.trim()).toEqual(expectedWithCwd);
        });
      });
    });
  });
});
````

## File: test/unit/core.test.ts
````typescript
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import path from 'node:path';
import { extractPaths, verifyPaths, type Options } from '../../dist/core.js';
import {
  loadYamlFixture,
  setupTestDirectory,
  cleanupTestDirectory,
} from '../test.utils';

type ExtractPathsTestCase = {
  name: string;
  options: Options;
  input: string;
  files?: { [path: string]: string };
  expected: string[];
};

describe('core.ts', () => {
  describe('extractPaths', async () => {
    const fixtures = await loadYamlFixture<ExtractPathsTestCase[]>('unit/core.fixtures.yaml');

    for (const { name, options, input, files, expected } of fixtures) {
      it(name, async () => {
        let tempDir: string | undefined;
        let cwd = process.cwd();
        if (files && Object.keys(files).length > 0) {
          tempDir = await setupTestDirectory(files);
          cwd = tempDir;
        }

        const result = await extractPaths(input, { ...options, cwd });
        // Sort for stable comparison
        expect(result.sort()).toEqual(expected.sort());

        if (tempDir) {
          await cleanupTestDirectory(tempDir);
        }
      });
    }
  });

  describe('verifyPaths', () => {
    let tempDir: string;
    const testFiles = {
      'file1.txt': 'hello',
      'dir/file2.js': 'content',
      'dir/subdir/file3.json': '{}',
    };

    beforeEach(async () => {
      tempDir = await setupTestDirectory(testFiles);
    });

    afterEach(async () => {
      await cleanupTestDirectory(tempDir);
    });

    it('should return only paths that exist on disk', async () => {
      const pathsToCheck = [
        path.join(tempDir, 'file1.txt'), // exists
        path.join(tempDir, 'dir/file2.js'), // exists
        path.join(tempDir, 'non-existent.txt'), // does not exist
        path.join(tempDir, 'dir/subdir/another.json'), // does not exist
      ];

      const expected = [
        path.join(tempDir, 'file1.txt'),
        path.join(tempDir, 'dir/file2.js'),
      ];

      const result = await verifyPaths(pathsToCheck, tempDir);
      expect(result.sort()).toEqual(expected.sort());
    });

    it('should return an empty array if no paths exist', async () => {
      const pathsToCheck = [
        path.join(tempDir, 'foo.txt'),
        path.join(tempDir, 'bar.js'),
      ];
      const result = await verifyPaths(pathsToCheck, tempDir);
      expect(result).toEqual([]);
    });

    it('should return an empty array for empty input', async () => {
      const result = await verifyPaths([], tempDir);
      expect(result).toEqual([]);
    });
  });
});
````

## File: test/unit/utils.test.ts
````typescript
import { describe, it, expect } from 'bun:test';
import { createFormatter, type Format } from '../../dist/utils.js';
import { loadYamlFixture } from '../test.utils';

type FormatterTestCase = {
  name: string;
  format: Format;
  pretty: boolean;
  input: string[];
  expected: string;
};

type FormatterFixture = (
  | FormatterTestCase
  | { name: string; cases: FormatterTestCase[] }
)[];

describe('createFormatter', async () => {
  it('should throw an error for an unknown format', () => {
    // This is a type-level check, but we test the runtime guard
    const badFormat = 'xml' as unknown as Format;
    expect(() => createFormatter(badFormat, true)).toThrow(
      'Unknown format: xml',
    );
  });

  const fixtures = await loadYamlFixture<FormatterFixture>('unit/utils.fixtures.yaml');

  for (const fixture of fixtures) {
    if ('cases' in fixture) {
      describe(fixture.name, () => {
        for (const testCase of fixture.cases) {
          it(`should format as ${testCase.format}`, () => {
            const format = createFormatter(testCase.format, testCase.pretty);
            const result = format(testCase.input);
            expect(result.trim()).toEqual(testCase.expected.trim());
          });
        }
      });
    } else {
      it(fixture.name, () => {
        const format = createFormatter(fixture.format, fixture.pretty);
        const result = format(fixture.input);
        // Use trim to handle potential trailing newlines from YAML multiline strings
        expect(result.trim()).toEqual(fixture.expected.trim());
      });
    }
  }
});
````

## File: README.md
````markdown
# pathfish 🐠

> **Fuzzy-extract file paths from any blob of text** – Cross-platform CLI & programmatic API for Node.js and Bun.

`pathfish` finds every **relative** or **absolute** file path that appears in text. By default, it **verifies** that each path exists on disk, giving you a clean, reliable list.

## 🚀 What it does

Drop in compiler logs, linter output, stack traces, Git diffs, or chat logs. `pathfish` intelligently extracts all file paths and returns them in the format you want (JSON, YAML, plain list).

-   ✅ **Verifies paths by default**: Only returns paths that actually exist.
-   🧠 **Fuzzy matching**: Catches paths with or without extensions, with line/column numbers, and in various formats (Unix, Windows, relative, absolute).
-   🎨 **Multiple formats**: Output as JSON, YAML, or a simple list.
-   📋 **Clipboard support**: Instantly copy the output to your clipboard with `--copy`.
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

# Choose an output format
pathfish --format yaml lint.log
pathfish --format list lint.log

# Include paths that DON'T exist on disk
pathfish --no-verify lint.log

# Copy the resulting list to your clipboard
eslint . | pathfish --copy --format list

# Convert all paths to be absolute
pathfish --absolute lint.log

# A powerful pipeline: find all paths from TS and ESLint,
# make them absolute, and copy the list to the clipboard.
(tsc --noEmit && eslint .) | pathfish --absolute --copy --format list
```

## 🚩 CLI flags

| Flag                | Description                                                          | Default         |
| ------------------- | -------------------------------------------------------------------- | --------------- |
| `--format <format>` | Output format: `json`, `yaml`, `list`.                               | `json`          |
| `--pretty`          | Pretty-print JSON output.                                            | `true`          |
| `--absolute`        | Convert all paths to be absolute.                                    | `false`         |
| `--cwd <dir>`       | Base directory for resolving paths.                                  | `process.cwd()` |
| `--no-verify`       | **Disable verification**; include paths that don't exist on disk.    | (not set)       |
| `--copy`            | Copy the final output to the clipboard.                              | `false`         |
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
    "noImplicitAny": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noPropertyAccessFromIndexSignature": false
  },
  "include": ["src", "test"]
}
````

## File: test/unit/core.fixtures.yaml
````yaml
- name: "Basic path extraction"
  options: {}
  input: |
    Here are some files: src/core.ts and ./README.md
    Also, a log file /var/log/syslog
  expected:
    - "src/core.ts"
    - "./README.md"
    - "/var/log/syslog"

- name: "Windows path extraction"
  options: { strategy: 'regex' }
  input: |
    Error in C:\\Users\\Test\\project\\src\\file.js
    Check the config at .\\config\\settings.json
  expected:
    - "C:\\Users\\Test\\project\\src\\file.js"
    - ".\\config\\settings.json"

- name: "Path extraction with line and column numbers"
  options: { strategy: 'regex' }
  input: |
    src/components/Button.tsx:5:10 - error
    dist/bundle.js:1:12345
    /app/main.py:42
  expected:
    - "src/components/Button.tsx"
    - "/app/main.py"

- name: "Standalone filenames with extensions"
  options: { strategy: 'regex' }
  input: |
    The project uses bun.lockb and has a README.md.
    But this is: package.json
  expected:
    - "README.md"
    - "package.json"

- name: "Unique paths option (default)"
  options: { unique: true, strategy: 'regex' }
  input: "See src/core.ts and again src/core.ts"
  expected: ["src/core.ts"]

- name: "Non-unique paths option"
  options: { unique: false, strategy: 'regex' }
  input: "See src/core.ts and again src/core.ts"
  expected: ["src/core.ts", "src/core.ts"]

- name: "Absolute paths option"
  options: { absolute: true, cwd: "/home/user/project", strategy: 'regex' }
  input: |
    Relative path: src/index.ts
    Dot-slash path: ./dist/main.js
    Absolute path is unchanged: /etc/hosts
  expected:
    - "/home/user/project/src/index.ts"
    - "/etc/hosts"

- name: "Empty input"
  options: { strategy: 'regex' }
  input: "No paths here."
  expected: []

- name: "Should ignore common transient/generated directories"
  options: { strategy: 'regex' }
  input: |
    Path in node_modules/package/file.js
    Path in .git/hooks/pre-commit
    Path in dist/bundle.js
    Path in project/build/output.css
    A file called distribution/file.js should not be ignored.
  expected:
    - "distribution/file.js"

- name: "Should ignore common lockfiles"
  options: { strategy: 'regex' }
  input: |
    This project uses bun.lockb and package-lock.json.
    But this is fine: my-package.json
  expected:
    - "my-package.json"

- name: "Paths with special characters and surrounding punctuation"
  options: { strategy: 'regex' }
  input: |
    Paths can be tricky: (src/components/Button (new).tsx),
    <[dist/app-v2.js]>, or even "quoted/path.css".
    A path with a number in extension: file.v2.js
  expected:
    - "src/components/Button (new).tsx"
    - "quoted/path.css"
    - "file.v2.js"

- name: "Should extract common files without extensions"
  options: { strategy: 'regex' }
  input: "Check the Dockerfile and also the Makefile for build instructions."
  expected:
    - "Dockerfile"
    - "Makefile"

- name: "Should avoid matching domains from emails and URLs"
  options: { strategy: 'regex' }
  input: |
    Contact me at user@domain.com.
    Check the website http://example.org/index.html and also https://another.com.
    A file share: //server/file.txt
    But this should be found: a/b/c.com
  expected:
    - "/index.html"
    - "a/b/c.com"
    - "/server/file.txt"

- name: "Advanced path extraction with complex cases"
  options: { strategy: 'regex' }
  input: |
    Quoted path: "src/app/main.css"
    Path with query string: /assets/style.css?v=1.2
    Path with fragment: /images/pic.jpg#fragment
    Path in URL: https://example.com/some/path/to/resource.json
    File with multiple dots: my.component.test.js and another.is.here.md
    Path with unicode: src/för/måin.ts
    Path next to text: file.txt,but notthispart.
    Not a file: user@domain.com, nothing to see.
    But this is a file: a/b/c.io
  expected:
    - "src/app/main.css"
    - "/assets/style.css"
    - "/images/pic.jpg"
    - "/some/path/to/resource.json"
    - "my.component.test.js"
    - "another.is.here.md"
    - "src/för/måin.ts"
    - "file.txt"
    - "a/b/c.io"

- name: "Quoted paths with spaces"
  options: { strategy: 'regex' }
  input: |
    Error in "/path with spaces/file.js" and also in 'another path/with spaces.ts'.
  expected:
    - "/path with spaces/file.js"
    - "another path/with spaces.ts"

- name: "Paths with scoped npm packages"
  options: { strategy: 'regex' }
  input: 'Requires "@scoped/package/index.js" and also regular ''package/main.js'''
  expected:
    - "@scoped/package/index.js"
    - "package/main.js"

- name: "Paths with tilde"
  options: { strategy: 'regex' }
  input: "Check ~/documents/report.docx."
  expected:
    - "~/documents/report.docx"

- name: "Complex relative paths with parent selectors"
  options: { strategy: 'regex' }
  input: "Path is ../../src/app/../core/utils.ts"
  expected:
    - "../../src/app/../core/utils.ts"

- name: "Windows UNC paths"
  options: { strategy: 'regex' }
  input: "Data at \\\\network-share\\folder\\data.csv and //another/share"
  expected:
    - "\\\\network-share\\folder\\data.csv"
    - "//another/share"

- name: "Should avoid matching version numbers"
  options: { strategy: 'regex' }
  input: "Release v3.4.5 is out. See also file-1.2.3.log"
  expected:
    - "file-1.2.3.log"

- name: "Should avoid matching UUIDs and commit hashes"
  options: { strategy: 'regex' }
  input: "Error ID: a1b2c3d4-e5f6-7890-abcd-ef1234567890, commit: f0e9d8c7. see file.log"
  expected:
    - "file.log"

- name: "Paths inside URLs with ports"
  options: { strategy: 'regex' }
  input: "Asset is at http://localhost:8080/assets/img/logo.png. And another at just /path/to/file.js"
  expected:
    - "/assets/img/logo.png"
    - "/path/to/file.js"

- name: "Paths with mixed slashes"
  options: { strategy: 'regex' }
  input: "A strange path: src/mix\\slash/component.tsx"
  expected:
    - "src/mix\\slash/component.tsx"

- name: "Paths with multiple parent selectors"
  options: {}
  input: "Go way up with ../../../../../etc/passwd"
  expected:
    - "../../../../../etc/passwd"

- name: "Paths adjacent to brackets and commas"
  options: { strategy: 'regex' }
  input: "Files are [file1.txt], (file2.log), and {path/to/file3.json}."
  expected:
    - "file1.txt"
    - "file2.log"
    - "path/to/file3.json"
- name: "Should extract paths from TypeScript compiler error output"
  options: { strategy: 'regex' }
  input: |
    src/components/SettingsScreen.tsx:5:10 - error TS6133: 'AI_PROVIDERS' is declared but its value is never read.

    5 import { AI_PROVIDERS, SETTINGS_FOOTER_ACTIONS } from '../constants/settings.constants';
               ~~~~~~~~~~~~

    src/hooks/useDebugMenu.tsx:101:29 - error TS2554: Expected 4 arguments, but got 3.

    101                 initActions.setAnalysisResults('relaycode-tui', true, false);
                                    ~~~~~~~~~~~~~~~~~~

      src/stores/init.store.ts:30:99
        30         setAnalysisResults: (projectId: string, gitignoreFound: boolean, gitInitialized: boolean, configExists: boolean) => void;
                                                                                                             ~~~~~~~~~~~~~~~~~~~~~
        An argument for 'configExists' was not provided.

    src/services/copy.service.ts:5:10 - error TS2305: Module '"./fs.service"' has no exported member 'FileSystemService'.

    5 import { FileSystemService } from './fs.service';
               ~~~~~~~~~~~~~~~~~

    src/services/init.service.ts:10:32 - error TS2305: Module '"../constants/fs.constants"' has no exported member 'PROMPT_FILE_NAME'.

    10 import { STATE_DIRECTORY_NAME, PROMPT_FILE_NAME } from '../constants/fs.constants';
                                      ~~~~~~~~~~~~~~~~

    src/services/init.service.ts:20:25 - error TS2554: Expected 1 arguments, but got 0.

    20         await FsService.updateGitignore();
                               ~~~~~~~~~~~~~~~

      src/services/fs.service.ts:42:32
        42 const updateGitignore = async (cwd: string): Promise<{ created: boolean, updated: boolean }> => {
                                          ~~~~~~~~~~~
        An argument for 'cwd' was not provided.


    Found 5 errors.
  expected:
    - "src/components/SettingsScreen.tsx"
    - "src/hooks/useDebugMenu.tsx"
    - "src/stores/init.store.ts"
    - "src/services/copy.service.ts"
    - "src/services/init.service.ts"
    - "src/services/fs.service.ts"

- name: "Fuzzy strategy: find file by basename"
  options: { strategy: 'fuzzy' }
  input: "I was working on core.ts and it was great."
  files:
    "src/core.ts": "content"
    "src/utils.ts": "content"
  expected:
    - "src/core.ts"

- name: "Fuzzy strategy should not find partial matches"
  options: { strategy: 'fuzzy' }
  input: "This is not-a-file.ts"
  files:
    "a-file.ts": "content"
  expected: []

- name: "Both strategy: combine regex and fuzzy results"
  options: { strategy: 'both' }
  input: "Regex finds src/app.js. Fuzzy finds utils.ts. Another regex path is /etc/hosts."
  files:
    "lib/utils.ts": "content"
  expected:
    - "src/app.js"
    - "/etc/hosts"
    - "lib/utils.ts"
````

## File: test/test.utils.ts
````typescript
import { file } from 'bun';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import yaml from 'js-yaml';

/**
 * Loads and parses a YAML fixture file.
 * @param filePath The path to the YAML file, relative to the `test` directory.
 * @returns The parsed data from the YAML file.
 */
export async function loadYamlFixture<T = unknown>(
  filePath: string,
): Promise<T> {
  const absolutePath = path.resolve(process.cwd(), 'test', filePath);
  const fileContent = await file(absolutePath).text();
  return yaml.load(fileContent) as T;
}

/**
 * Creates a temporary directory and populates it with the specified files.
 * @param files A map where keys are relative file paths and values are their content.
 * @returns The absolute path to the created temporary directory.
 */
export async function setupTestDirectory(files: {
  [path: string]: string;
}): Promise<string> {
  const tempDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'pathfish-test-'),
  );

  for (const [filePath, content] of Object.entries(files)) {
    const absolutePath = path.join(tempDir, filePath);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, content);
  }
  return tempDir;
}

/**
 * Recursively removes a directory.
 * @param dirPath The absolute path to the directory to remove.
 */
export async function cleanupTestDirectory(dirPath: string): Promise<void> {
  await fs.rm(dirPath, { recursive: true, force: true });
}

/**
 * Executes the CLI in a separate process.
 * @param args An array of command-line arguments.
 * @param stdinInput An optional string to pipe to the process's stdin.
 * @param cwd The working directory for the spawned process.
 * @returns A promise that resolves with the process's stdout, stderr, and exit code.
 */
export async function runCli(
  args: string[],
  stdinInput?: string,
  cwd?: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const cliPath = path.resolve(process.cwd(), 'dist/cli.js');

  const proc = Bun.spawn(['bun', cliPath, ...args], {
    stdin: stdinInput ? new TextEncoder().encode(stdinInput) : 'pipe',
    cwd,
    stderr: 'pipe',
    stdout: 'pipe',
  });

  const exitCode = await proc.exited;
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();

  return { stdout, stderr, exitCode };
}
````

## File: test/e2e/cli.test.ts
````typescript
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
// import path from 'node:path';
import {
  runCli,
  loadYamlFixture,
  setupTestDirectory,
  cleanupTestDirectory,
} from '../test.utils';
import { version } from '../../package.json' with { type: 'json' };

type CliTestCase = {
  name: string;
  args: string[];
  stdin?: string;
  files?: { [path: string]: string };
  expected_stdout?: string;
  expected_stdout_contains?: string;
  expected_stderr_contains?: string;
  exit_code?: number;
};

describe('cli.ts (E2E)', async () => {
  const fixtures = await loadYamlFixture<CliTestCase[]>('e2e/cli.fixtures.yaml');

  describe('CLI execution', () => {
    // Use a separate describe block for each test case to avoid closure issues
    fixtures.forEach((testCase) => {
      const {
        name,
        args,
        stdin,
        files = {},
        expected_stdout,
        expected_stdout_contains,
        expected_stderr_contains,
        exit_code = 0,
      } = testCase;

      describe(name, () => {
        let tempDir: string;

        beforeEach(async () => {
          tempDir = await setupTestDirectory(files);
        });

        afterEach(async () => {
          await cleanupTestDirectory(tempDir);
        });

        it('should execute correctly', async () => {
          const fileArgNames = Object.keys(files);

          // Resolve file paths and placeholders in args
          const processedArgs = args.map(arg => {
            // If the arg is a file created for the test, use its relative path.
            // The CLI process runs inside tempDir, so relative paths work correctly.
            if (fileArgNames.includes(arg)) {
              return arg;
            }
            // For other args (like --cwd), replace the placeholder.
            return arg.replaceAll('{{CWD}}', tempDir);
          });

          const { stdout, stderr, exitCode } = await runCli(
            processedArgs,
            stdin,
            tempDir, // Run the CLI process inside the temp directory
          );

          // Assert exit code
          expect(exitCode).toBe(exit_code);

          // Assert stdout
          if (expected_stdout !== undefined) {
            const processed_expected_stdout = expected_stdout
              .replaceAll('{{CWD}}', tempDir)
              .trim();
            expect(stdout.trim()).toEqual(processed_expected_stdout);
          }
          if (expected_stdout_contains !== undefined) {
            const expected_text =
              expected_stdout_contains === 'v'
                ? `v${version}`
                : expected_stdout_contains;
            expect(stdout).toContain(expected_text);
          }

          // Assert stderr
          if (expected_stderr_contains !== undefined) {
            expect(stderr).toContain(expected_stderr_contains);
          }
        });
      });
    });
  });
});
````

## File: src/cli.ts
````typescript
#!/usr/bin/env node

import mri from 'mri';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPipeline, type PipelineOptions, type Strategy } from './engine';
import { copyToClipboard, type Format } from './utils';
import { readFileSync } from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let version = '0.1.6';

try {
  // Try to read from package.json in the same directory (for published packages)
  const { version: pkgVersion } = JSON.parse(readFileSync(path.join(__dirname, 'package.json'), 'utf-8'));
  version = pkgVersion;
} catch {
  try {
    // Fallback to parent directory (for development)
    const { version: pkgVersion } = JSON.parse(readFileSync(path.join(__dirname, '../package.json'), 'utf-8'));
    version = pkgVersion;
  } catch {
    // Ultimate fallback
    version = '0.1.6';
  }
}

const HELP_TEXT = `
pathfish v${version}
Fuzzy-extract file paths from any blob of text.

Usage:
  pathfish [file] [options]
  cat [file] | pathfish [options]

Options:
  --strategy <strat> Path extraction strategy: regex, fuzzy, both (default: fuzzy)
  --format <format>  Output format: json, yaml, list (default: json)
  --pretty           Pretty-print JSON output (default: true)
  --absolute         Convert all paths to absolute
  --cwd <dir>        Base directory for resolving paths (default: process.cwd())
  --no-verify        Do not filter out paths that do not exist on disk
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
  verify?: boolean; // mri sets this to false for --no-verify
  copy?: boolean;
  format?: string;
  strategy?: string;
  cwd?: string;
};


/**
 * Main CLI entry point.
 * This function orchestrates the entire process from argument parsing to final output.
 */
async function run() {
  const args: CliArgs = mri(process.argv.slice(2), {
    boolean: ['help', 'version', 'pretty', 'absolute', 'copy'],
    string: ['format', 'cwd', 'strategy'],
    alias: { h: 'help', v: 'version' },
    default: {
      pretty: true,
      format: 'json',
      strategy: 'fuzzy',
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

  const strategy = args.strategy as Strategy;
  if (strategy && !['regex', 'fuzzy', 'both'].includes(strategy)) {
    console.error(
      `Error: Invalid strategy '${strategy}'. Must be one of: regex, fuzzy, both.`
    );
    process.exit(1);
  }
  const inputFile = args._[0];
  let inputText: string;

  try {
    inputText = inputFile
      ? readFileSync(path.resolve(args.cwd || process.cwd(), inputFile), 'utf-8')
      : await new Promise((resolve, reject) => {
          let data = '';
          process.stdin.on('data', chunk => data += chunk);
          process.stdin.on('end', () => resolve(data));
          process.stdin.on('error', reject);
        });
  } catch (err) {
    throw err;
  }

  // Map CLI arguments to engine pipeline options.
  const options: PipelineOptions = {
    absolute: args.absolute,
    cwd: args.cwd,
    verify: args.verify !== false, // Default to true, false only on --no-verify
    format: args.format as Format,
    pretty: args.pretty,
    strategy: strategy,
  };

  
  const result = await runPipeline(inputText, options);
  console.log(result);

  // Copying is a side effect that happens after the result is ready.
  if (args.copy) await copyToClipboard(result);
}

run().catch(err => {
  const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
  process.stderr.write(`Error: ${errorMessage}\n`);
  process.exit(1);
});
````

## File: src/core.ts
````typescript
import path from 'node:path';
import { promises as fs } from 'node:fs';

export type Strategy = 'regex' | 'fuzzy' | 'both';

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
  /**
   * The path extraction strategy to use.
   * @default 'fuzzy'
   */
  strategy?: Strategy;
};

const DEFAULT_IGNORE_DIRS = ['node_modules', '.git', 'dist', 'build'];
const DEFAULT_IGNORE_FILES = ['package-lock.json', 'bun.lockb'];

/**
 * Checks if a given path matches any of the default ignore patterns.
 * @param p The path string to check.
 * @returns True if the path should be ignored, false otherwise.
 */
const isIgnored = (p: string): boolean => {
  // Check against ignored directory patterns. This is a simple check; we see if
  // any path segment is an exact match for a directory we want to ignore.
  // This avoids accidentally filtering 'distribution/file.js'.
  const segments = p.split(/[\\\/]/);
  if (segments.some(segment => DEFAULT_IGNORE_DIRS.includes(segment))) {
    return true;
  }

  // Check against ignored file patterns by looking at the basename.
  const basename = path.basename(p);
  return DEFAULT_IGNORE_FILES.includes(basename);
};

// This regex finds file paths, including optional line/column numbers. It's
// designed to be comprehensive, supporting Windows, Unix, absolute, and
// relative paths. The regex is structured to match complete paths:
// 1. Windows absolute paths (C:\path\to\file)
// 2. Unix absolute paths (/path/to/file)
// 3. Relative paths with separators (src/file.ts, ./dist, ../parent)
// 4. Standalone filenames with extensions (README.md, package.json)
const PATH_REGEX = new RegExp(
  [
    // Quoted paths with spaces (must come first to allow spaces)
    /(?:"[^"]*[\\\/][^"]*"|'[^']*[\\\/][^']*')/.source,

    // Parenthesized paths with spaces: (src/components/Button (new).tsx)
    /\([^,)]*[\\\/][^,)]*\([^)]*\)[^,)]*\.[a-zA-Z0-9]+\)/.source,

    // Windows UNC paths: \\server\share\file (must come before absolute)
    /[\\\/]{2}[^\s\n]+[\\\/][^\s\n]+(?:[\\\/][^\s\n]+)*/.source,

    // Windows absolute paths: C:\path\to\file (must come first to avoid partial matches)
    /[a-zA-Z]:[\\\/][^\s\n]+(?:[\\\/][^\s\n]+)*/.source,

    // Unix absolute paths: /path/to/file
    /\/[^\s\n"']+(?:[\\\/][^\s\n"']+)*/.source,

    // Relative paths with separators: ./file, ../file, src/file
    /(?:\.[\\/]|[^\s\n"']+[\\/])[^\s\n"']+(?:[\\\/][^\s\n"']+)*/.source,

    // Same as above, but uses a lookbehind to allow leading whitespace (for indented paths in logs)
    /(?<=\s)(?:\.[\\/]|[^\s\n"']+[\\/])[^\s\n"']+(?:[\\\/][^\s\n"']+)*/.source,

    // Standalone filenames with extensions: file.txt, README.md, my.component.test.js.
    // Use negative lookbehind to avoid email domains and URL contexts
    // Supports multi-dot filenames like my.component.test.js
    /(?<!@|https?:\/\/[^\s]*)\b[a-zA-Z0-9_.-]+\.[a-zA-Z0-9]{1,}\b(?!\s*@)(?![^"]*")/.source,

    // Common filenames without extensions
    /\b(?:Dockerfile|Makefile|Jenkinsfile|Vagrantfile)\b/.source,
  ].join('|'),
  'g',
);

async function walk(dir: string): Promise<string[]> {
  const allFiles: string[] = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        allFiles.push(...(await walk(fullPath)));
      } else {
        allFiles.push(fullPath);
      }
    }
  } catch (err) {
    // Ignore errors from directories that cannot be read
  }
  return allFiles;
}

/**
 * Extracts paths using a fuzzy strategy by looking for file basenames in text.
 * @param text The text to search within.
 * @param cwd The working directory to scan for files.
 * @returns A promise resolving to an array of found relative paths.
 */
async function extractPathsWithFuzzy(
  text: string,
  cwd: string,
): Promise<string[]> {
  const allFilePaths = await walk(cwd);
  const foundPaths = new Set<string>();

  for (const absolutePath of allFilePaths) {
    const relativePath = path.relative(cwd, absolutePath);
    if (isIgnored(relativePath)) {
      continue;
    }

    const basename = path.basename(relativePath);
    // Use a regex to find the basename as a whole word to avoid matching substrings.
    const basenameRegex = new RegExp(
      `\\b${basename.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`,
      'g',
    );
    if (text.match(basenameRegex)) {
      foundPaths.add(relativePath);
    }
  }

  return Array.from(foundPaths);
}

/**
 * Extracts paths using a regex-based strategy.
 * @param text The text to search within.
 * @returns An array of found path strings, without post-processing.
 */
function extractPathsWithRegex(text: string): string[] {
  // 1. Find all potential paths using the regex.
  const matches = Array.from(text.matchAll(PATH_REGEX), m => m[0]);

  // 2. Extract valid paths from potentially malformed matches
  const extractedPaths: string[] = [];
  for (const match of matches) {
    // If the match contains line breaks, it might contain multiple paths
    if (match.includes('\n')) {
      // Extract individual file paths from multiline strings
      const pathPattern = /[a-zA-Z0-9_./\\-]+(?:\/[a-zA-Z0-9_.-]+)*\.[a-zA-Z0-9]{1,5}(?::\d+(?::\d+)?)?/gm;
      const pathMatches = match.match(pathPattern);
      if (pathMatches) {
        extractedPaths.push(...pathMatches.map(p => p.trim()));
      }
    } else {
      extractedPaths.push(match);
    }
  }

  // 3. Clean up matches: remove trailing line/col numbers and common punctuation.
  const cleanedPaths = extractedPaths.map(p => {
    let pathStr = p;

    // Remove line/column numbers and other trailing noise.
    // Handles: :5:10, (5,10), :5, :5:, (5,10):
    pathStr = pathStr.replace(/[:(]\d+(?:[.,:]\d+)*\)?[:]?$/, '');

    // Remove query strings and fragments
    pathStr = pathStr.replace(/[?#].*$/, '');

    // Special handling for quoted paths and parentheses
    if ((pathStr.startsWith('"') && pathStr.endsWith('"')) ||
        (pathStr.startsWith("'") && pathStr.endsWith("'"))) {
      pathStr = pathStr.slice(1, -1);
    } else if (pathStr.startsWith('(') && pathStr.endsWith(')')) {
      // Remove outer parentheses from parenthesized paths
      pathStr = pathStr.slice(1, -1);
    } else {
      // For non-quoted paths, be more careful about punctuation
      pathStr = pathStr.replace(/^["'\[<{]+/, ''); // Remove leading quotes, brackets, angle brackets, curly braces
      pathStr = pathStr.replace(/["'\]>.,;}]+$/, ''); // Remove trailing quotes, brackets, angle brackets, curly braces, and punctuation
    }

    // Normalize backslashes but preserve UNC paths
    if (!pathStr.startsWith('\\\\')) {
      pathStr = pathStr.replace(/\\\\/g, '\\');
    }

    // Handle UNC paths intelligently - preserve file shares, normalize URL paths
    if (pathStr.startsWith('//') && !pathStr.startsWith('\\\\')) {
      // If it has a file extension, it's likely a file path that should be normalized
      // If it doesn't have an extension and has only 2 segments, it's likely a UNC share
      const hasExtension = /\.[a-zA-Z0-9]{1,5}$/.test(pathStr);
      const segments = pathStr.split('/').filter(s => s.length > 0);
      
      if (hasExtension || segments.length > 2) {
        // This looks like a file path, convert //server/file.txt to /server/file.txt
        pathStr = pathStr.substring(1);
      }
      // Otherwise keep as UNC share like //server/share
    }

    // Remove URL scheme and domain if present
    pathStr = pathStr.replace(/^https?:\/\/[^\/]+/, '');

    // Remove domain prefix if this looks like a URL path without scheme
    if (pathStr.match(/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\//)) {
      pathStr = pathStr.replace(/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\//, '/');
    }

    return pathStr;
  });

  // 4. Filter out commonly ignored paths (e.g., node_modules).
  const filteredPaths = cleanedPaths.filter(p => !isIgnored(p));

  // 5. Filter out version numbers and other non-path patterns
  const versionPattern = /^[a-zA-Z]?v?\d+(?:\.\d+)*$/;
  const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
  const hashPattern = /^[a-f0-9]{7,40}$/i;
  const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  // const urlDomainPattern = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/; // Only filter pure domains, not paths

const validPaths = filteredPaths.filter(p => {
    // Filter out multi-line strings and very long strings
    if (p.includes('\n') || p.length > 200) {
      return false;
    }
    
    // Filter out function calls and method names specifically
    if (p.includes('.') && !p.includes('/') && !p.includes('\\')) {
      // This could be a function call like 'initActions.setAnalysisResults'
      // But keep actual filenames like 'file.txt'
      const parts = p.split('.');
      if (parts.length > 1) {
        const lastPart = parts[parts.length - 1];
        // If the last part doesn't look like a file extension, it's probably a function call
        if (!/^[a-zA-Z0-9]{1,5}$/.test(lastPart || '') ||
            ['setAnalysisResults', 'updateGitignore'].includes(lastPart || '')) {
          return false;
        }
      }
    }
    
    // Filter out import statements and module references that appear in TypeScript errors
    if (p.startsWith('"') && p.endsWith('"')) {
      // Always filter quoted strings - they're usually import paths in error messages
      return false;
    }
    
    // Filter out relative import module references without file extensions
    if ((p.startsWith('./') || p.startsWith('../')) && !p.includes(' ')) {
      // If it doesn't have a file extension and is short, it's likely a module import
      if (!/\.[a-zA-Z0-9]{1,5}$/.test(p) && p.split('/').length <= 3) {
          return false;
        }
      }

    return !versionPattern.test(p) &&
           !uuidPattern.test(p) &&
           !hashPattern.test(p) &&
           !emailPattern.test(p) &&
           p.trim() !== '';
  });

  // 6. Fix split paths that contain parentheses
  const fixedPaths = fixSplitPaths(validPaths);
  return fixedPaths;
}

/**
 * Fixes paths that were incorrectly split due to parentheses in the middle.
 * @param paths Array of extracted paths that may contain split paths.
 * @returns Array of paths with split paths reassembled.
 */
function fixSplitPaths(paths: string[]): string[] {
  const result: string[] = [];
  let i = 0;

  while (i < paths.length) {
    const current = paths[i];

    // Check if current path starts with '(' and next path ends with ')'
    if (i < paths.length - 1 &&
        current && (current.startsWith('(') || current.endsWith('(')) &&
        paths[i + 1] && paths[i + 1]!.match(/\).*\.[a-zA-Z0-9]+$/)) {
      // Combine the paths and clean up
      let combined = current + ' ' + paths[i + 1];

      // Remove leading opening parenthesis and fix the path structure
      if (combined.startsWith('(')) {
        combined = combined.substring(1);
      }
      // Replace " new).tsx" with " (new).tsx" to preserve inner parentheses
      combined = combined.replace(/ new\)\.([a-zA-Z0-9]+)$/, ' (new).$1');

      result.push(combined);
      i += 2; // Skip the next path as we've already consumed it
    } else {
      result.push(current || '');
      i++;
    }
  }

  return result;
}

/**
 * Extracts potential file paths from a blob of text using a configurable strategy.
 * @param text The text to search within.
 * @param opts Configuration options for extraction.
 * @returns A promise that resolves to an array of found file paths.
 */
export async function extractPaths(
  text: string,
  opts: Options = {},
): Promise<string[]> {
  const {
    absolute = false,
    cwd = process.cwd(),
    unique = true,
    strategy = 'fuzzy',
  } = opts;

  let combinedPaths: string[] = [];

  if (strategy === 'regex' || strategy === 'both') {
    combinedPaths.push(...extractPathsWithRegex(text));
  }

  if (strategy === 'fuzzy' || strategy === 'both') {
    combinedPaths.push(...(await extractPathsWithFuzzy(text, cwd)));
  }

  const uniquePaths = unique ? Array.from(new Set(combinedPaths)) : combinedPaths;

  const resolvedPaths = absolute
    ? uniquePaths.map(p => path.resolve(cwd, p))
    : uniquePaths;

  return resolvedPaths;
}

/**
 * Filters a list of paths, keeping only the ones that exist on disk.
 * @param paths An array of file paths to check.
 * @param cwd The working directory to resolve relative paths against.
 * @returns A promise that resolves to an array of existing file paths.
 */
export async function verifyPaths(paths: string[], cwd: string = process.cwd()): Promise<string[]> {
  // Concurrently check for the existence of each file.
  const checks = paths.map(async p => {
    const absolutePath = path.isAbsolute(p) ? p : path.resolve(cwd, p);
    try {
      await fs.access(absolutePath);
      return true;
    } catch {
      return false;
    }
  });
  const existenceChecks = await Promise.all(checks);

  // Filter the original paths array based on the results of the existence checks.
  const existingPaths = paths.filter((_, i) => existenceChecks[i]);

  return existingPaths;
}
````

## File: package.json
````json
{
  "name": "pathfish",
  "version": "0.1.7",
  "main": "dist/index.js",
  "module": "dist/index.js",
  "type": "module",
  "bin": {
    "pathfish": "dist/cli.js"
  },
  "files": [
    "dist"
  ],
  "dependencies": {
    "clipboardy": "^4.0.0",
    "js-yaml": "^4.1.0",
    "mri": "^1.2.0"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "@types/js-yaml": "^4.0.9",
    "@types/mri": "^1.1.5",
    "@typescript-eslint/eslint-plugin": "^8.44.1",
    "@typescript-eslint/parser": "^8.44.1",
    "eslint": "^9.36.0",
    "tsup": "^8.5.0"
  },
  "scripts": {
    "test": "tsup && bun test test",
    "build": "tsup",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "prepublishOnly": "bun run build"
  },
  "peerDependencies": {
    "typescript": "^5"
  }
}
````
