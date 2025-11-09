// ========================================
// AI Trading Decision Engine
// ========================================

import * as fs from 'fs';
import * as path from 'path';

export interface Decision {
  symbol: string;
  action: 'open_long' | 'open_short' | 'close_long' | 'close_short' | 'hold' | 'wait';
  leverage?: number;
  position_size_usd?: number;
  stop_loss?: number;
  take_profit?: number;
  confidence?: number;
  risk_usd?: number;
  price?: number; // Add price field for close actions
  reasoning: string;
}

export interface FullDecision {
  user_prompt: string;
  cot_trace: string; // Chain of Thought
  decisions: Decision[];
  timestamp: Date;
}

export interface PositionInfo {
  symbol: string;
  side: 'long' | 'short';
  entry_price: number;
  mark_price: number;
  quantity: number;
  leverage: number;
  unrealized_pnl: number;
  unrealized_pnl_pct: number;
  liquidation_price: number;
  margin_used: number;
  update_time: number; // milliseconds
}

// Import and re-export AccountInfo from unified types
import type { AccountInfo } from '@/types';
export type { AccountInfo };

export interface MarketData {
  symbol: string;
  current_price: number;

  // Price changes
  price_change_1h: number;
  price_change_4h: number;
  price_change_15m: number; // 新增 15m 价格变化

  // Multi-timeframe MACD (最关键 - 用于趋势共振判断)
  macd_15m: number;
  macd_1h: number;
  macd_4h: number;
  macd_1d: number; // 日线 MACD

  // Multi-timeframe RSI (用于防假突破检测)
  rsi_15m: number;
  rsi_1h: number;
  rsi_4h: number;
  rsi_1d: number; // 日线 RSI

  // EMA (用于趋势方向确认)
  ema20: number; // 当前价格对应的 EMA20

  // Volume (成交量)
  volume_24h: number;
  volume_avg_24h: number; // 24h 平均成交量（用于判断是否放量 >1.5x）

  // Open Interest (持仓量)
  oi_value: number; // 当前持仓量价值（百万美元）
  oi_change_pct: number; // OI 变化百分比（判断 >+5% 真实突破）

  // Market sentiment (市场情绪指标)
  buy_sell_ratio?: number; // 买卖比（可选，某些交易所可能没有）
  funding_rate?: number; // 资金费率（可选）

  // OHLC data (K线数据 - 用于形态判断)
  open: number;
  high: number;
  low: number;
  close: number;

  // Volatility (波动率)
  atr: number; // 平均真实波幅

  // Legacy fields (保持兼容)
  current_macd: number; // 废弃：使用 macd_15m
  current_rsi7: number; // 废弃：使用 rsi_15m
  current_rsi14: number; // 废弃：使用 rsi_1h
}

export interface TradingContext {
  current_time: string;
  runtime_minutes: number;
  call_count: number;
  account: AccountInfo;
  positions: PositionInfo[];
  market_data_map: Record<string, MarketData>;
  sharpe_ratio?: number;
  btc_eth_leverage: number;
  altcoin_leverage: number;
  prompt_template?: string; // 提示词模板名称，默认 adaptive

  // 性能指标（完整的历史表现数据）
  performance?: {
    total_trades: number;
    winning_trades: number;
    losing_trades: number;
    win_rate: number;
    avg_profit: number;
    avg_loss: number;
    profit_factor: number;
    sharpe_ratio: number;
    max_drawdown: number;
    avg_holding_time_minutes: number;
  };
}

// ========================================
// System Prompt Builder (从文件读取)
// ========================================

