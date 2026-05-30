import { describe, it, expect } from 'vitest';
import {
  videoCatalogItemSchema, triggerEntrySchema,
  funcTriageEntrySchema, funcDomainEntrySchema,
} from '../../../src/lib/education/schemas';

const validVideo = {
  videoId: 'abc123XYZ45',
  title: '範例衛教',
  channel: '台大兒醫',
  channelId: 'UC' + 'a'.repeat(22),
  duration: 245,
  publishedAt: '2024-03-15',
  language: 'zh-Hant' as const,
  subtitleType: 'human' as const,
  sourceTier: 'official-tw' as const,
  viewCount: 12500,
  curatedAt: '2026-05-19',
  verifiedBy: 'claude-code' as const,
  verificationStatus: 'verified' as const,
  score: 0.92,
};

describe('videoCatalogItemSchema', () => {
  it('accepts a valid catalog item', () => {
    expect(videoCatalogItemSchema.parse(validVideo)).toBeDefined();
  });

  it('rejects invalid videoId regex (10 chars)', () => {
    expect(() => videoCatalogItemSchema.parse({ ...validVideo, videoId: 'abc123XYZ4' })).toThrow();
  });

  it('rejects invalid videoId regex (12 chars)', () => {
    expect(() => videoCatalogItemSchema.parse({ ...validVideo, videoId: 'abc123XYZ455' })).toThrow();
  });

  it('rejects invalid channelId regex', () => {
    expect(() => videoCatalogItemSchema.parse({ ...validVideo, channelId: 'NotAChannelId' })).toThrow();
  });

  it('rejects score > 1', () => {
    expect(() => videoCatalogItemSchema.parse({ ...validVideo, score: 1.5 })).toThrow();
  });

  it('strips unknown extra fields (zod v4 default)', () => {
    const parsed = videoCatalogItemSchema.parse({ ...validVideo, foo: 'bar' });
    expect('foo' in parsed).toBe(false);
  });
});

describe('triggerEntrySchema discriminatedUnion', () => {
  it('accepts valid func.triage entry', () => {
    expect(triggerEntrySchema.parse({
      trigger: 'func.triage.consult.18-39',
      category: 'triage',
      triageCategory: 'consult',
      ageGroup: '18-39',
      videoIds: ['abc123XYZ45'],
    })).toBeDefined();
  });

  it('rejects cross-field mismatch (trigger ≠ fields)', () => {
    expect(() => funcTriageEntrySchema.parse({
      trigger: 'func.triage.consult.40-54',
      category: 'triage',
      triageCategory: 'consult',
      ageGroup: '18-39',
      videoIds: [],
    })).toThrow();
  });

  it('accepts func.domain with inapplicable: true', () => {
    expect(triggerEntrySchema.parse({
      trigger: 'func.domain.cognition.low.40-54',
      category: 'domain',
      domain: 'cognition',
      band: 'low',
      ageGroup: '40-54',
      inapplicable: true,
      videoIds: [],
    })).toBeDefined();
  });

  it('rejects func.domain with unknown domain', () => {
    expect(() => funcDomainEntrySchema.parse({
      trigger: 'func.domain.unknown.low.18-39',
      category: 'domain',
      domain: 'unknown',
      band: 'low',
      ageGroup: '18-39',
      videoIds: [],
    })).toThrow();
  });

  it('accepts func.domain with moderate band', () => {
    expect(triggerEntrySchema.parse({
      trigger: 'func.domain.psychological.moderate.55-64',
      category: 'domain',
      domain: 'psychological',
      band: 'moderate',
      ageGroup: '55-64',
      videoIds: [],
    })).toBeDefined();
  });

  it('rejects func.triage with invalid category (not in enum)', () => {
    expect(() => funcTriageEntrySchema.parse({
      trigger: 'func.triage.bogus.18-39',
      category: 'triage',
      triageCategory: 'bogus',
      ageGroup: '18-39',
      videoIds: [],
    })).toThrow();
  });

  it('rejects videoIds with invalid regex', () => {
    expect(() => funcTriageEntrySchema.parse({
      trigger: 'func.triage.observe.18-39',
      category: 'triage',
      triageCategory: 'observe',
      ageGroup: '18-39',
      videoIds: ['SHORT'],
    })).toThrow();
  });

  it('strips extra field on category=domain (zod default strip)', () => {
    const parsed = funcDomainEntrySchema.parse({
      trigger: 'func.domain.vitality.low.18-39',
      category: 'domain',
      domain: 'vitality',
      band: 'low',
      ageGroup: '18-39',
      bogus: 'x',
      videoIds: [],
    });
    expect('bogus' in parsed).toBe(false);
  });
});
