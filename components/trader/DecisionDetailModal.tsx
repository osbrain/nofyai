'use client';

import { DecisionRecord } from '@/types';
import { Badge } from '@/components/ui/badge';
import { formatUSD, formatPercent } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface DecisionDetailModalProps {
  decision: DecisionRecord | null;
  onClose: () => void;
}

export function DecisionDetailModal({ decision, onClose }: DecisionDetailModalProps) {
  if (!decision) return null;

  // Clean up CoT trace: remove trailing ```json or ```
  const cleanCotTrace = (trace: string) => {
    return trace
      .replace(/```json\s*$/i, '')  // Remove trailing ```json
      .replace(/```\s*$/i, '')       // Remove trailing ```
      .trim();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-border px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-text-primary">AI 决策详情</h2>
            <div className="flex items-center gap-3 mt-2 text-sm text-text-secondary">
              <span>Cycle #{decision.cycle_number}</span>
              <span>•</span>
              <span>{new Date(decision.timestamp).toLocaleString()}</span>
              <span>•</span>
              <Badge variant={decision.success ? 'success' : 'danger'}>
                {decision.success ? '成功' : '失败'}
              </Badge>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary transition-colors"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto px-6 py-6 space-y-6" style={{ maxHeight: 'calc(90vh - 100px)' }}>
          {/* Error Message */}
          {decision.error_message && (
            <div className="bg-danger/10 border border-danger/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-danger">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                </svg>
                <h3 className="font-bold text-danger">错误信息</h3>
              </div>
              <p className="text-sm text-danger whitespace-pre-wrap">{decision.error_message}</p>
            </div>
          )}

          {/* Account State */}
          <div className="bg-background-secondary rounded-lg p-4">
            <h3 className="font-bold text-text-primary mb-3 flex items-center gap-2">
              <span>📊</span>
              <span>账户状态快照</span>
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <div className="text-xs text-text-tertiary mb-1">账户净值</div>
                <div className="text-lg font-bold text-text-primary">{formatUSD(decision.account_snapshot.total_equity)}</div>
              </div>
              <div>
                <div className="text-xs text-text-tertiary mb-1">可用余额</div>
                <div className="text-lg font-bold text-text-primary">{formatUSD(decision.account_snapshot.available_balance)}</div>
              </div>
              <div>
                <div className="text-xs text-text-tertiary mb-1">总盈亏</div>
                <div className={`text-lg font-bold ${decision.account_snapshot.total_pnl >= 0 ? 'text-success' : 'text-danger'}`}>
                  {decision.account_snapshot.total_pnl >= 0 ? '+' : ''}{formatUSD(decision.account_snapshot.total_pnl)}
                </div>
              </div>
              <div>
                <div className="text-xs text-text-tertiary mb-1">持仓数量</div>
                <div className="text-lg font-bold text-text-primary">{decision.account_snapshot.position_count}</div>
              </div>
              <div>
                <div className="text-xs text-text-tertiary mb-1">保证金使用率</div>
                <div className="text-lg font-bold text-text-primary">{decision.account_snapshot.margin_used_pct.toFixed(1)}%</div>
              </div>
            </div>
          </div>

          {/* Positions Snapshot */}
          {decision.positions_snapshot && decision.positions_snapshot.length > 0 && (
            <div className="bg-background-secondary rounded-lg p-4">
              <h3 className="font-bold text-text-primary mb-3 flex items-center gap-2">
                <span>📈</span>
                <span>持仓快照</span>
              </h3>
              <div className="space-y-3">
                {decision.positions_snapshot.map((pos, i) => (
                  <div key={i} className="bg-white rounded-lg p-3 border border-border">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-text-primary">{pos.symbol}</span>
                        <Badge variant={pos.side === 'long' ? 'success' : 'danger'}>
                          {pos.side.toUpperCase()}
                        </Badge>
                        <span className="text-sm text-text-secondary">{pos.leverage}x</span>
                      </div>
                      <div className={`text-sm font-semibold ${pos.unrealized_pnl >= 0 ? 'text-success' : 'text-danger'}`}>
                        {pos.unrealized_pnl >= 0 ? '+' : ''}{formatUSD(pos.unrealized_pnl)}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-text-tertiary">入场价: </span>
                        <span className="font-mono text-text-primary">{formatUSD(pos.entry_price)}</span>
                      </div>
                      <div>
                        <span className="text-text-tertiary">现价: </span>
                        <span className="font-mono text-text-primary">{formatUSD(pos.mark_price)}</span>
                      </div>
                      <div>
                        <span className="text-text-tertiary">数量: </span>
                        <span className="font-mono text-text-primary">{pos.quantity.toFixed(4)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Candidate Coins */}
          {decision.candidate_coins && decision.candidate_coins.length > 0 && (
            <div className="bg-background-secondary rounded-lg p-4">
              <h3 className="font-bold text-text-primary mb-3 flex items-center gap-2">
                <span>🪙</span>
                <span>候选币种 ({decision.candidate_coins.length} 个)</span>
              </h3>
              <div className="flex flex-wrap gap-2">
                {decision.candidate_coins.map((coin, i) => (
                  <div key={i} className="px-3 py-1 bg-white rounded-lg text-sm font-mono text-text-secondary">
                    {coin}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Input Prompt */}
          {decision.input_prompt && (
            <div className="bg-background-secondary rounded-lg p-4">
              <h3 className="font-bold text-text-primary mb-3 flex items-center gap-2">
                <span>📥</span>
                <span>输入 Prompt（发送给AI的市场数据）</span>
              </h3>
              <div className="bg-white rounded-lg p-4 border border-border">
                <pre className="text-xs font-mono text-text-secondary whitespace-pre-wrap overflow-x-auto">
                  {decision.input_prompt}
                </pre>
              </div>
            </div>
          )}

          {/* CoT Trace */}
          {decision.cot_trace && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
              <h3 className="font-bold text-primary mb-3 flex items-center gap-2">
                <span>💭</span>
                <span>AI 思维链分析（Chain of Thought）</span>
              </h3>
              <div className="bg-white rounded-lg p-4 border border-primary/30 prose prose-sm max-w-none prose-headings:text-text-primary prose-p:text-text-secondary prose-strong:text-text-primary prose-li:text-text-secondary prose-ul:list-disc prose-ol:list-decimal">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {cleanCotTrace(decision.cot_trace)}
                </ReactMarkdown>
              </div>
            </div>
          )}

          {/* Decision JSON */}
          {decision.decision_json && (
            <div className="bg-background-secondary rounded-lg p-4">
              <h3 className="font-bold text-text-primary mb-3 flex items-center gap-2">
                <span>📋</span>
                <span>决策 JSON</span>
              </h3>
              <div className="bg-white rounded-lg p-4 border border-border">
                <pre className="text-xs font-mono text-text-secondary whitespace-pre-wrap overflow-x-auto">
                  {decision.decision_json}
                </pre>
              </div>
            </div>
          )}

          {/* Execution Log */}
          {decision.execution_log && decision.execution_log.length > 0 && (
            <div className="bg-background-secondary rounded-lg p-4">
              <h3 className="font-bold text-text-primary mb-3 flex items-center gap-2">
                <span>⚡</span>
                <span>执行日志</span>
              </h3>
              <div className="space-y-2">
                {decision.execution_log.map((log, i) => (
                  <div key={i} className="bg-white rounded-lg px-4 py-2 border border-border text-sm">
                    <span className={log.startsWith('✓') ? 'text-success' : log.startsWith('❌') ? 'text-danger' : 'text-text-secondary'}>
                      {log}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Decisions Actions */}
          {decision.decisions && decision.decisions.length > 0 && (
            <div className="bg-background-secondary rounded-lg p-4">
              <h3 className="font-bold text-text-primary mb-3 flex items-center gap-2">
                <span>🎯</span>
                <span>AI 决策动作</span>
              </h3>
              <div className="space-y-3">
                {decision.decisions.map((aiDecision, i) => {
                  // Find matching execution result
                  const executionResult = decision.execution_results?.find(
                    r => r.symbol === aiDecision.symbol && r.action === aiDecision.action
                  );

                  // Find position info for this symbol if it exists
                  const position = decision.positions_snapshot?.find(
                    p => p.symbol === aiDecision.symbol
                  );

                  return (
                    <div key={i} className="bg-white rounded-lg p-4 border border-border">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-text-primary">{aiDecision.symbol}</span>
                          <Badge variant={aiDecision.action.includes('long') ? 'success' : aiDecision.action.includes('short') ? 'danger' : 'secondary'}>
                            {aiDecision.action.toUpperCase()}
                          </Badge>
                          {executionResult && (
                            <Badge variant={executionResult.success ? 'success' : 'danger'}>
                              {executionResult.success ? '成功' : '失败'}
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-text-tertiary">{new Date(decision.timestamp).toLocaleString()}</span>
                      </div>

                      {/* AI Reasoning */}
                      {aiDecision.reasoning && (
                        <div className="mb-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                          <div className="text-xs text-text-tertiary mb-1">AI 决策理由：</div>
                          <div className="text-sm text-text-secondary">{aiDecision.reasoning}</div>
                        </div>
                      )}

                      {/* Position Details */}
                      {position && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <div>
                            <span className="text-text-tertiary">数量: </span>
                            <span className="font-mono text-text-primary">{position.quantity.toFixed(4)}</span>
                          </div>
                          <div>
                            <span className="text-text-tertiary">入场价: </span>
                            <span className="font-mono text-text-primary">{formatUSD(position.entry_price)}</span>
                          </div>
                          <div>
                            <span className="text-text-tertiary">现价: </span>
                            <span className="font-mono text-text-primary">{formatUSD(position.mark_price)}</span>
                          </div>
                          <div>
                            <span className="text-text-tertiary">杠杆: </span>
                            <span className="font-semibold text-primary">{position.leverage}x</span>
                          </div>
                        </div>
                      )}

                      {/* Execution Error */}
                      {executionResult?.error && (
                        <div className="mt-3 text-xs text-danger bg-danger/10 rounded px-3 py-2">
                          {executionResult.error}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