// 统一的可用动作模板（所有提示词共用）
const ACTIONS_TEMPLATE = `
# 可用动作 (Actions)

## 开平仓动作

1. **open_long**: 开多仓（看涨）
   - 用于: 看涨信号强烈时
   - 必须设置: leverage, position_size_usd, stop_loss, take_profit, confidence, risk_usd

2. **open_short**: 开空仓（看跌）
   - 用于: 看跌信号强烈时
   - 必须设置: leverage, position_size_usd, stop_loss, take_profit, confidence, risk_usd

3. **close_long** / **close_short**: 完全平仓
   - 用于: 止盈、止损、或趋势反转

4. **wait**: 观望，不持仓
   - 用于: 没有明确信号，或资金不足

5. **hold**: 持有当前仓位
   - 用于: 持仓表现符合预期，继续等待

## 动态调整动作 (可选)

6. **update_stop_loss**: 调整止损价格
   - 用于: 持仓盈利后追踪止损（锁定利润）
   - 建议: 盈利 >3% 时，将止损移至成本价或更高

7. **update_take_profit**: 调整止盈价格
   - 用于: 优化目标位，适应技术位变化

8. **partial_close**: 部分平仓
   - 用于: 分批止盈，降低风险
   - 建议: 盈利达到第一目标时先平仓 50-70%

---

`;

// 统一的输出格式模板（所有提示词共用）
const OUTPUT_FORMAT_TEMPLATE = `

# 📤 输出格式

**第一步: 思维链（纯文本）**
简洁分析你的思考过程

**第二步: JSON 决策数组**
\`\`\`json
[
  {"symbol": "BTCUSDT", "action": "open_short", "leverage": \${btcEthLeverage}, "position_size_usd": \${accountEquity_sample}, "stop_loss": 97000, "take_profit": 91000, "confidence": 85, "risk_usd": 300, "reasoning": "下跌趋势+MACD死叉"},
  {"symbol": "ETHUSDT", "action": "close_long", "reasoning": "止盈离场"}
]
\`\`\`

**字段说明**:
- \`action\`: open_long | open_short | close_long | close_short | hold | wait
- \`confidence\`: 0-100（开仓建议≥85，使用客观评分公式）
- 开仓时必填: leverage, position_size_usd, stop_loss, take_profit, confidence, risk_usd, reasoning

现在，分析下面提供的市场数据并做出交易决策。
`;

