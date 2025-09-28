// Debug file for cleanup steps

const matches = ["(src/components/Button", "new).tsx", "<[dist/app-v2.js]>,", "\"quoted/path.css\"", "file.v2.js"];

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