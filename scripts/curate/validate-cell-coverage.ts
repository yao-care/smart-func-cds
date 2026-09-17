#!/usr/bin/env tsx
/**
 * validate-cell-coverage.ts
 *
 * 守門：每個「實際會被派生出來」的衛教 trigger 都要有內容。
 *
 * 分母取自 `expectedTriggerKeys()`（與 `deriveFuncTriggers` 同源），不是
 * content-relevance.yaml 的清單——否則整段漏掉的組合會假性通過。
 *
 * 三種缺口的處理不同：
 * - missing（yaml 根本沒這個 key）→ 直接失敗，這是 bug 不是內容債。
 * - empty（有 key 但文章影片皆空）→ 對 baseline 棘輪：只擋新增的。
 * - videoGaps（有文章沒影片）→ 只報數字，補影片需 yt-dlp（`pnpm curate:videos`），
 *   不該擋住其他人的 CI。
 *
 * 用法：pnpm validate:coverage [--update-baseline]
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { buildContentIndex } from '../build-content-index.js';
import { coverageReport, ratchet } from './lib/coverage.js';

const BASELINE_PATH = path.join('scripts', 'curate', 'coverage-baseline.json');

interface Baseline {
  _comment?: string;
  empty: string[];
}

async function readBaseline(): Promise<Baseline> {
  try {
    return JSON.parse(await fs.readFile(BASELINE_PATH, 'utf8')) as Baseline;
  } catch {
    return { empty: [] };
  }
}

async function main(): Promise<void> {
  const updating = process.argv.includes('--update-baseline');
  const index = await buildContentIndex({ write: false });
  const report = coverageReport(index.triggers);
  const baseline = await readBaseline();

  console.log(
    `衛教 trigger 應有 ${report.expected.length} 組：` +
      `完全無內容 ${report.empty.length}、缺影片 ${report.videoGaps.length}、yaml 缺鍵 ${report.missing.length}`,
  );

  if (updating) {
    const next: Baseline = {
      _comment:
        '目前尚無任何衛教內容的 trigger（棘輪基準線）。補齊後請重跑 pnpm validate:coverage --update-baseline 收斂此清單；此檔只會變短，不該變長。',
      empty: [...report.empty].sort(),
    };
    await fs.writeFile(BASELINE_PATH, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
    console.log(`✓ 已更新 baseline（${next.empty.length} 筆）`);
    return;
  }

  let failed = false;

  if (report.missing.length > 0) {
    failed = true;
    console.error(`✗ content-relevance.yaml 缺少這些 trigger（派生得到卻查不到內容）：\n  ${report.missing.join('\n  ')}`);
  }

  const { regressions, staleBaseline } = ratchet(report.empty, baseline.empty);
  if (regressions.length > 0) {
    failed = true;
    console.error(`✗ 新增了沒有任何衛教內容的 trigger：\n  ${regressions.join('\n  ')}`);
  }
  if (staleBaseline.length > 0) {
    console.log(`ℹ baseline 有 ${staleBaseline.length} 筆已補齊，請跑 --update-baseline 收斂：\n  ${staleBaseline.join('\n  ')}`);
  }

  if (report.unreachablePresent.length > 0) {
    console.log(
      `ℹ yaml 有派生不到的殘留 trigger（trigger-derivation 不會產生），可移除：\n  ${report.unreachablePresent.join('\n  ')}`,
    );
  }

  if (report.videoGaps.length > 0) {
    console.log(`ℹ ${report.videoGaps.length} 組 trigger 有文章但無影片，待 pnpm curate:videos 補。`);
  }

  if (failed) process.exit(1);
  console.log('✓ 衛教覆蓋未退步');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
