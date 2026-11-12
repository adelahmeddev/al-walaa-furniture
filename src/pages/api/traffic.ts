import type { APIRoute } from 'astro';
import { checkAdminAuth, getRuntimeEnv, getTrafficStats } from '../../utils/db';

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

export const GET: APIRoute = async ({ request, url, locals }) => {
  const { db, adminKey } = getRuntimeEnv(locals);

  if (!checkAdminAuth(request, adminKey)) {
    return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
      status: 401,
      headers: JSON_HEADERS,
    });
  }

  const range = url.searchParams.get('range') || '7d';
  const stats = await getTrafficStats(db, range);

  return new Response(
    JSON.stringify({
      ok: true,
      dbConnected: Boolean(db),
      ...stats,
    }),
    {
      status: 200,
      headers: JSON_HEADERS,
    }
  );
};
