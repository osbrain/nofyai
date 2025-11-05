# 贡献指南

感谢你考虑为 NofyAI 做出贡献！

## 如何贡献

### 报告 Bug

如果你发现了 Bug，请在 GitHub Issues 中报告，包含以下信息：

- **标题**：简明扼要的描述
- **环境**：Node.js 版本、操作系统、浏览器等
- **重现步骤**：详细的步骤说明
- **期望行为**：你期望发生什么
- **实际行为**：实际发生了什么
- **截图**：如果适用，添加截图帮助解释问题
- **日志**：相关的控制台输出或错误日志

### 提出新功能

如果你有新功能的想法，请先在 Issues 中讨论：

1. 检查是否已有相关的 Issue
2. 创建新 Issue 并打上 `enhancement` 标签
3. 清楚描述功能的用途和预期行为
4. 等待维护者反馈后再开始编码

### 提交代码

#### 开发流程

1. **Fork 仓库**
   ```bash
   # 在 GitHub 上点击 Fork 按钮
   git clone https://github.com/你的用户名/nofyai.git
   cd nofyai
   ```

2. **创建分支**
   ```bash
   git checkout -b feature/amazing-feature
   # 或
   git checkout -b fix/bug-description
   ```

3. **安装依赖**
   ```bash
   npm install
   ```

4. **配置开发环境**
   ```bash
   cp config.json.example config.json
   cp .env.local.example .env.local
   # 编辑配置文件
   ```

5. **进行开发**
   - 编写代码
   - 确保遵循代码规范
   - 添加必要的注释

6. **测试**
   ```bash
   npm run lint        # 检查代码风格
   npm run build       # 确保构建成功
   npm run dev         # 本地测试
   ```

7. **提交改动**
   ```bash
   git add .
   git commit -m "feat: 添加某某功能"
   # 提交信息格式请参考下方说明
   ```

8. **推送分支**
   ```bash
   git push origin feature/amazing-feature
   ```

9. **创建 Pull Request**
   - 在 GitHub 上打开你的 Fork 仓库
   - 点击 "New Pull Request"
   - 填写 PR 描述，说明你的改动

#### 提交信息规范

使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

```
<类型>(<范围>): <描述>

[可选的正文]

[可选的脚注]
```

**类型：**
- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档更新
- `style`: 代码格式（不影响代码运行）
- `refactor`: 重构（既不是新功能也不是 Bug 修复）
- `perf`: 性能优化
- `test`: 测试相关
- `chore`: 构建过程或辅助工具的变动

**示例：**
```
feat(trader): 添加 Hyperliquid 交易所支持

- 实现 Hyperliquid API 集成
- 添加钱包签名功能
- 更新配置文件示例

Closes #123
```

### 代码规范

#### TypeScript

- **严格模式**：启用 TypeScript strict mode
- **类型定义**：为所有函数和变量提供明确的类型
- **避免 `any`**：尽量使用具体类型
- **接口优先**：使用 `interface` 而非 `type`（除非需要联合类型）

#### React

- **函数组件**：使用函数组件和 Hooks
- **Props 类型**：为所有组件定义 Props 接口
- **命名规范**：组件使用 PascalCase，文件名与组件名一致
- **避免内联样式**：使用 Tailwind CSS 类名

#### 样式

- **Tailwind CSS**：优先使用 Tailwind 工具类
- **响应式设计**：使用 `sm:`、`md:`、`lg:` 前缀
- **自定义类**：必要时在 `globals.css` 中定义
- **避免 `!important`**：除非绝对必要

#### 文件组织

- **路径别名**：使用 `@/` 导入模块（如 `@/lib/api`）
- **相对路径**：避免深层相对路径（`../../../`）
- **单一职责**：每个文件只做一件事
- **合理命名**：文件名清晰描述其内容

### 测试

目前项目暂无自动化测试，但请确保：

- [ ] 所有页面能正常加载
- [ ] API 端点返回正确数据
- [ ] 交易流程完整运行
- [ ] 无控制台错误
- [ ] 在不同浏览器测试（Chrome、Firefox、Safari）
- [ ] 响应式设计在移动端正常显示

### 文档

如果你的改动涉及：

- **新功能**：更新 README.md
- **API 变化**：更新 API 文档
- **配置变更**：更新 config.json.example
- **架构调整**：更新 CLAUDE.md

### Pull Request 检查清单

提交 PR 前，请确保：

- [ ] 代码遵循项目的代码规范
- [ ] 提交信息遵循 Conventional Commits
- [ ] 已在本地测试所有改动
- [ ] 构建成功（`npm run build`）
- [ ] 无 ESLint 错误（`npm run lint`）
- [ ] 更新了相关文档
- [ ] PR 描述清晰说明了改动内容

### 行为准则

#### 我们的承诺

为了营造开放和友好的环境，我们承诺：

- 使用友好和包容的语言
- 尊重不同的观点和经验
- 优雅地接受建设性批评
- 关注对社区最有利的事情
- 对其他社区成员表示同理心

#### 不可接受的行为

- 使用性化的语言或图像
- 侮辱性或贬损性评论
- 人身攻击
- 骚扰行为
- 发布他人的私人信息
- 其他在专业环境中不适当的行为

## 问题和讨论

- **Bug 报告**：使用 GitHub Issues
- **功能请求**：使用 GitHub Issues（标签：`enhancement`）
- **一般问题**：使用 GitHub Discussions
- **安全问题**：请私下联系维护者

## 许可

提交代码即表示你同意将你的贡献按照 [MIT License](LICENSE) 授权。

---

再次感谢你的贡献！🎉
