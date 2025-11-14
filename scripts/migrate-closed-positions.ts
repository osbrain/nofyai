#!/usr/bin/env tsx
/**
 * Migration Script: Extract Closed Positions from Decision Logs
 *
 * This script migrates historical closed position data from decision logs
 * to the new closed_positions.json format for faster access.
 *
 * Usage:
 *   npx tsx scripts/migrate-closed-positions.ts [trader_id]
 *
 * If trader_id is not provided, it will migrate all traders.
 */

import fs from 'fs/promises';
import path from 'path';

interface DecisionRecord {
  timestamp: string;
  cycle_number: number;
  trader_id: string;
  decisions: Array<{
    symbol: string;
    action: string;
    reasoning: string;
  }>;
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
}

interface ClosedPosition {
  id: number;
  trader_id: string;
  cycle_number: number;
  timestamp: string;
  symbol: string;
  side: 'long' | 'short';
  action: 'close_long' | 'close_short';
  open_time: string;
  close_time: string;
  entry_price: number;
  exit_price: number;
  quantity: number;
  leverage: number;
  pnl: number;
  pnl_pct: number;
  holding_time_minutes: number;
  reasoning?: string;
}

const DECISION_LOGS_DIR = './decision_logs';

/**
 * Read all decision logs for a trader
 */
async function readDecisionLogs(traderId: string): Promise<DecisionRecord[]> {
  const traderDir = path.join(DECISION_LOGS_DIR, traderId);

  try {
    const files = await fs.readdir(traderDir);
    const decisionFiles = files
      .filter(f => f.startsWith('decision_') && f.endsWith('.json'))
      .sort();

    const records: DecisionRecord[] = [];

    for (const file of decisionFiles) {
      try {
        const filepath = path.join(traderDir, file);
        const content = await fs.readFile(filepath, 'utf-8');
        const record = JSON.parse(content) as DecisionRecord;
        records.push(record);
      } catch (error) {
        console.error(`  ❌ Failed to read ${file}:`, error);
      }
    }

    return records;
  } catch (error) {
    console.error(`Failed to read decision logs for ${traderId}:`, error);
    return [];
  }
}

/**
 * Extract closed positions from decision logs
 */
