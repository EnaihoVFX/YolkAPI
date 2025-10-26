#!/usr/bin/env tsx

import { JsonRpcClient, ContractAddress, AccountAddress } from '@concordium/web-sdk';
import { readFileSync } from 'fs';
import { join } from 'path';

const NODE_URL = process.env.CCD_NODE || 'https://json-rpc.testnet.concordium.com';
const CONTRACT_WASM_PATH = join(__dirname, '../contracts/realpay/target/wasm32-unknown-unknown/release/realpay.wasm');

async function deployContract() {
  console.log('🚀 Deploying RealPay contract to Concordium testnet...');
  console.log(`Node URL: ${NODE_URL}`);
  
  try {
    // Create RPC client
    const client = new JsonRpcClient(NODE_URL);
    
    // Read contract WASM
    const wasmModule = readFileSync(CONTRACT_WASM_PATH);
    console.log(`Contract WASM size: ${wasmModule.length} bytes`);
    
    // Deploy contract
    console.log('Deploying contract...');
    const deployResult = await client.deployModule(wasmModule, {
      sender: AccountAddress.fromBase58(process.env.DEPLOYER_ACCOUNT || '3XH2KzQ1BnBYMYUX3RcAhCfpw4gK8yTQBjCFXeM5G8yLhqB7jv'),
      energy: 1000000,
    });
    
    console.log('✅ Contract deployed successfully!');
    console.log('Module reference:', deployResult.moduleRef);
    
    // Initialize contract
    console.log('Initializing contract...');
    const initResult = await client.initContract({
      moduleRef: deployResult.moduleRef,
      initName: 'init_realpay',
      amount: 0,
      sender: AccountAddress.fromBase58(process.env.DEPLOYER_ACCOUNT || '3XH2KzQ1BnBYMYUX3RcAhCfpw4gK8yTQBjCFXeM5G8yLhqB7jv'),
      energy: 100000,
    });
    
    console.log('✅ Contract initialized successfully!');
    console.log('Contract address:', initResult.address);
    console.log('Transaction hash:', initResult.txHash);
    
    // Save contract address to .env
    const envContent = `CONTRACT_INDEX=${initResult.address.index}
CONTRACT_SUBINDEX=${initResult.address.subindex}
CCD_NODE=${NODE_URL}
DEPLOYER_ACCOUNT=${process.env.DEPLOYER_ACCOUNT || '3XH2KzQ1BnBYMYUX3RcAhCfpw4gK8yTQBjCFXeM5G8yLhqB7jv'}
`;
    
    require('fs').writeFileSync(join(__dirname, '../.env'), envContent);
    console.log('✅ Contract address saved to .env file');
    
    return initResult.address;
    
  } catch (error) {
    console.error('❌ Contract deployment failed:', error);
    throw error;
  }
}

// Run deployment if called directly
if (require.main === module) {
  deployContract()
    .then((address) => {
      console.log('\n🎉 Deployment complete!');
      console.log(`Contract Address: ${address.index}/${address.subindex}`);
      console.log('\nNext steps:');
      console.log('1. Update your .env file with the contract address');
      console.log('2. Restart the API server');
      console.log('3. Test the blockchain integration');
    })
    .catch((error) => {
      console.error('Deployment failed:', error);
      process.exit(1);
    });
}

export { deployContract };

