import { defineMiddleware } from 'astro/middleware';
import { getRuntimeEnv, recordPageVisit } from './utils/db';

const IGNORED_PATH_PREFIXES = ['/api/', '/admin', '/_astro/', '/_image', '/media/'];

export const onRequest = defineMiddleware(async (context, next) => {
  const response = await next();

  if (context.request.method !== 'GET') {
    return response;
  }

  if (response.status < 200 || response.status >= 400) {
    return response;
  }

  const { pathname } = new URL(context.request.url);
  if (
    IGNORED_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
    /\.[a-z0-9]+$/i.test(pathname)
  ) {
    return response;
  }

  const { db } = getRuntimeEnv(context.locals);
  if (!db) {
    return response;
  }

  const reqWithCf = context.request as Request & {
    cf?: { city?: unknown; country?: unknown };
  };
  const runtimeCf = (context.locals as { runtime?: { cf?: { city?: unknown; country?: unknown }; ctx?: { waitUntil?: (p: Promise<unknown>) => void } } }).runtime?.cf;

  const city = String(
    reqWithCf.cf?.city ||
      runtimeCf?.city ||
      context.request.headers.get('cf-ipcity') ||
      ''
  );
  const country = String(
    reqWithCf.cf?.country ||
      runtimeCf?.country ||
      context.request.headers.get('cf-ipcountry') ||
      ''
  );
  const userAgent = context.request.headers.get('user-agent') || '';

  const promise = recordPageVisit(db, {
    path: pathname,
    city,
    country,
    userAgent,
  });

  const ctx = (context.locals as { runtime?: { ctx?: { waitUntil?: (p: Promise<unknown>) => void } } }).runtime?.ctx;
  if (ctx && typeof ctx.waitUntil === 'function') {
    ctx.waitUntil(promise);
  } else {
    await promise;
  }

  return response;
});
