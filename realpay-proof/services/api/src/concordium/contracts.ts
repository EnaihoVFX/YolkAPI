import { rpc, REALPAY } from './client';
import { ulid } from 'ulidx';

// Concordium blockchain integration for receipt minting
export async function mintReceipt(sender: string, receipt: any): Promise<any> {
  const method = 'realpay.mint_receipt';
  
  // Create receipt structure for blockchain contract
  const contractReceipt = {
    receipt_id: receipt.receipt_id || ulid(),
    tx_hash: receipt.tx_hash || `tx_${ulid()}`,
    merchant_id_hash: receipt.merchant_id_hash || '0x' + '0'.repeat(64),
    party_id_hash: receipt.party_id_hash || '0x' + '0'.repeat(64),
    amount_plt: receipt.amount_plt || 0,
    ts_unix: receipt.ts_unix || Math.floor(Date.now() / 1000),
    unit_id_hash: receipt.unit_id_hash || null,
    batch_id_hash: receipt.batch_id_hash || null,
    geo_hash: receipt.geo_hash || null,
    meta_root: receipt.meta_root || null,
  };

  // Encode parameters as UTF-8 JSON bytes for contract execution
  const parameter: Uint8Array = new TextEncoder().encode(JSON.stringify(contractReceipt));
  const energy = 50000;

  try {
    console.log(`🔗 Minting receipt on Concordium blockchain: ${contractReceipt.receipt_id}`);
    console.log(`📋 Contract: ${REALPAY.address.index}/${REALPAY.address.subindex}`);
    console.log(`⚡ Method: ${method}`);
    console.log(`👤 Sender: ${sender}`);
    
    // Execute contract call on Concordium blockchain
    const response = await rpc.invokeContract({
      contract: REALPAY.address,
      method,
      invoker: sender,
      parameter,
      energy,
    });

    console.log('✅ Receipt minted successfully on Concordium blockchain');
    console.log(`📄 Transaction: ${response.txHash}`);
    console.log(`📊 Block Height: ${response.blockHeight}`);
    
    return {
      ok: true,
      method,
      address: REALPAY.address,
      sender,
      receipt: contractReceipt,
      txHash: response.txHash || response.transactionHash,
      blockHeight: response.blockHeight,
      energyUsed: response.energyUsed,
      events: response.events,
      response
    };
  } catch (error) {
    console.error('❌ Failed to mint receipt on Concordium blockchain:', error);
    throw new Error(`Blockchain transaction failed: ${error.message}`);
  }
}


