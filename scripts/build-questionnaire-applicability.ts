#!/usr/bin/env tsx
import fs from 'node:fs/promises';
import path from 'node:path';
import yaml from 'js-yaml';

interface ContentRelevance {
  inapplicable: Record<string, string[]>;
}

const QUESTIONNAIRE_DOMAINS = [
  'vitality', 'locomotion', 'cognition', 'psychological', 'sensory',
] as const;

const AGE_GROUPS_ADULT = [
  '18-39', '40-54', '55-64',
] as const;

async function main(): Promise<void> {
  const cwd = process.cwd();
  const relevancePath = path.join(cwd, 'src/data/education/content-relevance.yaml');
  const relevance = yaml.load(await fs.readFile(relevancePath, 'utf8')) as ContentRelevance;

  const result: Record<string, string[]> = {};
  for (const ag of AGE_GROUPS_ADULT) {
    result[ag] = QUESTIONNAIRE_DOMAINS.filter(domain => {
      const inapp = relevance.inapplicable[domain] ?? [];
      return !inapp.includes(ag);
    });
  }

  const sorted = Object.fromEntries(
    Object.keys(result).sort().map(k => [k, result[k].sort()]),
  );

  const outPath = path.join(cwd, 'src/lib/data/expected-questionnaire-domains.generated.json');
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, JSON.stringify(sorted, null, 2) + '\n');
  console.log(`[build-questionnaire-applicability] wrote ${outPath}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => { console.error(err); process.exit(1); });
}
