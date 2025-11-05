'use client';

import { useConfig } from '@/hooks/useTrading';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SkeletonCard } from '@/components/ui/skeleton';

export function ConfigViewer() {
  const { data: config, error, isLoading } = useConfig();

  if (error) {
    return (
      <Card className="p-8">
        <div className="text-center text-danger">
          <div className="text-4xl mb-4">⚠️</div>
          <div className="font-semibold mb-2">Failed to load configuration</div>
          <div className="text-sm text-text-secondary">{error.message}</div>
        </div>
      </Card>
    );
  }

  if (isLoading || !config) {
    return (
      <div className="space-y-6">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* System Configuration */}
      <Card className="p-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <span>⚙️</span>
            <span>System Configuration</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Leverage Configuration */}
            <div className="p-4 bg-background-secondary rounded-lg">
              <div className="text-xs text-text-tertiary uppercase tracking-wider mb-2">
                BTC/ETH Leverage
              </div>
              <div className="text-2xl font-bold text-primary">
                {config.leverage.btc_eth_leverage}x
              </div>
            </div>

            <div className="p-4 bg-background-secondary rounded-lg">
              <div className="text-xs text-text-tertiary uppercase tracking-wider mb-2">
                Altcoin Leverage
              </div>
              <div className="text-2xl font-bold text-primary">
                {config.leverage.altcoin_leverage}x
              </div>
            </div>

            {/* Risk Management */}
            <div className="p-4 bg-background-secondary rounded-lg">
              <div className="text-xs text-text-tertiary uppercase tracking-wider mb-2">
                Max Daily Loss
              </div>
              <div className="text-2xl font-bold text-danger">
                {config.max_daily_loss}%
              </div>
            </div>

            <div className="p-4 bg-background-secondary rounded-lg">
              <div className="text-xs text-text-tertiary uppercase tracking-wider mb-2">
                Max Drawdown
              </div>
              <div className="text-2xl font-bold text-danger">
                {config.max_drawdown}%
              </div>
            </div>

            <div className="p-4 bg-background-secondary rounded-lg">
              <div className="text-xs text-text-tertiary uppercase tracking-wider mb-2">
                Stop Trading Duration
              </div>
              <div className="text-2xl font-bold text-warning">
                {config.stop_trading_minutes} min
              </div>
            </div>

            {/* Server Configuration */}
            <div className="p-4 bg-background-secondary rounded-lg">
              <div className="text-xs text-text-tertiary uppercase tracking-wider mb-2">
                API Server Port
              </div>
              <div className="text-2xl font-bold text-text-primary">
                {config.api_server_port}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Coin Pool Configuration */}
      <Card className="p-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <span>🪙</span>
            <span>Coin Pool Configuration</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-background-secondary rounded-lg">
              <div>
                <div className="text-sm font-semibold text-text-primary mb-1">
                  Use Default Coins
                </div>
                <div className="text-xs text-text-tertiary">
                  Use predefined coin list instead of dynamic pool
                </div>
              </div>
              <Badge variant={config.use_default_coins ? 'success' : 'secondary'}>
                {config.use_default_coins ? 'Enabled' : 'Disabled'}
              </Badge>
            </div>

            {config.use_default_coins && config.default_coins.length > 0 && (
              <div className="p-4 bg-background-secondary rounded-lg">
                <div className="text-sm font-semibold text-text-primary mb-3">
                  Default Coin List ({config.default_coins.length} coins)
                </div>
                <div className="flex flex-wrap gap-2">
                  {config.default_coins.map((coin, i) => (
                    <div key={i} className="px-3 py-1 bg-white rounded-lg text-sm font-mono text-text-secondary">
                      {coin}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {config.coin_pool_api_url && (
              <div className="p-4 bg-background-secondary rounded-lg">
                <div className="text-sm font-semibold text-text-primary mb-1">
                  AI500 Coin Pool API
                </div>
                <div className="text-xs font-mono text-text-tertiary break-all">
                  {config.coin_pool_api_url}
                </div>
              </div>
            )}

            {config.oi_top_api_url && (
              <div className="p-4 bg-background-secondary rounded-lg">
                <div className="text-sm font-semibold text-text-primary mb-1">
                  OI Top API
                </div>
                <div className="text-xs font-mono text-text-tertiary break-all">
                  {config.oi_top_api_url}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Trader Configurations */}
      <Card className="p-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <span>🤖</span>
            <span>Trader Configurations ({config.traders.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {config.traders.map((trader, i) => (
              <div key={trader.id} className="p-5 bg-background-secondary rounded-xl border border-border">
                {/* Trader Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent-purple flex items-center justify-center text-2xl">
                      🤖
                    </div>
                    <div>
                      <div className="font-bold text-lg text-text-primary">{trader.name}</div>
                      <div className="text-xs text-text-tertiary">ID: {trader.id}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={trader.enabled ? 'success' : 'secondary'}>
                      {trader.enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                    <Badge variant="primary">
                      {trader.ai_model.toUpperCase()}
                    </Badge>
                    <Badge variant="secondary">
                      {trader.exchange.toUpperCase()}
                    </Badge>
                  </div>
                </div>

                {/* Trader Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <div className="text-xs text-text-tertiary mb-1">Initial Balance</div>
                    <div className="text-lg font-semibold text-text-primary">
                      ${trader.initial_balance.toLocaleString()}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-text-tertiary mb-1">Scan Interval</div>
                    <div className="text-lg font-semibold text-text-primary">
                      {trader.scan_interval_minutes} min
                    </div>
                  </div>

                  {/* Exchange-specific fields */}
                  {trader.exchange === 'binance' && 'binance_api_key_masked' in trader && (
                    <>
                      <div className="col-span-full">
                        <div className="text-xs text-text-tertiary mb-1">Binance API Key</div>
                        <div className="text-sm font-mono text-text-secondary">
                          {trader.binance_api_key_masked}
                        </div>
                      </div>
                    </>
                  )}

                  {trader.exchange === 'hyperliquid' && 'hyperliquid_wallet_addr' in trader && (
                    <>
                      <div className="col-span-full">
                        <div className="text-xs text-text-tertiary mb-1">Hyperliquid Wallet</div>
                        <div className="text-sm font-mono text-text-secondary">
                          {trader.hyperliquid_wallet_addr}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-text-tertiary mb-1">Testnet</div>
                        <Badge variant={'hyperliquid_testnet' in trader && trader.hyperliquid_testnet ? 'warning' : 'success'}>
                          {'hyperliquid_testnet' in trader && trader.hyperliquid_testnet ? 'Yes' : 'No'}
                        </Badge>
                      </div>
                    </>
                  )}

                  {trader.exchange === 'aster' && 'aster_user' in trader && (
                    <>
                      <div className="col-span-full">
                        <div className="text-xs text-text-tertiary mb-1">Aster User (Main Wallet)</div>
                        <div className="text-sm font-mono text-text-secondary">
                          {trader.aster_user}
                        </div>
                      </div>
                      <div className="col-span-full">
                        <div className="text-xs text-text-tertiary mb-1">Aster Signer (API Wallet)</div>
                        <div className="text-sm font-mono text-text-secondary">
                          {trader.aster_signer}
                        </div>
                      </div>
                    </>
                  )}

                  {/* AI-specific fields */}
                  {trader.ai_model === 'custom' && 'custom_api_url' in trader && (
                    <>
                      <div className="col-span-full">
                        <div className="text-xs text-text-tertiary mb-1">Custom API URL</div>
                        <div className="text-sm font-mono text-text-secondary break-all">
                          {trader.custom_api_url}
                        </div>
                      </div>
                      {'custom_model_name' in trader && trader.custom_model_name && (
                        <div>
                          <div className="text-xs text-text-tertiary mb-1">Model Name</div>
                          <div className="text-sm font-mono text-text-secondary">
                            {trader.custom_model_name}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Masked Keys Indicator */}
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="text-xs text-text-tertiary flex items-center gap-2">
                    <span>🔐</span>
                    <span>API keys are masked for security (showing first/last 4 characters only)</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
