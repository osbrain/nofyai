'use client';

import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { EquityPoint } from '@/types';
import { formatUSD, formatPercent } from '@/lib/utils';

interface EquityChartProps {
  data: EquityPoint[];
  initialBalance: number;
}

export function EquityChart({ data, initialBalance }: EquityChartProps) {
  // Sort data by timestamp
  const sortedData = useMemo(() => {
    return [...data].sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }, [data]);

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
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload as EquityPoint;
      const isProfitable = data.total_pnl >= 0;

      return (
        <div className="bg-white border border-border rounded-lg shadow-lg p-4">
          <div className="text-xs text-text-secondary mb-2">
            {new Date(data.timestamp).toLocaleString()}
          </div>
          <div className="space-y-2">
            <div>
              <div className="text-xs text-text-tertiary">Total Equity</div>
              <div className="text-lg font-bold text-text-primary">
                {formatUSD(data.total_equity)}
              </div>
            </div>
            <div>
              <div className="text-xs text-text-tertiary">Profit & Loss</div>
              <div className={`text-sm font-semibold ${isProfitable ? 'text-success' : 'text-danger'}`}>
                {isProfitable ? '+' : ''}{formatUSD(data.total_pnl)} ({formatPercent(data.total_pnl_pct)})
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
              <div>
                <div className="text-xs text-text-tertiary">Positions</div>
                <div className="text-sm font-semibold text-text-primary">
                  {data.position_count}
                </div>
              </div>
              <div>
                <div className="text-xs text-text-tertiary">Margin</div>
                <div className="text-sm font-semibold text-text-primary">
                  {data.margin_used_pct.toFixed(1)}%
                </div>
              </div>
            </div>
            <div className="text-xs text-text-tertiary pt-1">
              Cycle #{data.cycle_number}
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  // Check if we have data
  if (!sortedData || sortedData.length === 0) {
    return (
      <div className="w-full h-[400px] flex items-center justify-center text-text-tertiary">
        <div className="text-center">
          <div className="text-6xl mb-4 opacity-30">📈</div>
          <div className="font-semibold mb-2">No Equity History</div>
          <div className="text-sm">Chart will appear as trading progresses</div>
        </div>
      </div>
    );
  }

  // Determine if overall profitable
  const latestPoint = sortedData[sortedData.length - 1];
  const isProfitable = latestPoint.total_pnl >= 0;
  const lineColor = isProfitable ? '#16C784' : '#EA3943';

  return (
    <div className="w-full h-[400px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={sortedData}
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
            tickFormatter={(value) => formatUSD(value)}
            stroke="#9CA3AF"
            style={{ fontSize: '12px' }}
            tickLine={false}
            axisLine={{ stroke: '#EFF2F5' }}
            width={80}
          />
          <Tooltip content={<CustomTooltip />} />

          {/* Reference line for initial balance */}
          <ReferenceLine
            y={initialBalance}
            stroke="#9CA3AF"
            strokeDasharray="3 3"
            label={{
              value: 'Initial',
              position: 'right',
              fill: '#9CA3AF',
              fontSize: 11,
            }}
          />

          {/* Equity line */}
          <Line
            type="monotone"
            dataKey="total_equity"
            stroke={lineColor}
            strokeWidth={2.5}
            dot={false}
            activeDot={{
              r: 6,
              fill: lineColor,
              stroke: '#fff',
              strokeWidth: 2,
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
