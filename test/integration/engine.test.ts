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

          const expectedWithCwd = expected.replaceAll('{{CWD}}', tempDir);

          // Use different comparison strategies based on format to avoid flaky tests
          if (options.format === 'list' || options.format === 'yaml') {
            // For line-based formats, sort lines to make comparison order-insensitive
            const sortLines = (s: string) =>
              s.trim().split('\n').map(l => l.trim()).sort();
            expect(sortLines(result)).toEqual(sortLines(expectedWithCwd));
          } else {
            // For JSON, a simple trim is usually enough, as order is often preserved.
            // More complex JSON could be parsed and deep-sorted if needed.
            expect(result.trim()).toEqual(expectedWithCwd.trim());
          }
        });
      });
    });
  });
});