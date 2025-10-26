import { createHash } from 'node:crypto';

export function sha256(input: string | Uint8Array | Buffer): string {
  const hash = createHash('sha256');
  if (typeof input === 'string') {
    hash.update(Buffer.from(input));
  } else {
    hash.update(Buffer.from(input));
  }
  return '0x' + hash.digest('hex');
}


