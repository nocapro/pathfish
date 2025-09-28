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

// This regex finds file paths, including optional line/column numbers. It's
// designed to be comprehensive, supporting Windows, Unix, absolute, and
// relative paths. It's composed of two main parts:
// 1. The first part finds paths that contain at least one directory separator
//    (e.g., `src/core.ts`, `./dist`, `/var/log/syslog`). This allows it to
//    find paths that don't have a file extension.
// 2. The second part finds standalone filenames that *do* have a file extension
//    (e.g., `README.md`, `bun.lockb`), using word boundaries.
// This new regex improves Windows path handling and is structured for clarity.
const PATH_REGEX = new RegExp(
  [
    // Part 1: Full paths (e.g., C:\foo\bar, /foo/bar, ./foo, ../foo, src/foo)
    /(?:[a-zA-Z]:)?(?:[\\/]|(?:[\w.-]+[\\/]))[\w.-]+(?:[\\/][\w.-]+)*/.source,
    // Part 2: Standalone filenames with extensions (e.g., README.md)
    /\b[\w.-]+\.\w+\b/.source,
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
    const cleanedPaths = matches.map(p =>
      p.replace(/(?::\d+)+$/, '') // a/b/c:10:5 -> a/b/c
       .replace(/[.,;]$/, ''),    // a/b/c, -> a/b/c
    );

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