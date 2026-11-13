import type { APIRoute } from 'astro';
import { getBlogPosts, getRuntimeEnv } from '../utils/db';

export const GET: APIRoute = async ({ locals, site }) => {
  const { db } = getRuntimeEnv(locals);
  const siteOrigin = (site?.toString() || process.env.SITE_URL || 'https://alwalaamoving.com').replace(/\/$/, '');

  const posts = await getBlogPosts(db, { lang: 'ar', publishedOnly: true, limit: 20 });

  const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>شركة الولاء لنقل وتغليف الأثاث — مدونة النقل</title>
    <link>${siteOrigin}/blog</link>
    <description>دليل ومقالات متخصصة عن أسعار نقل العفش، أوناش الرفع الهيدروليكية، وخطوات التغليف الفندقي في مصر.</description>
    <language>ar-EG</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${siteOrigin}/rss.xml" rel="self" type="application/rss+xml" />
${posts
  .map(
    (post) => `    <item>
      <title><![CDATA[${post.title}]]></title>
      <link>${siteOrigin}/blog/${post.slug}</link>
      <guid isPermaLink="true">${siteOrigin}/blog/${post.slug}</guid>
      <description><![CDATA[${post.description || post.excerpt}]]></description>
      <pubDate>${new Date(post.createdAt).toUTCString()}</pubDate>
    </item>`
  )
  .join('\n')}
  </channel>
</rss>`;

  return new Response(rssXml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
};
