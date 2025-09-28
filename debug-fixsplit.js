// Debug file for fixSplitPaths function

function fixSplitPaths(paths) {
  const result = [];
  let i = 0;

  while (i < paths.length) {
    const current = paths[i];

    console.log(`Processing index ${i}: "${current}"`);

    // Check if current path ends with '(' and next path looks like it continues
    if (i < paths.length - 1 &&
        current.endsWith('(') &&
        paths[i + 1].match(/\).*\.[a-zA-Z0-9]+$/)) {
      // Combine the paths
      const combined = current + ' ' + paths[i + 1];
      console.log(`  Combining with next: "${paths[i + 1]}" -> "${combined}"`);
      result.push(combined);
      i += 2; // Skip the next path as we've already consumed it
    } else {
      console.log(`  Keeping as is: "${current}"`);
      result.push(current);
      i++;
    }
  }

  return result;
}

const testPaths = ["(src/components/Button", "new).tsx", "quoted/path.css", "file.v2.js"];
console.log("Input paths:", testPaths);
console.log("Fixed paths:", fixSplitPaths(testPaths));