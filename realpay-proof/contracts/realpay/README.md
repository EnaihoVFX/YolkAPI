## Build & Deploy (Concordium)

Follow these steps to build the contract Wasm and deploy with Concordium tools:

1) Install the Wasm target for Rust

```bash
rustup target add wasm32-unknown-unknown
```

2) Install cargo-concordium

```bash
cargo install cargo-concordium
```

3) Build the contract Wasm and schema

```bash
cargo concordium build --out realpay.wasm.v1 --schema-out schema.bin
```

4) Deploy and initialize using concordium-client

Use `concordium-client` to deploy the module and initialize the `realpay` contract.
After initialization, record `CONTRACT_INDEX` and `SUBINDEX` in `services/api/.env` for the API to reference.
