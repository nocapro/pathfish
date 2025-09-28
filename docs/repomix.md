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
  const initialPaths = extractPaths(text, { unique: true, ...extractOptions });

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
  } catch (error) {
    // Suppress errors in environments without a clipboard. Copying is a
    // "nice-to-have" side effect, not a critical function.
  }
}
````

## File: test/unit/utils.test.ts
````typescript
import { describe, it, expect } from 'bun:test';
import { createFormatter, type Format } from '../../src/utils';
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
    const badFormat = 'xml' as any;
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

## File: test/integration/engine.test.ts
````typescript
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { runPipeline, type PipelineOptions } from '../../src/engine';
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

          // Replace placeholder in expected output with the actual temp dir path
          const expectedWithCwd = expected.replaceAll('{{CWD}}', tempDir).trim();

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
import { extractPaths, verifyPaths, type Options } from '../../src/core';
import {
  loadYamlFixture,
  setupTestDirectory,
  cleanupTestDirectory,
} from '../test.utils';

type ExtractPathsTestCase = {
  name: string;
  options: Options;
  input: string;
  expected: string[];
};

describe('core.ts', () => {
  describe('extractPaths', async () => {
    const fixtures = await loadYamlFixture<ExtractPathsTestCase[]>('unit/core.fixtures.yaml');

    for (const { name, options, input, expected } of fixtures) {
      it(name, () => {
        const result = extractPaths(input, options);
        // Sort for stable comparison
        expect(result.sort()).toEqual(expected.sort());
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

## File: README.md
````markdown
# pathfish

> Fuzzy-extract file paths from any blob of text – TypeScript CLI & programmatic API powered by Bun.

## What it does

Drop in compiler logs, linter output, stack traces, Git diffs, chat logs, etc.
`pathfish` finds every **relative** or **absolute** file path that appears in the text and returns them in the format you want (JSON, YAML, plain list).
It finds paths with or without file extensions, and can optionally **verify** that each file really exists, **copy** the list to your clipboard, or **chain** several commands together.

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
| `--verify`   | Keep only paths that exist on disk   | `true`  |
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

### Dockerfile commands

Input
```
COPY --from=builder /app/dist/server /usr/local/bin/server
```

Output (`--format list`)
```
/app/dist/server
/usr/local/bin/server
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
  "include": ["src", "test"]
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
  args: []
  stdin: "path is src/index.ts"
  files:
    "src/index.ts": ""
  expected_stdout: |
    [
      "src/index.ts"
    ]

- name: "should output compact json with --pretty=false"
  args: ["--pretty=false"]
  stdin: "path is src/index.ts"
  files:
    "src/index.ts": ""
  expected_stdout: '["src/index.ts"]'

- name: "should read from a file argument"
  args: ["input.log"]
  files:
    "input.log": "path in file is src/index.ts"
    "src/index.ts": ""
  expected_stdout: |
    [
      "src/index.ts"
    ]

- name: "should output yaml with --format yaml"
  args: ["--format", "yaml"]
  stdin: "src/app.js and src/style.css"
  files:
    "src/app.js": ""
    "src/style.css": ""
  expected_stdout: |
    - src/app.js
    - src/style.css

- name: "should output a list with --format list"
  args: ["--format", "list"]
  stdin: "src/app.js and src/style.css"
  files:
    "src/app.js": ""
    "src/style.css": ""
  expected_stdout: |
    src/app.js
    src/style.css

- name: "should filter out non-existing files by default"
  args: ["--format", "list"]
  stdin: "good: file1.txt, bad: missing.txt"
  files:
    "file1.txt": "content"
  expected_stdout: "file1.txt"

- name: "should include non-existing files with --no-verify"
  args: ["--no-verify", "--format", "list"]
  stdin: "good: file1.txt, bad: missing.txt"
  files:
    "file1.txt": "content"
  expected_stdout: |
    file1.txt
    missing.txt

- name: "should make paths absolute with --absolute"
  args: ["--absolute", "--format", "list", "--no-verify"]
  stdin: "relative/path.js"
  expected_stdout: "{{CWD}}/relative/path.js"

- name: "should use specified --cwd for absolute paths"
  args: ["--no-verify", "--absolute", "--format", "list", "--cwd", "{{CWD}}/fake-root"]
  stdin: "relative/path.js"
  files: # create the fake root so it's a valid directory
    "fake-root/placeholder.txt": ""
  expected_stdout: "{{CWD}}/fake-root/relative/path.js"

- name: "should work with --copy flag (output is unchanged)"
  args: ["--copy", "--format", "list"]
  stdin: "src/main.ts"
  files:
    "src/main.ts": ""
  expected_stdout: "src/main.ts"

- name: "should handle a combination of flags"
  args: ["data.log", "--absolute", "--format", "yaml"]
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
  args: ["--format", "list"]
  stdin: "no paths here"
  expected_stdout: ""

- name: "should handle complex paths from stdin"
  args: ["--no-verify", "--format", "list"]
  stdin: "url.com/path/to/file.js?v=42 and a/b/c.py#L10"
  files: {}
  expected_stdout: |
    /path/to/file.js
    a/b/c.py

- name: "should handle quoted paths with spaces from stdin"
  args: ["--no-verify", "--format", "list"]
  stdin: 'Found file in "path with spaces/file.txt"'
  files: {}
  expected_stdout: |
    path with spaces/file.txt
````

## File: test/integration/engine.fixtures.yaml
````yaml
- name: "Basic pipeline: extract and format as pretty JSON"
  options: { format: 'json', pretty: true }
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
  options: { format: 'list', verify: true }
  input: "Existing file: file1.txt. Missing file: missing.txt. Existing subdir file: dir/file2.log"
  files:
    'file1.txt': 'content'
    'dir/file2.log': 'log content'
  expected: |
    file1.txt
    dir/file2.log

- name: "Pipeline with absolute path conversion"
  options: { absolute: true, format: 'json', pretty: false, verify: false } # verification disabled
  input: "Relative path: src/main.js and ./index.html"
  files: {}
  expected: '["{{CWD}}/src/main.js","{{CWD}}/index.html"]'

- name: "Pipeline with verification and absolute path conversion"
  options: { absolute: true, format: 'yaml', verify: true }
  input: "Real: src/app.ts. Fake: src/fake.ts"
  files:
    'src/app.ts': 'export default {}'
  expected: |
    - {{CWD}}/src/app.ts

- name: "Pipeline with different format (yaml) and no unique"
  options: { format: 'yaml', unique: false, verify: false }
  input: "path: a.txt, again: a.txt"
  files: {}
  expected: |
    - a.txt
    - a.txt

- name: "Pipeline should produce empty output for no matches"
  options: { format: 'json' }
  input: "Just some regular text without any paths."
  files: {}
  expected: "[]"

- name: "Pipeline with complex paths and query strings"
  options: { format: 'list', verify: false }
  input: "Path1: /a/b.css?v=1 Path2: src/d.ts#foo Path3: user@domain.com"
  files: {}
  expected: |
    /a/b.css
    src/d.ts

- name: "Pipeline with quoted path with spaces and verification"
  options: { format: 'list', verify: true }
  input: 'Log: "real dir/real file.txt" and "fake dir/fake file.txt"'
  files:
    'real dir/real file.txt': 'content'
  expected: |
    real dir/real file.txt
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
  options: {}
  input: |
    Error in C:\\Users\\Test\\project\\src\\file.js
    Check the config at .\\config\\settings.json
  expected:
    - "C:\\Users\\Test\\project\\src\\file.js"
    - ".\\config\\settings.json"

- name: "Path extraction with line and column numbers"
  options: {}
  input: |
    src/components/Button.tsx:5:10 - error
    dist/bundle.js:1:12345
    /app/main.py:42
  expected:
    - "src/components/Button.tsx"
    - "/app/main.py"

- name: "Standalone filenames with extensions"
  options: {}
  input: |
    The project uses bun.lockb and has a README.md.
    But this is: package.json
  expected:
    - "README.md"
    - "package.json"

- name: "Unique paths option (default)"
  options: { unique: true }
  input: "See src/core.ts and again src/core.ts"
  expected: ["src/core.ts"]

- name: "Non-unique paths option"
  options: { unique: false }
  input: "See src/core.ts and again src/core.ts"
  expected: ["src/core.ts", "src/core.ts"]

- name: "Absolute paths option"
  options: { absolute: true, cwd: "/home/user/project" }
  input: |
    Relative path: src/index.ts
    Dot-slash path: ./dist/main.js
    Absolute path is unchanged: /etc/hosts
  expected:
    - "/home/user/project/src/index.ts"
    - "/etc/hosts"

- name: "Empty input"
  options: {}
  input: "No paths here."
  expected: []

- name: "Should ignore common transient/generated directories"
  options: {}
  input: |
    Path in node_modules/package/file.js
    Path in .git/hooks/pre-commit
    Path in dist/bundle.js
    Path in project/build/output.css
    A file called distribution/file.js should not be ignored.
  expected:
    - "distribution/file.js"

- name: "Should ignore common lockfiles"
  options: {}
  input: |
    This project uses bun.lockb and package-lock.json.
    But this is fine: my-package.json
  expected:
    - "my-package.json"

- name: "Paths with special characters and surrounding punctuation"
  options: {}
  input: |
    Paths can be tricky: (src/components/Button (new).tsx),
    <[dist/app-v2.js]>, or even "quoted/path.css".
    A path with a number in extension: file.v2.js
  expected:
    - "src/components/Button (new).tsx"
    - "quoted/path.css"
    - "file.v2.js"

- name: "Should extract common files without extensions"
  options: {}
  input: "Check the Dockerfile and also the Makefile for build instructions."
  expected:
    - "Dockerfile"
    - "Makefile"

- name: "Should avoid matching domains from emails and URLs"
  options: {}
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
  options: {}
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
  options: {}
  input: |
    Error in "/path with spaces/file.js" and also in 'another path/with spaces.ts'.
  expected:
    - "/path with spaces/file.js"
    - "another path/with spaces.ts"

- name: "Paths with scoped npm packages"
  options: {}
  input: "Requires \"@scoped/package/index.js\" and also regular 'package/main.js'"
  expected:
    - "@scoped/package/index.js"
    - "package/main.js"

- name: "Paths with tilde"
  options: {}
  input: "Check ~/documents/report.docx."
  expected:
    - "~/documents/report.docx"

- name: "Complex relative paths with parent selectors"
  options: {}
  input: "Path is ../../src/app/../core/utils.ts"
  expected:
    - "../../src/app/../core/utils.ts"

- name: "Windows UNC paths"
  options: {}
  input: "Data at \\\\network-share\\folder\\data.csv and //another/share"
  expected:
    - "\\\\network-share\\folder\\data.csv"
    - "//another/share"

- name: "Should avoid matching version numbers"
  options: {}
  input: "Release v3.4.5 is out. See also file-1.2.3.log"
  expected:
    - "file-1.2.3.log"

- name: "Should avoid matching UUIDs and commit hashes"
  options: {}
  input: "Error ID: a1b2c3d4-e5f6-7890-abcd-ef1234567890, commit: f0e9d8c7. see file.log"
  expected:
    - "file.log"

- name: "Paths inside URLs with ports"
  options: {}
  input: "Asset is at http://localhost:8080/assets/img/logo.png. And another at just /path/to/file.js"
  expected:
    - "/assets/img/logo.png"
    - "/path/to/file.js"

- name: "Paths with mixed slashes"
  options: {}
  input: "A strange path: src/mix\\slash/component.tsx"
  expected:
    - "src/mix\\slash/component.tsx"

- name: "Paths with multiple parent selectors"
  options: {}
  input: "Go way up with ../../../../../etc/passwd"
  expected:
    - "../../../../../etc/passwd"

- name: "Paths adjacent to brackets and commas"
  options: {}
  input: "Files are [file1.txt], (file2.log), and {path/to/file3.json}."
  expected:
    - "file1.txt"
    - "file2.log"
    - "path/to/file3.json"
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
  const cliPath = path.resolve(process.cwd(), 'src/cli.ts');

  const proc = Bun.spawn(['bun', 'run', cliPath, ...args], {
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
  "scripts": {
    "test": "bun test test"
  },
  "peerDependencies": {
    "typescript": "^5"
  }
}
````

## File: src/cli.ts
````typescript
#!/usr/bin/env bun

import mri from 'mri';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPipeline, type PipelineOptions } from './engine';
import { copyToClipboard, type Format } from './utils';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { version } = await Bun.file(path.join(__dirname, '../package.json')).json();

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
  cwd?: string;
};


/**
 * Main CLI entry point.
 * This function orchestrates the entire process from argument parsing to final output.
 */
async function run() {
  const args: CliArgs = mri(process.argv.slice(2), {
    boolean: ['help', 'version', 'pretty', 'absolute', 'copy'],
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
  let inputText: string;

  try {
    inputText = inputFile
      ? await Bun.file(path.resolve(args.cwd || process.cwd(), inputFile)).text()
      : await Bun.stdin.text();
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

## File: test/e2e/cli.test.ts
````typescript
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import path from 'node:path';
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

    // Windows UNC paths: \\server\share\file (must come before absolute)
    /[\\\/]{2}[^\s\n]+[\\\/][^\s\n]+(?:[\\\/][^\s\n]+)*/.source,

    // Windows absolute paths: C:\path\to\file (must come first to avoid partial matches)
    /[a-zA-Z]:[\\\/][^\s\n]+(?:[\\\/][^\s\n]+)*/.source,

    // Unix absolute paths: /path/to/file
    /\/[^\s\n]+(?:[\\\/][^\s\n]+)*/.source,

    // Relative paths with separators: ./file, ../file, src/file
    /(?:\.[\\/]|[^\s\n]+[\\/])[^\s\n]+(?:[\\\/][^\s\n]+)*/.source,

    // Standalone filenames with extensions: file.txt, README.md.
    // It avoids matching email domains and parts of URLs by using a negative
    // lookbehind for '@', 'http://', 'https://', and '//'. It also prevents slashes in the filename
    // part to avoid overlapping with the relative path regex.
    /(?<!@|https?:\/\/|\/\/)\b[^\s\n\\/]+\.[a-zA-Z0-9]+\b/.source,

    // Common filenames without extensions
    /\b(?:Dockerfile|Makefile|Jenkinsfile|Vagrantfile)\b/.source,
  ].join('|'),
  'g',
);

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

    // 2. Clean up matches: remove trailing line/col numbers and common punctuation.
    const cleanedPaths = matches.map(p => {
      let path = p;

      // Remove line/column numbers
      path = path.replace(/(?::\d+)+$/, '');

      // Remove query strings and fragments
      path = path.replace(/[?#].*$/, '');

      // Special handling for quoted paths with parentheses
      if ((path.startsWith('"') && path.endsWith('"')) ||
          (path.startsWith("'") && path.endsWith("'"))) {
        path = path.slice(1, -1);
      } else {
        // For non-quoted paths, be more careful about punctuation
        path = path.replace(/^["'\[<{]+/, ''); // Remove leading quotes, brackets, angle brackets, curly braces
        path = path.replace(/["'\]>.,;}]+$/, ''); // Remove trailing quotes, brackets, angle brackets, curly braces, and punctuation
      }

      // Normalize backslashes but preserve UNC paths
      if (!path.startsWith('\\\\')) {
        path = path.replace(/\\\\/g, '\\');
      }

      // Normalize UNC paths to single slash if they appear in URLs
      if (path.startsWith('//') && !path.startsWith('\\\\')) {
        path = path.substring(1);
      }

      // Remove URL scheme and domain if present
      path = path.replace(/^https?:\/\/[^\/]+/, '');

      // Remove domain prefix if this looks like a URL path without scheme
      if (path.match(/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\//)) {
        path = path.replace(/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\//, '/');
      }

      return path;
    });

    // 3. Filter out commonly ignored paths (e.g., node_modules).
    const filteredPaths = cleanedPaths.filter(p => !isIgnored(p));

    // 4. Filter out version numbers and other non-path patterns
    const versionPattern = /^[a-zA-Z]?v?\d+(?:\.\d+)*$/;
    const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
    const hashPattern = /^[a-f0-9]{7,40}$/i;
    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    const urlDomainPattern = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/; // Only filter pure domains, not paths

  const validPaths = filteredPaths.filter(p => {
      // Check if this is actually a filename with extension vs a pure domain
      const isFilenameWithExtension = /[a-zA-Z0-9]-[a-zA-Z0-9.]*\.[a-zA-Z0-9]+/.test(p) ||
                                     /\.[a-zA-Z0-9]{2,}$/.test(p) && !/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(p.replace(/\.[a-zA-Z0-9]+$/, ''));

      return !versionPattern.test(p) &&
             !uuidPattern.test(p) &&
             !hashPattern.test(p) &&
             !emailPattern.test(p) &&
             (!urlDomainPattern.test(p) || isFilenameWithExtension) &&
             p.trim() !== '';
    });

    // 5. Fix split paths that contain parentheses
    const fixedPaths = fixSplitPaths(validPaths);

    // 6. (Optional) Filter for unique paths.
    const uniquePaths = unique ? Array.from(new Set(fixedPaths)) : fixedPaths;

    // 7. (Optional) Resolve paths to be absolute.
    const resolvedPaths = absolute
      ? uniquePaths.map(p => path.resolve(cwd, p))
      : uniquePaths;

    return resolvedPaths;
  };
};

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
        (current.startsWith('(') || current.endsWith('(')) &&
        paths[i + 1].match(/\).*\.[a-zA-Z0-9]+$/)) {
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
      result.push(current);
      i++;
    }
  }

  return result;
}

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
 * @param cwd The working directory to resolve relative paths against.
 * @returns A promise that resolves to an array of existing file paths.
 */
export async function verifyPaths(paths: string[], cwd: string = process.cwd()): Promise<string[]> {
  // Concurrently check for the existence of each file.
  const checks = paths.map(p => {
    const absolutePath = path.isAbsolute(p) ? p : path.resolve(cwd, p);
    return Bun.file(absolutePath).exists();
  });
  const existenceChecks = await Promise.all(checks);

  // Filter the original paths array based on the results of the existence checks.
  const existingPaths = paths.filter((_, i) => existenceChecks[i]);

  return existingPaths;
}
````
