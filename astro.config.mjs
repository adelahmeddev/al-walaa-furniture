import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';
import cloudflare from '@astrojs/cloudflare';

// Set SITE_URL in Cloudflare Pages environment variables when connecting your custom domain
const siteUrl = (process.env.SITE_URL || 'https://alwalaa-moving.com').replace(/\/$/, '');

// https://astro.build/config
export default defineConfig({
  site: siteUrl,
  output: 'server',
  adapter: cloudflare({
    imageService: 'passthrough',
    platformProxy: {
      enabled: true,
    },
  }),
  integrations: [
    tailwind(),
    sitemap({
      customPages: [`${siteUrl}/`, `${siteUrl}/en/`],
      filter: (page) => !page.includes('/admin') && !page.includes('/api/'),
      i18n: {
        defaultLocale: 'ar',
        locales: {
          ar: 'ar-EG',
          en: 'en-US',
        },
      },
    }),
  ],
});
