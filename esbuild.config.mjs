// Bundle minimo por handler para mitigar cold start (SRV-BP-006): un artefacto
// liviano por funcion, tree-shaking, un solo .mjs por Lambda.
//
// El AWS SDK v3 se marca EXTERNAL: el runtime Node de Lambda (nodejs20.x+) ya lo
// provee, asi que bundlearlo solo infla el paquete y empeora el cold start. Si se
// despliega en un runtime que NO lo trae, se elimina de `external`. Powertools SI
// se bundlea (no viene en el runtime salvo layer).
import { build } from 'esbuild';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const HANDLERS_DIR = 'src/infrastructure/entry-points/handlers';

const entryPoints = readdirSync(HANDLERS_DIR)
  .filter((f) => f.endsWith('.handler.ts'))
  .map((f) => join(HANDLERS_DIR, f));

await build({
  entryPoints,
  bundle: true,
  minify: true,
  sourcemap: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  outdir: 'dist/handlers',
  outExtension: { '.js': '.mjs' },
  // Provisto por el runtime de Lambda -> no bundlear (cold start SRV-BP-006).
  external: ['@aws-sdk/*'],
  banner: {
    // shim para __dirname/require en ESM si alguna dep lo requiere
    js: "import { createRequire as _cr } from 'module'; const require = _cr(import.meta.url);",
  },
  logLevel: 'info',
});

console.log(`esbuild: ${entryPoints.length} handlers empaquetados en dist/handlers`);
