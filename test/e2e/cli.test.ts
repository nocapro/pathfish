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
    let tempDir: string;

    for (const testCase of fixtures) {
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

      // Each test case gets its own directory setup
      beforeEach(async () => {
        tempDir = await setupTestDirectory(files);
      });

      afterEach(async () => {
        await cleanupTestDirectory(tempDir);
      });

      it(name, async () => {
        const fileArgNames = Object.keys(files);

        // Resolve file paths and placeholders in args
        const processedArgs = args.map(arg => {
          // If the arg is a file that we created for the test, make its path absolute.
          if (fileArgNames.includes(arg)) {
            return path.join(tempDir, arg);
          }
          // For other args (like --cwd), replace the placeholder.
          return arg.replaceAll('{{CWD}}', tempDir);
        });

        const { stdout, stderr, exitCode } = await runCli(
          processedArgs,
          stdin,
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
    }
  });
});