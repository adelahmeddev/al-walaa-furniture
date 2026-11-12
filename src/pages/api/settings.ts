import type { APIRoute } from 'astro';
import { checkAdminAuth, getRuntimeEnv, getSiteSettings, saveSiteSettings } from '../../utils/db';
import type { SiteSettings } from '../../utils/settings';

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

export const GET: APIRoute = async ({ locals }) => {
  const { db } = getRuntimeEnv(locals);
  const settings = await getSiteSettings(db);
  return new Response(JSON.stringify({ settings, dbConnected: Boolean(db) }), {
    status: 200,
    headers: JSON_HEADERS,
  });
};

export const PUT: APIRoute = async ({ request, locals }) => {
  const { db, adminKey } = getRuntimeEnv(locals);

  if (!checkAdminAuth(request, adminKey)) {
    return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
      status: 401,
      headers: JSON_HEADERS,
    });
  }

  if (!db) {
    return new Response(
      JSON.stringify({ ok: false, error: 'Cloudflare D1 binding (DB) is not configured' }),
      { status: 503, headers: JSON_HEADERS }
    );
  }

  try {
    const payload = (await request.json()) as Partial<SiteSettings>;
    const settings = await saveSiteSettings(db, payload);
    return new Response(JSON.stringify({ ok: true, settings }), {
      status: 200,
      headers: JSON_HEADERS,
    });
  } catch (err) {
    console.error('PUT /api/settings error:', err);
    return new Response(JSON.stringify({ ok: false, error: 'Failed to save settings' }), {
      status: 400,
      headers: JSON_HEADERS,
    });
  }
};
