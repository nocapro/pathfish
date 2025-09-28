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
  const fixtures = await loadYamlFixture<EngineTestCase[]>(
    './engine.fixtures.yaml',
  );

  describe('runPipeline', () => {
    let tempDir: string;

    for (const { name, options, input, files, expected } of fixtures) {
      // Each test case gets its own directory setup
      beforeEach(async () => {
        tempDir = await setupTestDirectory(files);
      });

      afterEach(async () => {
        await cleanupTestDirectory(tempDir);
      });

      it(name, async () => {
        // Use the temp directory as the CWD for the pipeline
        const result = await runPipeline(input, { ...options, cwd: tempDir });

        // Replace placeholder in expected output with the actual temp dir path
        const expectedWithCwd = expected.replaceAll('{{CWD}}', tempDir).trim();

        expect(result.trim()).toEqual(expectedWithCwd);
      });
    }
  });
});