import { SITE } from './site';

const CONTEXT = 'https://schema.org';
const abs = (site: URL, path: string) => new URL(path, site).href;

const ORG = SITE.organization;

/**
 * 公司節點的完整定義。每頁只由 Base.astro 輸出一次，其他節點一律以 orgRef 參照，
 * 不再內嵌整包 Organization——同一份資料重複多份會讓抓取器認不出是同一個實體。
 */
function organizationNode() {
  return {
    '@type': ['Organization', 'MedicalOrganization'],
    '@id': ORG.id,
    name: ORG.name,
    legalName: ORG.legalName,
    alternateName: ORG.alternateName,
    url: ORG.url,
    taxID: ORG.taxID,
    email: ORG.email,
    logo: { '@type': 'ImageObject', url: ORG.logoUrl },
    address: { '@type': 'PostalAddress', ...ORG.address },
    sameAs: [...ORG.sameAs],
  };
}

/** 對公司節點的參照，供 publisher / author / creator / copyrightHolder 使用。 */
const orgRef = { '@id': ORG.id };

export function organizationSchema() {
  return { '@context': CONTEXT, ...organizationNode() };
}

export function webSiteSchema(site: URL) {
  return {
    '@context': CONTEXT,
    '@type': 'WebSite',
    name: SITE.name,
    url: abs(site, '/'),
    inLanguage: SITE.inLanguage,
    publisher: orgRef,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${abs(site, '/search')}?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}

export function softwareApplicationSchema(site: URL) {
  return {
    '@context': CONTEXT,
    '@type': 'SoftwareApplication',
    '@id': SITE.softwareId,
    name: SITE.name,
    applicationCategory: 'HealthApplication',
    operatingSystem: 'Web',
    url: abs(site, '/'),
    inLanguage: SITE.inLanguage,
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'TWD' },
    sameAs: SITE.sameAs,
    publisher: orgRef,
    author: orgRef,
    creator: orgRef,
    copyrightHolder: orgRef,
  };
}

interface MedicalWebPageInput {
  title: string;
  summary: string;
  ageGroups: string[];
  url: string;
  publishedAt: Date;
  updatedAt?: Date;
}

export function medicalWebPageSchema(site: URL, input: MedicalWebPageInput) {
  const modified = (input.updatedAt ?? input.publishedAt).toISOString();
  return {
    '@context': CONTEXT,
    '@type': 'MedicalWebPage',
    name: input.title,
    description: input.summary,
    url: input.url,
    inLanguage: SITE.inLanguage,
    specialty: 'PublicHealth',
    audience: { '@type': 'MedicalAudience', audienceType: 'Patient' },
    isPartOf: { '@type': 'WebSite', name: SITE.name, url: abs(site, '/') },
    publisher: orgRef,
    author: orgRef,
    datePublished: input.publishedAt.toISOString(),
    dateModified: modified,
    lastReviewed: modified,
  };
}

export function articleListSchema(articles: { name: string; url: string }[]) {
  return {
    '@context': CONTEXT,
    '@type': 'ItemList',
    itemListElement: articles.map((a, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: a.name,
      url: a.url,
    })),
  };
}

export function breadcrumbSchema(site: URL, items: { label: string; href?: string }[]) {
  return {
    '@context': CONTEXT,
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.label,
      ...(item.href ? { item: abs(site, item.href) } : {}),
    })),
  };
}

export function faqPageSchema(faqs: { question: string; answer: string }[]) {
  return {
    '@context': CONTEXT,
    '@type': 'FAQPage',
    publisher: orgRef,
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  };
}
