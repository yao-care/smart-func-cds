import { z } from 'astro/zod';   // = zod v4
import { AGE_GROUPS_ADULT } from '../utils/age-groups';

// --- IC domain (smart-func-cds 成人功能健康評估) ---
export const IC_DOMAIN_NAMES = [
  'vitality',      // 身體活力
  'locomotion',    // 行動功能
  'cognition',     // 認知功能
  'psychological', // 心理功能
  'sensory',       // 感官功能
] as const;
export type ICDomain = typeof IC_DOMAIN_NAMES[number];

// --- 影片元資料 ---
export const videoCatalogItemSchema = z.object({
  videoId: z.string().regex(/^[A-Za-z0-9_-]{11}$/),
  title: z.string().min(1),
  channel: z.string().min(1),
  channelId: z.string().regex(/^UC[A-Za-z0-9_-]{22}$/),
  duration: z.number().int().positive(),
  publishedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  language: z.enum(['zh-Hant', 'en']),
  subtitleType: z.enum(['human', 'auto', 'none']),
  sourceTier: z.enum(['official-tw', 'international', 'pro-kol']),
  viewCount: z.number().int().nonnegative(),
  curatedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  lastValidatedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  verifiedBy: z.enum(['claude-code', 'manual']),
  verificationStatus: z.enum(['verified', 'rejected']),
  score: z.number().min(0).max(1),
  notes: z.string().optional(),
});

// --- Trigger 映射（discriminatedUnion + cross-field refine）---
const videoIdsField = z.array(z.string().regex(/^[A-Za-z0-9_-]{11}$/)).default([]);

// --- IC trigger schemas (smart-func-cds) ---
const IC_DOMAIN_ENUM = z.enum(IC_DOMAIN_NAMES);
const IC_AGE_GROUP_ENUM = z.enum(AGE_GROUPS_ADULT);
const IC_BAND_ENUM = z.enum(['low', 'moderate']);
const IC_TRIAGE_CATEGORY_ENUM = z.enum(['normal', 'observe', 'consult', 'incomplete']);

export const funcTriageEntrySchema = z.object({
  trigger: z.string(),
  category: z.literal('triage'),
  triageCategory: IC_TRIAGE_CATEGORY_ENUM,
  ageGroup: IC_AGE_GROUP_ENUM,
  educationSlug: z.string().optional(),
  inapplicable: z.literal(true).optional(),
  videoIds: videoIdsField,
}).refine(
  d => d.trigger === `func.triage.${d.triageCategory}.${d.ageGroup}`,
  { message: 'trigger 字串與 triageCategory + ageGroup 不一致', path: ['trigger'] },
);

export const funcDomainEntrySchema = z.object({
  trigger: z.string(),
  category: z.literal('domain'),
  domain: IC_DOMAIN_ENUM,
  band: IC_BAND_ENUM,
  ageGroup: IC_AGE_GROUP_ENUM,
  educationSlug: z.string().optional(),
  inapplicable: z.literal(true).optional(),
  videoIds: videoIdsField,
}).refine(
  d => d.trigger === `func.domain.${d.domain}.${d.band}.${d.ageGroup}`,
  { message: 'trigger 字串與 domain + band + ageGroup 不一致', path: ['trigger'] },
);

export const triggerEntrySchema = z.discriminatedUnion('category', [
  funcTriageEntrySchema,
  funcDomainEntrySchema,
]);

// --- Runtime slim shape（reproducible JSON）---
export const runtimeVideoSchema = videoCatalogItemSchema.pick({
  videoId: true,
  title: true,
  channel: true,
  duration: true,
  language: true,
  sourceTier: true,
  score: true,
});

export const runtimeIndexSchema = z.object({
  catalog: z.record(z.string(), runtimeVideoSchema),
  triggers: z.record(z.string(), z.object({
    videoIds: z.array(z.string()),
    inapplicable: z.boolean(),
    educationSlug: z.string().optional(),
    articleSlugs: z.array(z.string()).optional(),
  })),
  educationSlugToTriggers: z.record(z.string(), z.array(z.string())),
  recommendations: z.record(z.string(), z.array(z.object({
    source: z.enum(['internal', 'custom', 'external']),
    slug: z.string().optional(),
    customId: z.string().optional(),
    url: z.string().optional(),
    title: z.string().optional(),
    summary: z.string().optional(),
  }))),
  clinicalEducation: z.record(z.string(), z.array(z.string())),
  articleSlugs: z.array(z.string()).optional(),
});

// --- Content-relevance schema（單一源）---
// func triage severities that may key a content cell (band-level)
export const FUNC_TRIAGE_SEVERITY = ['observe', 'consult'] as const;

// cell / 情境導向：每個 trigger 列該格內容
const articleRefSchema = z.object({
  slug: z.string(),
  // 只有 func.domain 格的文章需要；省略時投影端預設視為 [observe, consult]
  severities: z.array(z.enum(FUNC_TRIAGE_SEVERITY)).optional(),
  browse: z.boolean().optional(),   // true = this is the cell's matrix/browse article (was the old educationSlug)
});

export const triggerRelevanceSchema = z.object({
  trigger: z.string(),
  videoIds: z.array(z.string().regex(/^[A-Za-z0-9_-]{11}$/)).default([]),
  articles: z.array(articleRefSchema).default([]),
});

export const contentRelevanceSchema = z.object({
  inapplicable: z.record(z.enum(IC_DOMAIN_NAMES), z.array(z.enum(AGE_GROUPS_ADULT))),
  triggers: z.array(triggerRelevanceSchema),
  clinicalAlertEducation: z.record(z.string(), z.array(z.string())).optional(),
});

export type ContentRelevance = z.infer<typeof contentRelevanceSchema>;
export type TriggerRelevance = z.infer<typeof triggerRelevanceSchema>;

// --- Types ---
export type VideoCatalogItem = z.infer<typeof videoCatalogItemSchema>;
export type TriggerEntry = z.infer<typeof triggerEntrySchema>;
export type RuntimeVideo = z.infer<typeof runtimeVideoSchema>;
export type RuntimeIndex = z.infer<typeof runtimeIndexSchema>;
export type CustomVideo = RuntimeVideo & { triggers: string[] | '*' };
