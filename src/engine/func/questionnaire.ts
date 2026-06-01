import { z } from 'astro/zod';
import { IC_DOMAIN_NAMES, type ICDomain } from '../../lib/education/schemas';
import { AGE_GROUPS_ADULT, type AgeGroupAdult } from '../../lib/utils/age-groups';

export const INDICATOR_KINDS = ['likert', 'objective'] as const;
export type IndicatorKind = typeof INDICATOR_KINDS[number];

export const INDICATOR_STYLES = ['capacity', 'symptom'] as const;
export type IndicatorStyle = typeof INDICATOR_STYLES[number];

export const DIRECTION_KINDS = ['higher_is_better', 'higher_is_worse'] as const;
export type Direction = typeof DIRECTION_KINDS[number];

export const LICENSE_KINDS = [
  'public-domain', 'cc-by', 'cc-by-sa', 'cc-by-nc-sa',
  'research-open-noncommercial', 'study-developed', 'commercial',
] as const;
export type License = typeof LICENSE_KINDS[number];

const loincRegex = /^\d{1,5}-\d$/;

export const likertQuestionSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  reverseScored: z.boolean().optional(),
  tier: z.enum(['screener', 'detail']).optional(),
  loincCode: z.string().regex(loincRegex).nullable().optional(),
  options: z.array(z.object({
    label: z.string(),
    score: z.number(),
  })),
});

export const clinicalCutoffSchema = z.object({
  threshold: z.number(),
  comparator: z.enum(['>=', '<=']),
  flagLabel: z.string().min(1),
  severity: z.enum(['consult', 'advisory']),
  citation: z.string().min(1),
});

export const revealDetailWhenSchema = z.object({
  screenerQuestionIds: z.array(z.string()).min(1),
  threshold: z.number(),
  comparator: z.enum(['>=', '<=']),
});

export const likertSubScaleSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  questionIds: z.array(z.string()).min(1),
  weight: z.number().nonnegative().optional(),
  clinicalCutoff: clinicalCutoffSchema.optional(),
});

const baseIndicatorFields = {
  id: z.string().regex(/^[a-z_]+\.[a-z_]+$/, 'id must be <domain>.<name>'),
  domain: z.enum(IC_DOMAIN_NAMES),
  label: z.string().min(1),
  tier: z.enum(['screener', 'detail']).default('screener'),
  style: z.enum(INDICATOR_STYLES),
  direction: z.enum(DIRECTION_KINDS),
  weight: z.number().nonnegative(),
  ageApplicability: z.array(z.enum(AGE_GROUPS_ADULT)).optional(),
  license: z.enum(LICENSE_KINDS).refine(l => l !== 'commercial', { message: 'commercial license forbidden' }),
  loincCode: z.string().regex(loincRegex).nullable().optional(),
};

export const likertIndicatorSchema = z.object({
  kind: z.literal('likert'),
  ...baseIndicatorFields,
  maxScore: z.number().int().positive().max(10),
  minScore: z.number().int().nonnegative().optional(),
  questions: z.array(likertQuestionSchema).min(1),
  subScales: z.array(likertSubScaleSchema).optional(),
  clinicalCutoff: clinicalCutoffSchema.optional(),
  revealDetailWhen: revealDetailWhenSchema.optional(),
  minCompletionPolicy: z.number().min(0).max(1).optional(),
}).refine(d => d.maxScore > (d.minScore ?? 0), { message: 'maxScore must > minScore' });

const normSpecSchema = z.object({
  mean: z.number(),
  std: z.number().positive(),
  citation: z.string().min(1),
});

const reactionTimeTestSchema = z.object({
  type: z.literal('reaction-time'),
  paradigm: z.literal('simple-visual'),
  trials: z.number().int().positive(),
  warmupTrials: z.number().int().nonnegative(),
  validRangeMs: z.object({ min: z.number().positive(), max: z.number().positive() }),
  norms: z.object({
    '18-39': normSpecSchema.nullable(),
    '40-54': normSpecSchema.nullable(),
    '55-64': normSpecSchema.nullable(),
  }),
});

const tmtATestSchema = z.object({
  type: z.literal('tmt-a'),
  targetCount: z.literal(25),
  administration: z.enum(['browser-mouse', 'browser-touch']),
  norms: z.object({
    '18-39': normSpecSchema.nullable(),
    '40-54': normSpecSchema.nullable(),
    '55-64': normSpecSchema.nullable(),
  }),
});

export const objectiveIndicatorSchema = z.object({
  kind: z.literal('objective'),
  ...baseIndicatorFields,
  test: z.discriminatedUnion('type', [reactionTimeTestSchema, tmtATestSchema]),
});

export const indicatorSchema = z.discriminatedUnion('kind', [
  likertIndicatorSchema,
  objectiveIndicatorSchema,
]);

export type LikertQuestion = z.infer<typeof likertQuestionSchema>;
export type LikertSubScale = z.infer<typeof likertSubScaleSchema>;
export type ClinicalCutoff = z.infer<typeof clinicalCutoffSchema>;
export type RevealDetailWhen = z.infer<typeof revealDetailWhenSchema>;
export type LikertIndicator = z.infer<typeof likertIndicatorSchema>;
export type ObjectiveIndicator = z.infer<typeof objectiveIndicatorSchema>;
export type Indicator = z.infer<typeof indicatorSchema>;
export type NormSpec = z.infer<typeof normSpecSchema>;
export type ObjectiveTest = z.infer<typeof reactionTimeTestSchema> | z.infer<typeof tmtATestSchema>;
