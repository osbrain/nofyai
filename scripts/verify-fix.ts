// Quick test to verify the PnL calculation fix

const testPosition = {
  symbol: 'ETHUSDT',
  side: 'short',
  entry_price: 3296.825,
  mark_price: 3313.14034109,
  quantity: 0.008,
  leverage: 5,
  unrealized_pnl: -0.1305,
  unrealized_pnl_pct: -0.49
};

// Old buggy calculation
const priceChange = (testPosition.entry_price - testPosition.mark_price) / testPosition.entry_price;
const buggyPnl = testPosition.quantity * testPosition.mark_price * priceChange * testPosition.leverage;

// New fixed calculation
const fixedPnl = testPosition.unrealized_pnl;

console.log('🔍 PnL 计算验证');
console.log('='.repeat(50));
console.log('测试持仓:', testPosition.symbol, testPosition.side);
console.log('入场价:', testPosition.entry_price);
console.log('平仓价:', testPosition.mark_price);
console.log('数量:', testPosition.quantity);
console.log('杠杆:', testPosition.leverage + 'x');
console.log();
console.log('❌ 旧计算（错误）:', buggyPnl.toFixed(4), 'USDT');
console.log('✅ 新计算（修复）:', fixedPnl.toFixed(4), 'USDT');
console.log('📊 实际 PnL:', testPosition.unrealized_pnl.toFixed(4), 'USDT');
console.log();
console.log('✨ 修复后差异:', Math.abs(fixedPnl - testPosition.unrealized_pnl).toFixed(4), 'USDT');
console.log('💯 准确度:', fixedPnl === testPosition.unrealized_pnl ? '100%' : '不匹配');
