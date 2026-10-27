# 市场提交信息

> 提交动作需要仓库所有者账号；这里是可以直接复制的元数据与检查表。

## 身份

| 字段 | 值 |
| --- | --- |
| npm | `dsh-client-ui-quote` |
| 仓库 | https://github.com/BangBang-03/dsh-client-ui-quote |
| 版本 | `0.12.5`（发版时同步；最终以 `package.json` 为准） |
| License | MIT |
| 图标 | `icon.svg` |

## 一句话

- 中文：把 DSH 里的任意选区变成**可审阅的引用对象**：评论、侧聊、原文高亮、跳回、清单审阅、逐条回应。
- English: Turn any DSH selection into a **reviewable quote** — comment, side chat, source highlight, jump-back, a searchable review list, and per-quote replies.

## 简介

- 中文：在 DSH 的对话、文件预览、终端或 diff 里选中文字，浮出「评论 / 添加到对话 / 侧边对话」。引用以原生芯片进输入框，评论与引用在同一颗芯片里；发送后留下高亮与序号，能跳回原文；右侧栏有可搜索、可导出 Markdown/JSON、带状态与标签的引用清单；侧边线程结论可写回主会话草稿。代码引用带 `path#Lx-Ly` 与围栏，模型能直接定位。
- English: Select text in the transcript, a file preview, the terminal, or a diff and choose Comment, Add to chat, or Side chat. A quote becomes a native composer chip with its comment in the same node; after sending it leaves a source highlight and ordinal, jumps back, and joins a searchable review list with Markdown/JSON export, status, and tags. Code quotes carry `path#Lx-Ly` and a fence, so the model can locate the source.

## 标签

`dsh`, `dsh-plugin`, `deepseek-harness`, `quote`, `selection`, `comment`, `annotation`, `review`, `kimi-code`

## 资产

- 图标：`icon.svg`
- 截图：`docs/screenshots/bar.png`、`comment.png`、`card.png`、`panel.png`
- 轮播：`docs/screenshots/overview.gif`（24 秒，静态截图合成，非实时录屏）

## 安装

```bash
dsh plugin --profile web add dsh-client-ui-quote
```

桌面版在应用内插件页搜索同名包；详见 README 的「安装」。

## 市场检查表

| 市场 | 入口 | 状态 |
| --- | --- | --- |
| DSH Market | https://dsh.market/ | 待提交 |
| dsh-plugin.org | https://dsh-plugin.org/zh/plugins | 待提交 |
| dsh.pub | https://dsh.pub/ | 待提交 |
| awesome-deepseek-harness | https://github.com/0xsline/awesome-deepseek-harness | 待 PR |
| 应用内市场（dshmarket） | DSH 插件页 | 已可由 npm 包搜索安装 |

提交时使用上面的中文/英文简介与标签，附 `overview.gif` 和 `panel.png`；提交后回到插件页确认版本、图标与描述没有被截断。

## 可直接粘贴的收录条目

市场索引的单文件提交已经放在仓库里：

- [`submission/BangBang-03__dsh-client-ui-quote.yml`](../submission/BangBang-03__dsh-client-ui-quote.yml)（`category: ui`，含中英文简介）

awesome-deepseek-harness 的列表条目（英文，一行）：

```text
- [BangBang-03/dsh-client-ui-quote](https://github.com/BangBang-03/dsh-client-ui-quote) - Turns any selection in a DSH conversation, file preview, terminal or diff into a reviewable quote with a same-node comment, source highlight and jump-back, a searchable review list (Markdown/JSON export, status and tags), side threads, revisions, per-quote reply badges, and code quotes carrying path#line.
```

## 发布前

1. 把 `CHANGELOG.md` 顶部的 `Unreleased (lab)` 改成正式版本号（`## X.Y.Z — YYYY-MM-DD`），在 lab 上提交。
2. 推 `lab`（CI 发一个 `-lab.N` 预发布），在真实 DSH 窗口点一遍：聚合条编辑/移除、回合尾按钮、打开文件与行范围、侧边对话（内置隐藏线程）、JSON 导出。
3. 发正式版：`main` 快进到 `lab` 并推送 → 在 `main` 头上打 `vX.Y.Z` 标签并推送。标签会同时触发两件事：**npm `latest` 发布** 与 **GitHub Release 创建**（正文取自 CHANGELOG 同名小节；已存在则更新 notes，重跑安全）。
4. 发完确认三处一致：`npm view dsh-client-ui-quote dist-tags` 的 `latest`、仓库 Releases 页的最新一条、`git ls-remote --tags` 的标签指向同一个提交。

已复核：`npm test` 690 组离线断言；真浏览器（1600×2000 视口）51/51；隔离 DSH web 实例中工作区 link 与 npm lab 发布包均加载成功，`__dshQuote` 可用、conversation/inputTriggers/sidebarRight/sidebarRightTabs 可见、`probe().nativeSideChat === true`（betterSidebar 缺失）；`npm pack --dry-run` 包含 README、截图、GIF 与本文件。真实窗口的四条交互路径仍需人工点击（聚合条编辑、回合尾按钮、打开文件与行范围、JSON 导出）。
