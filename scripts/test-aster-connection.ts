import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';

/**
 * Test Aster API wallet configuration
 * Usage: npx tsx scripts/test-aster-connection.ts
 */

interface Config {
  traders: Array<{
    id: string;
    aster_user: string;
    aster_signer: string;
    aster_private_key: string;
  }>;
}

async function testConnection() {
  console.log('\n🔍 Aster API Wallet Configuration Diagnostics\n');
  console.log('='.repeat(60));

  // Load config
  const configPath = path.join(process.cwd(), 'config.json');
  if (!fs.existsSync(configPath)) {
    console.error('❌ config.json not found');
    process.exit(1);
  }

  const configContent = fs.readFileSync(configPath, 'utf-8');
  const config: Config = JSON.parse(configContent);
  const trader = config.traders[0];

  console.log('\n📋 Current Configuration:\n');
  console.log(`  aster_user:    ${trader.aster_user}`);
  console.log(`  aster_signer:  ${trader.aster_signer}`);
  console.log(`  private_key:   ${trader.aster_private_key.substring(0, 10)}...${trader.aster_private_key.substring(54)}`);

  // Validate address formats
  console.log('\n🔍 Validating Address Formats:\n');

  try {
    ethers.getAddress(trader.aster_user);
    console.log('  ✅ aster_user is valid Ethereum address');
  } catch (e) {
    console.log('  ❌ aster_user is INVALID');
    return;
  }

  try {
    ethers.getAddress(trader.aster_signer);
    console.log('  ✅ aster_signer is valid Ethereum address');
  } catch (e) {
    console.log('  ❌ aster_signer is INVALID');
    return;
  }

  // Validate private key and derive address
  console.log('\n🔑 Validating Private Key:\n');

  let wallet: ethers.Wallet;
  try {
    const pk = trader.aster_private_key.startsWith('0x')
      ? trader.aster_private_key
      : '0x' + trader.aster_private_key;
    wallet = new ethers.Wallet(pk);
    console.log('  ✅ Private key is valid');
    console.log(`  📍 Derived address: ${wallet.address}`);
  } catch (e) {
    console.log('  ❌ Private key is INVALID');
    console.log(`  Error: ${e instanceof Error ? e.message : String(e)}`);
    return;
  }

  // Check if private key matches signer address
  console.log('\n🔗 Checking Key-Address Match:\n');

  if (wallet.address.toLowerCase() === trader.aster_signer.toLowerCase()) {
    console.log('  ✅ Private key matches aster_signer address');
  } else {
    console.log('  ❌ MISMATCH: Private key does NOT match aster_signer!');
    console.log(`     Expected: ${trader.aster_signer}`);
    console.log(`     Derived:  ${wallet.address}`);
    console.log('\n  💡 Fix: Update aster_signer to match the derived address');
    return;
  }

  // Test Aster API connection
  console.log('\n🌐 Testing Aster API Connection:\n');

  const baseURL = 'https://fapi.asterdex.com';

  // Test 1: Get account balance
  console.log('  🔄 Testing GET /fapi/v3/balance...');

  try {
    const nonce = String(Date.now() * 1000 + Math.floor(Math.random() * 1000));
    const params: any = {
      recvWindow: '50000',
      timestamp: String(Date.now()),
    };

    // Sign request
    const jsonStr = JSON.stringify(params);
    const abiCoder = ethers.AbiCoder.defaultAbiCoder();
    const encoded = abiCoder.encode(
      ['string', 'address', 'address', 'uint256'],
      [jsonStr, trader.aster_user, trader.aster_signer, BigInt(nonce)]
    );

    const hash = ethers.keccak256(encoded);
    const messageHash = ethers.hashMessage(ethers.getBytes(hash));
    const signature = await wallet.signMessage(ethers.getBytes(hash));

    params.user = trader.aster_user;
    params.signer = trader.aster_signer;
    params.signature = signature;
    params.nonce = nonce;

    const queryString = Object.entries(params)
      .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
      .join('&');

    const response = await fetch(`${baseURL}/fapi/v3/balance?${queryString}`);
    const text = await response.text();

    if (response.ok) {
      console.log('  ✅ SUCCESS! Account balance retrieved');
      const data = JSON.parse(text);
      console.log(`     Total Balance: ${data.totalWalletBalance || data.balance || 'N/A'}`);
    } else {
      console.log(`  ❌ FAILED: HTTP ${response.status}`);
      console.log(`     Response: ${text}`);

      try {
        const error = JSON.parse(text);
        if (error.msg === 'No agent found') {
          console.log('\n  💡 Diagnosis: "No agent found" error means:');
          console.log('     1. API wallet (aster_signer) is not properly bound to main wallet (aster_user)');
          console.log('     2. Or you are using the wrong API wallet address/private key');
          console.log('\n  📝 Solution:');
          console.log('     1. Visit https://www.asterdex.com/en/api-wallet');
          console.log('     2. Go to Professional API → API Management');
          console.log('     3. Check your API wallet address');
          console.log('     4. If no API wallet exists, create one');
          console.log('     5. Copy the correct API wallet address and private key');
          console.log('     6. Update config.json:');
          console.log(`        "aster_signer": "<your_api_wallet_address>",`);
          console.log(`        "aster_private_key": "<your_api_wallet_private_key>",`);
        }
      } catch {}
    }
  } catch (error) {
    console.log('  ❌ Request failed');
    console.log(`     Error: ${error instanceof Error ? error.message : String(error)}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n✅ Diagnostics complete\n');
}

testConnection().catch(console.error);
