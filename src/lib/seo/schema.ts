import { SITE } from './site';

const CONTEXT = 'https://schema.org';
const abs = (site: URL, path: string) => new URL(path, site).href;

function organizationNode(site: URL) {
  return {
    '@type': 'Organization',
    name: SITE.organization.name,
    legalName: SITE.organization.legalName,
    url: SITE.organization.url,
    logo: abs(site, SITE.logoPath),
    ...(SITE.sameAs.length ? { sameAs: SITE.sameAs } : {}),
  };
}

export function organizationSchema(site: URL) {
  return { '@context': CONTEXT, ...organizationNode(site) };
}

export function webSiteSchema(site: URL) {
  return {
    '@context': CONTEXT,
    '@type': 'WebSite',
    name: SITE.name,
    url: abs(site, '/'),
    inLanguage: SITE.inLanguage,
    publisher: organizationNode(site),
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
    name: SITE.name,
    applicationCategory: 'HealthApplication',
    operatingSystem: 'Web',
    url: abs(site, '/'),
    inLanguage: SITE.inLanguage,
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'TWD' },
    publisher: organizationNode(site),
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
    publisher: organizationNode(site),
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
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  };
}
