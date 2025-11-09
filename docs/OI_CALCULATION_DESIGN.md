# OI（持仓量）变化率计算方案

## 📊 OI变化率的意义

**持仓量（Open Interest）** 是衍生品市场的重要指标：
- **OI增加 + 价格上涨** → 多头主导，真实上涨
- **OI增加 + 价格下跌** → 空头主导，真实下跌
- **OI减少 + 价格变化** → 止盈/止损平仓，趋势可能反转

**OI变化率阈值**：
- **>+5%**：持仓量显著增加，确认趋势
- **<-5%**：持仓量显著减少，警惕反转

---

## 🎯 计算方案设计

### 方案对比

| 方案 | 优点 | 缺点 | 推荐度 |
|------|------|------|--------|
| **1. Binance历史API** | 官方数据准确 | API限制，需额外请求 | ⭐⭐⭐⭐ |
| **2. 本地文件缓存** | 简单可控 | 需要持久化管理 | ⭐⭐⭐⭐⭐ |
| **3. Redis缓存** | 高性能 | 需要额外服务 | ⭐⭐⭐ |
| **4. 仅内存缓存** | 极简 | 重启丢失数据 | ⭐⭐ |

---

## ✅ 推荐方案：本地文件缓存

### 实现思路

```typescript
// 1. 缓存结构
interface OICache {
  [symbol: string]: {
    timestamp: number;
    oiValue: number;      // OI价值（百万美元）
    oiQuantity: number;   // OI数量（合约数量）
  }[];
}

// 2. 缓存文件
// .cache/oi-history.json
{
  "BTCUSDT": [
    { "timestamp": 1699564800000, "oiValue": 8567.52, "oiQuantity": 85000 },
    { "timestamp": 1699568400000, "oiValue": 8612.34, "oiQuantity": 86200 },
    ...
  ]
}

// 3. 计算逻辑
// 对比当前OI与N小时前的OI
oiChangePct = (currentOI - previousOI) / previousOI * 100
```

### 数据保留策略

- **采样频率**：每次调用getMarketData时更新
- **保留时长**：保留最近72小时的数据（约72个数据点，每小时1个）
- **对比基准**：与4小时前的OI对比（匹配4h K线周期）
- **清理机制**：自动删除超过72小时的旧数据

---

## 📝 完整实现代码

### 1. OI缓存管理类

