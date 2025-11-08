'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { TraderDetailView } from '@/components/trader/TraderDetailView';
import { useTranslations } from '@/lib/i18n-context';
import { Badge } from '@/components/ui/badge';
import { SkeletonCard } from '@/components/ui/skeleton';
import { MaskedTraderConfig } from '@/types';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function HomePage() {
  const t = useTranslations();
  const { data: config, error } = useSWR('/api/config', fetcher);
  const [selectedTraderId, setSelectedTraderId] = useState<string | null>(null);

  // Set the first trader as selected by default
  useEffect(() => {
    if (config?.traders && config.traders.length > 0 && !selectedTraderId) {
      setSelectedTraderId(config.traders[0].id);
    }
  }, [config, selectedTraderId]);

  if (error) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <p className="text-danger font-semibold">Failed to load configuration</p>
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="w-full px-6 py-8">
        <SkeletonCard />
      </div>
    );
  }

  const traders: MaskedTraderConfig[] = config.traders || [];
  const hasTraders = traders.length > 0;
  const hasSingleTrader = traders.length === 1;
  const currentTrader = traders.find(t => t.id === selectedTraderId);

  return (
    <div className="w-full px-6 py-8">
      {hasTraders ? (
        <>
          {/* Trader Tabs - Only show if multiple traders */}
          {!hasSingleTrader && (
            <div className="mb-6">
              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                {traders.map((trader) => (
                  <button
                    key={trader.id}
                    onClick={() => setSelectedTraderId(trader.id)}
                    className={`px-6 py-3 rounded-lg font-semibold text-sm whitespace-nowrap transition-all ${
                      selectedTraderId === trader.id
                        ? 'bg-gradient-to-r from-primary to-accent-purple text-white shadow-lg'
                        : 'bg-white text-text-secondary hover:bg-background-secondary border border-border'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span>🤖</span>
                      <span>{trader.name}</span>
                      {trader.enabled && (
                        <Badge variant="success" className="ml-1">
                          {t.config.enabled}
                        </Badge>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Trader Detail View */}
          {selectedTraderId && currentTrader && (
            <TraderDetailView traderId={selectedTraderId} showHeader={true} />
          )}
        </>
      ) : (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">🤖</div>
          <h2 className="text-2xl font-bold text-text-primary mb-2">
            {t.competition.noTradersActive}
          </h2>
          <p className="text-text-secondary mb-6">
            {t.competition.startBackend}
          </p>
          <Link
            href="/config"
            className="inline-block px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-semibold"
          >
            {t.competition.config}
          </Link>
        </div>
      )}
    </div>
  );
}
