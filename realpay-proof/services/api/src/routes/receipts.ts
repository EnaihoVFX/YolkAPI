import type { FastifyInstance } from 'fastify';
import { rpc, REALPAY } from '../concordium/client';

// Simple in-memory store for recent receipts (stub). TODO: replace with DB.
const recent: any[] = [];

export default async function receipts(app: FastifyInstance) {
  app.get('/recent', async (req) => {
    const nRaw = (req.query as any)?.n;
    const n = Math.max(1, Math.min(100, Number(nRaw ?? 10)));
    return recent.slice(-n).reverse();
  });

  app.get('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!id) return reply.code(400).send({ ok: false, error: 'Missing id' });

    try {
      const parameter: Uint8Array = new TextEncoder().encode(JSON.stringify(id));
      const energy = 50000;
      const result = await (rpc as any).invokeContract({
        contract: REALPAY.address,
        method: 'realpay.get_receipt',
        invoker: 'anonymous',
        parameter,
        energy,
      });

      return { ok: true, data: result ?? null };
    } catch (err) {
      app.log.error({ err, id }, 'get_receipt failed');
      return reply.code(500).send({ ok: false });
    }
  });
}

// Optional helper to push into recent from other modules.
export function _pushRecent(r: any) {
  recent.push(r);
  if (recent.length > 1000) recent.shift();
}


