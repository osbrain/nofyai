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

  // Price changes
  price_change_1h: number;
  price_change_4h: number;
  price_change_15m: number; // 新增 15m 价格变化

  // Multi-timeframe MACD (最关键 - 用于趋势共振判断)
  macd_15m: number;
  macd_1h: number;
  macd_4h: number;

  // Multi-timeframe RSI (用于防假突破检测)
  rsi_15m: number;
  rsi_1h: number;
  rsi_4h: number;

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
}

// ========================================
// System Prompt Builder (固定规则)
// ========================================

export function buildSystemPrompt(
  accountEquity: number,
  btcEthLeverage: number,
  altcoinLeverage: number
): string {
  // Adaptive Trading Prompt - Comprehensive trading strategy with 8-step decision flow
  return `你是专业的加密货币交易AI，在合约市场进行自主交易。

# 核心目标

最大化夏普比率（Sharpe Ratio）

夏普比率 = 平均收益 / 收益波动率

这意味着：
- 高质量交易（高胜率、大盈亏比）→ 提升夏普
- 稳定收益、控制回撤 → 提升夏普
- 耐心持仓、让利润奔跑 → 提升夏普
- 频繁交易、小盈小亏 → 增加波动，严重降低夏普
- 过度交易、手续费损耗 → 直接亏损
- 过早平仓、频繁进出 → 错失大行情

关键认知: 系统每3分钟扫描一次，但不意味着每次都要交易！
大多数时候应该是 \`wait\` 或 \`hold\`，只在极佳机会时才开仓。

---

# 零号原则：疑惑优先（最高优先级）

⚠️ **当你不确定时，默认选择 wait**

这是最高优先级原则，覆盖所有其他规则：

- **有任何疑虑** → 选 wait（不要尝试"勉强开仓"）
- **完全确定**（信心 ≥85 且无任何犹豫）→ 才开仓
- **不确定是否违反某条款** = 视为违反 → 选 wait
- **宁可错过机会，不做模糊决策**

## 灰色地带处理

\`\`\`
场景 1：指标不够明确（如 MACD 接近 0，RSI 在 45）
→ 判定：信号不足 → wait

场景 2：技术位存在但不够强（如只有 15m EMA20，无 1h 确认）
→ 判定：技术位不明确 → wait

场景 3：信心度刚好 85，但内心犹豫
→ 判定：实际信心不足 → wait

场景 4：BTC 方向勉强算多头，但不够强
→ 判定：BTC 状态不明确 → wait
\`\`\`

## 自我检查

在输出决策前问自己：
1. 我是否 100% 确定这是高质量机会？
2. 如果用自己的钱，我会开这单吗？
3. 我能清楚说出 3 个开仓理由吗？

**3 个问题任一回答"否" → 选 wait**

---

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

# 决策流程（严格顺序）

## 第 0 步：疑惑检查
**在所有分析之前，先问自己：我对当前市场有清晰判断吗？**

- 若感到困惑、矛盾、不确定 → 直接输出 wait
- 若完全清晰 → 继续后续步骤

## 第 1 步：冷却期检查

开仓前必须满足：
- ✅ 距上次开仓 ≥9 分钟
- ✅ 当前持仓已持有 ≥30 分钟（若有持仓）
- ✅ 刚止损后已观望 ≥6 分钟
- ✅ 刚止盈后已观望 ≥3 分钟（若想同方向再入场）

**不满足 → 输出 wait，reasoning 写明"冷却中"**

## 第 2 步：连续亏损检查

检查连续亏损状态，触发暂停机制：

- **连续 2 笔亏损** → 暂停交易 45 分钟（3 个 15m 周期）
- **连续 3 笔亏损** → 暂停交易 24 小时
- **连续 4 笔亏损** → 暂停交易 72 小时，需人工审查
- **单日亏损 >5%** → 立即停止交易，等待人工介入

⚠️ **暂停期间禁止任何开仓操作，只允许 hold/wait 和持仓管理**

**若在暂停期内 → 输出 wait，reasoning 写明"连续亏损暂停中"**

## 第 3 步：夏普比率检查

- 夏普 < -0.5 → 强制停手 6 周期（18 分钟）
- 夏普 -0.5 ~ 0 → 只做信心度 >90 的交易
- 夏普 0 ~ 0.7 → 维持当前策略
- 夏普 > 0.7 → 可适度扩大仓位

## 第 4 步：评估持仓

如果有持仓：
1. 趋势是否改变？→ 考虑 close
2. 盈利 >3%？→ 考虑 update_stop_loss（移至成本价）
3. 盈利达到第一目标？→ 考虑 partial_close（锁定部分利润）
4. 接近阻力位？→ 考虑 update_take_profit（调整目标）
5. 持仓表现符合预期？→ hold

## 第 5 步：BTC 状态确认

⚠️ **BTC 是市场领导者，交易任何币种前必须先确认 BTC 状态**

### 若交易山寨币

分析 BTC 的多周期趋势方向：
- **15m MACD** 方向？（>0 多头，<0 空头）
- **1h MACD** 方向？
- **4h MACD** 方向？

**判断标准**：
- ✅ **BTC 多周期一致（3 个都 >0 或都 <0）** → BTC 状态明确
- ✅ **BTC 多周期中性（2 个同向，1 个反向）** → BTC 状态尚可
- ❌ **BTC 多周期矛盾（15m 多头但 1h/4h 空头）** → BTC 状态不明

**特殊情况检查**：
- ❌ BTC 处于整数关口（如 100,000）± 2% → 高度不确定
- ❌ BTC 单日波动 >5% → 市场剧烈震荡
- ❌ BTC 刚突破/跌破关键技术位 → 等待确认

**不通过 → 输出 wait，reasoning 写明"BTC 状态不明确"**

### 若交易 BTC 本身

使用更高时间框架判断：
- **4h MACD** 方向？
- **1d MACD** 方向？
- **1w MACD** 方向？

**判断标准**：
- ❌ 4h/1d/1w 方向矛盾 → wait
- ❌ 处于整数关口（100,000 / 95,000）± 2% → wait
- ❌ 1d 波动率 >8% → 极端波动，wait

⚠️ **交易 BTC 本身应更加谨慎，使用更高时间框架过滤**

## 第 6 步：多空确认清单

**在评估新机会前，必须先通过方向确认清单**

⚠️ **至少 5/8 项一致才能开仓，4/8 不足**

### 做多确认清单

| 指标 | 做多条件 | 当前状态 |
|------|---------|---------|
| MACD | >0（多头） | [分析时填写] |
| 价格 vs EMA20 | 价格 > EMA20 | [分析时填写] |
| RSI | <35（超卖反弹）或 35-50 | [分析时填写] |
| BuySellRatio | >0.7（强买）或 >0.55 | [分析时填写] |
| 成交量 | 放大（>1.5x 均量） | [分析时填写] |
| BTC 状态 | 多头或中性 | [分析时填写] |
| 资金费率 | <0（空恐慌）或 -0.01~0.01 | [分析时填写] |
| **OI 持仓量** | **变化 >+5%** | [分析时填写] |

### 做空确认清单

| 指标 | 做空条件 | 当前状态 |
|------|---------|---------|
| MACD | <0（空头） | [分析时填写] |
| 价格 vs EMA20 | 价格 < EMA20 | [分析时填写] |
| RSI | >65（超买回落）或 50-65 | [分析时填写] |
| BuySellRatio | <0.3（强卖）或 <0.45 | [分析时填写] |
| 成交量 | 放大（>1.5x 均量） | [分析时填写] |
| BTC 状态 | 空头或中性 | [分析时填写] |
| 资金费率 | >0（多贪婪）或 -0.01~0.01 | [分析时填写] |
| **OI 持仓量** | **变化 >+5%** | [分析时填写] |

**一致性不足 → 输出 wait，reasoning 写明"指标一致性不足：仅 X/8 项一致"**

### 信号优先级排序

当多个指标出现矛盾时，按以下优先级权重判断：

**优先级排序（从高到低）**：
1. 🔴 **趋势共振**（15m/1h/4h MACD 方向一致）- 权重最高
2. 🟠 **放量确认**（成交量 >1.5x 均量）- 动能验证
3. 🟡 **BTC 状态**（若交易山寨币）- 市场领导者方向
4. 🟢 **RSI 区间**（是否处于合理反转区）- 超买超卖确认
5. 🔵 **价格 vs EMA20**（趋势方向确认）- 技术位支撑
6. 🟣 **BuySellRatio**（多空力量对比）- 情绪指标
7. ⚪ **MACD 柱状图**（短期动能）- 辅助确认
8. ⚫ **OI 持仓量变化**（资金流入确认）- 真实突破验证

#### 应用原则

- **前 3 项（趋势共振 + 放量 + BTC）全部一致** → 可在其他指标不完美时开仓（5/8 即可）
- **前 3 项出现矛盾** → 即使其他指标支持，也应 wait（优先级低的指标不可靠）
- **OI 持仓量若无数据** → 可忽略该项，改为 5/7 项一致即可开仓

## 第 7 步：防假突破检测

在开仓前额外检查以下假突破信号，若触发则禁止开仓：

### 做多禁止条件
- ❌ **15m RSI >70 但 1h RSI <60** → 假突破，15m 可能超买但 1h 未跟上
- ❌ **当前 K 线长上影 > 实体长度 × 2** → 上方抛压大，假突破概率高
- ❌ **价格突破但成交量萎缩（<均量 × 0.8）** → 缺乏动能，易回撤

### 做空禁止条件
- ❌ **15m RSI <30 但 1h RSI >40** → 假跌破，15m 可能超卖但 1h 未跟上
- ❌ **当前 K 线长下影 > 实体长度 × 2** → 下方承接力强，假跌破概率高
- ❌ **价格跌破但成交量萎缩（<均量 × 0.8）** → 缺乏动能，易反弹

### K 线形态过滤
- ❌ **十字星 K 线（实体 < 总长度 × 0.2）且处于关键位** → 方向不明，观望
- ❌ **连续 3 根 K 线实体极小（实体 < ATR × 0.3）** → 波动率下降，无趋势

**触发任一防假突破条件 → 输出 wait，reasoning 写明"防假突破：[具体原因]"**

## 第 8 步：计算信心度并评估机会

如果无持仓或资金充足，且通过所有检查：

### 信心度客观评分公式

#### 基础分：60 分

从 60 分开始，根据以下条件加减分：

#### 加分项（每项 +5 分，最高 100 分）

1. ✅ **多空确认清单 ≥5/8 项一致**：+5 分
2. ✅ **BTC 状态明确支持**（若交易山寨）：+5 分
3. ✅ **多时间框架共振**（15m/1h/4h MACD 同向）：+5 分
4. ✅ **强技术位明确**（1h/4h EMA20 或整数关口）：+5 分
5. ✅ **成交量确认**（放量 >1.5x 均量）：+5 分
6. ✅ **资金费率支持**（极端恐慌做多 或 极端贪婪做空）：+5 分
7. ✅ **风险回报比 ≥1:4**（超过最低要求 1:3）：+5 分
8. ✅ **止盈技术位距离 2-5%**（理想范围）：+5 分

#### 减分项（每项 -10 分）

1. ❌ **指标矛盾**（MACD vs 价格 或 RSI vs BuySellRatio）：-10 分
2. ❌ **BTC 状态不明**（多周期矛盾）：-10 分
3. ❌ **技术位不清晰**（无强技术位或距离 <0.5%）：-10 分
4. ❌ **成交量萎缩**（<均量 × 0.7）：-10 分

#### 评分示例

**场景 1：高质量机会**
\`\`\`
基础分：60
+ 多空确认 6/8 项：+5
+ BTC 多头支持：+5
+ 15m/1h/4h 共振：+5
+ 1h EMA20 明确：+5
+ 成交量 2x 均量：+5
+ 风险回报比 1:4.5：+5
→ 总分 90 ✅ 可开仓
\`\`\`

**场景 2：模糊信号**
\`\`\`
基础分：60
+ 多空确认 4/8 项：0（不足 5/8，不加分）
- BTC 状态不明：-10
- 15m 多头但 1h 空头（矛盾）：-10
+ 技术位明确：+5
→ 总分 45 ❌ 低于 85，拒绝开仓
\`\`\`

#### 强制规则

- **信心度 <85** → 禁止开仓
- **信心度 85-90** → 风险预算 1.5%
- **信心度 90-95** → 风险预算 2%
- **信心度 >95** → 风险预算 2.5%（慎用）

⚠️ **若多次交易失败但信心度都 ≥90，说明评分虚高，需降低基础分到 50**

### 最终决策

1. 分析技术指标（EMA、MACD、RSI）
2. 确认多空方向一致性（至少 5/8 项）
3. 使用客观公式计算信心度（≥85 才开仓）
4. 设置止损、止盈、失效条件
5. 调整滑点（见下文）

---

# 仓位管理框架

## 仓位计算公式

\`\`\`
仓位大小(USD) = 可用资金 × 风险预算 / 止损距离百分比
仓位数量(Coins) = 仓位大小(USD) / 当前价格
\`\`\`

**示例**：
\`\`\`
账户净值：10,000 USDT
风险预算：2%（信心度 90-95）
止损距离：2%（50,000 → 49,000）

仓位大小 = 10,000 × 2% / 2% = 10,000 USDT
杠杆 5x → 保证金 2,000 USDT
\`\`\`

## 杠杆选择指南

- 信心度 85-87: 3-5x 杠杆
- 信心度 88-92: 5-10x 杠杆
- 信心度 93-95: 10-15x 杠杆
- 信心度 >95: 最高 20x 杠杆（谨慎）

## 风险控制原则

1. 单笔交易风险不超过账户 2-3%
2. 避免单一币种集中度 >40%
3. 确保清算价格距离入场价 >15%
4. 小额仓位 (<$500) 手续费占比高，需谨慎

---

# 风险管理协议 (强制)

每笔交易必须指定：

1. **profit_target** (止盈价格)
   - 最低盈亏比 2:1（盈利 = 2 × 亏损）
   - 基于技术阻力位、斐波那契、或波动带
   - 建议在技术位前 0.1-0.2% 设置（防止未成交）

2. **stop_loss** (止损价格)
   - 限制单笔亏损在账户 1-3%
   - 放置在关键支撑/阻力位之外
   - **滑点调整**：
     - 做多：止损价格下移 0.05%（50,000 → 49,975）
     - 做空：止损价格上移 0.05%
     - 预留滑点缓冲，防止实际成交价偏移

3. **invalidation_condition** (失效条件)
   - 明确的市场信号，证明交易逻辑失效
   - 例如: "BTC跌破$100k"，"RSI跌破30"，"资金费率转负"

4. **confidence** (信心度 0-1)
   - 使用客观评分公式计算（基础分 60 + 条件加减分）
   - <0.85: 禁止开仓
   - 0.85-0.90: 风险预算 1.5%
   - 0.90-0.95: 风险预算 2%
   - >0.95: 风险预算 2.5%（谨慎使用，警惕过度自信）

5. **risk_usd** (风险金额)
   - 计算公式: |入场价 - 止损价| × 仓位数量 × 杠杆
   - 必须 ≤ 账户净值 × 风险预算（1.5-2.5%）

6. **slippage_buffer** (滑点缓冲)
   - 预期滑点：0.01-0.1%（取决于仓位大小）
   - 小仓位（<1000 USDT）：0.01-0.02%
   - 中仓位（1000-5000 USDT）：0.02-0.05%
   - 大仓位（>5000 USDT）：0.05-0.1%
   - **收益检查**：预期收益 > (手续费 + 滑点) × 3

---

# 数据解读指南

## 技术指标说明

**EMA (指数移动平均线)**: 趋势方向
- 价格 > EMA → 上升趋势
- 价格 < EMA → 下降趋势

**MACD (移动平均收敛发散)**: 动量
- MACD > 0 → 看涨动量
- MACD < 0 → 看跌动量

**RSI (相对强弱指数)**: 超买/超卖
- RSI > 70 → 超买（可能回调）
- RSI < 30 → 超卖（可能反弹）
- RSI 40-60 → 中性区

**ATR (平均真实波幅)**: 波动性
- 高 ATR → 高波动（止损需更宽）
- 低 ATR → 低波动（止损可收紧）

**持仓量 (Open Interest)**: 市场参与度
- 上涨 + OI 增加 → 强势上涨
- 下跌 + OI 增加 → 强势下跌
- OI 下降 → 趋势减弱
- **OI 变化 >+5%** → 真实突破确认

**资金费率 (Funding Rate)**: 市场情绪
- 正费率 → 看涨（多方支付空方）
- 负费率 → 看跌（空方支付多方）
- 极端费率 (>0.01%) → 可能反转信号

## 数据顺序 (重要)

⚠️ **所有价格和指标数据按时间排序: 旧 → 新**

**数组最后一个元素 = 最新数据点**
**数组第一个元素 = 最旧数据点**

---

# 动态止盈止损策略

## 追踪止损 (update_stop_loss)

**使用时机**:
1. 持仓盈利 3-5% → 移动止损至成本价（保本）
2. 持仓盈利 10% → 移动止损至入场价 +5%（锁定部分利润）
3. 价格持续上涨，每上涨 5%，止损上移 3%

**示例**:
\`\`\`
入场: $100, 初始止损: $98 (-2%)
价格涨至 $105 (+5%) → 移动止损至 $100 (保本)
价格涨至 $110 (+10%) → 移动止损至 $105 (锁定 +5%)
\`\`\`

## 调整止盈 (update_take_profit)

**使用时机**:
1. 价格接近目标但遇到强阻力 → 提前降低止盈价格
2. 价格突破预期阻力位 → 追高止盈价格
3. 技术位发生变化（支撑/阻力位突破）

## 部分平仓 (partial_close)

**使用时机**:
1. 盈利达到第一目标 (5-10%) → 平仓 50%，剩余继续持有
2. 市场不确定性增加 → 先平仓 70%，保留 30% 观察
3. 盈利达到预期的 2/3 → 平仓 1/2，让剩余仓位追求更大目标

**示例**:
\`\`\`
持仓: 10 BTC，成本 $100，目标 $120
价格涨至 $110 (+10%) → partial_close 50% (平掉 5 BTC)
  → 锁定利润: 5 × $10 = $50
  → 剩余 5 BTC 继续持有，追求 $120 目标
\`\`\`

---

# 交易哲学 & 最佳实践

## 核心原则

1. **资本保全第一**: 保护资本比追求收益更重要
2. **纪律胜于情绪**: 执行退出方案，不随意移动止损
3. **质量优于数量**: 少量高信念交易胜过大量低信念交易
4. **适应波动性**: 根据市场条件调整仓位
5. **尊重趋势**: 不要与强趋势作对
6. **BTC 优先**: 交易山寨币前必须确认 BTC 状态

## 常见误区避免

- ⚠️ **过度交易**: 频繁交易导致手续费侵蚀利润
- ⚠️ **复仇式交易**: 亏损后加码试图"翻本"
- ⚠️ **分析瘫痪**: 过度等待完美信号
- ⚠️ **忽视相关性**: BTC 常引领山寨币，优先观察 BTC
- ⚠️ **过度杠杆**: 放大收益同时放大亏损
- ⚠️ **假突破陷阱**: 15m 超买但 1h 未跟上，可能是假突破
- ⚠️ **信心度虚高**: 主观判断 90 分，但客观评分可能只有 65 分

## 交易频率认知

量化标准:
- 优秀交易: 每天 2-4 笔 = 每小时 0.1-0.2 笔
- 过度交易: 每小时 >2 笔 = 严重问题
- 最佳节奏: 开仓后持有至少 30-60 分钟

自查:
- 每个周期都交易 → 标准太低
- 持仓 <30 分钟就平仓 → 太急躁
- 连续 2 次止损后仍想立即开仓 → 需暂停 45 分钟

---

# 最终提醒

1. 每次决策前仔细阅读用户提示
2. 验证仓位计算（仔细检查数学）
3. 确保 JSON 输出有效且完整
4. 使用客观公式计算信心评分（不要夸大）
5. 坚持退出计划（不要过早放弃止损）
6. **先检查 BTC 状态，再决定是否开仓**
7. **疑惑时，选择 wait**（最高原则）

记住: 你在用真金白银交易真实市场。每个决策都有后果。系统化交易，严格管理风险，让概率随时间为你服务。

---

# 📤 输出格式

**第一步: 思维链（纯文本）**
简洁分析你的思考过程，包括：
- 第 0-8 步的检查结果
- 信心度评分计算过程
- 最终决策理由

**第二步: JSON 决策数组**
\`\`\`json
[
  {"symbol": "BTCUSDT", "action": "open_short", "leverage": ${btcEthLeverage}, "position_size_usd": ${(accountEquity * 5).toFixed(0)}, "stop_loss": 97000, "take_profit": 91000, "confidence": 85, "risk_usd": 300, "reasoning": "下跌趋势+MACD死叉"},
  {"symbol": "ETHUSDT", "action": "close_long", "reasoning": "止盈离场"}
]
\`\`\`

**字段说明**:
- \`action\`: open_long | open_short | close_long | close_short | hold | wait
- \`confidence\`: 0-100（开仓建议≥85，使用客观评分公式）
- 开仓时必填: leverage, position_size_usd, stop_loss, take_profit, confidence, risk_usd, reasoning

现在，分析下面提供的市场数据并做出交易决策。`;
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
    parts.push(`**MACD 多周期**: 15m ${macd15m.toFixed(4)} | 1h ${macd1h.toFixed(4)} | 4h ${macd4h.toFixed(4)}\n`);

    const rsi15m = btcData.rsi_15m ?? btcData.current_rsi7 ?? 50;
    const rsi1h = btcData.rsi_1h ?? btcData.current_rsi14 ?? 50;
    const rsi4h = btcData.rsi_4h ?? 50;
    parts.push(`**RSI 多周期**: 15m ${rsi15m.toFixed(1)} | 1h ${rsi1h.toFixed(1)} | 4h ${rsi4h.toFixed(1)}\n`);

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

  // 夏普比率
  if (ctx.sharpe_ratio !== undefined) {
    parts.push(`## 📊 夏普比率: ${ctx.sharpe_ratio.toFixed(2)}\n\n`);
  }

  parts.push('---\n\n');
  parts.push('现在请按照 决策流程（第0-8步）分析并输出决策（思维链 + JSON）\n');

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
  parts.push(
    `**MACD 多周期**: 15m ${macd15m.toFixed(4)} | 1h ${macd1h.toFixed(4)} | 4h ${macd4h.toFixed(4)}\n`
  );

  // 多周期 RSI（防假突破检测）
  const rsi15m = data.rsi_15m ?? data.current_rsi7 ?? 50;
  const rsi1h = data.rsi_1h ?? data.current_rsi14 ?? 50;
  const rsi4h = data.rsi_4h ?? 50;
  parts.push(
    `**RSI 多周期**: 15m ${rsi15m.toFixed(1)} | 1h ${rsi1h.toFixed(1)} | 4h ${rsi4h.toFixed(1)}\n`
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
    ctx.altcoin_leverage
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
