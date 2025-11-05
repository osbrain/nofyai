'use client';

import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { formatPercent, getTraderColor } from '@/lib/utils';

interface TraderEquityData {
  traderId: string;
  traderName: string;
  data: Array<{
    timestamp: string;
    total_pnl_pct: number;
    cycle_number: number;
  }>;
}

interface ComparisonChartProps {
  traders: TraderEquityData[];
}

export function ComparisonChart({ traders }: ComparisonChartProps) {
  // Combine all data points and create a unified timeline
  const chartData = useMemo(() => {
    if (!traders || traders.length === 0) return [];

    // Collect all unique timestamps
    const timestampSet = new Set<string>();
    traders.forEach(trader => {
      trader.data.forEach(point => {
        timestampSet.add(point.timestamp);
      });
    });

    // Sort timestamps
    const timestamps = Array.from(timestampSet).sort((a, b) =>
      new Date(a).getTime() - new Date(b).getTime()
    );

    // Create data points for each timestamp
    return timestamps.map(timestamp => {
      const dataPoint: any = { timestamp };

      traders.forEach(trader => {
        const point = trader.data.find(p => p.timestamp === timestamp);
        if (point) {
          dataPoint[trader.traderId] = point.total_pnl_pct;
        }
      });

      return dataPoint;
    });
  }, [traders]);

  // Format timestamp for display
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffHours < 24) {
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      });
    } else if (diffHours < 168) { // 7 days
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        hour: '2-digit'
      });
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      });
    }
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-border rounded-lg shadow-lg p-4">
          <div className="text-xs text-text-secondary mb-3">
            {new Date(label).toLocaleString()}
          </div>
          <div className="space-y-2">
            {payload
              .sort((a: any, b: any) => b.value - a.value)
              .map((entry: any, index: number) => {
                const trader = traders.find(t => t.traderId === entry.dataKey);
                const isProfitable = entry.value >= 0;
                return (
                  <div key={index} className="flex items-center justify-between gap-6">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: entry.color }}
                      />
                      <span className="text-sm font-medium text-text-primary">
                        {trader?.traderName || entry.dataKey}
                      </span>
                    </div>
                    <span className={`text-sm font-bold ${isProfitable ? 'text-success' : 'text-danger'}`}>
                      {isProfitable ? '+' : ''}{formatPercent(entry.value)}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      );
    }
    return null;
  };

  // Custom legend
  const CustomLegend = ({ payload }: any) => {
    return (
      <div className="flex flex-wrap items-center justify-center gap-4 mt-6">
        {payload.map((entry: any, index: number) => {
          const trader = traders.find(t => t.traderId === entry.dataKey);
          return (
            <div key={index} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-sm font-medium text-text-secondary">
                {trader?.traderName || entry.dataKey}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  // Check if we have data
  if (!chartData || chartData.length === 0 || traders.length === 0) {
    return (
      <div className="w-full h-[500px] flex items-center justify-center text-text-tertiary">
        <div className="text-center">
          <div className="text-6xl mb-4 opacity-30">📊</div>
          <div className="font-semibold mb-2">No Comparison Data</div>
          <div className="text-sm">Chart will appear as traders make decisions</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-[500px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#EFF2F5"
            vertical={false}
          />
          <XAxis
            dataKey="timestamp"
            tickFormatter={formatTimestamp}
            stroke="#9CA3AF"
            style={{ fontSize: '12px' }}
            tickLine={false}
            axisLine={{ stroke: '#EFF2F5' }}
          />
          <YAxis
            tickFormatter={(value) => `${value > 0 ? '+' : ''}${value.toFixed(1)}%`}
            stroke="#9CA3AF"
            style={{ fontSize: '12px' }}
            tickLine={false}
            axisLine={{ stroke: '#EFF2F5' }}
            width={60}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend content={<CustomLegend />} />

          {/* Reference line for 0% (break-even) */}
          <ReferenceLine
            y={0}
            stroke="#9CA3AF"
            strokeDasharray="3 3"
            label={{
              value: 'Break-even',
              position: 'right',
              fill: '#9CA3AF',
              fontSize: 11,
            }}
          />

          {/* Lines for each trader */}
          {traders.map((trader, index) => {
            const color = getTraderColor(index);
            return (
              <Line
                key={trader.traderId}
                type="monotone"
                dataKey={trader.traderId}
                stroke={color}
                strokeWidth={2.5}
                dot={false}
                activeDot={{
                  r: 6,
                  fill: color,
                  stroke: '#fff',
                  strokeWidth: 2,
                }}
                connectNulls
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
