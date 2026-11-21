import type { APIRoute } from 'astro';
import { getRuntimeEnv, getUploadedFileRange } from '../../../utils/db';

export const GET: APIRoute = async ({ params, locals, request }) => {
  try {
    const { db } = getRuntimeEnv(locals);
    const id = String(params.id || '').trim();

    if (!db || !id) {
      return new Response('Not Found', { status: 404 });
    }

    const rangeHeader = request.headers.get('Range');
    let startByte = 0;
    let endByte: number | undefined = undefined;
    let isRange = false;

    if (rangeHeader && rangeHeader.startsWith('bytes=')) {
      isRange = true;
      const parts = rangeHeader.replace('bytes=', '').split('-');
      startByte = parseInt(parts[0], 10) || 0;
      if (parts[1] && parts[1].trim() !== '') {
        endByte = parseInt(parts[1], 10);
      }
    }

    const file = await getUploadedFileRange(db, id, startByte, endByte);
    if (!file) {
      return new Response('Not Found', { status: 404 });
    }

    const isVideo = file.mimeType.startsWith('video/');
    const chunkLength = file.data.byteLength;

    if (isRange || isVideo) {
      return new Response(file.data as unknown as BodyInit, {
        status: 206,
        headers: {
          'Content-Type': file.mimeType,
          'Content-Range': `bytes ${file.start}-${file.end}/${file.totalLength}`,
          'Content-Length': String(chunkLength),
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    }

    return new Response(file.data as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': file.mimeType,
        'Content-Length': String(file.totalLength),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (err) {
    console.error(`GET /api/images/${params.id} error:`, err);
    return new Response(err instanceof Error ? err.message : 'Internal Server Error', {
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
};
