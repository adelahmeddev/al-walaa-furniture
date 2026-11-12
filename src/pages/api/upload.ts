import type { APIRoute } from 'astro';
import { checkAdminAuth, getRuntimeEnv, saveUploadedImage } from '../../utils/db';

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

export const POST: APIRoute = async ({ request, locals }) => {
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
    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return new Response(JSON.stringify({ ok: false, error: 'No image file provided' }), {
        status: 400,
        headers: JSON_HEADERS,
      });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const saved = await saveUploadedImage(db, bytes, file.type || 'image/webp');
    return new Response(JSON.stringify({ ok: true, ...saved }), {
      status: 201,
      headers: JSON_HEADERS,
    });
  } catch (err) {
    console.error('POST /api/upload error:', err);
    return new Response(
      JSON.stringify({ ok: false, error: err instanceof Error ? err.message : 'Upload failed' }),
      { status: 400, headers: JSON_HEADERS }
    );
  }
};
