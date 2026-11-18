import { build } from 'esbuild';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

const { metafile } = await build({
  entryPoints: { lighting: 'dist/scene.js', lens: 'src/lens/lens.tsx' },
  outdir: 'dist/bundles',
  entryNames: '[name]-[hash]',
  chunkNames: 'shared-[hash]',
  bundle: true,
  splitting: true,
  minify: true,
  format: 'esm',
  jsx: 'automatic',
  metafile: true
});

const entries = Object.entries(metafile.outputs).filter(([, output]) => output.entryPoint);
const imports = entries.map(([filename]) => {
  const basename = path.basename(filename);
  const name = basename.slice(0, basename.indexOf('-'));
  return `export const load${name[0].toUpperCase() + name.slice(1)} = () => import('./${basename}');`;
});
await writeFile('dist/bundles/entries.js', imports.join('\n') + '\n');
