'use client';

import { PerformanceAnalysis } from '@/types';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatUSD, formatPercent } from '@/lib/utils';

interface PerformanceMetricsProps {
  performance: PerformanceAnalysis;
}

export function PerformanceMetrics({ performance }: PerformanceMetricsProps) {
  const hasData = performance.total_trades > 0;
  const hasSufficientData = performance.total_trades >= 10; // 至少10笔交易才有统计意义

  // 判断夏普比率等级（考虑样本量）
  const getSharpeRating = (sharpe: number, trades: number) => {
    if (!hasData) return { label: '无数据', color: 'text-text-tertiary', bgColor: 'bg-background-secondary' };
    if (trades < 10) return { label: '样本较少', color: 'text-text-secondary', bgColor: 'bg-background-secondary' };
    if (sharpe > 1.5) return { label: '优异', color: 'text-success', bgColor: 'bg-success/10' };
    if (sharpe > 0.5) return { label: '良好', color: 'text-success', bgColor: 'bg-success/10' };
    if (sharpe > 0) return { label: '正收益', color: 'text-success', bgColor: 'bg-success/10' };
    if (sharpe > -0.5) return { label: '轻微亏损', color: 'text-warning', bgColor: 'bg-warning/10' };
    if (sharpe > -1.5) return { label: '需要改进', color: 'text-warning', bgColor: 'bg-warning/10' };
    return { label: '持续亏损', color: 'text-danger', bgColor: 'bg-danger/10' };
  };

  // 获取Sharpe建议
  const getSharpeAdvice = (sharpe: number, trades: number) => {
    if (!hasData) return '📊 开始交易以查看指标';
    if (trades < 5) return '📈 样本太少，继续积累数据';
    if (trades < 10) return '⏳ 样本偏少，建议至少10笔交易后评估';
    if (sharpe > 1.5) return '🚀 表现优异，可适度扩大仓位';
    if (sharpe > 0.5) return '✅ 表现良好，维持当前策略';
    if (sharpe > 0) return '📊 正收益，保持谨慎';
    if (sharpe > -0.5) return '⚠️ 轻微亏损，严格控制风险';
    if (sharpe > -1.5) return '🔍 需要优化策略，降低仓位';
    return '🛑 表现不佳，建议暂停交易深度反思';
  };

  const sharpeRating = getSharpeRating(performance.sharpe_ratio, performance.total_trades);
  const sharpeAdvice = getSharpeAdvice(performance.sharpe_ratio, performance.total_trades);

  return (
    <div className="space-y-4">
      {/* Key Metrics Grid - Compact 2 column */}
      <div className="grid grid-cols-2 gap-3">
        {/* Sharpe Ratio - 最重要的指标 */}
        <Card className={`p-4 ${sharpeRating.bgColor} border-2 ${sharpeRating.color.replace('text-', 'border-')}/30 col-span-2`}>
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs text-text-tertiary uppercase tracking-wider">
              Sharpe Ratio {performance.total_trades < 10 && hasData && `(${performance.total_trades} trades)`}
            </div>
            <Badge variant={hasSufficientData && performance.sharpe_ratio > 0 ? 'success' : hasSufficientData && performance.sharpe_ratio < -0.5 ? 'danger' : 'secondary'}>
              {sharpeRating.label}
            </Badge>
          </div>
          <div className={`text-3xl font-bold ${sharpeRating.color} mb-1`}>
            {hasData ? performance.sharpe_ratio.toFixed(2) : '--'}
          </div>
          <div className="text-xs text-text-secondary">
            {sharpeAdvice}
          </div>
        </Card>

        {/* Win Rate */}
        <Card className="p-4">
          <div className="text-xs text-text-tertiary uppercase tracking-wider mb-1">Win Rate</div>
          <div className="text-2xl font-bold text-text-primary mb-1">
            {formatPercent(performance.win_rate)}
          </div>
          <div className="flex items-center justify-between text-xs text-text-secondary">
            <span>{performance.winning_trades}W</span>
            <span>•</span>
            <span>{performance.losing_trades}L</span>
          </div>
        </Card>

        {/* Profit Factor */}
        <Card className="p-4">
          <div className="text-xs text-text-tertiary uppercase tracking-wider mb-1">Profit Factor</div>
          <div className={`text-2xl font-bold mb-1 ${performance.profit_factor >= 1.5 ? 'text-success' : performance.profit_factor >= 1 ? 'text-text-primary' : 'text-danger'}`}>
            {performance.profit_factor.toFixed(2)}x
          </div>
          <div className="text-xs text-text-secondary">
            {!hasData ? '📊 Awaiting data' :
             performance.profit_factor >= 1.5 ? '✅ 优秀盈亏比' :
             performance.profit_factor >= 1 ? '📊 正盈亏比' :
             '⚠️ 盈利不足'}
          </div>
        </Card>

        {/* Average Profit */}
        <Card className="p-4">
          <div className="text-xs text-text-tertiary uppercase tracking-wider mb-1">Avg Profit</div>
          <div className="text-xl font-bold text-success mb-1">
            +{formatUSD(performance.avg_profit)}
          </div>
          <div className="text-xs text-text-secondary">
            Per win
          </div>
        </Card>

        {/* Average Loss */}
        <Card className="p-4">
          <div className="text-xs text-text-tertiary uppercase tracking-wider mb-1">Avg Loss</div>
          <div className="text-xl font-bold text-danger mb-1">
            {formatUSD(performance.avg_loss)}
          </div>
          <div className="text-xs text-text-secondary">
            Per loss
          </div>
        </Card>

        {/* Max Drawdown */}
        <Card className="p-4">
          <div className="text-xs text-text-tertiary uppercase tracking-wider mb-1">Max Drawdown</div>
          <div className={`text-xl font-bold mb-1 ${Math.abs(performance.max_drawdown) > 20 ? 'text-danger' : hasData ? 'text-warning' : 'text-text-tertiary'}`}>
            {formatPercent(performance.max_drawdown)}
          </div>
          <div className="text-xs text-text-secondary">
            {!hasData ? '📊 No drawdown' :
             Math.abs(performance.max_drawdown) > 20 ? '⚠️ 高风险' : '📉 可接受'}
          </div>
        </Card>

        {/* Total Trades */}
        <Card className="p-4">
          <div className="text-xs text-text-tertiary uppercase tracking-wider mb-1">Total Trades</div>
          <div className="text-xl font-bold text-text-primary mb-1">
            {performance.total_trades}
          </div>
          <div className="text-xs text-text-secondary">
            Completed
          </div>
        </Card>
      </div>
    </div>
  );
}
