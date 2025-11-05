// ========================================
// HTTP Client with Proxy Support
// ========================================
//
// This module provides a fetch wrapper that supports HTTP/HTTPS proxy
// for accessing APIs that may be blocked by firewalls (e.g., Binance).
//
// Usage:
//   import { fetchWithProxy } from './http-client';
//   const response = await fetchWithProxy('https://api.example.com/data');
//
// Configuration:
//   Set HTTP_PROXY or HTTPS_PROXY in .env.local
//   Example: HTTPS_PROXY=http://127.0.0.1:7890
//
// ========================================

import { ProxyAgent } from 'undici';
import { fetch as undiciFetch } from 'undici';

// Read proxy configuration from environment variables
const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;

// Create proxy agent if proxy is configured
const proxyAgent = proxyUrl ? new ProxyAgent(proxyUrl) : undefined;

/**
 * Fetch wrapper with proxy support
 *
 * Automatically uses HTTP/HTTPS proxy if configured via environment variables.
 * Falls back to standard fetch if no proxy is configured.
 *
 * @param url - The URL to fetch
 * @param options - Standard fetch options
 * @returns Promise<Response>
 */
export const fetchWithProxy = async (
  url: string,
  options: RequestInit = {}
): Promise<Response> => {
  if (proxyAgent) {
    console.log(`🔄 [HTTP Client] Using proxy: ${proxyUrl}`);

    try {
      // Use undici fetch with proxy agent
      return (await undiciFetch(url, {
        ...options,
        // @ts-ignore - undici specific option
        dispatcher: proxyAgent,
      })) as Response;
    } catch (error) {
      console.error(`❌ [HTTP Client] Proxy connection failed:`, error);
      throw error;
    }
  } else {
    console.log(`📡 [HTTP Client] Direct connection (no proxy configured)`);
    return fetch(url, options);
  }
};

/**
 * Check if proxy is configured
 * @returns boolean
 */
export const isProxyConfigured = (): boolean => {
  return !!proxyUrl;
};

/**
 * Get current proxy URL
 * @returns string | undefined
 */
export const getProxyUrl = (): string | undefined => {
  return proxyUrl;
};

/**
 * Test proxy connectivity
 *
 * @param testUrl - URL to test (default: Binance API health endpoint)
 * @returns Promise<boolean>
 */
export const testProxyConnection = async (
  testUrl: string = 'https://fapi.binance.com/fapi/v1/ping'
): Promise<boolean> => {
  try {
    console.log(`🔍 [HTTP Client] Testing connection to ${testUrl}...`);

    const response = await fetchWithProxy(testUrl);

    if (response.ok) {
      console.log(`✅ [HTTP Client] Connection successful!`);
      return true;
    } else {
      console.warn(`⚠️ [HTTP Client] Connection returned status ${response.status}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ [HTTP Client] Connection test failed:`, error);
    return false;
  }
};

// Log proxy status on module load
if (typeof window === 'undefined') {
  // Only log in Node.js environment (server-side)
  if (proxyUrl) {
    console.log(`🌐 [HTTP Client] Proxy configured: ${proxyUrl}`);
  } else {
    console.log(`🌐 [HTTP Client] No proxy configured (direct connection)`);
  }
}
