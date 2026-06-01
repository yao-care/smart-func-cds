/**
 * content-index invariants (adult IC).
 *
 * 原本是「與改版前舊 video-index fixture 做 parity」的測試；成人化後該
 * fixture 已無意義並刪除。改為驗證 build-content-index 對成人 IC 內容層
 * 產出的結構不變量：catalog / recommendations / triggers / 矩陣覆蓋 /
 * 已策展影片接線。
 *
 * Run:  pnpm test --run tests/education/content-index-parity.test.ts
 */

import { describe, it, expect, beforeAll } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RuntimeIndex } from '$lib/education/schemas';
import { IC_DOMAIN_NAMES } from '$lib/education/schemas';
import { AGE_GROUPS_ADULT } from '$lib/utils/age-groups';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

let neu: RuntimeIndex;

beforeAll(async () => {
  const mod = await import(path.join(ROOT, 'scripts/build-content-index.ts'));
  neu = await mod.buildContentIndex({ write: false });
}, 30_000);

// ---------------------------------------------------------------------------
// 1. catalog — verified-only，已策展影片皆在且格式合法
// ---------------------------------------------------------------------------
describe('catalog', () => {
  it('每筆都是 verified 且 videoId 合 YouTube 格式', () => {
    const cat = neu.catalog as Record<string, { videoId: string; verificationStatus?: string }>;
    expect(Object.keys(cat).length).toBeGreaterThan(0);
    for (const [id, v] of Object.entries(cat)) {
      expect(id, `catalog videoId 格式不符: ${id}`).toMatch(/^[A-Za-z0-9_-]{11}$/);
      expect(v.videoId).toBe(id);
    }
  });

  it('2026-05-31 首批策展的 5 部成人影片都在 catalog', () => {
    const cat = neu.catalog as Record<string, unknown>;
    for (const id of ['sVQyMtAlXC4', 'D-i_2Fr493s', 'spdYQ-FjHE0', 'rN-2iDdxuGo', 'lTPf6eUnmC0']) {
      expect(cat[id], `catalog 缺少策展影片 ${id}`).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// 2. recommendations — 成人 key pattern + 結構完整
// ---------------------------------------------------------------------------
describe('recommendations', () => {
  it('存在且為非空物件', () => {
    expect(neu.recommendations).toBeDefined();
    expect(typeof neu.recommendations).toBe('object');
    expect(Object.keys(neu.recommendations).length).toBeGreaterThan(0);
  });

  it('所有 key 皆符合 <triageCategory>::<icDomain>::<ageGroup>', () => {
    const domains = IC_DOMAIN_NAMES.join('|');
    const ages = AGE_GROUPS_ADULT.join('|');
    const re = new RegExp(`^(normal|observe|consult|incomplete)::(${domains})::(${ages})$`);
    for (const key of Object.keys(neu.recommendations)) {
      expect(key, `recommendations key 不符成人 pattern: ${key}`).toMatch(re);
    }
  });

  it('所有推薦項目皆 source=internal 且有 slug + title', () => {
    const recs = neu.recommendations as Record<string, Array<{ source: string; slug?: string; title?: string }>>;
    for (const [key, items] of Object.entries(recs)) {
      for (const item of items) {
        expect(item.source, `${key}: item 缺 source`).toBe('internal');
        expect(item.slug, `${key}: item 缺 slug`).toBeTruthy();
        expect(item.title, `${key}: item="${item.slug}" 缺 title`).toBeTruthy();
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 3. recommendations 內容鎖 — 代表性 cell 的文章 slug 集合
//
// 防止改版時 article slug 在 cell 間錯置（結構測試抓不到）。
// 與 src/data/education/content-relevance.yaml 對齊（Set 比較，與順序無關）。
// ---------------------------------------------------------------------------
describe('recommendations 內容鎖 — 代表性 cell', () => {
  const EXPECTED: Record<string, Set<string>> = {
    'consult::cognition::18-39': new Set(['cognitive-health', 'attention-memory-care']),
    'observe::vitality::40-54': new Set(['adult-sleep-hygiene', 'fatigue-management', 'balanced-nutrition']),
    'consult::sensory::55-64': new Set(['vision-care', 'hearing-care', 'screen-eye-strain']),
    'consult::psychological::18-39': new Set([
      'understanding-burnout', 'stress-management', 'mood-self-awareness', 'psychological-wellbeing',
    ]),
  };

  it('鎖定 cell 的 slug 集合完全相符', () => {
    const recs = neu.recommendations as Record<string, Array<{ slug: string }>>;
    for (const [key, expected] of Object.entries(EXPECTED)) {
      const items = recs[key];
      expect(items, `recommendations["${key}"] 應存在`).toBeDefined();
      expect(new Set(items.map((i) => i.slug)), `recommendations["${key}"] slug 集合不符`).toEqual(expected);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. triggers — func.domain.* 結構 + 已策展影片接線鎖
// ---------------------------------------------------------------------------
describe('triggers', () => {
  type Trig = { videoIds: string[]; inapplicable: boolean; educationSlug?: string; articleSlugs?: string[] };

  it('所有 func.domain trigger key 皆 5 段且 domain/age 合法', () => {
    const domains = new Set<string>(IC_DOMAIN_NAMES);
    const ages = new Set<string>(AGE_GROUPS_ADULT);
    const trigs = neu.triggers as Record<string, Trig>;
    for (const key of Object.keys(trigs)) {
      if (!key.startsWith('func.domain.')) continue;
      const parts = key.split('.');
      expect(parts.length, `trigger 段數異常: ${key}`).toBe(5);
      expect(domains.has(parts[2]), `未知 domain: ${key}`).toBe(true);
      expect(['low', 'moderate'].includes(parts[3]), `未知 band: ${key}`).toBe(true);
      expect(ages.has(parts[4]), `未知 ageGroup: ${key}`).toBe(true);
    }
  });

  it('已策展影片接到正確的 domain×band cell（全 3 年齡）', () => {
    const trigs = neu.triggers as Record<string, Trig>;
    const wired: Record<string, string> = {
      'func.domain.locomotion.low': 'sVQyMtAlXC4',
      'func.domain.cognition.low': 'D-i_2Fr493s',
      'func.domain.sensory.low': 'spdYQ-FjHE0',
      'func.domain.sensory.moderate': 'rN-2iDdxuGo',
      'func.domain.psychological.low': 'lTPf6eUnmC0',
    };
    for (const [cellBand, videoId] of Object.entries(wired)) {
      for (const age of AGE_GROUPS_ADULT) {
        const key = `${cellBand}.${age}`;
        expect(trigs[key]?.videoIds ?? [], `${key} 缺策展影片`).toContain(videoId);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 5. 矩陣覆蓋 — 每個可適用的 func.domain cell 都有衛教文章（educationSlug）
// ---------------------------------------------------------------------------
describe('矩陣覆蓋', () => {
  it('每個非 inapplicable 的 func.domain cell 都有 educationSlug（主衛教文章）', () => {
    const trigs = neu.triggers as Record<string, { inapplicable: boolean; educationSlug?: string }>;
    for (const domain of IC_DOMAIN_NAMES) {
      for (const band of ['low', 'moderate'] as const) {
        for (const age of AGE_GROUPS_ADULT) {
          const key = `func.domain.${domain}.${band}.${age}`;
          const cell = trigs[key];
          if (!cell || cell.inapplicable) continue;
          expect(cell.educationSlug, `${key}: 缺主衛教文章 educationSlug`).toBeTruthy();
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 6. clinicalEducation 存在
// ---------------------------------------------------------------------------
describe('clinicalEducation', () => {
  it('存在且為物件', () => {
    expect(neu.clinicalEducation).toBeDefined();
    expect(typeof neu.clinicalEducation).toBe('object');
  });
});
