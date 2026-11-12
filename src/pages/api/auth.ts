import type { APIRoute } from 'astro';
import { checkAdminAuth, getRuntimeEnv } from '../../utils/db';

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

export const POST: APIRoute = async ({ request, locals }) => {
  const { adminKey } = getRuntimeEnv(locals);

  let keyFromBody = '';
  try {
    const body = (await request.json()) as { key?: string };
    keyFromBody = String(body?.key || '');
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid JSON payload' }), {
      status: 400,
      headers: JSON_HEADERS,
    });
  }

  const fakeReq = new Request(request.url, {
    headers: { 'x-admin-key': keyFromBody },
  });

  if (!checkAdminAuth(fakeReq, adminKey)) {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid access key' }), {
      status: 401,
      headers: JSON_HEADERS,
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: JSON_HEADERS,
  });
};
