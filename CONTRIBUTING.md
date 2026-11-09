# 贡献指南

这是 DSH（DeepSeek Harness）的一个客户端插件：划词 → 浮层 → 原生引用芯片 → 发送后胶囊。动手前先读 [`AGENTS.md`](AGENTS.md) 的红线；这份管两件事：issue 怎么提 / 怎么分诊，以及怎么提一个能被合并的 PR。

## 最短路径（维护者，有写权限）

```bash
git clone https://github.com/BangBang-03/dsh-client-ui-quote.git
cd dsh-client-ui-quote
node --check lib/client.js
npm test          # 784 组离线断言，必须全绿
```

没有写权限？不要直接 clone 上游后 push（会被拒），走下一节的 fork 流程。

插件没有运行期依赖（客户端 bundle 只 `require("react")`），**不需要 `npm install`**，也不要在 PR 里新增依赖。

## 没有写权限？走 fork

外部贡献者从自己的 fork 提 PR，流程只有这一条：

```bash
gh repo fork BangBang-03/dsh-client-ui-quote --clone   # 或网页上点 Fork
cd dsh-client-ui-quote
git remote add upstream https://github.com/BangBang-03/dsh-client-ui-quote.git
git checkout -b fix/quote-bar-jitter
# 改代码、跑 node --check 与 npm test
git push -u origin fix/quote-bar-jitter
```

然后在 GitHub 上向 `BangBang-03:main` 开 PR。几条约定：

- **一次 PR 只做一件事**，别把重构和修复混在一起。
- 提 PR 前先 `git fetch upstream && git rebase upstream/main`，避免主干已经变过。
- 不需要把提交压成一条：合并是 squash，PR 标题会变成主干提交标题（见下一节）。
- 首次贡献者的 CI 会先停在 `action_required`，等维护者点一次 **Approve and run workflows**（见「关于 CI」）。

## PR 的目标与形状

- **目标分支只有一个：`main`**。它是仓库唯一的长期分支，也是发版线。
- **PR 标题会直接变成主干提交的标题**（合并方式是 squash），所以请写成仓库的提交口径：
  `fix(quote): 中文说明` / `feat(panel): …` / `docs: …` / `test: …` / `chore: …`。
- **PR 描述会变成提交正文**，请写清：改了什么、为什么这么改、怎么验证的（跑了什么、在什么环境）。
- 仓库带一个 PR 模板（三段：改了什么 / 为什么 / 怎么验证）。**填完请把模板里的引导行删掉**——描述会原样进提交正文，别把「> 一两句话…」也带进去。
- 合并默认走 squash：你的署名会保留在主干提交里（author + `Co-authored-by`），**不需要**先把提交压成一条。
- **个别 PR 会手工合入**：改动挤在一起或需要取舍时，维护者可能把补丁重放进主干，再按「已采纳」关闭 PR。这时 GitHub 显示 **Closed 而不是 Merged**；提交里会写明来源 PR 与作者，别因此以为贡献被拒。

## 提交前自检

- `node --check lib/client.js && npm test` 全绿。
- **新增行为必须带断言**；**不许删断言、也不许放宽期望值换绿**。
- 断言数量变了：**凡写到断言数的文档都要同改**（R17）——[`README.md`](README.md)、[`docs/README.en.md`](docs/README.en.md)、[`docs/design.md`](docs/design.md)、[`docs/testing.md`](docs/testing.md)、[`docs/release.md`](docs/release.md)、[`docs/distribution.md`](docs/distribution.md)、[`test/README.md`](test/README.md)、[`.github/workflows/README.md`](.github/workflows/README.md) 与 [`CHANGELOG.md`](CHANGELOG.md) 当轮小节；改完 `grep -rn "离线断言" --include=*.md .` 复核。
- 改了界面文案：`lib/client.js` 的 `zh`/`en`/`ru`、`locale/zh.json`、`locale/en.json`、`locale/ru.json`、README 功能表一起改（三语成对）。
- **不要改 `package.json` 的 `version`**：版本号由维护者在发版提交里统一改。

## 最容易踩的几条红线（全文见 AGENTS.md）

- 客户端功能只住在 `lib/client.js`；`lib/index.js` 只承载隐藏侧聊线程的创建，不承载别的功能。
- 不搬移、不改写宿主的 React 节点——胶囊是「隐藏原节点 + 在它前面画自己的」。
- 线格式 `> ❝ …` / `> ❞ …` / `※ │q1:…` **只增不改**，必须兼容已经发出去的旧消息。
- 永不代发：所有路径（含侧边对话、带回主会话）只写草稿。
- 代码里不写盘、不发外部网络请求（导出走 `Blob` 下载）。

## 关于 CI

首次贡献者的 PR 工作流会停在 `action_required`，需要维护者在 Actions 页点一次 **Approve and run workflows** 才会开跑。**这不是被拒绝，也不是你在等什么**——如果你提了 PR 而 CI 一直没动，稍等一下即可。

## Issue 分诊（维护者）

- 新 issue 按表单提交；缺「DSH 版本 / 复现步骤 / probe()」的先打 `needs-repro`，补齐后再分类。
- 48 小时内至少打两类标签：`area:*`（client / panel / host / docs）与类型（`bug` / `enhancement` / `question`）；拿不准先打 `needs-triage`。
- 每周过一遍 `needs-triage` 与 `needs-repro`；确认是宿主版本或内部契约问题的打 `compat`，并在 issue 里写明实测的 app.asar 版本。
- 关闭时写清原因（已修复 / 已采纳 / `wontfix` / `duplicate`），不静默关闭。
- 标签清单与颜色见 [`.github/labels.yml`](.github/labels.yml)；新增标签先改文件，再到 Settings → Labels 建（或接 label-sync）。

## 问题与讨论

用 [Issues](https://github.com/BangBang-03/dsh-client-ui-quote/issues)：Bug 用「Bug 报告」表单，功能建议用「功能建议」表单，用法问题用「使用问题」表单。仓库没有开 Discussions。

报 bug 前先看 README 的「已知限制」；模板会要求 DSH 版本、桌面 / web、插件版本与 `window.__dshQuote.probe()` 输出。安全漏洞不要开公开 issue，走 [SECURITY.md](SECURITY.md)；社区行为见 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)，求助路径见 [SUPPORT.md](SUPPORT.md)。
