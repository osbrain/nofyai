// Test Kimi API Key
import * as fs from 'fs';
import * as path from 'path';
import { fetchWithProxy } from '../lib/http-client';

async function testKimiAPI() {
  console.log('🧪 Testing Kimi API Key...\n');

  // Read config.json
  const configPath = path.join(process.cwd(), 'config.json');
  if (!fs.existsSync(configPath)) {
    console.error('❌ config.json not found');
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  const kimiTrader = config.traders.find((t: any) => t.ai_model === 'kimi');

  if (!kimiTrader) {
    console.error('❌ No Kimi trader found in config.json');
    process.exit(1);
  }

  const apiKey = kimiTrader.kimi_api_key;
  const modelName = kimiTrader.kimi_model_name || 'kimi-k2-turbo-preview';

  console.log(`📋 Trader ID: ${kimiTrader.id}`);
  console.log(`🔑 API Key: ${apiKey.substring(0, 8)}...${apiKey.slice(-4)}`);
  console.log(`🤖 Model: ${modelName}`);
  console.log('🌐 Base URL: https://api.moonshot.cn/v1\n');

  // Test API call with timeout
  try {
    console.log('📡 Sending test request...\n');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

    const response = await fetchWithProxy('https://api.moonshot.cn/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Say "Hello, Kimi API is working!" in one sentence.' },
        ],
        temperature: 0.7,
        max_tokens: 100,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    console.log(`📊 Response Status: ${response.status} ${response.statusText}\n`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error Response:');
      console.error(errorText);
      console.error('\n🔍 Possible issues:');
      console.error('  1. Invalid API key');
      console.error('  2. API key expired');
      console.error('  3. Account balance insufficient');
      console.error('  4. Model name incorrect');
      process.exit(1);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    console.log('✅ API Key is VALID!\n');
    console.log('📝 AI Response:');
    console.log(`   "${content}"\n`);
    console.log('🎉 Kimi API test successful!');

    // Show token usage if available
    if (data.usage) {
      console.log('\n📊 Token Usage:');
      console.log(`   Prompt tokens: ${data.usage.prompt_tokens}`);
      console.log(`   Completion tokens: ${data.usage.completion_tokens}`);
      console.log(`   Total tokens: ${data.usage.total_tokens}`);
    }

  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error('❌ Request timeout (15 seconds)');
      console.error('\n🔍 Possible issues:');
      console.error('  1. Network connection is slow');
      console.error('  2. API server not responding');
      console.error('  3. Firewall blocking the request');
    } else {
      console.error('❌ Test failed:');
      console.error(error instanceof Error ? error.message : error);
      console.error('\n🔍 Possible issues:');
      console.error('  1. Network connection problem');
      console.error('  2. Firewall blocking the request');
      console.error('  3. DNS resolution issue');
    }
    process.exit(1);
  }
}

testKimiAPI();
