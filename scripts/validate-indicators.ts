// Prebuild guardrail: validate src/data/questionnaire/indicators.yaml against
// the Zod indicator schema + charter §0.3 (each domain ≥1 capacity indicator).
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { indicatorSchema, type Indicator } from '../src/engine/func/questionnaire';
import { IC_DOMAIN_NAMES, type ICDomain } from '../src/lib/education/schemas';

/** 純函式：檢查 tier 完整性，回傳錯誤訊息陣列（空陣列=通過）。 */
export function validateTierIntegrity(indicators: Indicator[]): string[] {
  const errors: string[] = [];
  const byDomain = new Map<string, Indicator[]>();
  for (const ind of indicators) {
    if (!byDomain.has(ind.domain)) byDomain.set(ind.domain, []);
    byDomain.get(ind.domain)!.push(ind);
  }
  // 1. 每個含 detail 指標的域，必須至少有一個 screener 指標
  for (const [domain, list] of byDomain) {
    const hasDetail = list.some(i => i.tier === 'detail');
    const hasScreener = list.some(i => i.tier === 'screener');
    if (hasDetail && !hasScreener) {
      errors.push(`domain ${domain}: 有 detail 指標但無 screener 指標（detail 將永不揭露）`);
    }
  }
  // 2. 題層 detail 的指標必須有 revealDetailWhen，且其 screenerQuestionIds 必須存在且非 detail
  for (const ind of indicators) {
    // objective 指標層 detail 由 domain-driven UI 揭露，無題層 detail / 不需 revealDetailWhen
    if (ind.kind !== 'likert') continue;
    const likert = ind;
    const detailQs = likert.questions.filter(q => q.tier === 'detail');
    if (detailQs.length === 0) continue;
    if (!likert.revealDetailWhen) {
      errors.push(`indicator ${likert.id}: 有題層 detail 但缺 revealDetailWhen`);
      continue;
    }
    const qById = new Map(likert.questions.map(q => [q.id, q]));
    for (const qid of likert.revealDetailWhen.screenerQuestionIds) {
      const q = qById.get(qid);
      if (!q) errors.push(`indicator ${likert.id}: revealDetailWhen 引用不存在的題 ${qid}`);
      else if (q.tier === 'detail') errors.push(`indicator ${likert.id}: revealDetailWhen 的螢檢題 ${qid} 不可為 detail`);
    }
  }
  return errors;
}

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

const tierErrors = validateTierIntegrity(allIndicators);
for (const e of tierErrors) fail(e);

console.log(`[validate-indicators] OK: ${allIndicators.length} indicators across ${IC_DOMAIN_NAMES.length} domains`);
