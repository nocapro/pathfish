import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    cli: 'src/cli.ts',
  },
  format: ['esm'],
  dts: true,
  outDir: 'dist',
  splitting: false,
  sourcemap: true,
  clean: true,
  target: 'es2022',
  platform: 'node',
  esbuildOptions: (options) => {
    options.format = 'esm';
  },
  onSuccess: async () => {
    // Copy package.json and adjust for publishing
    const fs = await import('fs/promises');
    const path = await import('path');

    const pkg = JSON.parse(await fs.readFile('package.json', 'utf-8'));

    // Update package.json for distribution
    delete pkg.private;
    pkg.main = 'index.js';
    pkg.module = 'index.js';
    pkg.types = 'index.d.ts';
    pkg.bin = {
      pathfish: 'cli.js'
    };
    pkg.files = ['**/*'];
    delete pkg.devDependencies;
    delete pkg.scripts;
    delete pkg.peerDependencies;

    await fs.writeFile('dist/package.json', JSON.stringify(pkg, null, 2));
  },
});