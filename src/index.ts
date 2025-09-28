// Re-export core functions and types for programmatic use.
export { extractPaths, verifyPaths, type Options } from './core';

// Import the low-level clipboard utility.
import { copyToClipboard } from './utils';

/**
 * Asynchronously copies an array of paths to the system clipboard,
 * formatting them as a newline-separated list.
 * It gracefully handles errors in environments without a clipboard (e.g., CI).
 * @param paths The array of path strings to copy.
 * @returns A promise that resolves when the operation is complete.
 */
export async function copyPathsToClipboard(paths: string[]): Promise<void> {
  const textToCopy = paths.join('\n');
  await copyToClipboard(textToCopy);
}