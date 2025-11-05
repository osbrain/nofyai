'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import {
  useStatus,
  useAccount,
  usePositions,
  useLatestDecisions,
  useEquityHistory,
  usePerformance,
} from '@/hooks/useTrading';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SkeletonCard } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { EquityChart } from '@/components/trader/EquityChart';
import { DecisionDetailModal } from '@/components/trader/DecisionDetailModal';
import { PerformanceMetrics } from '@/components/trader/PerformanceMetrics';
import { formatUSD, formatPercent } from '@/lib/utils';
import { DecisionRecord } from '@/types';

export default function TraderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [selectedDecision, setSelectedDecision] = useState<DecisionRecord | null>(null);

  const { data: status } = useStatus(id);
  const { data: account } = useAccount(id);
  const { data: positions } = usePositions(id);
  const { data: decisions } = useLatestDecisions(id);
  const { data: equityHistory } = useEquityHistory(id);
  const { data: performance } = usePerformance(id);

  if (!status || !account) {
    return (
      <div className="min-h-screen bg-background-secondary">
        <header className="sticky top-0 z-50 bg-white border-b border-border shadow-sm">
          <div className="w-full px-6">
            <div className="flex items-center h-16">
              <Link href="/" className="text-sm text-primary hover:underline">
                ← Back to Competition
              </Link>
            </div>
          </div>
        </header>
        <main className="w-full px-6 py-8">
          <div className="space-y-6">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </main>
      </div>
    );
  }

  const isRunning = status.is_running;
  const isProfitable = account.total_pnl >= 0;

  return (
    <div className="min-h-screen bg-background-secondary">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-border shadow-sm">
        <div className="w-full px-6">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="text-sm text-primary hover:underline flex items-center gap-2">
              <span>←</span>
              <span>Back to Competition</span>
            </Link>

            <div className="flex items-center gap-4">
              {isRunning ? (
                <Badge variant="success">Live Trading</Badge>
              ) : (
                <Badge variant="secondary">Offline</Badge>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full px-6 py-6">
        {/* Not Started Banner */}
        {!isRunning && status.call_count === 0 && (
          <div className="mb-6 p-4 bg-gradient-to-r from-primary/10 to-accent-purple/10 border-2 border-primary/30 rounded-xl">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="text-3xl">🚀</div>
                <div>
                  <h3 className="text-base font-bold text-text-primary mb-1">
                    Trader Not Started
                  </h3>
                  <p className="text-xs text-text-secondary">
                    Start the AI trader to begin autonomous trading
                  </p>
                </div>
              </div>
              <button
                onClick={async () => {
                  try {
                    await fetch(`/api/trade/start?trader_id=${id}`, { method: 'POST' });
                    window.location.reload();
                  } catch (error) {
                    alert('Failed to start trader');
                  }
                }}
                className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-semibold text-sm whitespace-nowrap"
              >
                Start Trading
              </button>
            </div>
          </div>
        )}

        {/* Trader Header - Compact */}
        <div className="mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent-purple flex items-center justify-center text-2xl shadow-lg">
              🤖
            </div>
            <div>
              <h1 className="text-2xl font-bold text-text-primary">Trader Details</h1>
              <div className="flex items-center gap-3 text-xs text-text-secondary">
                <span>AI: <span className="font-semibold text-primary">{status.ai_provider?.toUpperCase() || 'UNKNOWN'}</span></span>
                <span>•</span>
                <span>Cycles: {status.call_count || 0}</span>
                <span>•</span>
                <span>Runtime: {status.runtime_minutes || 0}m</span>
              </div>
            </div>
          </div>
        </div>

        {/* Account Overview - Top Row */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          <Card className="p-3">
            <div className="text-xs text-text-secondary uppercase tracking-wider mb-1">Total Equity</div>
            <div className="text-xl font-bold text-text-primary">{formatUSD(account.total_equity)}</div>
            <div className={`text-xs font-semibold ${isProfitable ? 'text-success' : 'text-danger'}`}>
              {formatPercent(account.total_pnl_pct)}
            </div>
          </Card>

          <Card className="p-3">
            <div className="text-xs text-text-secondary uppercase tracking-wider mb-1">Available</div>
            <div className="text-xl font-bold text-text-primary">{formatUSD(account.available_balance)}</div>
            <div className="text-xs text-text-tertiary">
              {account.total_equity > 0
                ? `${((account.available_balance / account.total_equity) * 100).toFixed(1)}% free`
                : '100% free'
              }
            </div>
          </Card>

          <Card className="p-3">
            <div className="text-xs text-text-secondary uppercase tracking-wider mb-1">Total P&L</div>
            <div className={`text-xl font-bold ${isProfitable ? 'text-success' : 'text-danger'}`}>
              {isProfitable ? '+' : ''}{formatUSD(account.total_pnl)}
            </div>
            <div className={`text-xs font-semibold ${isProfitable ? 'text-success' : 'text-danger'}`}>
              {formatPercent(account.total_pnl_pct)}
            </div>
          </Card>

          <Card className="p-3">
            <div className="text-xs text-text-secondary uppercase tracking-wider mb-1">Positions</div>
            <div className="text-xl font-bold text-text-primary">{account.position_count}</div>
            <div className="text-xs text-text-tertiary">
              Margin: {(account.margin_used_pct || 0).toFixed(1)}%
            </div>
          </Card>
        </div>

        {/* Two Column Layout - Adjusted ratio */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* LEFT COLUMN - Performance & Decisions Tabs (2/5 width) */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="overflow-hidden h-full">
              <Tabs defaultValue="performance">
                <TabsList className="w-full">
                  <TabsTrigger value="performance" className="flex-1">Performance</TabsTrigger>
                  <TabsTrigger value="decisions" className="flex-1">Decisions</TabsTrigger>
                </TabsList>

                {/* Performance Tab */}
                <TabsContent value="performance" className="p-4">
                  {performance ? (
                    <PerformanceMetrics performance={performance} />
                  ) : (
                    <div className="text-center py-12 text-text-tertiary">
                      <div className="text-4xl mb-2">📊</div>
                      <div className="text-sm">Loading performance data...</div>
                    </div>
                  )}
                </TabsContent>

                {/* Decisions Tab */}
                <TabsContent value="decisions" className="p-4">
                  {decisions && decisions.length > 0 ? (
                    <div className="space-y-3 max-h-[600px] overflow-y-auto">
                      {decisions.map((decision, i) => (
                        <div
                          key={i}
                          className="p-3 bg-background-secondary rounded-lg border border-border hover:border-primary/50 transition-all cursor-pointer"
                          onClick={() => setSelectedDecision(decision)}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <span className="font-semibold text-text-primary text-sm">Cycle #{decision.cycle_number}</span>
                              <span className="text-xs text-text-secondary ml-2">
                                {new Date(decision.timestamp).toLocaleString()}
                              </span>
                            </div>
                            <Badge variant={decision.success ? 'success' : 'danger'}>
                              {decision.success ? 'Success' : 'Failed'}
                            </Badge>
                          </div>
                          {decision.decisions && decision.decisions.length > 0 && (
                            <div className="text-xs text-text-secondary mb-1">
                              {decision.decisions.length} action(s)
                            </div>
                          )}
                          {decision.cot_trace && (
                            <div className="text-xs text-text-tertiary truncate">
                              💭 {decision.cot_trace.substring(0, 100)}...
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-text-tertiary">
                      <div className="text-4xl mb-2">🧠</div>
                      <div className="font-semibold mb-1 text-sm">No Decisions Yet</div>
                      <div className="text-xs">AI decisions will appear here</div>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </Card>
          </div>

          {/* RIGHT COLUMN - Chart & Positions (3/5 width) */}
          <div className="lg:col-span-3 space-y-6">
            {/* Equity Chart - Large */}
            <Card className="p-4">
              <h3 className="text-sm font-bold text-text-primary mb-3">Equity Performance</h3>
              {equityHistory && equityHistory.length > 0 ? (
                <div className="h-[400px]">
                  <EquityChart
                    data={equityHistory}
                    initialBalance={status.initial_balance}
                  />
                </div>
              ) : (
                <div className="h-[400px] flex items-center justify-center text-text-tertiary">
                  <div className="text-center">
                    <div className="text-5xl mb-3 opacity-30">📈</div>
                    <div className="text-sm font-semibold mb-1">No Equity History</div>
                    <div className="text-xs">Chart will appear as trading progresses</div>
                  </div>
                </div>
              )}
            </Card>

            {/* Positions Table - Compact */}
            <Card className="p-4">
              <h3 className="text-sm font-bold text-text-primary mb-3">Current Positions</h3>
              {positions && positions.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="border-b border-border">
                      <tr className="text-left">
                        <th className="pb-2 font-semibold text-text-secondary">Symbol</th>
                        <th className="pb-2 font-semibold text-text-secondary">Side</th>
                        <th className="pb-2 font-semibold text-text-secondary">Entry</th>
                        <th className="pb-2 font-semibold text-text-secondary">Lev</th>
                        <th className="pb-2 font-semibold text-text-secondary text-right">P&L</th>
                      </tr>
                    </thead>
                    <tbody>
                      {positions.map((pos, i) => (
                        <tr key={i} className="border-b border-border/50">
                          <td className="py-2 font-semibold">{pos.symbol}</td>
                          <td className="py-2">
                            <Badge variant={pos.side === 'long' ? 'success' : 'danger'}>
                              {pos.side.toUpperCase()}
                            </Badge>
                          </td>
                          <td className="py-2 font-mono">{formatUSD(pos.entry_price)}</td>
                          <td className="py-2 font-semibold text-primary">{pos.leverage}x</td>
                          <td className={`py-2 text-right ${pos.unrealized_pnl >= 0 ? 'text-success' : 'text-danger'}`}>
                            <div className="font-semibold">
                              {pos.unrealized_pnl >= 0 ? '+' : ''}{formatUSD(pos.unrealized_pnl)}
                            </div>
                            <div className="text-xs opacity-75">
                              ({formatPercent(pos.unrealized_pnl_pct)})
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-text-tertiary">
                  <div className="text-4xl mb-2 opacity-30">📊</div>
                  <div className="text-xs">No active positions</div>
                </div>
              )}
            </Card>
          </div>
        </div>

        {/* Decision Detail Modal */}
        <DecisionDetailModal
          decision={selectedDecision}
          onClose={() => setSelectedDecision(null)}
        />
      </main>
    </div>
  );
}
