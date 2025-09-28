import path from 'node:path';
import { promises as fs } from 'node:fs';

export type Strategy = 'regex' | 'fuzzy' | 'both';

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
  /**
   * The path extraction strategy to use.
   * @default 'fuzzy'
   */
  strategy?: Strategy;
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

    // Parenthesized paths with spaces: (src/components/Button (new).tsx)
    /\([^,)]*[\\\/][^,)]*\([^)]*\)[^,)]*\.[a-zA-Z0-9]+\)/.source,

    // Windows UNC paths: \\server\share\file (must come before absolute)
    /[\\\/]{2}[^\s\n]+[\\\/][^\s\n]+(?:[\\\/][^\s\n]+)*/.source,

    // Windows absolute paths: C:\path\to\file (must come first to avoid partial matches)
    /[a-zA-Z]:[\\\/][^\s\n]+(?:[\\\/][^\s\n]+)*/.source,

    // Unix absolute paths: /path/to/file
    /\/[^\s\n"']+(?:[\\\/][^\s\n"']+)*/.source,

    // Relative paths with separators: ./file, ../file, src/file
    /(?:\.[\\/]|[^\s\n"']+[\\/])[^\s\n"']+(?:[\\\/][^\s\n"']+)*/.source,

    // Same as above, but uses a lookbehind to allow leading whitespace (for indented paths in logs)
    /(?<=\s)(?:\.[\\/]|[^\s\n"']+[\\/])[^\s\n"']+(?:[\\\/][^\s\n"']+)*/.source,

    // Standalone filenames with extensions: file.txt, README.md, my.component.test.js.
    // Use negative lookbehind to avoid email domains and URL contexts
    // Supports multi-dot filenames like my.component.test.js
    /(?<!@|https?:\/\/[^\s]*)\b[a-zA-Z0-9_.-]+\.[a-zA-Z0-9]{1,}\b(?!\s*@)(?![^"]*")/.source,

    // Common filenames without extensions
    /\b(?:Dockerfile|Makefile|Jenkinsfile|Vagrantfile)\b/.source,
  ].join('|'),
  'g',
);

async function walk(dir: string): Promise<string[]> {
  const allFiles: string[] = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        allFiles.push(...(await walk(fullPath)));
      } else {
        allFiles.push(fullPath);
      }
    }
  } catch (err) {
    // Ignore errors from directories that cannot be read
  }
  return allFiles;
}

/**
 * Extracts paths using a fuzzy strategy by looking for file basenames in text.
 * @param text The text to search within.
 * @param cwd The working directory to scan for files.
 * @returns A promise resolving to an array of found relative paths.
 */
async function extractPathsWithFuzzy(
  text: string,
  cwd: string,
): Promise<string[]> {
  const allFilePaths = await walk(cwd);
  const foundPaths = new Set<string>();

  for (const absolutePath of allFilePaths) {
    const relativePath = path.relative(cwd, absolutePath);
    if (isIgnored(relativePath)) {
      continue;
    }

    const basename = path.basename(relativePath);
    // Use a regex to find the basename as a whole word to avoid matching substrings.
    const basenameRegex = new RegExp(
      `\\b${basename.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`,
      'g',
    );
    if (text.match(basenameRegex)) {
      foundPaths.add(relativePath);
    }
  }

  return Array.from(foundPaths);
}

/**
 * Extracts paths using a regex-based strategy.
 * @param text The text to search within.
 * @returns An array of found path strings, without post-processing.
 */
