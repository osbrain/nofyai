import { AsterTrader, Position, Balance } from './aster';
import {
  getFullDecision,
  Decision,
  TradingContext,
  PositionInfo,
  AccountInfo,
  AIConfig,
  FullDecision,
  MarketData as AIMarketData,
} from './ai';
import { getMarketDataBatch, getMarketData, DEFAULT_SYMBOLS } from './market-data';
import { DecisionLogger } from './decision-logger';

// ========================================
// Trading Engine State
// ========================================

export interface TradingEngineConfig {
  aster: {
    user: string;
    signer: string;
    privateKey: string;
  };
  ai: AIConfig;
  initialBalance: number;
  btcEthLeverage: number;
  altcoinLeverage: number;
  scanIntervalMinutes: number;
  traderId?: string; // Optional trader ID for logs
}

export interface TradingSession {
  isRunning: boolean;
  startTime: Date | null;
  callCount: number;
  lastDecision: FullDecision | null;
  positionFirstSeenTime: Record<string, number>; // symbol_side -> timestamp
}

// ========================================
// Trading Engine
// ========================================

export class TradingEngine {
  private trader: AsterTrader;
  private aiConfig: AIConfig;
  private config: TradingEngineConfig;
  private session: TradingSession;
  private intervalId: NodeJS.Timeout | null = null;
  private logger: DecisionLogger;
  private traderId: string;

  constructor(config: TradingEngineConfig) {
    this.config = config;
    this.traderId = config.traderId || `trader_${Date.now()}`;

    this.trader = new AsterTrader({
      user: config.aster.user,
      signer: config.aster.signer,
      privateKey: config.aster.privateKey,
    });
    this.aiConfig = config.ai;
    this.logger = new DecisionLogger(this.traderId);

    this.session = {
      isRunning: false,
      startTime: null,
      callCount: 0,
      lastDecision: null,
      positionFirstSeenTime: {},
    };
  }

  // ========================================
  // Session Control
  // ========================================

  start(): void {
    if (this.session.isRunning) {
      throw new Error('Trading engine is already running');
    }

    this.session.isRunning = true;
    this.session.startTime = new Date();
    this.session.callCount = 0;

    console.log('🚀 Trading engine started');
    console.log(`📊 Trader ID: ${this.traderId}`);

    // Initialize cycle number from existing logs
    this.logger.initializeCycleNumber().then(() => {
      // Run immediately, then on interval
      this.runCycle().catch(err => {
        console.error('Error in trading cycle:', err);
      });

      this.intervalId = setInterval(() => {
        this.runCycle().catch(err => {
          console.error('Error in trading cycle:', err);
        });
      }, this.config.scanIntervalMinutes * 60 * 1000);
    });
  }

  stop(): void {
    if (!this.session.isRunning) {
      throw new Error('Trading engine is not running');
    }

    this.session.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    console.log('🛑 Trading engine stopped');
  }

  getSession(): TradingSession {
    return { ...this.session };
  }

  // ========================================
  // Core Trading Cycle
  // ========================================

  private async runCycle(): Promise<void> {
    try {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🔄 Trading Cycle #${this.session.callCount + 1}`);
      console.log(`${'='.repeat(60)}\n`);

      this.session.callCount++;

      // 1. Build trading context
      const ctx = await this.buildTradingContext();

      // 2. Get AI decision
      console.log('🤖 Calling AI for decision...');
      const fullDecision = await getFullDecision(ctx, this.aiConfig);
      this.session.lastDecision = fullDecision;

      console.log('\n📝 Chain of Thought:');
      console.log(fullDecision.cot_trace);
      console.log('\n📋 Decisions:', JSON.stringify(fullDecision.decisions, null, 2));

      // 3. Execute decisions and collect results
      const executionResults = await this.executeDecisions(fullDecision.decisions, ctx);

      // 4. Save decision log
      await this.logger.saveDecision(fullDecision, ctx, executionResults);

      console.log(`\n✅ Cycle #${this.session.callCount} completed\n`);
    } catch (error) {
      console.error('❌ Error in trading cycle:', error);
      // Continue running even on error
    }
  }

  // ========================================
  // Build Trading Context
  // ========================================

