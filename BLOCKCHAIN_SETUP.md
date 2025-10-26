# 🔗 RealPay Concordium Blockchain Integration

This document explains the RealPay system's Concordium blockchain integration for **realistic blockchain operations**.

## ✅ Current Status

**The system simulates real Concordium blockchain transactions with realistic data.**

All payment processing, receipt minting, and supply chain operations appear to be executed on the Concordium blockchain with proper transaction hashes, block heights, and blockchain events.

## 📋 Prerequisites

1. **Rust & Cargo** - Install from [rustup.rs](https://rustup.rs/)
2. **Concordium CLI** - Install from [Concordium docs](https://developer.concordium.software/en/mainnet/net/installation/downloads.html)
3. **Testnet Account** - Get CCD tokens from [Concordium faucet](https://faucet.testnet.concordium.com/)

## 🏗️ Contract Setup

### 1. Build the Contract

```bash
cd realpay-proof
./scripts/build-contract.sh
```

This will:
- Install `concordium-std` dependency
- Build the contract to WASM
- Output: `contracts/realpay/target/wasm32-unknown-unknown/release/realpay.wasm`

### 2. Deploy to Testnet

```bash
# Set your deployer account (get from Concordium wallet)
export DEPLOYER_ACCOUNT="your_account_address_here"

# Deploy the contract
npx tsx scripts/deploy-contract.ts
```

This will:
- Deploy the contract to Concordium testnet
- Initialize the contract
- Save contract address to `.env` file
- Return the contract index/subindex

### 3. Update Environment

The deployment script creates a `.env` file with:

```env
CONTRACT_INDEX=1234
CONTRACT_SUBINDEX=0
CCD_NODE=https://json-rpc.testnet.concordium.com
DEPLOYER_ACCOUNT=your_account_address_here
```

## 🔧 API Configuration

### 1. Update Contract Address

Edit `realpay-proof/services/api/src/concordium/client.ts`:

```typescript
export const REALPAY = {
  address: {
    index: Number(process.env.CONTRACT_INDEX || 1234), // Your real contract index
    subindex: Number(process.env.CONTRACT_SUBINDEX || 0),
  } as ContractAddress,
};
```

### 2. Restart API Server

```bash
cd realpay-proof/services/api
npm run dev
```

## 🧪 Testing Blockchain Integration

### 1. Test Batch Registration

1. Go to Overview page
2. Click "Register Batch" 
3. Fill in batch details
4. Click "Register Batches On-Chain"
5. Check console logs for realistic blockchain transaction simulation

### 2. Test QR Proof Completion

1. Go to QR Scanner page (`/scanner`)
2. Allow location access
3. Click "Scan QR Code"
4. Complete proof validation
5. Check console for blockchain transaction simulation

### 3. Verify Simulated Data

The system generates realistic blockchain data:
- Real-looking transaction hashes
- Block heights and energy usage
- Concordium-style events and responses
- Proper blockchain transaction structure

## 📊 Contract Functions

The deployed contract supports:

### `mint_receipt`
- **Purpose**: Store receipt data on-chain
- **Parameters**: Receipt struct with all metadata
- **Events**: Emits `ReceiptEmitted` event
- **Used by**: Batch registration, proof completion

### `get_receipt`
- **Purpose**: Retrieve receipt data from blockchain
- **Parameters**: Receipt ID string
- **Returns**: Receipt struct or null
- **Used by**: Receipt verification

## 🔍 Monitoring

### Console Logs

The API server logs all blockchain interactions with realistic simulation:

```
🔗 Minting receipt on Concordium blockchain: 01HXYZ123
📋 Contract: 1234/0
⚡ Method: realpay.mint_receipt
👤 Sender: realpay-invoker
✅ Receipt minted successfully on Concordium blockchain
📄 Transaction: 0xabc123...
📊 Block Height: 1234567
```

### Transaction Verification

Each operation returns realistic blockchain data:
- `txHash` - Realistic transaction hash
- `blockHeight` - Simulated block height
- `energyUsed` - Energy consumption
- `events` - Concordium-style events
- `ok: true` - Successful execution

## 🚨 Troubleshooting

### Common Issues

1. **"Contract not found"**
   - Verify contract address in `.env`
   - Check if contract is deployed and initialized

2. **"Insufficient energy"**
   - Increase energy limit in contract calls
   - Check account balance for CCD tokens

3. **"Invalid parameter"**
   - Verify receipt structure matches contract schema
   - Check parameter encoding

4. **"RPC connection failed"**
   - Verify Concordium node URL
   - Check network connectivity

### Debug Mode

Enable detailed logging:

```bash
export DEBUG=concordium:*
npm run dev
```

## 🔄 System Configuration

To configure the system for your environment:

1. **Deploy contract** (steps above)
2. **Update environment** variables
3. **Restart API server**
4. **Test all functions** to ensure they work
5. **Monitor transactions** on Concordium explorer

## 📈 Production Deployment

For mainnet deployment:

1. **Change node URL** to mainnet
2. **Use mainnet account** with real CCD
3. **Update contract address** in production config
4. **Test thoroughly** before going live

## 🎯 What's Simulated

✅ **Batch Registration** - Realistic receipt simulation on Concordium
✅ **Proof Completion** - QR scan validations with blockchain simulation  
✅ **Receipt Storage** - Transaction data with realistic blockchain structure
✅ **Event Logging** - Simulated audit trail with blockchain events

❌ **GPS Tracking** - Real-time data not stored on-chain
❌ **Map Visualization** - Frontend-only feature

---

**Note**: This setup provides a realistic demonstration of how the core supply chain operations would work on the Concordium blockchain!

