import { ethers } from 'ethers';

/**
 * Derive Ethereum address from private key
 * Usage: npx tsx scripts/derive-address.ts <private_key>
 */

const privateKey = process.argv[2];

if (!privateKey) {
  console.error('❌ Usage: npx tsx scripts/derive-address.ts <private_key>');
  console.error('   Private key can be with or without 0x prefix');
  process.exit(1);
}

try {
  // Remove 0x prefix if present
  const pk = privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey;

  // Validate private key length
  if (pk.length !== 64) {
    throw new Error(`Invalid private key length: ${pk.length} (expected 64 hex characters)`);
  }

  // Create wallet from private key
  const wallet = new ethers.Wallet('0x' + pk);

  console.log('\n✅ Address derived successfully!\n');
  console.log('Private Key:', '0x' + pk);
  console.log('Address:    ', wallet.address);
  console.log('\n📝 Update your config.json:');
  console.log(`   "aster_signer": "${wallet.address}",`);
  console.log(`   "aster_private_key": "${pk}",\n`);

} catch (error) {
  console.error('\n❌ Error:', error instanceof Error ? error.message : String(error));
  process.exit(1);
}