  private async buildTradingContext(): Promise<TradingContext> {
    // Get account balance
    const balance = await this.trader.getBalance();

    // Get positions
    const positions = await this.trader.getPositions();

    // Track position first seen time
    const now = Date.now();
    positions.forEach(pos => {
      const key = `${pos.symbol}_${pos.side}`;
      if (!this.session.positionFirstSeenTime[key]) {
        this.session.positionFirstSeenTime[key] = now;
      }
    });

    // Convert to trading context format
    const positionInfos: PositionInfo[] = positions.map(pos => {
      const key = `${pos.symbol}_${pos.side}`;
      const firstSeenTime = this.session.positionFirstSeenTime[key] || now;
      const unrealizedPnlPct =
        pos.entryPrice > 0
          ? ((pos.markPrice - pos.entryPrice) / pos.entryPrice) * 100 * (pos.side === 'short' ? -1 : 1)
          : 0;

      return {
        symbol: pos.symbol,
        side: pos.side,
        entry_price: pos.entryPrice,
        mark_price: pos.markPrice,
        quantity: pos.positionAmt,
        leverage: pos.leverage,
        unrealized_pnl: pos.unRealizedProfit,
        unrealized_pnl_pct: unrealizedPnlPct,
        liquidation_price: pos.liquidationPrice,
        margin_used: pos.markPrice * pos.positionAmt / pos.leverage,
        update_time: firstSeenTime,
      };
    });

    // Calculate account info
    const totalPnl = balance.totalUnrealizedProfit;
    const totalPnlPct = ((balance.totalWalletBalance - this.config.initialBalance) / this.config.initialBalance) * 100;
    const marginUsed = positionInfos.reduce((sum, pos) => sum + pos.margin_used, 0);
    const marginUsedPct = (marginUsed / balance.totalWalletBalance) * 100;

    const accountInfo: AccountInfo = {
      total_equity: balance.totalWalletBalance,
      available_balance: balance.availableBalance,
      total_pnl: totalPnl,
      total_pnl_pct: totalPnlPct,
      margin_used: marginUsed,
      margin_used_pct: marginUsedPct,
      position_count: positions.length,
    };

    // Get runtime
    const runtimeMinutes = this.session.startTime
      ? Math.floor((Date.now() - this.session.startTime.getTime()) / (1000 * 60))
      : 0;

    // Build market data from Binance API
    const marketDataMap: Record<string, AIMarketData> = {};

    // Collect symbols to fetch
    const symbolsToFetch = new Set<string>();

    // Always fetch BTC
    symbolsToFetch.add('BTCUSDT');

    // Add symbols from existing positions
    positionInfos.forEach(pos => symbolsToFetch.add(pos.symbol));

    // Add default trading symbols (if no positions)
    if (symbolsToFetch.size === 1) {
      DEFAULT_SYMBOLS.forEach(s => symbolsToFetch.add(s));
    }

    console.log(`📊 Fetching market data for ${symbolsToFetch.size} symbols...`);

    try {
      const binanceData = await getMarketDataBatch(Array.from(symbolsToFetch));

      // Convert Binance market data to AI market data format
      for (const [symbol, data] of Object.entries(binanceData)) {
        marketDataMap[symbol] = {
          symbol: data.symbol,
          current_price: data.current_price,
          price_change_1h: data.price_change_1h,
          price_change_4h: data.price_change_4h,
          current_macd: data.current_macd,
          current_rsi7: data.current_rsi7,
          current_rsi14: data.current_rsi14,
          volume_24h: data.volume_24h,
          oi_value: data.oi_value,
        };
      }

      console.log(`✓ Successfully fetched ${Object.keys(marketDataMap).length} symbols`);
    } catch (error) {
      console.error('❌ Failed to fetch market data:', error);
      // Fallback to minimal BTC data if fetch fails
      marketDataMap['BTCUSDT'] = {
        symbol: 'BTCUSDT',
        current_price: 95000,
        price_change_1h: 0,
        price_change_4h: 0,
        current_macd: 0,
        current_rsi7: 50,
        current_rsi14: 50,
        volume_24h: 0,
        oi_value: 0,
      };
    }

    return {
      current_time: new Date().toISOString(),
      runtime_minutes: runtimeMinutes,
      call_count: this.session.callCount,
      account: accountInfo,
      positions: positionInfos,
      market_data_map: marketDataMap,
      btc_eth_leverage: this.config.btcEthLeverage,
      altcoin_leverage: this.config.altcoinLeverage,
    };
  }

  // ========================================
  // Execute Decisions
  // ========================================

