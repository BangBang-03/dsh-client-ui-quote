# 贡献指南

这是 DSH（DeepSeek Harness）的一个客户端插件：划词 → 浮层 → 原生引用芯片 → 发送后胶囊。动手前先读 [`AGENTS.md`](AGENTS.md) 的红线；这份只管「怎么提一个能被合并的 PR」。

## 最短路径

```bash
git clone https://github.com/BangBang-03/dsh-client-ui-quote.git
cd dsh-client-ui-quote
node --check lib/client.js
npm test          # 706 组离线断言，必须全绿
```

插件没有运行期依赖（客户端 bundle 只 `require("react")`），**不需要 `npm install`**，也不要在 PR 里新增依赖。

## PR 的目标与形状

- **目标分支只有一个：`main`**。它是仓库唯一的长期分支，也是发版线。
- **PR 标题会直接变成主干提交的标题**（合并方式是 squash），所以请写成仓库的提交口径：
  `fix(quote): 中文说明` / `feat(panel): …` / `docs: …` / `test: …` / `chore: …`。
- **PR 描述会变成提交正文**，请写清：改了什么、为什么这么改、怎么验证的（跑了什么、在什么环境）。
- 合并方式固定为 squash：你的署名会保留在主干提交里（author + `Co-authored-by`），**不需要**先把提交压成一条。

## 提交前自检

- `node --check lib/client.js && npm test` 全绿。
- **新增行为必须带断言**；**不许删断言、也不许放宽期望值换绿**。
- 断言数量变了：README 四处（`npm test` 入口、工程化第 4 条、自检合计、真机验证）+ [`test/README.md`](test/README.md) + [`CHANGELOG.md`](CHANGELOG.md) 各一处一起改。
- 改了界面文案：`lib/client.js` 的 `zh`/`en`、`locale/zh.json`、`locale/en.json`、README 功能表一起改（中英成对）。
- **不要改 `package.json` 的 `version`**：版本号由维护者在发版提交里统一改。

## 最容易踩的几条红线（全文见 AGENTS.md）

- 客户端功能只住在 `lib/client.js`；`lib/index.js` 只承载隐藏侧聊线程的创建，不承载别的功能。
- 不搬移、不改写宿主的 React 节点——胶囊是「隐藏原节点 + 在它前面画自己的」。
- 线格式 `> ❝ …` / `> ❞ …` / `※ │q1:…` **只增不改**，必须兼容已经发出去的旧消息。
- 永不代发：所有路径（含侧边对话、带回主会话）只写草稿。
- 代码里不写盘、不发外部网络请求（导出走 `Blob` 下载）。

## 关于 CI

首次贡献者的 PR 工作流会停在 `action_required`，需要维护者在 Actions 页点一次 **Approve and run workflows** 才会开跑。**这不是被拒绝，也不是你在等什么**——如果你提了 PR 而 CI 一直没动，稍等一下即可。

## 问题与讨论

用 [Issues](https://github.com/BangBang-03/dsh-client-ui-quote/issues)；仓库没有开 Discussions。
