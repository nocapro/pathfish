#!/usr/bin/env node

import mri from 'mri';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPipeline, type PipelineOptions } from './engine';
import { copyToClipboard, type Format } from './utils';
import { readFileSync } from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let version = '0.1.3';

try {
  // Try to read from package.json in the same directory (for published packages)
  const { version: pkgVersion } = JSON.parse(readFileSync(path.join(__dirname, 'package.json'), 'utf-8'));
  version = pkgVersion;
} catch {
  try {
    // Fallback to parent directory (for development)
    const { version: pkgVersion } = JSON.parse(readFileSync(path.join(__dirname, '../package.json'), 'utf-8'));
    version = pkgVersion;
  } catch {
    // Ultimate fallback
    version = '0.1.3';
  }
}

const HELP_TEXT = `
pathfish v${version}
Fuzzy-extract file paths from any blob of text.

Usage:
  pathfish [file] [options]
  cat [file] | pathfish [options]

Options:
  --format <format>  Output format: json, yaml, list (default: json)
  --pretty           Pretty-print JSON output (default: true)
  --absolute         Convert all paths to absolute
  --cwd <dir>        Base directory for resolving paths (default: process.cwd())
  --no-verify        Do not filter out paths that do not exist on disk
  --copy             Copy the final output to the clipboard
  --help, -h         Show this help message
  --version, -v      Show version number
`;

type CliArgs = {
  _: string[];
  help?: boolean;
  version?: boolean;
  pretty?: boolean;
  absolute?: boolean;
  verify?: boolean; // mri sets this to false for --no-verify
  copy?: boolean;
  format?: string;
  cwd?: string;
};


/**
 * Main CLI entry point.
 * This function orchestrates the entire process from argument parsing to final output.
 */
async function run() {
  const args: CliArgs = mri(process.argv.slice(2), {
    boolean: ['help', 'version', 'pretty', 'absolute', 'copy'],
    string: ['format', 'cwd'],
    alias: { h: 'help', v: 'version' },
    default: {
      pretty: true,
      format: 'json',
    },
  });

  if (args.help) {
    console.log(HELP_TEXT);
    return;
  }

  if (args.version) {
    console.log(`v${version}`);
    return;
  }

  const inputFile = args._[0];
  let inputText: string;

  try {
    inputText = inputFile
      ? readFileSync(path.resolve(args.cwd || process.cwd(), inputFile), 'utf-8')
      : await new Promise((resolve, reject) => {
          let data = '';
          process.stdin.on('data', chunk => data += chunk);
          process.stdin.on('end', () => resolve(data));
          process.stdin.on('error', reject);
        });
  } catch (err) {
    throw err;
  }

  // Map CLI arguments to engine pipeline options.
  const options: PipelineOptions = {
    absolute: args.absolute,
    cwd: args.cwd,
    verify: args.verify !== false, // Default to true, false only on --no-verify
    format: args.format as Format,
    pretty: args.pretty,
  };

  
  const result = await runPipeline(inputText, options);
  console.log(result);

  // Copying is a side effect that happens after the result is ready.
  if (args.copy) await copyToClipboard(result);
}

run().catch(err => {
  const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
  process.stderr.write(`Error: ${errorMessage}\n`);
  process.exit(1);
});