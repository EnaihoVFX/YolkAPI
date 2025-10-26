import type { FastifyInstance } from 'fastify';
import { ulid } from 'ulidx';
import { sign, publicKeyBase58 } from '../crypto/sign';
import QRCode from 'qrcode';

type CreateBody = {
  type: 'pay' | 'proof';
  amountPLT?: number;
  routeId?: string;
  hopIndex?: number;
  geoHash?: string;
  expiryUnix?: number;
  memo?: unknown;
};

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    const out: Record<string, unknown> = {};
    for (const [k, v] of entries) out[k] = canonicalize(v);
    return out;
  }
  return value;
}

function buildTagUrl(tid: string): string {
  const base = process.env.TAG_BASE_URL || 'https://example.com/t/';
  return base.endsWith('/') ? base + tid : base + '/' + tid;
}

export default async function tags(app: FastifyInstance) {
  app.post('/create', async (req, reply) => {
    const body = req.body as CreateBody;
    if (!body || (body.type !== 'pay' && body.type !== 'proof')) {
      return reply.code(400).send({ ok: false, error: 'Invalid type' });
    }

    const tid = ulid();
    const exp = typeof body.expiryUnix === 'number' ? body.expiryUnix : Math.floor(Date.now() / 1000) + 3600;
    const url = buildTagUrl(tid);

    const payload: any = { tid, typ: body.type, exp, url };
    if (typeof body.amountPLT === 'number') payload.amt = body.amountPLT;
    if (typeof body.routeId === 'string') payload.rid = body.routeId;
    if (typeof body.hopIndex === 'number') payload.hop = body.hopIndex;
    if (typeof body.geoHash === 'string') payload.geo = body.geoHash;

    const message = JSON.stringify(canonicalize(payload));
    const sig = sign(message);

    return { ok: true, ...payload, sig };
  });

  app.get('/sample/paytag-nft.json', async () => {
    const tid = ulid();
    const tag = {
      tid,
      typ: 'pay',
      amt: 100,
      exp: Math.floor(Date.now() / 1000) + 3600,
      url: buildTagUrl(tid),
    };
    const message = JSON.stringify(canonicalize(tag));
    const sig = sign(message);
    return {
      schema: 'https://schema.realpay/v1/paytag-nft',
      version: '1.0.0',
      tag,
      security: {
        signature: {
          alg: 'ed25519',
          pk: publicKeyBase58,
          sig,
        },
      },
      integrity: {
        meta_root: null,
      },
    };
  });

  app.get('/sample/prooftag-nft.json', async () => {
    const tid = ulid();
    const tag = {
      tid,
      typ: 'proof',
      geo: 'u4pruy',
      exp: Math.floor(Date.now() / 1000) + 3600,
      url: buildTagUrl(tid),
    };
    const message = JSON.stringify(canonicalize(tag));
    const sig = sign(message);
    return {
      schema: 'https://schema.realpay/v1/prooftag-nft',
      version: '1.0.0',
      tag,
      security: {
        signature: {
          alg: 'ed25519',
          pk: publicKeyBase58,
          sig,
        },
      },
      integrity: {
        meta_root: null,
      },
    };
  });

  app.get('/qr/:tid.svg', async (req, reply) => {
    const { tid } = req.params as { tid: string };
    const url = buildTagUrl(tid);
    const svg = await QRCode.toString(url, { type: 'svg', margin: 1, width: 256 });
    reply.header('Content-Type', 'image/svg+xml');
    return svg;
  });
}


