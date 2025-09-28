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
    // lookbehind for '@' and '//'. It also prevents slashes in the filename
    // part to avoid overlapping with the relative path regex.
    /(?<!@|\/\/)\b[^\s\n\\/]+\.[a-zA-Z0-9]+\b/.source,

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
    const cleanedPaths = matches.map(p =>
      p.replace(/(?::\d+)+$/, '') // a/b/c:10:5 -> a/b/c
       .replace(/[?#].*$/, '') // remove query strings and fragments
       .replace(/^[ "'(<]+|[ .,;"')>]+$/g, '') // strip surrounding punctuation
       .replace(/\\\\/g, '\\'), // Normalize double backslashes to single
    );

    // 3. Filter out commonly ignored paths (e.g., node_modules).
    const filteredPaths = cleanedPaths.filter(p => !isIgnored(p));

    // 4. (Optional) Filter for unique paths.
    const uniquePaths = unique ? Array.from(new Set(filteredPaths)) : filteredPaths;

    // 5. (Optional) Resolve paths to be absolute.
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