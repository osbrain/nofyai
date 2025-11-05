import fs from 'fs/promises';
import path from 'path';
import { FullDecision, Decision, TradingContext } from './ai';

// ========================================
// Types
// ========================================

export interface DecisionRecord {
  timestamp: string;
  cycle_number: number;
  trader_id: string;
  success: boolean; // Overall success of this decision cycle

  // AI Decision
  cot_trace: string;
  decisions: Decision[];

  // Account State (snapshot before execution)
  account_snapshot: {
    total_equity: number;
    available_balance: number;
    total_pnl: number;
    total_pnl_pct: number;
    margin_used: number;
    margin_used_pct: number;
    position_count: number;
  };

  // Positions (snapshot before execution)
  positions_snapshot: Array<{
    symbol: string;
    side: string;
    entry_price: number;
    mark_price: number;
    quantity: number;
    leverage: number;
    unrealized_pnl: number;
    unrealized_pnl_pct: number;
  }>;

  // Execution Results
  execution_results: Array<{
    symbol: string;
    action: string;
    success: boolean;
    error?: string;
  }>;

  // Performance Metrics (optional)
  performance?: {
    runtime_minutes: number;
    total_cycles: number;
  };
}

// ========================================
// Decision Logger
// ========================================

export class DecisionLogger {
  private traderId: string;
  private logDir: string;
  private cycleNumber: number = 0;

  constructor(traderId: string, baseDir: string = './decision_logs') {
    this.traderId = traderId;
    this.logDir = path.join(baseDir, traderId);
    this.ensureLogDirectory();
  }

