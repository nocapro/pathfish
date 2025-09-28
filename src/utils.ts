import yaml from 'js-yaml';
import clipboardy from 'clipboardy';

export type Format = 'json' | 'yaml' | 'list';

/**
 * A higher-order function that returns a formatting function based on the desired format.
 * This keeps the formatting logic separate and easy to test.
 * @param format The output format.
 * @param pretty Whether to pretty-print (for JSON).
 * @returns A function that takes an array of strings and returns a formatted string.
 */
export const createFormatter = (format: Format, pretty: boolean) => {
  if (!['json', 'yaml', 'list'].includes(format)) {
    // Fail fast if the format is not supported.
    throw new Error(`Unknown format: ${format}`);
  }
  return (paths: string[]): string => {
    switch (format) {
      case 'json':
        return JSON.stringify(paths, null, pretty ? 2 : undefined);
      case 'yaml':
        return yaml.dump(paths);
      case 'list':
        return paths.join('\n');
    }
  };
};

/**
 * Asynchronously copies a given string to the system clipboard.
 * It gracefully handles errors in environments without a clipboard (e.g., CI).
 * @param text The text to copy.
 * @returns A promise that resolves when the operation is complete.
 */
export async function copyToClipboard(text: string): Promise<void> {
  try {
    await clipboardy.write(text);
  } catch {
    // Suppress errors in environments without a clipboard. Copying is a
    // "nice-to-have" side effect, not a critical function.
  }
}