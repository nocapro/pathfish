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