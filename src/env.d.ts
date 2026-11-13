/// <reference types="astro/client" />
import type { D1Database } from '@cloudflare/workers-types';
import type { Runtime } from '@astrojs/cloudflare';

declare global {
  namespace App {
    interface Locals extends Runtime<{
      DB?: D1Database;
      ADMIN_KEY?: string;
    }> {}
  }
}
