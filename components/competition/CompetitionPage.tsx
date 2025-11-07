'use client';

import { useCompetition, useEquityHistory } from '@/hooks/useTrading';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SkeletonCard } from '@/components/ui/skeleton';
import { ComparisonChart } from '@/components/competition/ComparisonChart';
import { formatUSD, formatPercent, getTraderColor } from '@/lib/utils';
import Link from 'next/link';
import { useTranslations } from '@/lib/i18n-context';

export function CompetitionPage() {
  const { data: competition, error, isLoading } = useCompetition();
  const t = useTranslations();

  // TODO: Implement proper equity history fetching without violating React Hooks rules
  // For now, we'll disable the comparison chart to avoid Hooks violations
  // const traderEquityData = competition?.traders.map(trader => {
  //   const { data: equityHistory } = useEquityHistory(trader.trader_id);
  //   return {
  //     traderId: trader.trader_id,
  //     traderName: trader.trader_name,
  //     data: equityHistory || [],
  //   };
  // }) || [];

  if (error) {
    return (
      <Card className="p-8">
        <div className="text-center text-danger">
          <div className="text-4xl mb-4">⚠️</div>
          <div className="font-semibold mb-2">{t.competition.failedToLoad}</div>
          <div className="text-sm text-text-secondary">{error.message}</div>
        </div>
      </Card>
    );
  }

  if (isLoading || !competition) {
    return (
      <div className="space-y-6">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  // Sort traders by ROI
  const sortedTraders = [...competition.traders].sort(
    (a, b) => b.total_pnl_pct - a.total_pnl_pct
  );

  const leader = sortedTraders[0];

  return (
    <div className="space-y-6">
      {/* Competition Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-accent-blue via-accent-purple to-accent-cyan flex items-center justify-center text-3xl shadow-lg">
            🏆
          </div>
          <div>
            <h1 className="text-3xl font-bold text-text-primary flex items-center gap-3">
              {t.competition.title}
              <Badge variant="primary">
                {competition.count} {competition.count === 1 ? t.competition.trader : t.competition.traders}
              </Badge>
            </h1>
            <p className="text-text-secondary text-sm mt-1">
              {t.competition.subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Configuration Link */}
          <Link
            href="/config"
            className="px-4 py-2 bg-white border border-border rounded-lg hover:border-primary/50 transition-all flex items-center gap-2 text-sm font-semibold text-text-secondary hover:text-primary"
          >
            <span>⚙️</span>
            <span>{t.competition.config}</span>
          </Link>

          {leader && (
            <div className="text-right">
              <div className="text-xs text-text-secondary mb-1">{t.competition.currentLeader}</div>
              <div className="text-lg font-bold text-primary">{leader.trader_name}</div>
              <div className={`text-sm font-semibold ${leader.total_pnl >= 0 ? 'text-success' : 'text-danger'}`}>
                {formatPercent(leader.total_pnl_pct)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Performance Comparison Chart - Temporarily disabled due to Hooks rules */}
      {/* TODO: Implement comparison chart with proper Hooks usage */}
      {/* {competition.traders.length > 0 && (
        <Card className="p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-text-primary">Performance Comparison</h2>
            <div className="text-xs text-text-secondary">ROI % over time</div>
          </div>
          <ComparisonChart traders={traderEquityData} />
        </Card>
      )} */}

      {/* Leaderboard */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-text-primary">{t.competition.leaderboard}</h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-secondary">{t.competition.rankedByROI}</span>
            <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
          </div>
        </div>

        <div className="space-y-3">
          {sortedTraders.map((trader, index) => {
            const isLeader = index === 0;
            const traderColor = getTraderColor(index);
            const isRunning = trader.is_running;

            return (
              <Link
                key={trader.trader_id}
                href={`/trader/${trader.trader_id}`}
                className="block"
              >
                <div
                  className={`
                    flex items-center justify-between p-5 rounded-xl border transition-all duration-300
                    ${isLeader
                      ? 'bg-gradient-to-r from-primary/5 to-transparent border-primary/30 shadow-md'
                      : 'bg-background-secondary border-border hover:border-primary/30'
                    }
                    hover:shadow-lg cursor-pointer
                  `}
                >
                  {/* Left: Rank & Info */}
                  <div className="flex items-center gap-4">
                    {/* Rank Badge */}
                    <div className="text-3xl">
                      {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : (
                        <span className="text-lg font-bold text-text-tertiary">#{index + 1}</span>
                      )}
                    </div>

                    {/* Trader Info */}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-text-primary text-lg">
                          {trader.trader_name}
                        </span>
                        {isRunning ? (
                          <Badge variant="success">{t.competition.live}</Badge>
                        ) : (
                          <Badge variant="secondary">{t.trader.offline}</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-text-secondary">
                        <span>{t.competition.model}: <span className="font-semibold" style={{ color: traderColor }}>{trader.ai_model?.toUpperCase() || 'UNKNOWN'}</span></span>
                        <span>•</span>
                        <span>{trader.call_count || 0} {t.competition.cycles}</span>
                        <span>•</span>
                        <span>{trader.position_count || 0} {t.competition.positions}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Performance Metrics */}
                  <div className="flex items-center gap-8">
                    {/* Total Equity */}
                    <div className="text-right">
                      <div className="text-xs text-text-secondary mb-1">{t.competition.totalEquity}</div>
                      <div className="text-lg font-bold text-text-primary">
                        {formatUSD(trader.total_equity || 0)}
                      </div>
                    </div>

                    {/* P&L */}
                    <div className="text-right min-w-[120px]">
                      <div className="text-xs text-text-secondary mb-1">{t.competition.profitAndLoss}</div>
                      <div className={`text-lg font-bold ${(trader.total_pnl || 0) >= 0 ? 'text-success' : 'text-danger'}`}>
                        {(trader.total_pnl || 0) >= 0 ? '+' : ''}{formatUSD(trader.total_pnl || 0)}
                      </div>
                      <div className={`text-sm font-semibold ${(trader.total_pnl_pct || 0) >= 0 ? 'text-success' : 'text-danger'}`}>
                        {formatPercent(trader.total_pnl_pct || 0)}
                      </div>
                    </div>

                    {/* Margin Usage */}
                    <div className="text-right">
                      <div className="text-xs text-text-secondary mb-1">{t.competition.marginUsed}</div>
                      <div className="text-lg font-semibold text-text-primary">
                        {(trader.margin_used_pct || 0).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {sortedTraders.length === 0 && (
          <div className="text-center py-16 text-text-tertiary">
            <div className="text-6xl mb-4 opacity-30">🤖</div>
            <div className="text-lg font-semibold mb-2">{t.competition.noTradersActive}</div>
            <div className="text-sm">{t.competition.startBackend}</div>
          </div>
        )}
      </Card>
    </div>
  );
}
