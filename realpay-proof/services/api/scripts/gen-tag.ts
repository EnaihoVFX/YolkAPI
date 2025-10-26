import { ulid } from 'ulidx';
import QRCode from 'qrcode';
import { sign, publicKeyBase58 } from '../src/crypto/sign';
import { writeFileSync } from 'node:fs';

type Args = {
  type: 'pay' | 'proof';
  amountPLT?: number;
  routeId?: string;
  hopIndex?: number;
  geoHash?: string;
  expiryUnix?: number;
  out?: string;
  qr?: string;
};

function parseArgs(): Args {
  const args: any = {};
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    const [k, v] = a.startsWith('--') ? a.slice(2).split('=') : [a, undefined];
    switch (k) {
      case 'type': args.type = (v ?? process.argv[++i]) as any; break;
      case 'amount':
      case 'amountPLT': args.amountPLT = Number(v ?? process.argv[++i]); break;
      case 'routeId': args.routeId = String(v ?? process.argv[++i]); break;
      case 'hopIndex': args.hopIndex = Number(v ?? process.argv[++i]); break;
      case 'geo':
      case 'geoHash': args.geoHash = String(v ?? process.argv[++i]); break;
      case 'expiry':
      case 'expiryUnix': args.expiryUnix = Number(v ?? process.argv[++i]); break;
      case 'out': args.out = String(v ?? process.argv[++i]); break;
      case 'qr': args.qr = String(v ?? process.argv[++i]); break;
    }
  }
  if (args.type !== 'pay' && args.type !== 'proof') args.type = 'pay';
  return args as Args;
}

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

async function main() {
  const args = parseArgs();
  const tid = ulid();
  const exp = typeof args.expiryUnix === 'number' && !Number.isNaN(args.expiryUnix)
    ? args.expiryUnix
    : Math.floor(Date.now() / 1000) + 3600;
  const url = buildTagUrl(tid);

  const payload: any = { tid, typ: args.type, exp, url };
  if (typeof args.amountPLT === 'number') payload.amt = args.amountPLT;
  if (typeof args.routeId === 'string') payload.rid = args.routeId;
  if (typeof args.hopIndex === 'number') payload.hop = args.hopIndex;
  if (typeof args.geoHash === 'string') payload.geo = args.geoHash;

  const message = JSON.stringify(canonicalize(payload));
  const sig = sign(message);
  const result = { ok: true, ...payload, sig, pk: publicKeyBase58 };

  if (args.out) {
    writeFileSync(args.out, JSON.stringify(result, null, 2));
  } else {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(result, null, 2));
  }

  if (args.qr) {
    const svg = await QRCode.toString(url, { type: 'svg', margin: 1, width: 256 });
    writeFileSync(args.qr, svg);
  }
}

void main();


