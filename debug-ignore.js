// Debug file for ignore logic
import path from 'node:path';

const DEFAULT_IGNORE_DIRS = ['node_modules', '.git', 'dist', 'build'];
const DEFAULT_IGNORE_FILES = ['package-lock.json', 'bun.lockb'];

const isIgnored = (p) => {
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

const testPaths = ["bun.lockb", "README.md", "package.json"];
testPaths.forEach(p => {
  console.log(`${p}: ignored = ${isIgnored(p)}`);
});