function extractClosedPositions(decisions: DecisionRecord[]): ClosedPosition[] {
  const closedPositions: ClosedPosition[] = [];

  if (decisions.length === 0) return closedPositions;

  // Sort decisions oldest first
  const sortedDecisions = [...decisions].sort((a, b) =>
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // Collect all close actions
  const allCloseActions: Array<{
    decision: DecisionRecord;
    action: any;
    symbol: string;
    side: string;
  }> = [];

  for (const decision of sortedDecisions) {
    for (const action of decision.decisions) {
      if (action.action === 'close_long' || action.action === 'close_short') {
        const side = action.action === 'close_long' ? 'long' : 'short';
        allCloseActions.push({
          decision,
          action,
          symbol: action.symbol,
          side: side,
        });
      }
    }
  }

  console.log(`  📊 Found ${allCloseActions.length} close actions`);

  let nextId = 1;

  // For each close action, find the corresponding open
  for (const { decision: closeDecision, action: closeAction, symbol, side } of allCloseActions) {
    // Get position details from close decision's snapshot (before close)
    const closePosition = closeDecision.positions_snapshot.find(
      p => p.symbol === symbol && p.side === side
    );

    if (!closePosition) {
      console.warn(`  ⚠️  Cycle ${closeDecision.cycle_number}: ${symbol} ${side} - position not found in snapshot`);
      continue;
    }

    // Find open time by looking backwards
    let openTime: string | null = null;
    let openPrice = closePosition.entry_price;

    for (let i = 0; i < sortedDecisions.length; i++) {
      const decision = sortedDecisions[i];

      // Stop when we reach the close decision
      if (decision.cycle_number >= closeDecision.cycle_number) break;

      // Check if this position exists in current snapshot
      const currentPos = decision.positions_snapshot.find(
        p => p.symbol === symbol && p.side === side
      );

      // Check previous snapshot (if exists)
      const prevPos = i > 0
        ? sortedDecisions[i - 1].positions_snapshot.find(
            p => p.symbol === symbol && p.side === side
          )
        : null;

      // Position appeared for the first time (wasn't in previous, but is in current)
      if (currentPos && !prevPos) {
        openTime = decision.timestamp;
        openPrice = currentPos.entry_price;
        break;
      }
    }

    // Fallback: If still not found, look for open_long/open_short action
    if (!openTime) {
      for (const decision of sortedDecisions) {
        if (decision.cycle_number >= closeDecision.cycle_number) break;

        for (const action of decision.decisions) {
          const actionSide = action.action.includes('long') ? 'long' : action.action.includes('short') ? 'short' : null;
          if ((action.action === 'open_long' || action.action === 'open_short') &&
              action.symbol === symbol && actionSide === side) {
            openTime = decision.timestamp;
            // Try to get price from next cycle's snapshot
            const nextDecision = sortedDecisions.find(d => d.cycle_number === decision.cycle_number + 1);
            if (nextDecision) {
              const pos = nextDecision.positions_snapshot.find(p => p.symbol === symbol && p.side === side);
              if (pos) openPrice = pos.entry_price;
            }
            break;
          }
        }
        if (openTime) break;
      }
    }

    if (!openTime) {
      console.warn(`  ⚠️  Cycle ${closeDecision.cycle_number}: ${symbol} ${side} - could not find open time`);
      continue;
    }

    const closePrice = closePosition.mark_price;

    // Calculate PnL percentage (price change)
    const priceChange = side === 'long'
      ? (closePrice - openPrice) / openPrice
      : (openPrice - closePrice) / openPrice;

    const pnlPct = priceChange * 100;

    // Use the unrealized_pnl from snapshot (already includes leverage)
    const pnl = closePosition.unrealized_pnl;

    // Calculate holding time
    const openTimestamp = new Date(openTime).getTime();
    const closeTimestamp = new Date(closeDecision.timestamp).getTime();
    const holdingTimeMinutes = (closeTimestamp - openTimestamp) / (1000 * 60);

    closedPositions.push({
      id: nextId++,
      trader_id: closeDecision.trader_id,
      cycle_number: closeDecision.cycle_number,
      timestamp: closeDecision.timestamp,
      symbol: symbol,
      side: side as 'long' | 'short',
      action: closeAction.action as 'close_long' | 'close_short',
      open_time: openTime,
      close_time: closeDecision.timestamp,
      entry_price: openPrice,
      exit_price: closePrice,
      quantity: closePosition.quantity,
      leverage: closePosition.leverage,
      pnl: pnl,
      pnl_pct: pnlPct,
      holding_time_minutes: holdingTimeMinutes,
      reasoning: closeAction.reasoning,
    });
  }

  console.log(`  ✅ Successfully extracted ${closedPositions.length} / ${allCloseActions.length} closed positions`);

  return closedPositions;
}

/**
 * Migrate a single trader
 */
async function migrateTrader(traderId: string): Promise<void> {
  console.log(`\n🔄 Migrating trader: ${traderId}`);

  // Read decision logs
  console.log(`  📁 Reading decision logs...`);
  const decisions = await readDecisionLogs(traderId);

  if (decisions.length === 0) {
    console.log(`  ⚠️  No decision logs found, skipping`);
    return;
  }

  console.log(`  📊 Found ${decisions.length} decision logs`);

  // Extract closed positions
  console.log(`  🔍 Extracting closed positions...`);
  const closedPositions = extractClosedPositions(decisions);

  if (closedPositions.length === 0) {
    console.log(`  ⚠️  No closed positions found, skipping`);
    return;
  }

  // Write to closed_positions.json
  const outputPath = path.join(DECISION_LOGS_DIR, traderId, 'closed_positions.json');
  console.log(`  💾 Writing to ${outputPath}...`);

  await fs.writeFile(
    outputPath,
    JSON.stringify(closedPositions, null, 2),
    'utf-8'
  );

  console.log(`  ✅ Migration complete for ${traderId}: ${closedPositions.length} positions saved`);
}

/**
 * Get all trader IDs from decision_logs directory
 */
async function getAllTraderIds(): Promise<string[]> {
  try {
    const entries = await fs.readdir(DECISION_LOGS_DIR, { withFileTypes: true });
    return entries
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name);
  } catch (error) {
    console.error('Failed to read decision_logs directory:', error);
    return [];
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Closed Positions Migration Script\n');

  const traderId = process.argv[2];

  if (traderId) {
    // Migrate single trader
    await migrateTrader(traderId);
  } else {
    // Migrate all traders
    console.log('📁 Scanning for traders...');
    const traderIds = await getAllTraderIds();

    if (traderIds.length === 0) {
      console.log('❌ No traders found in decision_logs directory');
      return;
    }

    console.log(`📊 Found ${traderIds.length} trader(s): ${traderIds.join(', ')}\n`);

    for (const id of traderIds) {
      await migrateTrader(id);
    }
  }

  console.log('\n✅ Migration complete!\n');
}

main().catch(error => {
  console.error('\n❌ Migration failed:', error);
  process.exit(1);
});