function extractPathsWithRegex(text: string): string[] {
  // 1. Find all potential paths using the regex.
  const matches = Array.from(text.matchAll(PATH_REGEX), m => m[0]);

  // 2. Extract valid paths from potentially malformed matches
  const extractedPaths: string[] = [];
  for (const match of matches) {
    // If the match contains line breaks, it might contain multiple paths
    if (match.includes('\n')) {
      // Extract individual file paths from multiline strings
      const pathPattern = /[a-zA-Z0-9_./\\-]+(?:\/[a-zA-Z0-9_.-]+)*\.[a-zA-Z0-9]{1,5}(?::\d+(?::\d+)?)?/gm;
      const pathMatches = match.match(pathPattern);
      if (pathMatches) {
        extractedPaths.push(...pathMatches.map(p => p.trim()));
      }
    } else {
      extractedPaths.push(match);
    }
  }

  // 3. Clean up matches: remove trailing line/col numbers and common punctuation.
  const cleanedPaths = extractedPaths.map(p => {
    let pathStr = p;

    // Remove line/column numbers and other trailing noise.
    // Handles: :5:10, (5,10), :5, :5:, (5,10):
    pathStr = pathStr.replace(/[:(]\d+(?:[.,:]\d+)*\)?[:]?$/, '');

    // Remove query strings and fragments
    pathStr = pathStr.replace(/[?#].*$/, '');

    // Special handling for quoted paths and parentheses
    if ((pathStr.startsWith('"') && pathStr.endsWith('"')) ||
        (pathStr.startsWith("'") && pathStr.endsWith("'"))) {
      pathStr = pathStr.slice(1, -1);
    } else if (pathStr.startsWith('(') && pathStr.endsWith(')')) {
      // Remove outer parentheses from parenthesized paths
      pathStr = pathStr.slice(1, -1);
    } else {
      // For non-quoted paths, be more careful about punctuation
      pathStr = pathStr.replace(/^["'\[<{]+/, ''); // Remove leading quotes, brackets, angle brackets, curly braces
      pathStr = pathStr.replace(/["'\]>.,;}]+$/, ''); // Remove trailing quotes, brackets, angle brackets, curly braces, and punctuation
    }

    // Normalize backslashes but preserve UNC paths
    if (!pathStr.startsWith('\\\\')) {
      pathStr = pathStr.replace(/\\\\/g, '\\');
    }

    // Handle UNC paths intelligently - preserve file shares, normalize URL paths
    if (pathStr.startsWith('//') && !pathStr.startsWith('\\\\')) {
      // If it has a file extension, it's likely a file path that should be normalized
      // If it doesn't have an extension and has only 2 segments, it's likely a UNC share
      const hasExtension = /\.[a-zA-Z0-9]{1,5}$/.test(pathStr);
      const segments = pathStr.split('/').filter(s => s.length > 0);
      
      if (hasExtension || segments.length > 2) {
        // This looks like a file path, convert //server/file.txt to /server/file.txt
        pathStr = pathStr.substring(1);
      }
      // Otherwise keep as UNC share like //server/share
    }

    // Remove URL scheme and domain if present
    pathStr = pathStr.replace(/^https?:\/\/[^\/]+/, '');

    // Remove domain prefix if this looks like a URL path without scheme
    if (pathStr.match(/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\//)) {
      pathStr = pathStr.replace(/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\//, '/');
    }

    return pathStr;
  });

  // 4. Filter out commonly ignored paths (e.g., node_modules).
  const filteredPaths = cleanedPaths.filter(p => !isIgnored(p));

  // 5. Filter out version numbers and other non-path patterns
  const versionPattern = /^[a-zA-Z]?v?\d+(?:\.\d+)*$/;
  const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
  const hashPattern = /^[a-f0-9]{7,40}$/i;
  const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  // const urlDomainPattern = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/; // Only filter pure domains, not paths

const validPaths = filteredPaths.filter(p => {
    // Filter out multi-line strings and very long strings
    if (p.includes('\n') || p.length > 200) {
      return false;
    }
    
    // Filter out function calls and method names specifically
    if (p.includes('.') && !p.includes('/') && !p.includes('\\')) {
      // This could be a function call like 'initActions.setAnalysisResults'
      // But keep actual filenames like 'file.txt'
      const parts = p.split('.');
      if (parts.length > 1) {
        const lastPart = parts[parts.length - 1];
        // If the last part doesn't look like a file extension, it's probably a function call
        if (!/^[a-zA-Z0-9]{1,5}$/.test(lastPart || '') ||
            ['setAnalysisResults', 'updateGitignore'].includes(lastPart || '')) {
          return false;
        }
      }
    }
    
    // Filter out import statements and module references that appear in TypeScript errors
    if (p.startsWith('"') && p.endsWith('"')) {
      // Always filter quoted strings - they're usually import paths in error messages
      return false;
    }
    
    // Filter out relative import module references without file extensions
    if ((p.startsWith('./') || p.startsWith('../')) && !p.includes(' ')) {
      // If it doesn't have a file extension and is short, it's likely a module import
      if (!/\.[a-zA-Z0-9]{1,5}$/.test(p) && p.split('/').length <= 3) {
          return false;
        }
      }

    return !versionPattern.test(p) &&
           !uuidPattern.test(p) &&
           !hashPattern.test(p) &&
           !emailPattern.test(p) &&
           p.trim() !== '';
  });

  // 6. Fix split paths that contain parentheses
  const fixedPaths = fixSplitPaths(validPaths);
  return fixedPaths;
}

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
        current && (current.startsWith('(') || current.endsWith('(')) &&
        paths[i + 1] && paths[i + 1]!.match(/\).*\.[a-zA-Z0-9]+$/)) {
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
      result.push(current || '');
      i++;
    }
  }

  return result;
}

/**
 * Extracts potential file paths from a blob of text using a configurable strategy.
 * @param text The text to search within.
 * @param opts Configuration options for extraction.
 * @returns A promise that resolves to an array of found file paths.
 */
export async function extractPaths(
  text: string,
  opts: Options = {},
): Promise<string[]> {
  const {
    absolute = false,
    cwd = process.cwd(),
    unique = true,
    strategy = 'fuzzy',
  } = opts;

  let combinedPaths: string[] = [];

  if (strategy === 'regex' || strategy === 'both') {
    combinedPaths.push(...extractPathsWithRegex(text));
  }

  if (strategy === 'fuzzy' || strategy === 'both') {
    combinedPaths.push(...(await extractPathsWithFuzzy(text, cwd)));
  }

  const uniquePaths = unique ? Array.from(new Set(combinedPaths)) : combinedPaths;

  const resolvedPaths = absolute
    ? uniquePaths.map(p => path.resolve(cwd, p))
    : uniquePaths;

  return resolvedPaths;
}

/**
 * Filters a list of paths, keeping only the ones that exist on disk.
 * @param paths An array of file paths to check.
 * @param cwd The working directory to resolve relative paths against.
 * @returns A promise that resolves to an array of existing file paths.
 */
export async function verifyPaths(paths: string[], cwd: string = process.cwd()): Promise<string[]> {
  // Concurrently check for the existence of each file.
  const checks = paths.map(async p => {
    const absolutePath = path.isAbsolute(p) ? p : path.resolve(cwd, p);
    try {
      await fs.access(absolutePath);
      return true;
    } catch {
      return false;
    }
  });
  const existenceChecks = await Promise.all(checks);

  // Filter the original paths array based on the results of the existence checks.
  const existingPaths = paths.filter((_, i) => existenceChecks[i]);

  return existingPaths;
}