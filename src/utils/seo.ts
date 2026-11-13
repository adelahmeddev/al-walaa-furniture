import { getInitialSettings, type SiteSettings } from './settings';
import { ui } from '../i18n/ui';
import type { BlogPost, BlogFaqItem } from '../data/blog-posts';

export interface BreadcrumbItem {
  name: string;
  url?: string;
}

export function buildBlogPostSchema(
  post: BlogPost,
  siteOrigin: string,
  pageUrl: string
): Record<string, unknown> {
  const isAr = post.lang === 'ar';
  const orgId = `${siteOrigin}/#organization`;
  const coverUrl = post.coverImage.startsWith('http')
    ? post.coverImage
    : `${siteOrigin}${post.coverImage.startsWith('/') ? '' : '/'}${post.coverImage}`;

  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    '@id': `${pageUrl}#article`,
    headline: post.title,
    description: post.description || post.excerpt,
    image: [coverUrl],
    datePublished: post.createdAt,
    dateModified: post.updatedAt || post.createdAt,
    inLanguage: isAr ? 'ar-EG' : 'en-US',
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': pageUrl,
    },
    author: {
      '@type': 'Organization',
      name: isAr ? 'فريق خبراء شركة الولاء لنقل الأثاث' : 'Al Walaa Moving Specialists',
      url: siteOrigin,
    },
    publisher: {
      '@type': 'Organization',
      '@id': orgId,
      name: isAr ? 'شركة الولاء لنقل الأثاث' : 'Al Walaa Furniture Moving',
      logo: {
        '@type': 'ImageObject',
        url: `${siteOrigin}/logo.jpg`,
      },
    },
    keywords: post.tags ? post.tags.join(', ') : undefined,
    articleSection: post.category,
  };
}

export function buildBlogFaqSchema(faq: BlogFaqItem[]): Record<string, unknown> | null {
  if (!faq || faq.length === 0) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}

export function buildBreadcrumbSchema(
  items: BreadcrumbItem[],
  siteOrigin: string
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => {
      const fullUrl = item.url
        ? item.url.startsWith('http')
          ? item.url
          : `${siteOrigin}${item.url.startsWith('/') ? '' : '/'}${item.url}`
        : siteOrigin;

      return {
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        item: fullUrl,
      };
    }),
  };
}

export function buildSeoSchemas(
  lang: 'ar' | 'en',
  siteOrigin: string,
  pageUrl: string,
  settings: SiteSettings = getInitialSettings()
) {
  const isAr = lang === 'ar';
  const orgId = `${siteOrigin}/#organization`;
  const dict = ui[lang] as Record<string, string>;

  const validSocials = Object.values(settings.social || {}).filter(
    (url) =>
      typeof url === 'string' &&
      url.startsWith('http') &&
      !['https://www.facebook.com/', 'https://www.instagram.com/'].includes(url)
  );

  const movingCompanySchema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'MovingCompany',
    '@id': orgId,
    name: isAr ? 'شركة الولاء لنقل الأثاث' : 'Al Walaa Furniture Moving',
    alternateName: isAr ? 'Al Walaa Furniture Moving' : 'شركة الولاء لنقل الأثاث',
    description: isAr
      ? 'شركة نقل عفش وتغليف وفك وتركيب أثاث في القاهرة والجيزة وجميع محافظات مصر مع أوناش رفع هيدروليكية حتى الدور 20 وضمان مكتوب.'
      : 'Professional furniture moving, 5-layer packing, carpentry reassembly, and hydraulic hoisting up to floor 20 across Cairo and Egypt.',
    url: siteOrigin,
    logo: `${siteOrigin}/logo.jpg`,
    image: [
      `${siteOrigin}/og-image.jpg`,
      `${siteOrigin}/media/hero-moving-egypt.jpg`,
    ],
    telephone: `+${settings.phone}`,
    priceRange: '$$',
    address: {
      '@type': 'PostalAddress',
      addressLocality: isAr ? 'القاهرة' : 'Cairo',
      addressRegion: isAr ? 'القاهرة' : 'Cairo',
      addressCountry: 'EG',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: 30.0444,
      longitude: 31.2357,
    },
    areaServed: [
      { '@type': 'City', name: isAr ? 'القاهرة' : 'Cairo' },
      { '@type': 'City', name: isAr ? 'الجيزة' : 'Giza' },
      { '@type': 'City', name: isAr ? 'مدينة نصر' : 'Nasr City' },
      { '@type': 'City', name: isAr ? 'التجمع الخامس' : 'New Cairo' },
      { '@type': 'City', name: isAr ? 'المعادي' : 'Maadi' },
      { '@type': 'City', name: isAr ? '6 أكتوبر' : '6th of October' },
      { '@type': 'City', name: isAr ? 'الشيخ زايد' : 'Sheikh Zayed' },
      { '@type': 'City', name: isAr ? 'الإسكندرية' : 'Alexandria' },
      { '@type': 'Country', name: isAr ? 'مصر' : 'Egypt' },
    ],
    openingHoursSpecification: {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: [
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
        'Sunday',
      ],
      opens: '00:00',
      closes: '23:59',
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.9',
      reviewCount: '1200',
      bestRating: '5',
      worstRating: '1',
    },
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: isAr ? 'خدمات نقل وتغليف الأثاث' : 'Furniture Moving & Packing Services',
      itemListElement: [
        {
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Service',
            name: dict['services.local'],
            description: dict['services.local.desc'],
            provider: { '@id': orgId },
          },
        },
        {
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Service',
            name: dict['services.heavy'],
            description: dict['services.heavy.desc'],
            provider: { '@id': orgId },
          },
        },
        {
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Service',
            name: dict['services.pack'],
            description: dict['services.pack.desc'],
            provider: { '@id': orgId },
          },
        },
        {
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Service',
            name: dict['services.install'],
            description: dict['services.install.desc'],
            provider: { '@id': orgId },
          },
        },
        {
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Service',
            name: dict['services.cities'],
            description: dict['services.cities.desc'],
            provider: { '@id': orgId },
          },
        },
        {
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Service',
            name: dict['services.storage'],
            description: dict['services.storage.desc'],
            provider: { '@id': orgId },
          },
        },
      ],
    },
  };

  if (validSocials.length > 0) {
    movingCompanySchema.sameAs = validSocials;
  }

  const faqEntries = [];
  for (let i = 1; i <= 10; i++) {
    const q = dict[`faq.q${i}`];
    const a = dict[`faq.a${i}`];
    if (q && a) {
      faqEntries.push({
        '@type': 'Question',
        name: q,
        acceptedAnswer: {
          '@type': 'Answer',
          text: a,
        },
      });
    }
  }

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqEntries,
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: isAr ? 'الرئيسية — نقل عفش بالقاهرة ومصر' : 'Home — Furniture Moving Egypt',
        item: pageUrl,
      },
    ],
  };

  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: isAr ? 'شركة الولاء لنقل الأثاث' : 'Al Walaa Furniture Moving',
    url: siteOrigin,
    inLanguage: isAr ? 'ar-EG' : 'en-US',
    publisher: { '@id': orgId },
  };

  return [websiteSchema, movingCompanySchema, faqSchema, breadcrumbSchema];
}
