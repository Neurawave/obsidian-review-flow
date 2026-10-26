// Builds main.js and styles.css, the files Obsidian loads, from src/. Same setup as Obsidian's sample plugin.
import esbuild from 'esbuild';
import { builtinModules } from 'node:module';

const external = ['obsidian', 'electron', ...builtinModules, ...builtinModules.map((m) => `node:${m}`)];

await esbuild.build({
  entryPoints: { main: 'src/plugin.js', styles: 'src/plugin.css' },
  outdir: '.',
  bundle: true,
  format: 'cjs',
  platform: 'node',
  target: 'es2020',
  external,
  logLevel: 'info',
});
