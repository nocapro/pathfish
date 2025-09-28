import { extractPaths, verifyPaths, type Options } from './core';
import { createFormatter, type Format } from './utils';

/**
 * Combined options for the entire path processing pipeline.
 */
export type PipelineOptions = Options & {
  /**
   * When false, disables filtering of paths that do not exist on disk.
   * @default true
   */
  verify?: boolean;
  /**
   * The output format.
   * @default 'json'
   */
  format?: Format;
  /**
   * Pretty-print JSON output.
   * @default true
   */
  pretty?: boolean;
};

/**
 * Executes the full path extraction and formatting pipeline.
 * This is the core engine of pathfish, decoupled from the CLI.
 * @param text The input text to process.
 * @param options Configuration for the pipeline.
 * @returns A promise that resolves to the formatted string output.
 */
export async function runPipeline(
  text: string,
  options: PipelineOptions = {},
): Promise<string> {
  const {
    verify: shouldVerify = true,
    format: formatType = 'json',
    pretty = true,
    ...extractOptions
  } = options;

  // 1. Extract paths from the text using the core extractor.
  const initialPaths = extractPaths(text, { unique: true, ...extractOptions });

  // 2. (Optional) Verify that the paths actually exist on disk.
  const verifiedPaths = shouldVerify
    ? await verifyPaths(initialPaths, extractOptions.cwd)
    : initialPaths;

  // 3. Format the resulting paths into the desired output string.
  const format = createFormatter(formatType, pretty);
  const formattedOutput = format(verifiedPaths);

  return formattedOutput;
}