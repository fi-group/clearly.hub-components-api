import * as esbuild from 'esbuild';

const minify = process.argv.includes('--minify');
const watch  = process.argv.includes('--watch');
const ext    = minify ? '.min.js' : '.js';

const config = {
  bundle:   true,
  format:   'iife',
  platform: 'browser',
  target:   'es2017',
  minify,
  entryPoints: [
    { in: 'src/oup.ts',        out: `dist/oup${ext.slice(0, -3)}` },
    { in: 'src/components.ts', out: `dist/oup.components${ext.slice(0, -3)}` },
  ],
  outdir: '.',
};

if (watch) {
  const ctx = await esbuild.context(config);
  await ctx.watch();
  console.log(`Watching (minify=${minify})…`);
} else {
  await esbuild.build(config);
  console.log(`Build complete (minify=${minify}).`);
}
