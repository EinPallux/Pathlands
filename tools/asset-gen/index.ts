import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// Asset pipeline reporter/validator (ASSET_PIPELINE.md §7). Phase 1 authors all
// assets procedurally in-code (no baked binaries), so this validates the
// MANIFEST and reports the generator inventory. As baked GLB/KTX2/OGG assets
// arrive, this tool gains budget/license checks against them.
// Run: pnpm gen

interface Generator {
  id: string;
  path: string;
  kind: string;
  origin: string;
  produces: string[];
  license: string;
  budgetTris?: number;
}

interface Manifest {
  generators: Generator[];
  sourced: Array<{ path: string; license: string; url?: string }>;
}

function main(): void {
  const here = dirname(fileURLToPath(import.meta.url));
  const manifestPath = resolve(here, '../../assets/MANIFEST.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Manifest;

  const errors: string[] = [];
  for (const g of manifest.generators) {
    if (!g.id || !g.path) errors.push(`generator missing id/path: ${JSON.stringify(g)}`);
    try {
      readFileSync(resolve(here, '../..', g.path));
    } catch {
      errors.push(`generator source not found: ${g.path}`);
    }
  }
  for (const s of manifest.sourced) {
    if (s.license !== 'CC0-1.0' && !/CC0|Pixabay|public domain/i.test(s.license)) {
      errors.push(`sourced asset has non-CC0 license: ${s.path} (${s.license})`);
    }
  }

  const producedCount = manifest.generators.reduce((n, g) => n + g.produces.length, 0);
  console.info('Pathlands asset pipeline\n');
  for (const g of manifest.generators) {
    console.info(`  ${g.kind.padEnd(9)} ${g.id.padEnd(14)} → ${g.produces.length} asset(s)  [${g.origin}]`);
  }
  console.info(`\n  ${manifest.generators.length} generators · ${producedCount} procedural assets · ${manifest.sourced.length} sourced`);

  if (errors.length > 0) {
    console.error(`\n✗ asset validation failed:`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.info('\n✓ asset manifest valid');
}

main();
