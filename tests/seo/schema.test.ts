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

const ORG_ID = 'https://www.yao.care/#organization';

describe('organizationSchema', () => {
  it('公司節點帶官網的 @id 與法律登記名稱', () => {
    const s = organizationSchema();
    expect(s['@context']).toBe('https://schema.org');
    expect(s['@type']).toEqual(['Organization', 'MedicalOrganization']);
    expect(s['@id']).toBe(ORG_ID);
    expect(s.name).toBe('yao.care');
    expect(s.legalName).toBe('藥提醒科技有限公司');
    expect(s.url).toBe('https://www.yao.care');
    expect(s.taxID).toBe('83620786');
  });
  it('@id 用官網網域，不用本站網域', () => {
    // 各站若用自己的 #organization，實體圖會裂成多個不相干的公司。
    expect(organizationSchema()['@id']).not.toContain('smart-func-cds');
  });
});

describe('公司只定義一次、其餘節點以 @id 參照', () => {
  it('WebSite / SoftwareApplication / FAQPage 的 publisher 是純參照', () => {
    const nodes = [
      webSiteSchema(site),
      softwareApplicationSchema(site),
      faqPageSchema([{ question: 'Q', answer: 'A' }]),
      medicalWebPageSchema(site, {
        title: 't', summary: 's', ageGroups: ['18-39'],
        url: 'https://x/', publishedAt: new Date('2026-01-01'),
      }),
    ] as Array<Record<string, any>>;
    for (const n of nodes) {
      expect(n.publisher).toEqual({ '@id': ORG_ID });
      expect(JSON.stringify(n)).not.toContain('藥提醒科技有限公司');
    }
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
  it('帶自己的 @id 與官網產品頁 sameAs', () => {
    const s = softwareApplicationSchema(site);
    expect(s['@id']).toBe('https://smart-func-cds.yao.care/#software');
    expect(s.sameAs).toContain('https://www.yao.care/medical/func/');
    expect(s.sameAs).toContain('https://github.com/yao-care/smart-func-cds');
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
      organizationSchema(), webSiteSchema(site),
      softwareApplicationSchema(site),
    ])).not.toThrow();
  });
});
