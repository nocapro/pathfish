// Debug file for dist/app-v2.js cleanup

const matches = ["<[dist/app-v2.js]>,"];

const cleanedPaths = matches.map(p => {
  let path = p;
  console.log(`Original: "${path}"`);

  // Remove line/column numbers
  path = path.replace(/(?::\d+)+$/, '');
  console.log(`After line/col removal: "${path}"`);

  // Remove query strings and fragments
  path = path.replace(/[?#].*$/, '');
  console.log(`After query removal: "${path}"`);

  // Special handling for quoted paths with parentheses
  if ((path.startsWith('"') && path.endsWith('"')) ||
      (path.startsWith("'") && path.endsWith("'"))) {
    path = path.slice(1, -1);
    console.log(`After quote removal: "${path}"`);
  } else {
    // For non-quoted paths, be more careful about punctuation
    path = path.replace(/^["'\[<{]+/, ''); // Remove leading quotes, brackets, angle brackets, curly braces
    console.log(`After leading punctuation removal: "${path}"`);
    path = path.replace(/["'\]>.,;}]+$/, ''); // Remove trailing quotes, brackets, angle brackets, curly braces, and punctuation
    console.log(`After trailing punctuation removal: "${path}"`);
  }

  console.log(`Final: "${path}"`);
  console.log('---');
  return path;
});

console.log("All cleaned paths:", cleanedPaths);

// Now check the ignore logic
const DEFAULT_IGNORE_DIRS = ['node_modules', '.git', 'dist', 'build'];
const DEFAULT_IGNORE_FILES = ['package-lock.json', 'bun.lockb'];

const isIgnored = (p) => {
  console.log(`Checking ignore for "${p}":`);
  const segments = p.split(/[\\\/]/);
  console.log(`  Segments: ${segments}`);
  const hasIgnoredSegment = segments.some(segment => DEFAULT_IGNORE_DIRS.includes(segment));
  console.log(`  Has ignored segment: ${hasIgnoredSegment}`);

  const basename = p.replace(/.*[\\\/]/, '');
  console.log(`  Basename: ${basename}`);
  const isIgnoredFile = DEFAULT_IGNORE_FILES.includes(basename);
  console.log(`  Is ignored file: ${isIgnoredFile}`);

  return hasIgnoredSegment || isIgnoredFile;
};

cleanedPaths.forEach(path => {
  console.log(`"${path}": ignored = ${isIgnored(path)}`);
});