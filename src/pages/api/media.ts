import type { APIRoute } from 'astro';
import { checkAdminAuth, getMediaItems, getRuntimeEnv, replaceMediaItems } from '../../utils/db';

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

export const GET: APIRoute = async ({ locals }) => {
  const { db } = getRuntimeEnv(locals);
  const items = await getMediaItems(db);
  return new Response(JSON.stringify({ items, dbConnected: Boolean(db) }), {
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
    const payload = (await request.json()) as { items?: unknown };
    if (!Array.isArray(payload?.items)) {
      return new Response(JSON.stringify({ ok: false, error: 'Invalid items array' }), {
        status: 400,
        headers: JSON_HEADERS,
      });
    }
    const items = await replaceMediaItems(db, payload.items);
    return new Response(JSON.stringify({ ok: true, items }), {
      status: 200,
      headers: JSON_HEADERS,
    });
  } catch (err) {
    console.error('PUT /api/media error:', err);
    return new Response(JSON.stringify({ ok: false, error: 'Failed to save media items' }), {
      status: 400,
      headers: JSON_HEADERS,
    });
  }
};
