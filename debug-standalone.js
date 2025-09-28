// Debug file for standalone filenames test
import { extractPaths } from './src/core.ts';

const testCase = {
  name: "Standalone filenames with extensions",
  options: {},
  input: "The project uses bun.lockb and has a README.md.\nBut this is: package.json",
  expected: ["README.md", "package.json"]
};

console.log("Input:", testCase.input);
console.log("Expected:", testCase.expected);

const result = extractPaths(testCase.input, testCase.options);
console.log("Actual result:", result);

// Let's check each step of the pipeline
const PATH_REGEX = new RegExp([
  /(?:\"[^\"]*[\\\/][^\"]*\"|'[^']*[\\\/][^']*')/.source,
  /[\\\/]{2}[^\s\n]+[\\\/][^\s\n]+(?:[\\\/][^\s\n]+)*/.source,
  /[a-zA-Z]:[\\\/][^\s\n]+(?:[\\\/][^\s\n]+)*/.source,
  /\/[^\s\n]+(?:[\\\/][^\s\n]+)*/.source,
  /(?:\.[\\\/]|[^\s\n]+[\\\/])[^\s\n]+(?:[\\\/][^\s\n]+)*/.source,
  /(?<!@|https?:\/\/|\/\/)\b[^\s\n\\\/]+\.[a-zA-Z0-9]+\b/.source,
  /\b(?:Dockerfile|Makefile|Jenkinsfile|Vagrantfile)\b/.source,
].join('|'), 'g');

const matches = Array.from(testCase.input.matchAll(PATH_REGEX), m => m[0]);
console.log("Raw regex matches:", matches);