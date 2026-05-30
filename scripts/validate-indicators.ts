// Prebuild guardrail: validate src/data/questionnaire/indicators.yaml against
// the Zod indicator schema + charter §0.3 (each domain ≥1 capacity indicator).
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { indicatorSchema, type Indicator } from '../src/engine/func/questionnaire';
import { IC_DOMAIN_NAMES, type ICDomain } from '../src/lib/education/schemas';

const fail = (msg: string) => {
  console.error(`[validate-indicators] FAIL: ${msg}`);
  process.exit(1);
};
const warn = (msg: string) => console.warn(`[validate-indicators] WARN: ${msg}`);

const yamlPath = path.join(process.cwd(), 'src/data/questionnaire/indicators.yaml');
const raw = yaml.load(fs.readFileSync(yamlPath, 'utf8')) as Record<string, unknown[]>;

const allIndicators: Indicator[] = [];
const isProd = process.env.NODE_ENV === 'production';

for (const [domain, list] of Object.entries(raw)) {
  if (!IC_DOMAIN_NAMES.includes(domain as ICDomain)) {
    fail(`unknown domain: ${domain}`);
  }
  for (const ind of list as unknown[]) {
    const parsed = indicatorSchema.safeParse(ind);
    if (!parsed.success) {
      fail(`indicator parse error in ${domain}: ${JSON.stringify(parsed.error.issues, null, 2)}`);
      continue;
    }
    const data = parsed.data;
    if (data.license === 'commercial') fail(`commercial license forbidden: ${data.id}`);
    if (!data.id.startsWith(`${domain}.`)) {
      fail(`indicator id ${data.id} prefix mismatch with domain ${domain}`);
    }
    if (data.kind === 'likert' && data.subScales) {
      const qids = new Set(data.questions.map(q => q.id));
      for (const sub of data.subScales) {
        for (const qid of sub.questionIds) {
          if (!qids.has(qid)) fail(`subScale ${sub.id} references unknown question id ${qid}`);
        }
      }
    }
    if (data.kind === 'objective') {
      for (const [ag, norm] of Object.entries(data.test.norms)) {
        if (norm === null) {
          if (isProd) fail(`norm null in prod for ${data.id}@${ag}`);
          else warn(`norm null for ${data.id}@${ag} (dev allowed; prod will fail)`);
        } else if (norm.std <= 0 || norm.std < Math.abs(norm.mean) * 0.01) {
          fail(`norm std too small for ${data.id}@${ag}`);
        }
      }
    }
    if (data.kind === 'likert') {
      const minS = data.minScore ?? 0;
      for (const q of data.questions) {
        for (const opt of q.options) {
          if (opt.score < minS || opt.score > data.maxScore) {
            fail(`option score out of [${minS}, ${data.maxScore}] for ${q.id}`);
          }
        }
      }
    }
    allIndicators.push(data);
  }
}

// charter §0.3 enforcement: each domain must have ≥1 capacity indicator
for (const domain of IC_DOMAIN_NAMES) {
  const inDomain = allIndicators.filter(i => i.domain === domain);
  if (inDomain.length === 0) fail(`domain ${domain} has 0 indicators`);
  const capCount = inDomain.filter(i => i.style === 'capacity').length;
  if (capCount === 0) fail(`domain ${domain} has 0 capacity-style indicators (charter §0.3)`);
}

console.log(`[validate-indicators] OK: ${allIndicators.length} indicators across ${IC_DOMAIN_NAMES.length} domains`);
