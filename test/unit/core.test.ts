import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import path from 'node:path';
import { extractPaths, verifyPaths, type Options, type Strategy } from '../../dist/core.js';
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
  expected?: string[];
  expected_by_strategy?: {
    [S in Strategy]?: string[];
  };
};

describe('core.ts', () => {
  describe('extractPaths', async () => {
    const fixtures = await loadYamlFixture<ExtractPathsTestCase[]>('unit/core.fixtures.yaml');

    for (const { name, options, input, files, expected, expected_by_strategy } of fixtures) {
      if (expected_by_strategy) {
        describe(name, () => {
          for (const [strategy, expectedOutput] of Object.entries(
            expected_by_strategy,
          )) {
            if (!expectedOutput) continue;
            it(`with strategy: ${strategy}`, async () => {
              let tempDir: string | undefined;
              let cwd = options.cwd || process.cwd();
              if (files && Object.keys(files).length > 0) {
                tempDir = await setupTestDirectory(files);
                cwd = tempDir;
              }

              const result = await extractPaths(input, {
                ...options,
                cwd,
                strategy: strategy as Strategy,
              });
              // Sort for stable comparison
              expect(result.sort()).toEqual(expectedOutput.sort());

              if (tempDir) {
                await cleanupTestDirectory(tempDir);
              }
            });
          }
        });
      } else {
        it(name, async () => {
          let tempDir: string | undefined;
          let cwd = options.cwd || process.cwd();
          if (files && Object.keys(files).length > 0) {
            tempDir = await setupTestDirectory(files);
            cwd = tempDir;
          }

          const result = await extractPaths(input, { ...options, cwd });
          // Sort for stable comparison
          expect(result.sort()).toEqual((expected ?? []).sort());

          if (tempDir) {
            await cleanupTestDirectory(tempDir);
          }
        });
      }
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