```typescript
// lib/oi-cache.ts
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';

interface OIRecord {
  timestamp: number;
  oiValue: number;      // OI价值（百万美元）
  oiQuantity: number;   // OI数量（合约数量）
}

interface OICache {
  [symbol: string]: OIRecord[];
}

class OIHistoryCache {
  private cachePath: string;
  private cache: OICache;
  private retentionHours: number = 72; // 保留72小时

  constructor() {
    const cacheDir = resolve(process.cwd(), '.cache');
    if (!existsSync(cacheDir)) {
      mkdirSync(cacheDir, { recursive: true });
    }
    this.cachePath = resolve(cacheDir, 'oi-history.json');
    this.loadCache();
  }

  /**
   * 加载缓存文件
   */
  private loadCache() {
    try {
      if (existsSync(this.cachePath)) {
        const data = readFileSync(this.cachePath, 'utf-8');
        this.cache = JSON.parse(data);
        this.cleanOldData();
      } else {
        this.cache = {};
      }
    } catch (error) {
      console.warn('[OI Cache] Failed to load cache, starting fresh:', error);
      this.cache = {};
    }
  }

  /**
   * 保存缓存到文件
   */
  private saveCache() {
    try {
      writeFileSync(this.cachePath, JSON.stringify(this.cache, null, 2), 'utf-8');
    } catch (error) {
      console.error('[OI Cache] Failed to save cache:', error);
    }
  }

  /**
   * 清理超过保留时长的旧数据
   */
  private cleanOldData() {
    const cutoffTime = Date.now() - this.retentionHours * 60 * 60 * 1000;

    for (const symbol in this.cache) {
      this.cache[symbol] = this.cache[symbol].filter(
        record => record.timestamp > cutoffTime
      );

      // 如果某个币种没有数据了，删除该键
      if (this.cache[symbol].length === 0) {
        delete this.cache[symbol];
      }
    }
  }

  /**
   * 添加新的OI记录
   */
  addRecord(symbol: string, oiValue: number, oiQuantity: number) {
    const now = Date.now();

    if (!this.cache[symbol]) {
      this.cache[symbol] = [];
    }

    // 检查是否已有最近1小时内的记录（防止重复添加）
    const lastRecord = this.cache[symbol][this.cache[symbol].length - 1];
    if (lastRecord && now - lastRecord.timestamp < 60 * 60 * 1000) {
      // 更新最新记录而不是添加新记录
      lastRecord.timestamp = now;
      lastRecord.oiValue = oiValue;
      lastRecord.oiQuantity = oiQuantity;
    } else {
      // 添加新记录
      this.cache[symbol].push({
        timestamp: now,
        oiValue,
        oiQuantity,
      });
    }

    this.cleanOldData();
    this.saveCache();
  }

  /**
   * 计算OI变化率（对比N小时前）
   * @param symbol 交易对
   * @param currentOI 当前OI价值（百万美元）
   * @param hoursAgo 对比几小时前（默认4小时）
   */
  calculateChange(symbol: string, currentOI: number, hoursAgo: number = 4): number {
    if (!this.cache[symbol] || this.cache[symbol].length === 0) {
      return 0; // 无历史数据
    }

    const targetTime = Date.now() - hoursAgo * 60 * 60 * 1000;

    // 找到最接近目标时间的记录
    let closestRecord: OIRecord | null = null;
    let minDiff = Infinity;

    for (const record of this.cache[symbol]) {
      const diff = Math.abs(record.timestamp - targetTime);
      if (diff < minDiff) {
        minDiff = diff;
        closestRecord = record;
      }
    }

    if (!closestRecord) {
      return 0;
    }

    // 如果找到的记录时间差超过2小时，认为数据不可靠
    if (minDiff > 2 * 60 * 60 * 1000) {
      console.warn(
        `[OI Cache] No reliable data for ${symbol} at ${hoursAgo}h ago (found ${(minDiff / 3600000).toFixed(1)}h ago)`
      );
      return 0;
    }

    const previousOI = closestRecord.oiValue;
    const changePct = ((currentOI - previousOI) / previousOI) * 100;

    console.log(
      `[OI Cache] ${symbol}: ${previousOI.toFixed(2)}M (${hoursAgo}h ago) → ${currentOI.toFixed(2)}M (now) = ${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%`
    );

    return changePct;
  }

  /**
   * 获取某个币种的历史记录数量
   */
  getRecordCount(symbol: string): number {
    return this.cache[symbol]?.length || 0;
  }
}

// 单例模式
let instance: OIHistoryCache | null = null;

export function getOICache(): OIHistoryCache {
  if (!instance) {
    instance = new OIHistoryCache();
  }
  return instance;
}
```

---

### 2. 更新市场数据获取函数

```typescript
// lib/market-data.ts (修改 fetchOpenInterest)

import { getOICache } from './oi-cache';

async function fetchOpenInterest(symbol: string): Promise<{ current: number; change_pct: number }> {
  try {
    const url = `${BINANCE_BASE_URL}/fapi/v1/openInterest?symbol=${symbol}`;
    const response = await fetchWithProxy(url);
    if (!response.ok) return { current: 0, change_pct: 0 };

    const data = await response.json();
    const oiQuantity = parseFloat(data.openInterest);

    // Get current price to calculate OI value
    const ticker = await fetchTicker(symbol);
    const oiValue = (oiQuantity * ticker.lastPrice) / 1_000_000; // Convert to millions

    // 使用OI缓存计算变化率
    const oiCache = getOICache();
    const oiChangePct = oiCache.calculateChange(symbol, oiValue, 4); // 对比4小时前

    // 保存当前OI到缓存
    oiCache.addRecord(symbol, oiValue, oiQuantity);

    console.log(
      `[OI] ${symbol}: ${oiValue.toFixed(2)}M USD, Change: ${oiChangePct >= 0 ? '+' : ''}${oiChangePct.toFixed(2)}% (cached records: ${oiCache.getRecordCount(symbol)})`
    );

    return {
      current: oiValue,
      change_pct: oiChangePct,
    };
  } catch (error) {
    console.warn(`Failed to fetch OI for ${symbol}:`, error);
    return { current: 0, change_pct: 0 };
  }
}
```

---

## 🧪 测试验证

### 测试脚本

```typescript
// scripts/test-oi-cache.ts
import { getOICache } from '../lib/oi-cache';

async function testOICache() {
  console.log('\n🧪 Testing OI Cache\n');

  const cache = getOICache();

  // 模拟添加数据
  console.log('📝 Adding test records...');

  // 添加BTC的OI记录（模拟每小时一次）
  const now = Date.now();
  cache.addRecord('BTCUSDT', 8000, 80000);

  // 模拟4小时前的数据
  const fourHoursAgo = now - 4 * 60 * 60 * 1000;
  cache['cache']['BTCUSDT'].unshift({
    timestamp: fourHoursAgo,
    oiValue: 7500,
    oiQuantity: 75000,
  });

  // 计算变化率
  const change = cache.calculateChange('BTCUSDT', 8000, 4);
  console.log(`\n✅ OI Change: ${change.toFixed(2)}%`);
  console.log(`Expected: ${((8000 - 7500) / 7500 * 100).toFixed(2)}% = 6.67%`);

  console.log(`\n📊 Cached records: ${cache.getRecordCount('BTCUSDT')}`);
}

testOICache();
```

---

## 📈 使用示例

### 在交易决策中使用OI变化率

```typescript
// AI提示词中的解读
if (data.oi_change_pct > 5) {
  // OI增加超过5% → 资金流入，确认趋势
  if (data.price_change_4h > 0) {
    console.log('✅ 多头增仓，真实上涨');
  } else {
    console.log('✅ 空头增仓，真实下跌');
  }
} else if (data.oi_change_pct < -5) {
  // OI减少超过5% → 平仓离场，警惕反转
  console.log('⚠️  大量平仓，趋势可能反转');
} else {
  // -5% ~ +5% → 中性
  console.log('➖ OI变化不大，观望');
}
```

---

## 🚀 部署步骤

1. **创建OI缓存模块**：
   ```bash
   # 创建文件
   touch lib/oi-cache.ts

   # 复制上面的代码到文件中
   ```

2. **更新market-data.ts**：
   - 在 `fetchOpenInterest` 函数中集成OI缓存
   - 导入 `getOICache`

3. **创建缓存目录**：
   ```bash
   mkdir -p .cache
   echo '.cache/' >> .gitignore
   ```

4. **运行测试**：
   ```bash
   npx tsx scripts/test-oi-cache.ts
   ```

5. **重启交易引擎**：
   - OI缓存会自动初始化
   - 首次运行变化率为0%（无历史数据）
   - 4小时后开始显示真实变化率

---

## ⏱️ 数据积累时间线

| 运行时长 | OI变化率状态 |
|---------|-------------|
| 0-1小时 | 始终0%（无历史数据） |
| 1-4小时 | 0%（历史数据不足4小时） |
| 4小时+ | ✅ 显示真实变化率 |

---

## 🎯 优化建议

### 1. 冷启动优化

如果需要立即获得OI变化率，可以：
- 使用Binance历史OI API预填充数据
- API: `/futures/data/openInterestHist`

### 2. 多周期OI变化

可以同时计算多个时间段的变化率：
```typescript
oi_change_1h: cache.calculateChange(symbol, oiValue, 1),
oi_change_4h: cache.calculateChange(symbol, oiValue, 4),
oi_change_24h: cache.calculateChange(symbol, oiValue, 24),
```

### 3. 性能优化

- 使用二分查找加速历史记录查询
- 异步写入缓存文件（避免阻塞）
- 批量保存（每N次更新写一次文件）

---

## 📚 参考资料

- Binance Futures API: https://binance-docs.github.io/apidocs/futures/en/
- OpenInterest解读: https://www.investopedia.com/terms/o/openinterest.asp
