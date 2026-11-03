import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { generateSpec, parseFeature, slugify } from './generator.ts';

const OUTPUT_DIR = join(import.meta.dirname, '..', '..', 'e2e-tests', 'generated');

function main(): void {
  const input = process.argv[2];
  if (!input) {
    console.error('Usage: npm run test:generate -- <steps-file>');
    process.exit(1);
  }

  const feature = parseFeature(readFileSync(input, 'utf8'));
  const name = slugify(feature.name) || slugify(basename(input, extname(input)));
  const outFile = join(OUTPUT_DIR, `${name}.spec.ts`);

  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(outFile, generateSpec(feature));
  console.log(`Generated ${outFile}`);
  console.log('Run it with: npx playwright test e2e-tests/generated, then npm run test:e2e:report');
}

main();
