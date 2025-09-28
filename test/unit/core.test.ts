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
    const fixtures = await loadYamlFixture<ExtractPathsTestCase[]>(
      './core.fixtures.yaml',
    );

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

      const result = await verifyPaths(pathsToCheck);
      expect(result.sort()).toEqual(expected.sort());
    });

    it('should return an empty array if no paths exist', async () => {
      const pathsToCheck = [
        path.join(tempDir, 'foo.txt'),
        path.join(tempDir, 'bar.js'),
      ];
      const result = await verifyPaths(pathsToCheck);
      expect(result).toEqual([]);
    });

    it('should return an empty array for empty input', async () => {
      const result = await verifyPaths([]);
      expect(result).toEqual([]);
    });
  });
});