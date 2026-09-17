/* Apprend à Node l'alias `@/` de tsconfig.json.
 *
 * Node exécute le TypeScript nativement (22.18+), ce qui permet au banc d'essai
 * d'importer directement la vraie route — pas une copie, pas un portage. Il ne lit en
 * revanche pas les `paths` de tsconfig : sans ce crochet, `@/lib/ghl` n'existe pas
 * hors du bundle Next.
 *
 *   node --conditions=react-server --import ./tools/alias-hook.mjs tools/lead.test.mjs
 *
 * `--conditions=react-server` est l'autre moitié : le paquet `server-only` lève une
 * exception quand il est chargé sans cette condition, ce qui est exactement son rôle —
 * empêcher que lib/ghl.ts se retrouve dans un bundle client.
 */

import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/* L'ESM de Node exige une extension ; les imports du projet n'en portent pas, comme
   partout en TypeScript. On rétablit celle qui existe sur le disque. */
const EXT = ['', '.ts', '.tsx', '.mjs', '.js', '/index.ts', '/index.tsx'];

function withExtension(base) {
  for (const e of EXT) {
    const candidate = base + e;
    if (e !== '' && existsSync(candidate)) return candidate;
    if (e === '' && existsSync(candidate) && /\.[a-z]+$/.test(candidate)) return candidate;
  }
  return base;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('@/')) {
      const target = withExtension(resolve(ROOT, specifier.slice(2)));
      return nextResolve(pathToFileURL(target).href, context);
    }
    return nextResolve(specifier, context);
  }
});
