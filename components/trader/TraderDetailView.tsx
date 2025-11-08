'use client';

import { useState } from 'react';
import {
  useStatus,
  useAccount,
  usePositions,
  useDecisions,
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
import { useTranslations } from '@/lib/i18n-context';

interface TraderDetailViewProps {
  traderId: string;
  showHeader?: boolean; // Whether to show the control header (for standalone page)
}

export function TraderDetailView({ traderId, showHeader = false }: TraderDetailViewProps) {
  const t = useTranslations();
  const [selectedDecision, setSelectedDecision] = useState<DecisionRecord | null>(null);

  const { data: status } = useStatus(traderId);
  const { data: account } = useAccount(traderId);
  const { data: positions } = usePositions(traderId);
  const { data: decisions } = useDecisions(traderId);
  const { data: equityHistory } = useEquityHistory(traderId);
  const { data: performance } = usePerformance(traderId);

  if (!status || !account) {
    return (
      <div className="space-y-6">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  const isRunning = status.is_running;
  const isProfitable = account.total_pnl >= 0;

  return (
    <>
      {/* Not Started Banner */}
      {!isRunning && status.call_count === 0 && (
        <div className="mb-6 p-4 bg-gradient-to-r from-primary/10 to-accent-purple/10 border-2 border-primary/30 rounded-xl">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="text-3xl">🚀</div>
              <div>
                <h3 className="text-base font-bold text-text-primary mb-1">
                  {t.trader.traderNotStartedTitle}
                </h3>
                <p className="text-xs text-text-secondary">
                  {t.trader.traderNotStartedDesc}
                </p>
              </div>
            </div>
            <button
              onClick={async () => {
                try {
                  await fetch(`/api/trade/start?trader_id=${traderId}`, { method: 'POST' });
                  window.location.reload();
                } catch (error) {
                  alert(t.trader.failedToStartTrader);
                }
              }}
              className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-semibold text-sm whitespace-nowrap"
            >
              {t.trader.startTradingButton}
            </button>
          </div>
        </div>
      )}

      {/* Trader Header - Compact */}
      <div className="mb-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent-purple flex items-center justify-center text-2xl shadow-lg">
              🤖
            </div>
            <div>
              <h1 className="text-2xl font-bold text-text-primary">{status.trader_name || t.trader.traderDetails}</h1>
              <div className="flex items-center gap-2 text-xs text-text-secondary">
                <span>{t.trader.ai}: <span className="font-semibold text-primary">{status.ai_provider?.toUpperCase() || 'UNKNOWN'}</span></span>
                <span>•</span>
                <span>{t.trader.cyclesLabel}: {status.call_count || 0}</span>
                <span>•</span>
                <span>{t.trader.runtimeLabel}: {status.runtime_minutes || 0}m</span>
                <span>•</span>
                {/* Status Indicator */}
                <div className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-success animate-pulse' : 'bg-text-tertiary'}`}></div>
                  <span className={`font-medium ${isRunning ? 'text-success' : 'text-text-tertiary'}`}>
                    {isRunning ? t.trader.liveTrading : t.trader.offline}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Control Buttons - Only shown when showHeader=true */}
          {showHeader && (
            <div className="flex items-center gap-3">
              {/* Start/Stop Button */}
              {isRunning ? (
                <button
                  onClick={async () => {
                    if (!confirm(t.trader.confirmStop)) {
                      return;
                    }
                    try {
                      const response = await fetch(`/api/trade/stop?trader_id=${traderId}`, {
                        method: 'POST',
                      });

                      if (!response.ok) {
                        const error = await response.json();
                        throw new Error(error.error || t.trader.failedToStopTrader);
                      }

                      alert(t.trader.traderStopped);
                      window.location.reload();
                    } catch (error) {
                      alert(error instanceof Error ? error.message : t.trader.failedToStopTrader);
                    }
                  }}
                  className="px-4 py-1.5 bg-warning text-white rounded-lg hover:bg-warning/90 transition-colors font-semibold text-sm flex items-center gap-2"
                >
                  <span>⏸️</span>
                  <span>{t.trader.stopTrading}</span>
                </button>
              ) : (
                <button
                  onClick={async () => {
                    try {
                      const response = await fetch(`/api/trade/start?trader_id=${traderId}`, {
                        method: 'POST',
                      });

                      if (!response.ok) {
                        const error = await response.json();
                        throw new Error(error.error || t.trader.failedToStartTrader);
                      }

                      alert(t.trader.traderStarted);
                      window.location.reload();
                    } catch (error) {
                      alert(error instanceof Error ? error.message : t.trader.failedToStartTrader);
                    }
                  }}
                  className="px-4 py-1.5 bg-success text-white rounded-lg hover:bg-success/90 transition-colors font-semibold text-sm flex items-center gap-2"
                >
                  <span>▶️</span>
                  <span>{t.trader.startTrading}</span>
                </button>
              )}

              {/* Emergency Stop (only when running) */}
              {isRunning && (
                <button
                  onClick={async () => {
                    if (!confirm(t.trader.confirmEmergencyStop)) {
                      return;
                    }
                    try {
                      const response = await fetch('/api/emergency-stop', {
                        method: 'POST',
                      });

                      if (!response.ok) {
                        const error = await response.json();
                        throw new Error(error.error || t.trader.failedToEmergencyStop);
                      }

                      alert(t.trader.emergencyStopComplete);
                      window.location.reload();
                    } catch (error) {
                      alert(error instanceof Error ? error.message : t.trader.failedToEmergencyStop);
                    }
                  }}
                  className="px-4 py-1.5 bg-danger text-white rounded-lg hover:bg-danger/90 transition-colors font-semibold text-sm flex items-center gap-2"
                >
                  <span>🚨</span>
                  <span>{t.trader.emergencyStop}</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Account Overview - Top Row */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <Card className="p-3">
          <div className="text-xs text-text-secondary uppercase tracking-wider mb-1">{t.trader.totalEquity}</div>
          <div className="text-xl font-bold text-text-primary">{formatUSD(account.total_equity)}</div>
          <div className={`text-xs font-semibold ${isProfitable ? 'text-success' : 'text-danger'}`}>
            {formatPercent(account.total_pnl_pct)}
          </div>
        </Card>

        <Card className="p-3">
          <div className="text-xs text-text-secondary uppercase tracking-wider mb-1">{t.trader.available}</div>
          <div className="text-xl font-bold text-text-primary">{formatUSD(account.available_balance)}</div>
          <div className="text-xs text-text-tertiary">
            {account.total_equity > 0
              ? `${((account.available_balance / account.total_equity) * 100).toFixed(1)}% ${t.trader.free}`
              : `100% ${t.trader.free}`
            }
          </div>
        </Card>

        <Card className="p-3">
          <div className="text-xs text-text-secondary uppercase tracking-wider mb-1">{t.trader.totalPnL}</div>
          <div className={`text-xl font-bold ${isProfitable ? 'text-success' : 'text-danger'}`}>
            {isProfitable ? '+' : ''}{formatUSD(account.total_pnl)}
          </div>
          <div className={`text-xs font-semibold ${isProfitable ? 'text-success' : 'text-danger'}`}>
            {formatPercent(account.total_pnl_pct)}
          </div>
        </Card>

        <Card className="p-3">
          <div className="text-xs text-text-secondary uppercase tracking-wider mb-1">{t.trader.positions}</div>
          <div className="text-xl font-bold text-text-primary">{account.position_count}</div>
          <div className="text-xs text-text-tertiary">
            {t.trader.margin}: {(account.margin_used_pct || 0).toFixed(1)}%
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
                <TabsTrigger value="performance" className="flex-1">{t.trader.performance}</TabsTrigger>
                <TabsTrigger value="decisions" className="flex-1">{t.trader.decisions}</TabsTrigger>
                <TabsTrigger value="trades" className="flex-1">{t.trader.trades}</TabsTrigger>
              </TabsList>

              {/* Performance Tab */}
              <TabsContent value="performance" className="p-4">
                {performance ? (
                  <PerformanceMetrics performance={performance} />
                ) : (
                  <div className="text-center py-12 text-text-tertiary">
                    <div className="text-4xl mb-2">📊</div>
                    <div className="text-sm">{t.trader.loadingPerformance}</div>
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
                            <span className="font-semibold text-text-primary text-sm">{t.trader.cycle} #{decision.cycle_number}</span>
                            <span className="text-xs text-text-secondary ml-2">
                              {new Date(decision.timestamp).toLocaleString()}
                            </span>
                          </div>
                          <Badge variant={decision.success ? 'success' : 'danger'}>
                            {decision.success ? t.trader.success : t.trader.failed}
                          </Badge>
                        </div>
                        {decision.decisions && decision.decisions.length > 0 && (
                          <div className="text-xs text-text-secondary mb-1">
                            {decision.decisions.length} {t.trader.actions}
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
                    <div className="font-semibold mb-1 text-sm">{t.trader.noDecisionsYet}</div>
                    <div className="text-xs">{t.trader.decisionsWillAppear}</div>
                  </div>
                )}
              </TabsContent>

              {/* Trades Tab */}
              <TabsContent value="trades" className="p-4">
                {decisions && decisions.length > 0 ? (
                  (() => {
                    // Extract all trade actions (open/close) from decisions
                    const allTrades: Array<{
                      cycle: number;
                      timestamp: string;
                      symbol: string;
                      action: string;
                      actionLabel: string;
                      actionType: 'buy' | 'sell';
                    }> = [];

                    decisions.forEach(decision => {
                      decision.decisions.forEach(d => {
                        if (d.action === 'open_long' || d.action === 'open_short' ||
                            d.action === 'close_long' || d.action === 'close_short') {
                          let actionLabel = '';
                          let actionType: 'buy' | 'sell' = 'buy';

                          if (d.action === 'open_long') {
                            actionLabel = t.trader.openLong;
                            actionType = 'buy';
                          } else if (d.action === 'open_short') {
                            actionLabel = t.trader.openShort;
                            actionType = 'sell';
                          } else if (d.action === 'close_long') {
                            actionLabel = t.trader.closeLong;
                            actionType = 'sell';
                          } else if (d.action === 'close_short') {
                            actionLabel = t.trader.closeShort;
                            actionType = 'buy';
                          }

                          allTrades.push({
                            cycle: decision.cycle_number,
                            timestamp: decision.timestamp,
                            symbol: d.symbol,
                            action: d.action,
                            actionLabel,
                            actionType,
                          });
                        }
                      });
                    });

                    return allTrades.length > 0 ? (
                      <div className="space-y-2 max-h-[600px] overflow-y-auto">
                        {allTrades.map((trade, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between p-3 bg-background-secondary rounded-lg border border-border hover:border-primary/30 transition-all"
                          >
                            <div className="flex items-center gap-3">
                              {/* Action Icon */}
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold ${
                                trade.actionType === 'buy'
                                  ? 'bg-success/10 text-success'
                                  : 'bg-danger/10 text-danger'
                              }`}>
                                {trade.actionType === 'buy' ? '↗' : '↘'}
                              </div>

                              {/* Trade Details */}
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className={`text-sm font-bold ${
                                    trade.actionType === 'buy' ? 'text-success' : 'text-danger'
                                  }`}>
                                    {trade.actionLabel}
                                  </span>
                                  <span className="text-sm font-semibold text-text-primary">
                                    {trade.symbol}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-text-secondary">
                                  <span>{t.trader.cycle} #{trade.cycle}</span>
                                  <span>•</span>
                                  <span>{new Date(trade.timestamp).toLocaleString()}</span>
                                </div>
                              </div>
                            </div>

                            {/* Badge */}
                            <Badge variant={trade.actionType === 'buy' ? 'success' : 'danger'}>
                              {trade.actionType === 'buy' ? t.trader.buy : t.trader.sell}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12 text-text-tertiary">
                        <div className="text-4xl mb-2">📊</div>
                        <div className="font-semibold mb-1 text-sm">{t.trader.noTradesYet}</div>
                        <div className="text-xs">{t.trader.tradesWillAppear}</div>
                      </div>
                    );
                  })()
                ) : (
                  <div className="text-center py-12 text-text-tertiary">
                    <div className="text-4xl mb-2">📊</div>
                    <div className="font-semibold mb-1 text-sm">{t.trader.noTradesYet}</div>
                    <div className="text-xs">{t.trader.tradesWillAppear}</div>
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
            <h3 className="text-sm font-bold text-text-primary mb-3">{t.trader.equityPerformance}</h3>
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
                  <div className="text-sm font-semibold mb-1">{t.trader.noEquityHistory}</div>
                  <div className="text-xs">{t.trader.chartWillAppear}</div>
                </div>
              </div>
            )}
          </Card>

          {/* Positions Table - Compact */}
          <Card className="p-4">
            <h3 className="text-sm font-bold text-text-primary mb-3">{t.trader.currentPositions}</h3>
            {positions && positions.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="border-b border-border">
                    <tr className="text-left">
                      <th className="pb-2 font-semibold text-text-secondary">{t.trader.symbol}</th>
                      <th className="pb-2 font-semibold text-text-secondary">{t.trader.side}</th>
                      <th className="pb-2 font-semibold text-text-secondary">{t.trader.entryPrice}</th>
                      <th className="pb-2 font-semibold text-text-secondary">{t.trader.lev}</th>
                      <th className="pb-2 font-semibold text-text-secondary text-right">{t.trader.unrealizedPnL}</th>
                      <th className="pb-2 font-semibold text-text-secondary text-center">{t.trader.action}</th>
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
                        <td className="py-2 text-center">
                          <button
                            onClick={async () => {
                              if (!confirm(t.trader.confirmClosePosition.replace('{side}', pos.side).replace('{symbol}', pos.symbol))) {
                                return;
                              }
                              try {
                                const response = await fetch('/api/positions/close', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    trader_id: traderId,
                                    symbol: pos.symbol,
                                    side: pos.side,
                                  }),
                                });

                                if (!response.ok) {
                                  const error = await response.json();
                                  throw new Error(error.error || t.trader.failedToClosePosition);
                                }

                                window.location.reload();
                              } catch (error) {
                                alert(error instanceof Error ? error.message : t.trader.failedToClosePosition);
                              }
                            }}
                            className="px-3 py-1 bg-danger/10 text-danger hover:bg-danger hover:text-white rounded transition-colors font-semibold"
                          >
                            {t.trader.close}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-text-tertiary">
                <div className="text-4xl mb-2 opacity-30">📊</div>
                <div className="text-xs">{t.trader.noActivePositions}</div>
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
    </>
  );
}
