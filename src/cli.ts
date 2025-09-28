#!/usr/bin/env bun

import mri from 'mri';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPipeline, type PipelineOptions } from './engine';
import { copyToClipboard, type Format } from './utils';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { version } = await Bun.file(path.join(__dirname, '../package.json')).json();

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
  const inputText = inputFile
    ? await Bun.file(inputFile).text()
    : await Bun.stdin.text();

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
  // Use console.error to write to stderr
  console.error(`\x1b[31mError: ${errorMessage}\x1b[0m`);
  process.exit(1);
});