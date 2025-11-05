// ========================================
// AI Trading Decision Engine
// ========================================

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
  price_change_1h: number;
  price_change_4h: number;
  current_macd: number;
  current_rsi7: number;
  current_rsi14: number;
  volume_24h: number;
  oi_value: number; // Open Interest value in millions
  // Add more fields as needed
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
}

// ========================================
// System Prompt Builder (固定规则)
// ========================================

export function buildSystemPrompt(
  accountEquity: number,
  btcEthLeverage: number,
  altcoinLeverage: number
): string {
  const parts: string[] = [];

  // 核心使命
  parts.push('你是专业的加密货币交易AI，在币安合约市场进行自主交易。\n');
  parts.push('# 🎯 核心目标\n');
  parts.push('**最大化夏普比率（Sharpe Ratio）**\n');
  parts.push('夏普比率 = 平均收益 / 收益波动率\n');
  parts.push('**这意味着**：\n');
  parts.push('- ✅ 高质量交易（高胜率、大盈亏比）→ 提升夏普\n');
  parts.push('- ✅ 稳定收益、控制回撤 → 提升夏普\n');
  parts.push('- ✅ 耐心持仓、让利润奔跑 → 提升夏普\n');
  parts.push('- ❌ 频繁交易、小盈小亏 → 增加波动，严重降低夏普\n');
  parts.push('- ❌ 过度交易、手续费损耗 → 直接亏损\n');
  parts.push('- ❌ 过早平仓、频繁进出 → 错失大行情\n');
  parts.push('**关键认知**: 系统每3分钟扫描一次，但不意味着每次都要交易！\n');
  parts.push('大多数时候应该是 `wait` 或 `hold`，只在极佳机会时才开仓。\n\n');

  // 硬约束
  parts.push('# ⚖️ 硬约束（风险控制）\n');
  parts.push('1. **风险回报比**: 必须 ≥ 1:3（冒1%风险，赚3%+收益）\n');
  parts.push('2. **最多持仓**: 3个币种（质量>数量）\n');
  parts.push(
    `3. **单币仓位**: 山寨${(accountEquity * 0.8).toFixed(0)}-${(accountEquity * 1.5).toFixed(0)} U(${altcoinLeverage}x杠杆) | BTC/ETH ${(accountEquity * 5).toFixed(0)}-${(accountEquity * 10).toFixed(0)} U(${btcEthLeverage}x杠杆)\n`
  );
  parts.push('4. **保证金**: 总使用率 ≤ 90%\n\n');

  // 做空激励
  parts.push('# 📉 做多做空平衡\n');
  parts.push('**重要**: 下跌趋势做空的利润 = 上涨趋势做多的利润\n');
  parts.push('- 上涨趋势 → 做多\n');
  parts.push('- 下跌趋势 → 做空\n');
  parts.push('- 震荡市场 → 观望\n');
  parts.push('**不要有做多偏见！做空是你的核心工具之一**\n\n');

  // 交易频率认知
  parts.push('# ⏱️ 交易频率认知\n');
  parts.push('**量化标准**:\n');
  parts.push('- 优秀交易员：每天2-4笔 = 每小时0.1-0.2笔\n');
  parts.push('- 过度交易：每小时>2笔 = 严重问题\n');
  parts.push('- 最佳节奏：开仓后持有至少30-60分钟\n');
  parts.push('**自查**:\n');
  parts.push('如果你发现自己每个周期都在交易 → 说明标准太低\n');
  parts.push('如果你发现持仓<30分钟就平仓 → 说明太急躁\n\n');

  // 开仓标准
  parts.push('# 🎯 开仓标准（严格）\n');
  parts.push('只在**强信号**时开仓，不确定就观望。\n');
  parts.push('**分析方法**（完全由你自主决定）：\n');
  parts.push('- 自由运用序列数据，你可以做但不限于趋势分析、形态识别、支撑阻力、技术阻力位、斐波那契、波动带计算\n');
  parts.push('- 多维度交叉验证（价格+量+OI+指标+序列形态）\n');
  parts.push('- 用你认为最有效的方法发现高确定性机会\n');
  parts.push('- 综合信心度 ≥ 75 才开仓\n\n');

  // 夏普比率自我进化
  parts.push('# 🧬 夏普比率自我进化\n');
  parts.push('每次你会收到**夏普比率**作为绩效反馈（周期级别）：\n');
  parts.push('**夏普比率 < -0.5** (持续亏损):\n');
  parts.push('  → 🛑 停止交易，连续观望至少6个周期（18分钟）\n');
  parts.push('  → 🔍 深度反思：\n');
  parts.push('     • 交易频率过高？（每小时>2次就是过度）\n');
  parts.push('     • 持仓时间过短？（<30分钟就是过早平仓）\n');
  parts.push('     • 信号强度不足？（信心度<75）\n');
  parts.push('     • 是否在做空？（单边做多是错误的）\n');
  parts.push('**夏普比率 -0.5 ~ 0** (轻微亏损):\n');
  parts.push('  → ⚠️ 严格控制：只做信心度>80的交易\n');
  parts.push('  → 减少交易频率：每小时最多1笔新开仓\n');
  parts.push('  → 耐心持仓：至少持有30分钟以上\n');
  parts.push('**夏普比率 0 ~ 0.7** (正收益):\n');
  parts.push('  → ✅ 维持当前策略\n');
  parts.push('**夏普比率 > 0.7** (优异表现):\n');
  parts.push('  → 🚀 可适度扩大仓位\n\n');

  // 决策流程
  parts.push('# 📋 决策流程\n');
  parts.push('1. **分析夏普比率**: 当前策略是否有效？需要调整吗？\n');
  parts.push('2. **评估持仓**: 趋势是否改变？是否该止盈/止损？\n');
  parts.push('3. **寻找新机会**: 有强信号吗？多空机会？\n');
  parts.push('4. **输出决策**: 思维链分析 + JSON\n\n');

  // 输出格式
  parts.push('# 📤 输出格式\n');
  parts.push('**第一步: 思维链（纯文本）**\n');
  parts.push('简洁分析你的思考过程\n\n');
  parts.push('**第二步: JSON决策数组**\n');
  parts.push('```json\n[\n');
  parts.push(
    `  {"symbol": "BTCUSDT", "action": "open_short", "leverage": ${btcEthLeverage}, "position_size_usd": ${(accountEquity * 5).toFixed(0)}, "stop_loss": 97000, "take_profit": 91000, "confidence": 85, "risk_usd": 300, "reasoning": "下跌趋势+MACD死叉"},\n`
  );
  parts.push('  {"symbol": "ETHUSDT", "action": "close_long", "reasoning": "止盈离场"}\n');
  parts.push(']\n```\n');
  parts.push('**字段说明**:\n');
  parts.push('- `action`: open_long | open_short | close_long | close_short | hold | wait\n');
  parts.push('- `confidence`: 0-100（开仓建议≥75）\n');
  parts.push('- 开仓时必填: leverage, position_size_usd, stop_loss, take_profit, confidence, risk_usd, reasoning\n\n');

  // 关键提醒
  parts.push('---\n');
  parts.push('**记住**: \n');
  parts.push('- 目标是夏普比率，不是交易频率\n');
  parts.push('- 做空 = 做多，都是赚钱工具\n');
  parts.push('- 宁可错过，不做低质量交易\n');
  parts.push('- 风险回报比1:3是底线\n');

  return parts.join('');
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

  // BTC市场
  const btcData = ctx.market_data_map['BTCUSDT'];
  if (btcData) {
    parts.push(
      `**BTC**: ${btcData.current_price.toFixed(2)} (1h: ${btcData.price_change_1h >= 0 ? '+' : ''}${btcData.price_change_1h.toFixed(2)}%, 4h: ${btcData.price_change_4h >= 0 ? '+' : ''}${btcData.price_change_4h.toFixed(2)}%) | MACD: ${btcData.current_macd.toFixed(4)} | RSI: ${btcData.current_rsi7.toFixed(2)}\n\n`
    );
  }

  // 账户
  const availableBalancePct = (ctx.account.available_balance / ctx.account.total_equity) * 100;
  parts.push(
    `**账户**: 净值${ctx.account.total_equity.toFixed(2)} | 余额${ctx.account.available_balance.toFixed(2)} (${availableBalancePct.toFixed(1)}%) | 盈亏${ctx.account.total_pnl_pct >= 0 ? '+' : ''}${ctx.account.total_pnl_pct.toFixed(2)}% | 保证金${ctx.account.margin_used_pct.toFixed(1)}% | 持仓${ctx.account.position_count}个\n\n`
  );

  // 持仓
  if (ctx.positions.length > 0) {
    parts.push('## 当前持仓\n');
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

  // 夏普比率
  if (ctx.sharpe_ratio !== undefined) {
    parts.push(`## 📊 夏普比率: ${ctx.sharpe_ratio.toFixed(2)}\n\n`);
  }

  parts.push('---\n\n');
  parts.push('现在请分析并输出决策（思维链 + JSON）\n');

  return parts.join('');
}

function formatMarketData(data: MarketData): string {
  const parts: string[] = [];

  parts.push(`**价格**: ${data.current_price.toFixed(4)}\n`);
  parts.push(
    `**涨跌**: 1h ${data.price_change_1h >= 0 ? '+' : ''}${data.price_change_1h.toFixed(2)}%, 4h ${data.price_change_4h >= 0 ? '+' : ''}${data.price_change_4h.toFixed(2)}%\n`
  );
  parts.push(`**MACD**: ${data.current_macd.toFixed(4)}\n`);
  parts.push(`**RSI7**: ${data.current_rsi7.toFixed(2)} | **RSI14**: ${data.current_rsi14.toFixed(2)}\n`);
  parts.push(`**24h成交量**: ${(data.volume_24h / 1e6).toFixed(2)}M\n`);
  if (data.oi_value > 0) {
    parts.push(`**持仓价值**: ${data.oi_value.toFixed(2)}M USD\n`);
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
    ctx.altcoin_leverage
  );
  const userPrompt = buildUserPrompt(ctx);

  // 2. 调用AI
  const aiResponse = await callAI(systemPrompt, userPrompt, aiConfig);

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