  private async ensureLogDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.logDir, { recursive: true });
    } catch (error) {
      console.error(`Failed to create log directory ${this.logDir}:`, error);
    }
  }

  /**
   * Save decision record to JSON file
   */
  async saveDecision(
    fullDecision: FullDecision,
    context: TradingContext,
    executionResults: Array<{ symbol: string; action: string; success: boolean; error?: string }>
  ): Promise<string | null> {
    try {
      this.cycleNumber++;

      const timestamp = new Date().toISOString();
      const dateStr = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
      const timeStr = new Date().toISOString().replace(/[:.]/g, '-').split('T')[1].split('Z')[0];

      const filename = `decision_${dateStr}_${timeStr}_cycle${this.cycleNumber}.json`;
      const filepath = path.join(this.logDir, filename);

      // Calculate overall success: true if all execution results succeeded
      const overallSuccess = executionResults.length === 0 || executionResults.every(result => result.success);

      const record: DecisionRecord = {
        timestamp,
        cycle_number: this.cycleNumber,
        trader_id: this.traderId,
        success: overallSuccess,
        cot_trace: fullDecision.cot_trace,
        decisions: fullDecision.decisions,
        account_snapshot: context.account,
        positions_snapshot: context.positions.map(pos => ({
          symbol: pos.symbol,
          side: pos.side,
          entry_price: pos.entry_price,
          mark_price: pos.mark_price,
          quantity: pos.quantity,
          leverage: pos.leverage,
          unrealized_pnl: pos.unrealized_pnl,
          unrealized_pnl_pct: pos.unrealized_pnl_pct,
        })),
        execution_results: executionResults,
        performance: {
          runtime_minutes: context.runtime_minutes,
          total_cycles: context.call_count,
        },
      };

      await fs.writeFile(filepath, JSON.stringify(record, null, 2), 'utf-8');

      console.log(`✅ Decision log saved: ${filename}`);
      return filepath;
    } catch (error) {
      console.error('❌ Failed to save decision log:', error);
      return null;
    }
  }

  /**
   * Get recent decision records (sorted by timestamp, newest first)
   */
  async getRecentDecisions(limit: number = 100): Promise<DecisionRecord[]> {
    try {
      const files = await fs.readdir(this.logDir);

      // Filter decision files and sort by name (which contains timestamp)
      const decisionFiles = files
        .filter(f => f.startsWith('decision_') && f.endsWith('.json'))
        .sort()
        .reverse()
        .slice(0, limit);

      const records: DecisionRecord[] = [];

      for (const file of decisionFiles) {
        try {
          const filepath = path.join(this.logDir, file);
          const content = await fs.readFile(filepath, 'utf-8');
          const record = JSON.parse(content) as DecisionRecord;
          records.push(record);
        } catch (error) {
          console.error(`Failed to read decision file ${file}:`, error);
        }
      }

      return records;
    } catch (error) {
      console.error('Failed to get recent decisions:', error);
      return [];
    }
  }

  /**
   * Get decision by cycle number
   */
  async getDecisionByCycle(cycleNumber: number): Promise<DecisionRecord | null> {
    try {
      const files = await fs.readdir(this.logDir);
      const targetFile = files.find(f =>
        f.startsWith('decision_') &&
        f.includes(`cycle${cycleNumber}.json`)
      );

      if (!targetFile) {
        return null;
      }

      const filepath = path.join(this.logDir, targetFile);
      const content = await fs.readFile(filepath, 'utf-8');
      return JSON.parse(content) as DecisionRecord;
    } catch (error) {
      console.error(`Failed to get decision for cycle ${cycleNumber}:`, error);
      return null;
    }
  }

  /**
   * Analyze performance from recent decisions
   * Returns comprehensive trading performance metrics including Sharpe Ratio
   */
  async analyzePerformance(recentCount: number = 100): Promise<{
    total_trades: number;
    winning_trades: number;
    losing_trades: number;
    win_rate: number;
    avg_profit: number;
    avg_loss: number;
    profit_factor: number;
    sharpe_ratio: number;
    max_drawdown: number;
    avg_holding_time_minutes: number;
    sample_trades: Array<{
      symbol: string;
      side: string;
      open_time: string;
      close_time: string;
      pnl: number;
      pnl_pct: number;
      leverage: number;
    }>;
  }> {
    try {
      const decisions = await this.getRecentDecisions(recentCount);

      if (decisions.length === 0) {
        return this.getEmptyPerformance();
      }

      // Extract closed trades from decision logs
      const closedTrades = this.extractClosedTrades(decisions);

      if (closedTrades.length === 0) {
        return this.getEmptyPerformance();
      }

      // Calculate basic statistics
      const winningTrades = closedTrades.filter(t => t.pnl > 0);
      const losingTrades = closedTrades.filter(t => t.pnl < 0);

      const totalTrades = closedTrades.length;
      const winningCount = winningTrades.length;
      const losingCount = losingTrades.length;
      const winRate = totalTrades > 0 ? (winningCount / totalTrades) * 100 : 0;

      // Calculate average profit and loss
      const avgProfit = winningCount > 0
        ? winningTrades.reduce((sum, t) => sum + t.pnl, 0) / winningCount
        : 0;

      const avgLoss = losingCount > 0
        ? losingTrades.reduce((sum, t) => sum + t.pnl, 0) / losingCount
        : 0;

      // Calculate profit factor
      const totalProfit = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
      const totalLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));
      const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : (totalProfit > 0 ? 999 : 0);

      // Calculate Sharpe Ratio
      const sharpeRatio = this.calculateSharpeRatio(closedTrades);

      // Calculate max drawdown from equity curve
      const maxDrawdown = this.calculateMaxDrawdown(decisions);

      // Calculate average holding time
      const avgHoldingTime = closedTrades.length > 0
        ? closedTrades.reduce((sum, t) => sum + t.holding_time_minutes, 0) / closedTrades.length
        : 0;

      // Get sample trades (last 10)
      const sampleTrades = closedTrades.slice(0, 10).map(t => ({
        symbol: t.symbol,
        side: t.side,
        open_time: t.open_time,
        close_time: t.close_time,
        pnl: t.pnl,
        pnl_pct: t.pnl_pct,
        leverage: t.leverage,
      }));

      return {
        total_trades: totalTrades,
        winning_trades: winningCount,
        losing_trades: losingCount,
        win_rate: winRate,
        avg_profit: avgProfit,
        avg_loss: avgLoss,
        profit_factor: profitFactor,
        sharpe_ratio: sharpeRatio,
        max_drawdown: maxDrawdown,
        avg_holding_time_minutes: avgHoldingTime,
        sample_trades: sampleTrades,
      };
    } catch (error) {
      console.error('Failed to analyze performance:', error);
      return this.getEmptyPerformance();
    }
  }

  /**
   * Extract closed trades from decision logs by matching open/close pairs
   * Simple approach: scan all decisions, track when positions appear/disappear
   */
  private extractClosedTrades(decisions: DecisionRecord[]): Array<{
    symbol: string;
    side: string;
    open_time: string;
    close_time: string;
    open_price: number;
    close_price: number;
    quantity: number;
    leverage: number;
    pnl: number;
    pnl_pct: number;
    holding_time_minutes: number;
  }> {
    const trades: Array<{
      symbol: string;
      side: string;
      open_time: string;
      close_time: string;
      open_price: number;
      close_price: number;
      quantity: number;
      leverage: number;
      pnl: number;
      pnl_pct: number;
      holding_time_minutes: number;
    }> = [];

    if (decisions.length === 0) return trades;

    // Sort decisions oldest first
    const sortedDecisions = [...decisions].reverse();

    // Build a timeline of all close actions
    const closeActions = new Map<string, { decision: DecisionRecord; action: any }>();

    for (const decision of sortedDecisions) {
      for (const action of decision.decisions) {
        if (action.action === 'close_long' || action.action === 'close_short') {
          const side = action.action === 'close_long' ? 'long' : 'short';
          const key = `${action.symbol}_${side}`;
          closeActions.set(key, { decision, action });
        }
      }
    }

    // For each close action, find the corresponding open by looking backwards
    for (const [key, { decision: closeDecision, action: closeAction }] of closeActions.entries()) {
      const [symbol, side] = key.split('_');

      // Get position details from close decision's snapshot (before close)
      const closePosition = closeDecision.positions_snapshot.find(
        p => p.symbol === symbol && p.side === side
      );

      if (!closePosition) continue;

      // Find open time by scanning backwards to find when this position first appeared
      let openTime: string | null = null;
      let openPrice = closePosition.entry_price;

      for (const decision of sortedDecisions) {
        if (new Date(decision.timestamp) >= new Date(closeDecision.timestamp)) break;

        // Check if this position exists in snapshot
        const pos = decision.positions_snapshot.find(
          p => p.symbol === symbol && p.side === side
        );

        if (pos) {
          // Position exists, update open time to earliest found
          openTime = decision.timestamp;
          openPrice = pos.entry_price;
        } else {
          // Position doesn't exist yet, so the next occurrence is the open
          openTime = null;
        }
      }

      // If we never found the position in earlier cycles, look for open_long/open_short action
      if (!openTime) {
        for (const decision of sortedDecisions) {
          if (new Date(decision.timestamp) >= new Date(closeDecision.timestamp)) break;

          for (const action of decision.decisions) {
            const actionSide = action.action.includes('long') ? 'long' : action.action.includes('short') ? 'short' : null;
            if ((action.action === 'open_long' || action.action === 'open_short') &&
                action.symbol === symbol && actionSide === side) {
              openTime = decision.timestamp;
              break;
            }
          }
          if (openTime) break;
        }
      }

      if (!openTime) {
        // Can't determine open time, skip this trade
        continue;
      }

      const closePrice = closePosition.mark_price;

      // Calculate PnL
      const priceChange = side === 'long'
        ? (closePrice - openPrice) / openPrice
        : (openPrice - closePrice) / openPrice;

      const pnlPct = priceChange * 100;
      const pnl = closePosition.quantity * closePrice * priceChange * closePosition.leverage;

      // Calculate holding time
      const openTimestamp = new Date(openTime).getTime();
      const closeTimestamp = new Date(closeDecision.timestamp).getTime();
      const holdingTimeMinutes = (closeTimestamp - openTimestamp) / (1000 * 60);

      trades.push({
        symbol: symbol,
        side: side,
        open_time: openTime,
        close_time: closeDecision.timestamp,
        open_price: openPrice,
        close_price: closePrice,
        quantity: closePosition.quantity,
        leverage: closePosition.leverage,
        pnl: pnl,
        pnl_pct: pnlPct,
        holding_time_minutes: holdingTimeMinutes,
      });
    }

    return trades;
  }

  /**
   * Calculate Sharpe Ratio from closed trades
   * Sharpe Ratio = Mean Return / Std Dev of Returns
   */
  private calculateSharpeRatio(trades: Array<{ pnl: number; pnl_pct: number }>): number {
    if (trades.length < 2) {
      return 0;
    }

    // Use PnL percentage for returns
    const returns = trades.map(t => t.pnl_pct);

    // Calculate mean return
    const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;

    // Calculate standard deviation
    const squaredDiffs = returns.map(r => Math.pow(r - meanReturn, 2));
    const variance = squaredDiffs.reduce((sum, d) => sum + d, 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    // Sharpe Ratio (assuming risk-free rate = 0 for simplicity)
    const sharpeRatio = stdDev > 0 ? meanReturn / stdDev : 0;

    return sharpeRatio;
  }

  /**
   * Calculate maximum drawdown from equity curve
   */
  private calculateMaxDrawdown(decisions: DecisionRecord[]): number {
    if (decisions.length < 2) {
      return 0;
    }

    // Sort by timestamp (oldest first)
    const sorted = [...decisions].sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    let maxEquity = sorted[0].account_snapshot.total_equity;
    let maxDrawdown = 0;

    for (const decision of sorted) {
      const equity = decision.account_snapshot.total_equity;

      // Update max equity
      if (equity > maxEquity) {
        maxEquity = equity;
      }

      // Calculate drawdown from peak
      const drawdown = maxEquity > 0 ? ((equity - maxEquity) / maxEquity) * 100 : 0;

      // Track max drawdown (most negative)
      if (drawdown < maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    return maxDrawdown;
  }

  /**
   * Get empty performance object when no trades available
   */
  private getEmptyPerformance() {
    return {
      total_trades: 0,
      winning_trades: 0,
      losing_trades: 0,
      win_rate: 0,
      avg_profit: 0,
      avg_loss: 0,
      profit_factor: 0,
      sharpe_ratio: 0,
      max_drawdown: 0,
      avg_holding_time_minutes: 0,
      sample_trades: [],
    };
  }

  /**
   * Get current cycle number
   */
  getCycleNumber(): number {
    return this.cycleNumber;
  }

  /**
   * Initialize cycle number from existing logs
   */
  async initializeCycleNumber(): Promise<void> {
    try {
      const files = await fs.readdir(this.logDir);
      const decisionFiles = files.filter(f =>
        f.startsWith('decision_') && f.endsWith('.json')
      );

      if (decisionFiles.length === 0) {
        this.cycleNumber = 0;
        return;
      }

      // Extract cycle numbers from filenames
      const cycleNumbers = decisionFiles
        .map(f => {
          const match = f.match(/cycle(\d+)\.json$/);
          return match ? parseInt(match[1], 10) : 0;
        })
        .filter(n => !isNaN(n));

      if (cycleNumbers.length > 0) {
        this.cycleNumber = Math.max(...cycleNumbers);
        console.log(`📊 Initialized cycle number to ${this.cycleNumber} (found ${decisionFiles.length} existing logs)`);
      }
    } catch (error) {
      console.error('Failed to initialize cycle number:', error);
      this.cycleNumber = 0;
    }
  }
}
