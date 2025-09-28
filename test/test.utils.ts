import { file } from 'bun';
import fs from 'node:fs/promises';
import path from 'node:path';
import yaml from 'js-yaml';

/**
 * Loads and parses a YAML fixture file.
 * @param filePath The path to the YAML file, relative to the `test` directory.
 * @returns The parsed data from the YAML file.
 */
export async function loadYamlFixture<T = unknown>(
  filePath: string,
): Promise<T> {
  const absolutePath = path.resolve(__dirname, filePath);
  const fileContent = await file(absolutePath).text();
  return yaml.load(fileContent) as T;
}

/**
 * Creates a temporary directory and populates it with the specified files.
 * @param files A map where keys are relative file paths and values are their content.
 * @returns The absolute path to the created temporary directory.
 */
export async function setupTestDirectory(files: {
  [path: string]: string;
}): Promise<string> {
  const tempDir = await fs.mkdtemp(path.join(process.cwd(), 'pathfish-test-'));
  for (const [filePath, content] of Object.entries(files)) {
    const absolutePath = path.join(tempDir, filePath);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, content);
  }
  return tempDir;
}

/**
 * Recursively removes a directory.
 * @param dirPath The absolute path to the directory to remove.
 */
export async function cleanupTestDirectory(dirPath: string): Promise<void> {
  await fs.rm(dirPath, { recursive: true, force: true });
}

/**
 * Executes the CLI in a separate process.
 * @param args An array of command-line arguments.
 * @param stdin An optional string to pipe to the process's stdin.
 * @returns A promise that resolves with the process's stdout, stderr, and exit code.
 */
export async function runCli(
  args: string[],
  stdin?: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const proc = Bun.spawn(['bun', 'src/cli.ts', ...args], {
    stdin: stdin ? new TextEncoder().encode(stdin) : 'pipe',
  });

  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  return { stdout, stderr, exitCode };
}