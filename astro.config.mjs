import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';

// Set SITE_URL in Cloudflare Pages environment variables when connecting your custom domain
const siteUrl = process.env.SITE_URL || 'https://alwalaa-moving.com';

// https://astro.build/config
export default defineConfig({
  site: siteUrl,
  integrations: [
    tailwind(),
    sitemap({
      filter: (page) => !page.includes('/admin'),
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