  private async executeDecisions(
    decisions: Decision[],
    ctx: TradingContext
  ): Promise<Array<{ symbol: string; action: string; success: boolean; error?: string }>> {
    // Sort decisions by priority: close > open > hold/wait
    const sorted = [...decisions].sort((a, b) => {
      const priorityMap: Record<string, number> = {
        close_long: 1,
        close_short: 1,
        open_long: 2,
        open_short: 2,
        hold: 3,
        wait: 3,
      };
      return (priorityMap[a.action] || 999) - (priorityMap[b.action] || 999);
    });

    console.log('\n📦 Executing decisions in priority order...\n');

    const executionResults: Array<{ symbol: string; action: string; success: boolean; error?: string }> = [];

    for (const decision of sorted) {
      try {
        await this.executeDecision(decision, ctx);
        executionResults.push({
          symbol: decision.symbol,
          action: decision.action,
          success: true,
        });
      } catch (error) {
        console.error(`❌ Failed to execute decision for ${decision.symbol}:`, error);
        executionResults.push({
          symbol: decision.symbol,
          action: decision.action,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
        // Continue with other decisions
      }
    }

    return executionResults;
  }

  private async executeDecision(decision: Decision, ctx: TradingContext): Promise<void> {
    const { symbol, action } = decision;

    console.log(`\n🎯 Executing: ${action} ${symbol}`);
    console.log(`   Reasoning: ${decision.reasoning}`);

    switch (action) {
      case 'open_long': {
        // Check if position already exists
        const existingPos = ctx.positions.find(p => p.symbol === symbol && p.side === 'long');
        if (existingPos) {
          console.log(`⚠️  Long position already exists for ${symbol}, skipping`);
          return;
        }

        // Calculate quantity from position size USD
        const price = await this.trader.getMarketPrice(symbol);
        const quantity = decision.position_size_usd! / price;

        console.log(`   Opening long: ${quantity.toFixed(4)} @ ${price.toFixed(2)}`);
        await this.trader.openLong(symbol, quantity, decision.leverage!);

        // Set stop loss and take profit
        await this.trader.setStopLoss(symbol, 'LONG', quantity, decision.stop_loss!);
        await this.trader.setTakeProfit(symbol, 'LONG', quantity, decision.take_profit!);

        console.log(`✅ Long position opened for ${symbol}`);
        break;
      }

      case 'open_short': {
        const existingPos = ctx.positions.find(p => p.symbol === symbol && p.side === 'short');
        if (existingPos) {
          console.log(`⚠️  Short position already exists for ${symbol}, skipping`);
          return;
        }

        const price = await this.trader.getMarketPrice(symbol);
        const quantity = decision.position_size_usd! / price;

        console.log(`   Opening short: ${quantity.toFixed(4)} @ ${price.toFixed(2)}`);
        await this.trader.openShort(symbol, quantity, decision.leverage!);

        await this.trader.setStopLoss(symbol, 'SHORT', quantity, decision.stop_loss!);
        await this.trader.setTakeProfit(symbol, 'SHORT', quantity, decision.take_profit!);

        console.log(`✅ Short position opened for ${symbol}`);
        break;
      }

      case 'close_long': {
        const pos = ctx.positions.find(p => p.symbol === symbol && p.side === 'long');
        if (!pos) {
          console.log(`⚠️  No long position found for ${symbol}, skipping`);
          return;
        }

        console.log(`   Closing long: ${pos.quantity.toFixed(4)}`);
        await this.trader.closeLong(symbol, pos.quantity);

        // Remove from position tracking
        delete this.session.positionFirstSeenTime[`${symbol}_long`];

        console.log(`✅ Long position closed for ${symbol}`);
        break;
      }

      case 'close_short': {
        const pos = ctx.positions.find(p => p.symbol === symbol && p.side === 'short');
        if (!pos) {
          console.log(`⚠️  No short position found for ${symbol}, skipping`);
          return;
        }

        console.log(`   Closing short: ${pos.quantity.toFixed(4)}`);
        await this.trader.closeShort(symbol, pos.quantity);

        // Remove from position tracking
        delete this.session.positionFirstSeenTime[`${symbol}_short`];

        console.log(`✅ Short position closed for ${symbol}`);
        break;
      }

      case 'hold':
        console.log(`⏸️  Holding position for ${symbol}`);
        break;

      case 'wait':
        console.log(`⏳ Waiting for opportunity on ${symbol}`);
        break;

      default:
        console.log(`⚠️  Unknown action: ${action}`);
    }
  }

  // ========================================
  // Manual Decision (for testing)
  // ========================================

  async getDecision(): Promise<FullDecision> {
    const ctx = await this.buildTradingContext();
    return await getFullDecision(ctx, this.aiConfig);
  }

  async executeManualDecision(decision: Decision): Promise<void> {
    const ctx = await this.buildTradingContext();
    await this.executeDecision(decision, ctx);
  }

  // ========================================
  // Data Access Methods for API Endpoints
  // ========================================

  /**
   * Get current account info
   */
  async getCurrentAccount(): Promise<AccountInfo> {
    const balance = await this.trader.getBalance();
    const positions = await this.trader.getPositions();

    const totalPnl = balance.totalUnrealizedProfit;
    const totalPnlPct =
      ((balance.totalWalletBalance - this.config.initialBalance) / this.config.initialBalance) * 100;

    const marginUsed = positions.reduce(
      (sum, pos) => sum + (pos.markPrice * pos.positionAmt) / pos.leverage,
      0
    );
    const marginUsedPct = (marginUsed / balance.totalWalletBalance) * 100;

    return {
      total_equity: balance.totalWalletBalance,
      available_balance: balance.availableBalance,
      total_pnl: totalPnl,
      total_pnl_pct: totalPnlPct,
      margin_used: marginUsed,
      margin_used_pct: marginUsedPct,
      position_count: positions.length,
    };
  }

  /**
   * Get current positions
   */
  async getCurrentPositions(): Promise<PositionInfo[]> {
    const positions = await this.trader.getPositions();
    const now = Date.now();

    return positions.map(pos => {
      const key = `${pos.symbol}_${pos.side}`;
      const firstSeenTime = this.session.positionFirstSeenTime[key] || now;
      const unrealizedPnlPct =
        pos.entryPrice > 0
          ? ((pos.markPrice - pos.entryPrice) / pos.entryPrice) *
            100 *
            (pos.side === 'short' ? -1 : 1)
          : 0;

      return {
        symbol: pos.symbol,
        side: pos.side,
        entry_price: pos.entryPrice,
        mark_price: pos.markPrice,
        quantity: pos.positionAmt,
        leverage: pos.leverage,
        unrealized_pnl: pos.unRealizedProfit,
        unrealized_pnl_pct: unrealizedPnlPct,
        liquidation_price: pos.liquidationPrice,
        margin_used: (pos.markPrice * pos.positionAmt) / pos.leverage,
        update_time: firstSeenTime,
      };
    });
  }

  /**
   * Get equity history from decision logs
   */
  async getEquityHistory(): Promise<Array<{
    timestamp: string;
    total_equity: number;
    available_balance: number;
    total_pnl: number;
    total_pnl_pct: number;
    position_count: number;
    margin_used_pct: number;
    cycle_number: number;
  }>> {
    const decisions = await this.logger.getRecentDecisions(1000);

    // If no history, return initial point
    if (decisions.length === 0) {
      const now = new Date().toISOString();
      return [{
        timestamp: now,
        total_equity: this.config.initialBalance,
        available_balance: this.config.initialBalance,
        total_pnl: 0,
        total_pnl_pct: 0,
        position_count: 0,
        margin_used_pct: 0,
        cycle_number: 0,
      }];
    }

    return decisions.map(decision => ({
      timestamp: decision.timestamp,
      total_equity: decision.account_snapshot.total_equity,
      available_balance: decision.account_snapshot.available_balance,
      total_pnl: decision.account_snapshot.total_pnl,
      total_pnl_pct: decision.account_snapshot.total_pnl_pct,
      position_count: decision.account_snapshot.position_count,
      margin_used_pct: decision.account_snapshot.margin_used_pct,
      cycle_number: decision.cycle_number,
    }));
  }

  /**
   * Get performance metrics from decision logs
   */
  async getPerformanceMetrics(recentCount: number = 100): Promise<any> {
    return await this.logger.analyzePerformance(recentCount);
  }

  /**
   * Get latest decisions from decision logs
   */
  async getLatestDecisions(limit: number = 5): Promise<any[]> {
    return await this.logger.getRecentDecisions(limit);
  }

  /**
   * Get trader info
   */
  getTraderInfo() {
    return {
      trader_id: this.traderId,
      ai_model: this.aiConfig.model,
      initial_balance: this.config.initialBalance,
    };
  }

  /**
   * Get config for status reporting
   */
  getConfig() {
    return {
      initialBalance: this.config.initialBalance,
      scanIntervalMinutes: this.config.scanIntervalMinutes,
    };
  }
}