export function buildSystemPrompt(
  accountEquity: number,
  btcEthLeverage: number,
  altcoinLeverage: number,
  promptTemplate: string = 'adaptive'
): string {
  // 读取提示词模板文件
  const promptFilePath = path.join(process.cwd(), 'lib', 'prompts', `${promptTemplate}.txt`);

  if (!fs.existsSync(promptFilePath)) {
    console.warn(`Prompt template file not found: ${promptFilePath}, using adaptive.txt as fallback`);
    const fallbackPath = path.join(process.cwd(), 'lib', 'prompts', 'adaptive.txt');
    if (!fs.existsSync(fallbackPath)) {
      throw new Error('Default prompt template (adaptive.txt) not found');
    }
    return fs.readFileSync(fallbackPath, 'utf-8');
  }

  // 读取提示词内容
  let promptContent = fs.readFileSync(promptFilePath, 'utf-8');

  // 移除末尾可能存在的输出格式部分（如果有的话）
  // 确保提示词文件只包含策略和规则，不包含输出格式
  promptContent = promptContent.replace(/---\s*\n*#\s*📤\s*输出格式[\s\S]*$/i, '');

  // 移除可能存在的可用动作部分（如果有的话）
  promptContent = promptContent.replace(/---\s*\n*#\s*可用动作[\s\S]*?---\s*\n/i, '');
  promptContent = promptContent.replace(/---\s*\n*#\s*ACTION\s+SPACE\s+DEFINITION[\s\S]*?---\s*\n/i, '');

  promptContent = promptContent.trim();

  // 构建完整提示词: 可用动作 + 策略内容 + 输出格式
  let fullPrompt = promptContent+ ACTIONS_TEMPLATE + '\n' + OUTPUT_FORMAT_TEMPLATE;

  // 替换动态参数（如果提示词中包含占位符）
  // 例如：${btcEthLeverage}, ${altcoinLeverage}, ${accountEquity}
  const accountEquitySample = Math.floor(accountEquity * 5); // 示例仓位大小
  fullPrompt = fullPrompt
    .replace(/\$\{btcEthLeverage\}/g, btcEthLeverage.toString())
    .replace(/\$\{altcoinLeverage\}/g, altcoinLeverage.toString())
    .replace(/\$\{accountEquity\}/g, accountEquity.toFixed(0))
    .replace(/\$\{accountEquity_sample\}/g, accountEquitySample.toFixed(0));

  return fullPrompt;
}

// ========================================
// User Prompt Builder (动态数据)
// ========================================

export function buildUserPrompt(ctx: TradingContext): string {
  const parts: string[] = [];

  // 系统状态
  parts.push(
    `**时间**: ${ctx.current_time} | **周期**: #${ctx.call_count} | **运行**: ${ctx.runtime_minutes}分钟\n\n`
  );

  // BTC市场（关键 - 用于第5步BTC状态确认）
  const btcData = ctx.market_data_map['BTCUSDT'];
  if (btcData) {
    parts.push('## 🔴 BTC 市场（市场领导者）\n\n');
    parts.push(`**价格**: $${btcData.current_price.toFixed(2)}\n`);

    // 安全访问新字段（可能为 undefined）
    const change15m = btcData.price_change_15m ?? 0;
    const change1h = btcData.price_change_1h ?? 0;
    const change4h = btcData.price_change_4h ?? 0;
    parts.push(`**涨跌**: 15m ${change15m >= 0 ? '+' : ''}${change15m.toFixed(2)}% | 1h ${change1h >= 0 ? '+' : ''}${change1h.toFixed(2)}% | 4h ${change4h >= 0 ? '+' : ''}${change4h.toFixed(2)}%\n`);

    const macd15m = btcData.macd_15m ?? btcData.current_macd ?? 0;
    const macd1h = btcData.macd_1h ?? 0;
    const macd4h = btcData.macd_4h ?? 0;
    const macd1d = btcData.macd_1d ?? 0;
    parts.push(`**MACD 多周期**: 15m ${macd15m.toFixed(4)} | 1h ${macd1h.toFixed(4)} | 4h ${macd4h.toFixed(4)} | 1d ${macd1d.toFixed(4)}\n`);

    const rsi15m = btcData.rsi_15m ?? btcData.current_rsi7 ?? 50;
    const rsi1h = btcData.rsi_1h ?? btcData.current_rsi14 ?? 50;
    const rsi4h = btcData.rsi_4h ?? 50;
    const rsi1d = btcData.rsi_1d ?? 50;
    parts.push(`**RSI 多周期**: 15m ${rsi15m.toFixed(1)} | 1h ${rsi1h.toFixed(1)} | 4h ${rsi4h.toFixed(1)} | 1d ${rsi1d.toFixed(1)}\n`);

    parts.push(`**资金费率**: ${(btcData.funding_rate || 0) >= 0 ? '+' : ''}${((btcData.funding_rate || 0) * 100).toFixed(4)}%\n\n`);
  }

  // 账户
  const availableBalancePct = (ctx.account.available_balance / ctx.account.total_equity) * 100;
  parts.push(
    `**账户**: 净值${ctx.account.total_equity.toFixed(2)} | 余额${ctx.account.available_balance.toFixed(2)} (${availableBalancePct.toFixed(1)}%) | 盈亏${ctx.account.total_pnl_pct >= 0 ? '+' : ''}${ctx.account.total_pnl_pct.toFixed(2)}% | 保证金${ctx.account.margin_used_pct.toFixed(1)}% | 持仓${ctx.account.position_count}个\n\n`
  );

  // 持仓
  if (ctx.positions.length > 0) {
    parts.push('## 当前持仓\n\n');
    ctx.positions.forEach((pos, i) => {
      // 计算持仓时长
      let holdingDuration = '';
      if (pos.update_time > 0) {
        const durationMs = Date.now() - pos.update_time;
        const durationMin = Math.floor(durationMs / (1000 * 60));
        if (durationMin < 60) {
          holdingDuration = ` | 持仓时长${durationMin}分钟`;
        } else {
          const durationHour = Math.floor(durationMin / 60);
          const durationMinRemainder = durationMin % 60;
          holdingDuration = ` | 持仓时长${durationHour}小时${durationMinRemainder}分钟`;
        }
      }

      parts.push(
        `${i + 1}. ${pos.symbol} ${pos.side.toUpperCase()} | 入场价${pos.entry_price.toFixed(4)} 当前价${pos.mark_price.toFixed(4)} | 盈亏${pos.unrealized_pnl_pct >= 0 ? '+' : ''}${pos.unrealized_pnl_pct.toFixed(2)}% | 杠杆${pos.leverage}x | 保证金${pos.margin_used.toFixed(0)} | 强平价${pos.liquidation_price.toFixed(4)}${holdingDuration}\n\n`
      );

      // 市场数据
      const marketData = ctx.market_data_map[pos.symbol];
      if (marketData) {
        parts.push(formatMarketData(marketData));
        parts.push('\n');
      }
    });
  } else {
    parts.push('**当前持仓**: 无\n\n');
  }

  // 候选币种
  const candidateSymbols = Object.keys(ctx.market_data_map).filter(s => s !== 'BTCUSDT');
  if (candidateSymbols.length > 0) {
    parts.push(`## 候选币种 (${candidateSymbols.length}个)\n\n`);
    candidateSymbols.forEach((symbol, i) => {
      const marketData = ctx.market_data_map[symbol];
      parts.push(`### ${i + 1}. ${symbol}\n\n`);
      parts.push(formatMarketData(marketData));
      parts.push('\n');
    });
  }

  // 性能指标（历史表现 - 用于自我优化）
  if (ctx.performance && ctx.performance.total_trades > 0) {
    parts.push('## 📊 历史表现（绩效分析）\n\n');

    const perf = ctx.performance;

    // 基本统计
    parts.push(`**总交易数**: ${perf.total_trades} 笔 | **盈利**: ${perf.winning_trades} 笔 | **亏损**: ${perf.losing_trades} 笔\n`);
    parts.push(`**胜率**: ${perf.win_rate.toFixed(1)}% | **平均盈利**: $${perf.avg_profit.toFixed(2)} | **平均亏损**: $${perf.avg_loss.toFixed(2)}\n`);

    // 关键指标
    parts.push(`**盈亏比**: ${perf.profit_factor.toFixed(2)} | **夏普比率**: ${perf.sharpe_ratio.toFixed(2)} | **最大回撤**: ${perf.max_drawdown.toFixed(2)}%\n`);
    parts.push(`**平均持仓时长**: ${perf.avg_holding_time_minutes.toFixed(0)} 分钟\n\n`);
  } else if (ctx.sharpe_ratio !== undefined) {
    // 向后兼容：如果没有完整性能数据但有夏普比率
    parts.push(`## 📊 夏普比率: ${ctx.sharpe_ratio.toFixed(2)}\n\n`);
  }

  parts.push('---\n\n');
  parts.push('分析并输出决策（思维链 + JSON）\n');

  return parts.join('');
}

function formatMarketData(data: MarketData): string {
  const parts: string[] = [];

  parts.push(`**价格**: $${data.current_price.toFixed(4)}\n`);

  // 安全访问价格变化（可能为 undefined）
  const change15m = data.price_change_15m ?? 0;
  const change1h = data.price_change_1h ?? 0;
  const change4h = data.price_change_4h ?? 0;
  parts.push(
    `**涨跌**: 15m ${change15m >= 0 ? '+' : ''}${change15m.toFixed(2)}% | 1h ${change1h >= 0 ? '+' : ''}${change1h.toFixed(2)}% | 4h ${change4h >= 0 ? '+' : ''}${change4h.toFixed(2)}%\n`
  );

  // 多周期 MACD（趋势共振判断 - 优先级最高）
  const macd15m = data.macd_15m ?? data.current_macd ?? 0;
  const macd1h = data.macd_1h ?? 0;
  const macd4h = data.macd_4h ?? 0;
  const macd1d = data.macd_1d ?? 0;
  parts.push(
    `**MACD 多周期**: 15m ${macd15m.toFixed(4)} | 1h ${macd1h.toFixed(4)} | 4h ${macd4h.toFixed(4)} | 1d ${macd1d.toFixed(4)}\n`
  );

  // 多周期 RSI（防假突破检测）
  const rsi15m = data.rsi_15m ?? data.current_rsi7 ?? 50;
  const rsi1h = data.rsi_1h ?? data.current_rsi14 ?? 50;
  const rsi4h = data.rsi_4h ?? 50;
  const rsi1d = data.rsi_1d ?? 50;
  parts.push(
    `**RSI 多周期**: 15m ${rsi15m.toFixed(1)} | 1h ${rsi1h.toFixed(1)} | 4h ${rsi4h.toFixed(1)} | 1d ${rsi1d.toFixed(1)}\n`
  );

  // EMA20（趋势方向确认）
  const ema20 = data.ema20 ?? data.current_price;
  const priceDiff = Math.abs(data.current_price - ema20);
  const priceDiffPct = (priceDiff / ema20) * 100;

  parts.push(`**EMA20**: ${ema20.toFixed(4)}`);
  if (priceDiffPct < 0.01) {
    // Price is essentially equal to EMA20 (within 0.01%)
    parts.push(` (价格 = EMA20，震荡中性)\n`);
  } else if (data.current_price > ema20) {
    parts.push(` (价格 > EMA20，上升趋势)\n`);
  } else {
    parts.push(` (价格 < EMA20，下降趋势)\n`);
  }

  // 成交量（判断是否放量）
  const volumeAvg = data.volume_avg_24h ?? data.volume_24h;
  const volumeRatio = volumeAvg > 0 ? data.volume_24h / volumeAvg : 1;
  parts.push(`**24h成交量**: ${(data.volume_24h / 1e6).toFixed(2)}M | 均量: ${(volumeAvg / 1e6).toFixed(2)}M | 放量倍数: ${volumeRatio.toFixed(2)}x\n`);

  // 持仓量（OI）
  if (data.oi_value > 0) {
    const oiChangePct = data.oi_change_pct ?? 0;
    parts.push(`**持仓量**: ${data.oi_value.toFixed(2)}M USD | 变化率: ${oiChangePct >= 0 ? '+' : ''}${oiChangePct.toFixed(2)}%\n`);
  }

  // 资金费率（市场情绪）
  if (data.funding_rate !== undefined) {
    parts.push(`**资金费率**: ${data.funding_rate >= 0 ? '+' : ''}${(data.funding_rate * 100).toFixed(4)}%`);
    if (data.funding_rate > 0.01) {
      parts.push(` (多头贪婪)\n`);
    } else if (data.funding_rate < -0.01) {
      parts.push(` (空头恐慌)\n`);
    } else {
      parts.push(` (中性)\n`);
    }
  }

  // K线数据（OHLC - 用于形态判断）
  if (data.open !== undefined && data.high !== undefined && data.low !== undefined && data.close !== undefined) {
    const bodySize = Math.abs(data.close - data.open);
    const upperWick = data.high - Math.max(data.open, data.close);
    const lowerWick = Math.min(data.open, data.close) - data.low;
    const totalRange = data.high - data.low;

    parts.push(`**K线形态**: O ${data.open.toFixed(4)} | H ${data.high.toFixed(4)} | L ${data.low.toFixed(4)} | C ${data.close.toFixed(4)}\n`);
    parts.push(`  → 实体: ${bodySize.toFixed(4)} | 上影: ${upperWick.toFixed(4)} | 下影: ${lowerWick.toFixed(4)}`);

    // 判断形态类型
    if (bodySize / totalRange < 0.2 && totalRange > 0) {
      parts.push(` (十字星)\n`);
    } else if (upperWick > bodySize * 2) {
      parts.push(` (长上影)\n`);
    } else if (lowerWick > bodySize * 2) {
      parts.push(` (长下影)\n`);
    } else {
      parts.push(`\n`);
    }

    // ATR（波动率）
    if (data.atr !== undefined) {
      parts.push(`**ATR (波动率)**: ${data.atr.toFixed(4)}\n`);
    }
  }

  return parts.join('');
}

// ========================================
// AI API Caller
// ========================================

export interface AIConfig {
  model: 'deepseek' | 'qwen' | 'custom';
  apiKey: string;
  baseURL?: string;
  modelName?: string;
}

export async function callAI(
  systemPrompt: string,
  userPrompt: string,
  config: AIConfig
): Promise<string> {
  const baseURL =
    config.baseURL ||
    (config.model === 'deepseek'
      ? 'https://api.deepseek.com'
      : config.model === 'qwen'
        ? 'https://dashscope.aliyuncs.com/compatible-mode/v1'
        : config.baseURL);

  if (!baseURL) {
    throw new Error('AI base URL is required for custom model');
  }

  const response = await fetch(`${baseURL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model === 'deepseek' ? 'deepseek-chat' : 'qwen-plus',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// ========================================
// Response Parser
// ========================================

export function parseDecisionResponse(aiResponse: string): {
  cotTrace: string;
  decisions: Decision[];
} {
  // 1. 提取思维链（JSON数组之前的内容）
  const jsonStart = aiResponse.indexOf('[');
  const cotTrace = jsonStart > 0 ? aiResponse.substring(0, jsonStart).trim() : aiResponse.trim();

  // 2. 提取JSON决策列表
  if (jsonStart === -1) {
    return { cotTrace, decisions: [] };
  }

  // 找到匹配的右括号
  const jsonEnd = findMatchingBracket(aiResponse, jsonStart);
  if (jsonEnd === -1) {
    throw new Error('无法找到JSON数组结束');
  }

  let jsonContent = aiResponse.substring(jsonStart, jsonEnd + 1).trim();

  // 修复中文引号
  jsonContent = jsonContent
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2018\u2019]/g, "'");

  // 解析JSON
  try {
    const decisions = JSON.parse(jsonContent) as Decision[];
    return { cotTrace, decisions };
  } catch (error) {
    throw new Error(`JSON解析失败: ${error instanceof Error ? error.message : error}\nJSON内容: ${jsonContent}`);
  }
}

function findMatchingBracket(s: string, start: number): number {
  if (start >= s.length || s[start] !== '[') {
    return -1;
  }

  let depth = 0;
  for (let i = start; i < s.length; i++) {
    if (s[i] === '[') {
      depth++;
    } else if (s[i] === ']') {
      depth--;
      if (depth === 0) {
        return i;
      }
    }
  }

  return -1;
}

// ========================================
// Decision Validator
// ========================================

export function validateDecision(
  decision: Decision,
  accountEquity: number,
  btcEthLeverage: number,
  altcoinLeverage: number
): string | null {
  const validActions = [
    'open_long',
    'open_short',
    'close_long',
    'close_short',
    'hold',
    'wait',
  ];

  if (!validActions.includes(decision.action)) {
    return `无效的action: ${decision.action}`;
  }

  // 开仓操作必须提供完整参数
  if (decision.action === 'open_long' || decision.action === 'open_short') {
    const isBTCETH = decision.symbol === 'BTCUSDT' || decision.symbol === 'ETHUSDT';
    const maxLeverage = isBTCETH ? btcEthLeverage : altcoinLeverage;
    const maxPositionValue = isBTCETH ? accountEquity * 10 : accountEquity * 1.5;

    if (!decision.leverage || decision.leverage <= 0 || decision.leverage > maxLeverage) {
      return `杠杆必须在1-${maxLeverage}之间（${decision.symbol}，当前配置上限${maxLeverage}倍）: ${decision.leverage}`;
    }

    if (!decision.position_size_usd || decision.position_size_usd <= 0) {
      return `仓位大小必须大于0: ${decision.position_size_usd}`;
    }

    // 验证仓位价值上限（1%容差）
    const tolerance = maxPositionValue * 0.01;
    if (decision.position_size_usd > maxPositionValue + tolerance) {
      if (isBTCETH) {
        return `BTC/ETH单币种仓位价值不能超过${maxPositionValue.toFixed(0)} USDT（10倍账户净值），实际: ${decision.position_size_usd.toFixed(0)}`;
      } else {
        return `山寨币单币种仓位价值不能超过${maxPositionValue.toFixed(0)} USDT（1.5倍账户净值），实际: ${decision.position_size_usd.toFixed(0)}`;
      }
    }

    if (!decision.stop_loss || decision.stop_loss <= 0) {
      return '止损必须大于0';
    }

    if (!decision.take_profit || decision.take_profit <= 0) {
      return '止盈必须大于0';
    }

    // 验证止损止盈合理性
    if (decision.action === 'open_long') {
      if (decision.stop_loss >= decision.take_profit) {
        return '做多时止损价必须小于止盈价';
      }
    } else {
      if (decision.stop_loss <= decision.take_profit) {
        return '做空时止损价必须大于止盈价';
      }
    }

    // 验证风险回报比（≥3:1）
    let entryPrice: number;
    let riskPercent: number;
    let rewardPercent: number;

    if (decision.action === 'open_long') {
      entryPrice = decision.stop_loss + (decision.take_profit - decision.stop_loss) * 0.2;
      riskPercent = ((entryPrice - decision.stop_loss) / entryPrice) * 100;
      rewardPercent = ((decision.take_profit - entryPrice) / entryPrice) * 100;
    } else {
      entryPrice = decision.stop_loss - (decision.stop_loss - decision.take_profit) * 0.2;
      riskPercent = ((decision.stop_loss - entryPrice) / entryPrice) * 100;
      rewardPercent = ((entryPrice - decision.take_profit) / entryPrice) * 100;
    }

    const riskRewardRatio = riskPercent > 0 ? rewardPercent / riskPercent : 0;

    if (riskRewardRatio < 3.0) {
      return `风险回报比过低(${riskRewardRatio.toFixed(2)}:1)，必须≥3.0:1 [风险:${riskPercent.toFixed(2)}% 收益:${rewardPercent.toFixed(2)}%] [止损:${decision.stop_loss.toFixed(2)} 止盈:${decision.take_profit.toFixed(2)}]`;
    }
  }

  return null; // Valid
}

// ========================================
// Main Decision Function
// ========================================

export async function getFullDecision(
  ctx: TradingContext,
  aiConfig: AIConfig
): Promise<FullDecision> {
  // 1. 构建提示词
  const systemPrompt = buildSystemPrompt(
    ctx.account.total_equity,
    ctx.btc_eth_leverage,
    ctx.altcoin_leverage,
    ctx.prompt_template || 'adaptive' // 使用配置的提示词模板，默认 adaptive
  );
  const userPrompt = buildUserPrompt(ctx);

  // 2. 调用AI
  const aiResponse = await callAI(systemPrompt, userPrompt, aiConfig);

  console.log('aiResponse', aiResponse);
  console.log('--------------------------------');
  console.log('prompt', systemPrompt);
  console.log('user prompt', userPrompt);
  console.log('--------------------------------');

  // 3. 解析响应
  const { cotTrace, decisions } = parseDecisionResponse(aiResponse);

  // 4. 验证决策
  for (let i = 0; i < decisions.length; i++) {
    const error = validateDecision(
      decisions[i],
      ctx.account.total_equity,
      ctx.btc_eth_leverage,
      ctx.altcoin_leverage
    );
    if (error) {
      console.warn(`决策 #${i + 1} 验证失败: ${error}`);
    }
  }

  return {
    user_prompt: userPrompt,
    cot_trace: cotTrace,
    decisions,
    timestamp: new Date(),
  };
}
