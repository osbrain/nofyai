import fs from 'fs/promises';
import path from 'path';
import { TradingEngineConfig } from './trading-engine';
import { AIConfig } from './ai';
import { TelegramConfig } from './telegram-notifier';

// ========================================
// Configuration Types
// ========================================

export interface TraderConfig {
  id: string;
  name: string;
  enabled: boolean;
  ai_model: 'deepseek' | 'qwen' | 'custom';
  exchange: 'aster'; // Currently only Aster supported in Next.js

  // Aster Exchange
  aster_user?: string;
  aster_signer?: string;
  aster_private_key?: string;

  // AI Configuration
  deepseek_api_key?: string;
  qwen_api_key?: string;
  custom_api_url?: string;
  custom_api_key?: string;
  custom_model_name?: string;

  // Trading Configuration
  initial_balance: number;
  scan_interval_minutes: number;
}

export interface AppConfig {
  traders: TraderConfig[];
  leverage: {
    btc_eth_leverage: number;
    altcoin_leverage: number;
  };
  telegram?: TelegramConfig;
  use_default_coins: boolean;
  default_coins: string[];
  coin_pool_api_url?: string;
  oi_top_api_url?: string;
  max_daily_loss?: number;
  max_drawdown?: number;
  stop_trading_minutes?: number;
}

// ========================================
// Configuration Loader
// ========================================

export class ConfigLoader {
  private configPath: string;
  private config: AppConfig | null = null;

  constructor(configPath: string = './config.json') {
    this.configPath = configPath;
  }

  /**
   * Load configuration from JSON file
   */
  async load(): Promise<AppConfig> {
    try {
      const content = await fs.readFile(this.configPath, 'utf-8');

      // Remove comments (JSON doesn't support comments, but config.json.example has them)
      const jsonContent = content.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

      this.config = JSON.parse(jsonContent) as AppConfig;

      console.log(`✅ Configuration loaded from ${this.configPath}`);
      console.log(`   Found ${this.config.traders.length} trader(s)`);
      console.log(`   Enabled: ${this.config.traders.filter(t => t.enabled).length}`);

      return this.config;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        console.error(`❌ Configuration file not found: ${this.configPath}`);
        console.error(`   Please create config.json from config.json.example`);
      } else {
        console.error(`❌ Failed to load configuration:`, error);
      }
      throw error;
    }
  }

  /**
   * Get loaded configuration
   */
  getConfig(): AppConfig {
    if (!this.config) {
      throw new Error('Configuration not loaded. Call load() first.');
    }
    return this.config;
  }

  /**
   * Get enabled traders only
   */
  getEnabledTraders(): TraderConfig[] {
    if (!this.config) {
      throw new Error('Configuration not loaded. Call load() first.');
    }
    return this.config.traders.filter(t => t.enabled);
  }

  /**
   * Get trader by ID
   */
  getTrader(traderId: string): TraderConfig | null {
    if (!this.config) {
      throw new Error('Configuration not loaded. Call load() first.');
    }
    return this.config.traders.find(t => t.id === traderId) || null;
  }

  /**
   * Convert TraderConfig to TradingEngineConfig
   */
  toEngineConfig(traderConfig: TraderConfig): TradingEngineConfig {
    if (!this.config) {
      throw new Error('Configuration not loaded. Call load() first.');
    }

    // Validate exchange-specific config
    if (traderConfig.exchange === 'aster') {
      if (!traderConfig.aster_user || !traderConfig.aster_signer || !traderConfig.aster_private_key) {
        throw new Error(`Trader ${traderConfig.id}: Missing Aster exchange configuration`);
      }
    }

    // Build AI config
    const aiConfig: AIConfig = {
      model: traderConfig.ai_model,
      apiKey: '',
      baseURL: undefined,
      modelName: undefined,
    };

    switch (traderConfig.ai_model) {
      case 'deepseek':
        if (!traderConfig.deepseek_api_key) {
          throw new Error(`Trader ${traderConfig.id}: Missing deepseek_api_key`);
        }
        aiConfig.apiKey = traderConfig.deepseek_api_key;
        aiConfig.baseURL = 'https://api.deepseek.com';
        break;

      case 'qwen':
        if (!traderConfig.qwen_api_key) {
          throw new Error(`Trader ${traderConfig.id}: Missing qwen_api_key`);
        }
        aiConfig.apiKey = traderConfig.qwen_api_key;
        aiConfig.baseURL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
        break;

      case 'custom':
        if (!traderConfig.custom_api_key || !traderConfig.custom_api_url) {
          throw new Error(`Trader ${traderConfig.id}: Missing custom API configuration`);
        }
        aiConfig.apiKey = traderConfig.custom_api_key;
        aiConfig.baseURL = traderConfig.custom_api_url;
        aiConfig.modelName = traderConfig.custom_model_name;
        break;
    }

    // Build TradingEngineConfig
    return {
      aster: {
        user: traderConfig.aster_user!,
        signer: traderConfig.aster_signer!,
        privateKey: traderConfig.aster_private_key!,
      },
      ai: aiConfig,
      initialBalance: traderConfig.initial_balance,
      btcEthLeverage: this.config.leverage.btc_eth_leverage,
      altcoinLeverage: this.config.leverage.altcoin_leverage,
      scanIntervalMinutes: traderConfig.scan_interval_minutes,
      traderId: traderConfig.id,
      traderName: traderConfig.name,
      telegram: this.config.telegram,
    };
  }
}

// ========================================
// Singleton Instance
// ========================================

let configLoaderInstance: ConfigLoader | null = null;

export function getConfigLoader(configPath?: string): ConfigLoader {
  if (!configLoaderInstance) {
    configLoaderInstance = new ConfigLoader(configPath);
  }
  return configLoaderInstance;
}
