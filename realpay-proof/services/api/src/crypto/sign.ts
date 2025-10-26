import nacl from 'tweetnacl';
import bs58 from 'bs58';

function toBytes(message: string | Uint8Array): Uint8Array {
  return typeof message === 'string' ? new TextEncoder().encode(message) : message;
}

// TODO: Load keys from a secure KMS or environment configuration.
const envSecretBase58 = process.env.ED25519_SECRET_BASE58;
let keypair: nacl.SignKeyPair;

try {
  if (envSecretBase58) {
    const secret = bs58.decode(envSecretBase58);
    if (secret.length === nacl.sign.secretKeyLength) {
      keypair = nacl.sign.keyPair.fromSecretKey(secret);
    } else if (secret.length === nacl.sign.seedLength) {
      keypair = nacl.sign.keyPair.fromSeed(secret);
    } else {
      keypair = nacl.sign.keyPair();
    }
  } else {
    keypair = nacl.sign.keyPair();
  }
} catch {
  keypair = nacl.sign.keyPair();
}

export const publicKeyBase58 = bs58.encode(keypair.publicKey);

export function sign(message: string | Uint8Array): string {
  const msg = toBytes(message);
  const sig = nacl.sign.detached(msg, keypair.secretKey);
  return bs58.encode(sig);
}

export function verify(message: string | Uint8Array, signatureBase58: string, publicKey?: string): boolean {
  const msg = toBytes(message);
  const sig = bs58.decode(signatureBase58);
  const pk = publicKey ? bs58.decode(publicKey) : keypair.publicKey;
  return nacl.sign.detached.verify(msg, sig, pk);
}


