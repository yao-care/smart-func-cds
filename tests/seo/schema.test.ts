import { describe, it, expect } from 'vitest';
import {
  organizationSchema,
  webSiteSchema,
  softwareApplicationSchema,
  medicalWebPageSchema,
  articleListSchema,
  breadcrumbSchema,
  faqPageSchema,
} from '../../src/lib/seo/schema';
import { SITE } from '../../src/lib/seo/site';

const site = new URL('https://smart-func-cds.yao.care/');

describe('organizationSchema', () => {
  it('帶 @type Organization 與機構名', () => {
    const s = organizationSchema(site);
    expect(s['@context']).toBe('https://schema.org');
    expect(s['@type']).toBe('Organization');
    expect(s.name).toBe('yao.care 藥提醒科技');
    expect(s.url).toBe('https://yao.care');
  });
  it('sameAs 為空時不輸出該欄位', () => {
    const s = organizationSchema(site) as Record<string, unknown>;
    expect('sameAs' in s).toBe(false);
  });
});

describe('webSiteSchema', () => {
  it('含 SearchAction，target 指向 /search', () => {
    const s = webSiteSchema(site);
    expect(s['@type']).toBe('WebSite');
    expect(s.name).toBe(SITE.name);
    expect(s.potentialAction['@type']).toBe('SearchAction');
    expect(s.potentialAction.target).toContain('/search?q=');
  });
});

describe('softwareApplicationSchema', () => {
  it('免費 HealthApplication', () => {
    const s = softwareApplicationSchema(site);
    expect(s['@type']).toBe('SoftwareApplication');
    expect(s.applicationCategory).toBe('HealthApplication');
    expect(s.offers.price).toBe('0');
    expect(s.isAccessibleForFree).toBe(true);
  });
});

describe('medicalWebPageSchema', () => {
  const s = medicalWebPageSchema(site, {
    title: '睡眠保健',
    summary: '摘要',
    ageGroups: ['18-39'],
    url: 'https://smart-func-cds.yao.care/education/sleep/',
    publishedAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-02-01'),
  });
  it('MedicalWebPage + 公共衛生 specialty + 病人 audience', () => {
    expect(s['@type']).toBe('MedicalWebPage');
    expect(s.specialty).toBe('PublicHealth');
    expect(s.audience['@type']).toBe('MedicalAudience');
    expect(s.audience.audienceType).toBe('Patient');
  });
  it('日期：dateModified 用 updatedAt，缺則用 publishedAt', () => {
    expect(s.datePublished).toBe('2026-01-01T00:00:00.000Z');
    expect(s.dateModified).toBe('2026-02-01T00:00:00.000Z');
    const s2 = medicalWebPageSchema(site, {
      title: 't', summary: 's', ageGroups: ['40-54'],
      url: 'https://x/', publishedAt: new Date('2026-01-01'),
    });
    expect(s2.dateModified).toBe('2026-01-01T00:00:00.000Z');
  });
});

describe('articleListSchema', () => {
  it('ItemList，position 從 1 起', () => {
    const s = articleListSchema([
      { name: 'A', url: 'https://x/a/' },
      { name: 'B', url: 'https://x/b/' },
    ]);
    expect(s['@type']).toBe('ItemList');
    expect(s.itemListElement[0].position).toBe(1);
    expect(s.itemListElement[1].name).toBe('B');
  });
});

describe('breadcrumbSchema', () => {
  it('BreadcrumbList，含 href 才有 item', () => {
    const s = breadcrumbSchema(site, [
      { label: '首頁', href: '/' },
      { label: '當前' },
    ]);
    expect(s['@type']).toBe('BreadcrumbList');
    expect(s.itemListElement[0].item).toBe('https://smart-func-cds.yao.care/');
    expect('item' in s.itemListElement[1]).toBe(false);
  });
});

describe('faqPageSchema', () => {
  it('FAQPage，每題轉 Question/Answer', () => {
    const s = faqPageSchema([{ question: 'Q1', answer: 'A1' }]);
    expect(s['@type']).toBe('FAQPage');
    expect(s.mainEntity[0]['@type']).toBe('Question');
    expect(s.mainEntity[0].acceptedAnswer.text).toBe('A1');
  });
});

describe('序列化', () => {
  it('所有工廠輸出可 JSON.stringify', () => {
    expect(() => JSON.stringify([
      organizationSchema(site), webSiteSchema(site),
      softwareApplicationSchema(site),
    ])).not.toThrow();
  });
});
