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