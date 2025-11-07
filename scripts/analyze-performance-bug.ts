import fs from 'fs/promises';
import path from 'path';

async function analyzePerformanceBug() {
  console.log('📊 分析 Performance 数据计算问题\n');
  console.log('='.repeat(60));

  // 读取最新的决策文件
  const logDir = '/Users/aiesst/Code/project/nofyai/decision_logs/aster_deepseek';
  const files = await fs.readdir(logDir);
  const latestFile = files.sort().reverse()[0];
  const latestPath = path.join(logDir, latestFile);
  const latestData = JSON.parse(await fs.readFile(latestPath, 'utf-8'));

  console.log('\n📄 最新决策数据 (Cycle #' + latestData.cycle_number + ')');
  console.log('时间:', latestData.timestamp);
  console.log('总权益:', latestData.account_snapshot.total_equity.toFixed(2), 'USDT');
  console.log('总盈亏:', latestData.account_snapshot.total_pnl_pct.toFixed(2), '%');
  console.log('持仓数:', latestData.account_snapshot.position_count);

  // 找出所有有平仓操作的决策
  const allFiles = await fs.readdir(logDir);
  const closeDecisions = [];

  for (const file of allFiles) {
    if (!file.endsWith('.json')) continue;
    const filePath = path.join(logDir, file);
    const data = JSON.parse(await fs.readFile(filePath, 'utf-8'));

    const hasClose = data.decisions.some((d: any) =>
      d.action === 'close_long' || d.action === 'close_short'
    );

    if (hasClose) {
      closeDecisions.push(data);
    }
  }

  console.log('\n\n📌 找到', closeDecisions.length, '个平仓决策');
  console.log('='.repeat(60));

  // 分析每个平仓交易
  let totalCalculatedPnl = 0;

  for (const decision of closeDecisions.slice(0, 5)) {
    console.log('\n🔍 Cycle #' + decision.cycle_number);
    console.log('时间:', decision.timestamp);

    for (const action of decision.decisions) {
      if (action.action === 'close_long' || action.action === 'close_short') {
        const side = action.action === 'close_long' ? 'long' : 'short';
        const pos = decision.positions_snapshot.find((p: any) =>
          p.symbol === action.symbol && p.side === side
        );

        if (pos) {
          console.log('\n  Symbol:', action.symbol);
          console.log('  Side:', side);
          console.log('  Entry Price:', pos.entry_price);
          console.log('  Close Price:', pos.mark_price);
          console.log('  Quantity:', pos.quantity);
          console.log('  Leverage:', pos.leverage + 'x');
          console.log('  Unrealized PnL:', pos.unrealized_pnl.toFixed(4), 'USDT');
          console.log('  Unrealized PnL %:', pos.unrealized_pnl_pct.toFixed(2), '%');

          // 当前的计算方式（有bug）
          const priceChange = side === 'long'
            ? (pos.mark_price - pos.entry_price) / pos.entry_price
            : (pos.entry_price - pos.mark_price) / pos.entry_price;
          const buggyPnl = pos.quantity * pos.mark_price * priceChange * pos.leverage;

          // 正确的计算方式
          const correctPnl = side === 'long'
            ? pos.quantity * (pos.mark_price - pos.entry_price) * pos.leverage
            : pos.quantity * (pos.entry_price - pos.mark_price) * pos.leverage;

          console.log('\n  ❌ 当前公式计算 PnL:', buggyPnl.toFixed(4), 'USDT');
          console.log('  ✅ 正确公式计算 PnL:', correctPnl.toFixed(4), 'USDT');
          console.log('  📊 实际未实现 PnL:', pos.unrealized_pnl.toFixed(4), 'USDT');
          console.log('  🔴 差异:', Math.abs(buggyPnl - pos.unrealized_pnl).toFixed(4), 'USDT');

          totalCalculatedPnl += pos.unrealized_pnl;
        }
      }
    }
  }

  console.log('\n\n' + '='.repeat(60));
  console.log('📈 总结分析');
  console.log('='.repeat(60));
  console.log('\n问题发现：');
  console.log('1. Performance 统计的是已平仓交易的 PnL');
  console.log('2. 当前账户显示的是总盈亏（包括未平仓持仓）');
  console.log('3. 如果已平仓交易都盈利，但当前持仓亏损，会出现矛盾');
  console.log('4. PnL 计算公式可能有误差\n');

  console.log('建议：');
  console.log('1. 修正 Performance 的 PnL 计算公式');
  console.log('2. 在页面上明确显示：Performance = 已平仓交易统计');
  console.log('3. 添加"当前持仓盈亏"的单独显示\n');
}

analyzePerformanceBug().catch(console.error);
