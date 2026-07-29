const ID = /^(?:\d{10}|cons-\d+-\d{3})\.pdf$/;

function rangeFrom(request, size) {
  const value = request.headers.get('Range');
  if (!value) return null;
  const match = value.match(/^bytes=(\d*)-(\d*)$/);
  if (!match) return 'invalid';
  const start = match[1] ? Number(match[1]) : null;
  const end = match[2] ? Number(match[2]) : null;
  if (start == null && end == null) return 'invalid';
  if (start == null) {
    const length = Math.min(end, size);
    return { offset: size - length, length };
  }
  if (start >= size) return 'invalid';
  const last = end == null ? size - 1 : Math.min(end, size - 1);
  if (last < start) return 'invalid';
  return { offset: start, length: last - start + 1 };
}

export async function onRequest(context) {
  const id = context.params.id;
  if (typeof id !== 'string' || !ID.test(id)) return new Response('Not found', { status: 404 });
  const key = `foreignlaw/pdf/${id}`;
  const head = await context.env.FOREIGNLAW_PDFS.head(key);
  if (!head) return new Response('Not found', { status: 404 });
  const range = rangeFrom(context.request, head.size);
  if (range === 'invalid') {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${head.size}` } });
  }
  const headers = new Headers({
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Content-Disposition': 'inline',
    'Content-Type': 'application/pdf',
    ETag: head.httpEtag,
  });
  if (context.request.method === 'HEAD') {
    headers.set('Content-Length', String(head.size));
    return new Response(null, { headers });
  }
  const object = await context.env.FOREIGNLAW_PDFS.get(key, range ? { range } : undefined);
  if (!object) return new Response('Not found', { status: 404 });
  if (range) {
    headers.set('Content-Length', String(range.length));
    headers.set('Content-Range', `bytes ${range.offset}-${range.offset + range.length - 1}/${head.size}`);
    return new Response(object.body, { status: 206, headers });
  }
  headers.set('Content-Length', String(head.size));
  return new Response(object.body, { headers });
}
