import type { APIRoute } from 'astro';
import { getBlogPosts, getRuntimeEnv } from '../utils/db';

export const GET: APIRoute = async ({ locals, site }) => {
  const { db } = getRuntimeEnv(locals);
  const siteOrigin = (site?.toString() || process.env.SITE_URL || 'https://alwalaamoving.com').replace(/\/$/, '');

  const [arPosts, enPosts] = await Promise.all([
    getBlogPosts(db, { lang: 'ar', publishedOnly: true }),
    getBlogPosts(db, { lang: 'en', publishedOnly: true }),
  ]);

  const now = new Date().toISOString().split('T')[0];

  const staticUrls = [
    {
      loc: `${siteOrigin}/`,
      lastmod: now,
      changefreq: 'daily',
      priority: '1.0',
      arAlt: `${siteOrigin}/`,
      enAlt: `${siteOrigin}/en/`,
    },
    {
      loc: `${siteOrigin}/en/`,
      lastmod: now,
      changefreq: 'daily',
      priority: '0.9',
      arAlt: `${siteOrigin}/`,
      enAlt: `${siteOrigin}/en/`,
    },
    {
      loc: `${siteOrigin}/blog`,
      lastmod: now,
      changefreq: 'daily',
      priority: '0.9',
      arAlt: `${siteOrigin}/blog`,
      enAlt: `${siteOrigin}/en/blog`,
    },
    {
      loc: `${siteOrigin}/en/blog`,
      lastmod: now,
      changefreq: 'daily',
      priority: '0.8',
      arAlt: `${siteOrigin}/blog`,
      enAlt: `${siteOrigin}/en/blog`,
    },
  ];

  const blogUrls = [
    ...arPosts.map((post) => ({
      loc: `${siteOrigin}/blog/${post.slug}`,
      lastmod: (post.updatedAt || post.createdAt || now).split('T')[0],
      changefreq: 'weekly',
      priority: '0.8',
      arAlt: `${siteOrigin}/blog/${post.slug}`,
      enAlt: `${siteOrigin}/en/blog`,
    })),
    ...enPosts.map((post) => ({
      loc: `${siteOrigin}/en/blog/${post.slug}`,
      lastmod: (post.updatedAt || post.createdAt || now).split('T')[0],
      changefreq: 'weekly',
      priority: '0.7',
      arAlt: `${siteOrigin}/blog`,
      enAlt: `${siteOrigin}/en/blog/${post.slug}`,
    })),
  ];

  const allUrls = [...staticUrls, ...blogUrls];

  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${allUrls
  .map(
    (u) => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
    <xhtml:link rel="alternate" hreflang="ar" href="${u.arAlt}" />
    <xhtml:link rel="alternate" hreflang="en" href="${u.enAlt}" />
  </url>`
  )
  .join('\n')}
</urlset>`;

  return new Response(sitemapXml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
};
