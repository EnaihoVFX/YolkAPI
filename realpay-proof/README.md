# realpay-proof

A blockchain-based proof-of-delivery system with Concordium integration.

- apps/dashboard: Next.js dashboard with Tailwind and shadcn/ui
- services/api: Fastify TypeScript backend with Concordium blockchain integration
- contracts/realpay: Concordium smart contract

## Prerequisites

- Node 18+, pnpm 9+
- Rust + Cargo (for smart contracts)
- Concordium blockchain access

## Setup

1. Install dependencies across the workspace:

```bash
pnpm install
```

2. Configure environment variables (optional):

```bash
# Copy environment template
cp services/api/.env.example services/api/.env

# Edit with your Concordium contract details
CONTRACT_INDEX=1234
CONTRACT_SUBINDEX=0
CCD_NODE=https://json-rpc.testnet.concordium.com
CONTRACT_INVOKER=realpay-invoker
```

3. Build smart contract:

```bash
cd contracts/realpay
cargo concordium build --out realpay.wasm.v1 --schema-out schema.bin
```

## Run locally

Start all services:

```bash
pnpm dev
```

Or run individual packages:

```bash
# Dashboard (Next.js)
pnpm --filter @realpay/dashboard dev

# API (Fastify)
pnpm --filter @realpay/api dev
```

## Build

Build all packages:

```bash
pnpm build
```

The system includes realistic blockchain simulation with Concordium integration for demonstration purposes.
