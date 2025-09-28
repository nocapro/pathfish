#!/usr/bin/env bun

import mri from 'mri';
import { extractPaths, verifyPaths, type Options } from './core';
import { createFormatter, copyToClipboard, type Format } from './utils';
import { version } from '../package.json' with { type: 'json' };

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
  --verify           Filter out paths that do not exist on disk
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
  verify?: boolean;
  copy?: boolean;
  format?: string;
  cwd?: string;
};

/**
 * Creates a pipeline of operations to be performed on the input text.
 * This functional approach makes the process clear and configurable.
 * @param args Parsed CLI arguments.
 * @returns An async function that executes the full path extraction and formatting pipeline.
 */
const createCliPipeline = (args: CliArgs) => async (inputText: string) => {
  const options: Options = {
    absolute: args.absolute,
    cwd: args.cwd || process.cwd(),
    unique: true, // Unique is always true for CLI
  };

  // 1. A function to extract paths from text using the specified options.
  const extract = (text: string) => extractPaths(text, options);

  // 2. An async function to optionally verify the extracted paths.
  const verify = async (paths: string[]) =>
    args.verify ? verifyPaths(paths) : paths;

  // 3. A function to format the paths into the desired output string.
  const format = createFormatter(args.format as Format, args.pretty ?? true);

  // 4. An async function to optionally copy the formatted string to the clipboard.
  const copy = async (formattedText: string) => {
    if (args.copy) {
      await copyToClipboard(formattedText);
    }
    return formattedText;
  };

  // Execute the pipeline by composing the functions.
  const initialPaths = extract(inputText);
  const verifiedPaths = await verify(initialPaths);
  const formattedOutput = format(verifiedPaths);
  const finalOutput = await copy(formattedOutput);

  return finalOutput;
};

/**
 * Main CLI entry point.
 * This function orchestrates the entire process from argument parsing to final output.
 */
async function run() {
  const args: CliArgs = mri(process.argv.slice(2), {
    boolean: ['help', 'version', 'pretty', 'absolute', 'verify', 'copy'],
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

  const pipeline = createCliPipeline(args);
  const result = await pipeline(inputText);

  console.log(result);
}

run().catch(err => {
  const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
  // Use console.error to write to stderr
  console.error(`\x1b[31mError: ${errorMessage}\x1b[0m`);
  process.exit(1);
});