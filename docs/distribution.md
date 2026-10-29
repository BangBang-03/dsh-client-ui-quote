# 市场提交信息

> 状态核对：**2026-10-29，`v0.14.0`**。提交动作需要仓库所有者账号；这里是可以直接粘贴的元数据、各渠道的真实入口与待办。

## 身份

| 字段 | 值 |
| --- | --- |
| npm | `dsh-client-ui-quote` |
| 仓库 | https://github.com/BangBang-03/dsh-client-ui-quote |
| 版本 | `0.14.0`（发版时同步；最终以 `package.json` 为准） |
| License | MIT |
| 图标 | `icon.svg` |

## 一句话

- 中文：把 DSH 里的任意选区变成**可审阅的引用对象**：评论、侧聊、原文高亮、跳回、清单审阅、逐条回应。
- English: Turn any DSH selection into a **reviewable quote** — comment, side chat, source highlight, jump-back, a searchable review list, and per-quote replies.

## 简介

- 中文：在 DSH 的对话、文件预览、终端或 diff 里选中文字，浮出「评论 / 添加到对话 / 侧边对话」。引用以原生芯片进输入框，评论与引用在同一颗芯片里；发送后留下高亮与序号，能跳回原文；右侧栏有可搜索、可导出 Markdown/JSON、带状态与标签的引用清单；侧边线程结论可写回主会话草稿；模型可按「引用N」逐条回应。代码引用带 `path#Lx-Ly` 与围栏，模型能直接定位。
- English: Select text in the transcript, a file preview, the terminal, or a diff and choose Comment, Add to chat, or Side chat. A quote becomes a native composer chip with its comment in the same node; after sending it leaves a source highlight and ordinal, jumps back, and joins a searchable review list with Markdown/JSON export, status, and tags. Code quotes carry `path#Lx-Ly` and a fence; replies can answer each quote by number.

## 标签

`dsh`, `dsh-plugin`, `deepseek-harness`, `quote`, `selection`, `comment`, `annotation`, `review`, `kimi-code`

## 资产

- 图标：`icon.svg`
- 截图：`docs/screenshots/bar.png`、`comment.png`、`card.png`、`panel.png`
- 轮播：`docs/screenshots/overview.gif`（24 秒，静态截图合成，非实时录屏；真正的录屏还没有）

## 安装

```bash
dsh plugin --profile web add dsh-client-ui-quote
```

桌面版在应用内插件页搜索同名包；详见根 README 的「安装」。

## 渠道状态（2026-10-28 实测）

| 渠道 | 状态 | 事实 |
| --- | --- | --- |
| **awesome-dsh-plugin**（`data/plugins/*.yml`，市场索引的事实来源） | ✅ 已收录 | PR [#6506](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/pull/6506) 于 **2026-10-17 合并**，条目 `BangBang-03__dsh-client-ui-quote.yml` 已在库里。**描述是 10-17 的旧版**，更新 PR [#10188](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/pull/10188) 已开、**CI 全绿**，等合并；见「待办 4」 |
| **dsh.pub** | ✅ 已收录（自动） | 详情页 `https://dsh.pub/zh/plugins/dsh-client-ui-quote/` 返回 200，带 `npx dshpub` 安装命令；描述是目录的模板句，不是我们写的 |
| **dsh.market** | ✅ 已收录（自动，`curated: false`） | 55 MB 的 `https://dsh.market/plugins.json`（15,748 条）里已有 `BangBang-03/dsh-client-ui-quote`，描述取自 `package.json`、安装命令取自 README 的「安装」段；`curated: false` = 还没有人工撰写/作者自述 |
| **应用内市场** | ✅ 可搜 | 按 npm 包名可搜到并安装 |
| **dsh-plugin.org** | ❌ 未收录 | 列表页与详情页都没有；提交走 issue，见「待办 2」 |
| **awesome-deepseek-harness**（1273★） | ⏳ 已开 PR | 未收录；PR [#764](https://github.com/0xsline/awesome-deepseek-harness/pull/764) 已开（中英两个文件各 +1 行，`## UI, Themes & Interaction`），等维护者合并 |

> 同名干扰：`skyhancloud/dsh-client-ui-quote`（2026-08-16 建，更早）也在 awesome-dsh-plugin 里有一条独立条目。它和本仓库不是同一个项目，npm 上的 `dsh-client-ui-quote` 是本仓库。

## 待办（按价值排序）

1. **awesome-deepseek-harness PR**（1273★，最高价值）：**已开 → [#764](https://github.com/0xsline/awesome-deepseek-harness/pull/764)**。按 [`contributing.md`](https://github.com/0xsline/awesome-deepseek-harness/blob/main/contributing.md) 的要求，**英文 `README.md` 与 `README.zh-CN.md` 两个文件各加一行**，放在 `## UI, Themes & Interaction`（中文版对应小节）。一行、事实性、不带徽章/截图。已 fork 到 `BangBang-03/awesome-deepseek-harness`，分支 `entry/dsh-client-ui-quote`。
2. **dsh-plugin.org issue**：到 [dshplugin/dsh-plugin-hub](https://github.com/dshplugin/dsh-plugin-hub/issues/new) 按模板提交（正文模板见下方）。
3. **dsh.market issue**：到 [2BingLing/dsh-market](https://github.com/2BingLing/dsh-market/issues/new?template=submit_plugin.md) 提交；目前是自动收录、`curated:false`，走 issue 可以补「作者自述」。仓库计划次日 06:00 的自动收录管道处理。
4. **awesome-dsh-plugin 条目更新**：**已开 → [#10188](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/pull/10188)**（CI 全绿，含 `READMEs match data/plugins` 与 build），用 [`submission/BangBang-03__dsh-client-ui-quote.yml`](../submission/BangBang-03__dsh-client-ui-quote.yml) 的内容替换库里那份旧条目（PR 改一个文件，+6/−6）。旧描述里**已经有两条不成立的说明**：
   - 「Alt+Q / Alt+C / Alt+B do the same three things」——0.12.9 起 **Web 没有默认键位**（宿主校验所有平台默认值，裸 Alt 会让整条命令注册失败），只有桌面端有。
   - 「writes the quote into the composer of one **dsh-better-sidebar** side thread」——默认已改成**宿主半创建的内置隐藏线程**，不装 better-sidebar 也有。
   - 另外缺了：代码引用 `path#line`、逐条回应徽章、多选插入、审阅状态与标签、JSON 导出。

## 可直接粘贴

### awesome-deepseek-harness（两行，分别进两个文件）

```text
# README.md
- [BangBang-03/dsh-client-ui-quote](https://github.com/BangBang-03/dsh-client-ui-quote) - Selection quoting for DSH web: a selection becomes a native reference chip in the composer; a sent quote keeps a source highlight and ordinal, jumps back, and joins a searchable review list with Markdown/JSON export, status and tags; code quotes carry path#line and replies can answer each quote by number.

# README.zh-CN.md
- [BangBang-03/dsh-client-ui-quote](https://github.com/BangBang-03/dsh-client-ui-quote) - DSH 网页版划词引用：选中文字以原生引用芯片进入输入框，发送后合成胶囊并在原文留下高亮与序号，可跳回、可导出清单（Markdown/JSON、状态与标签）；代码引用带 path#line，回复可按「引用N」逐条对应。
```

### dsh-plugin.org issue

标题：

```text
[插件提交] BangBang-03/dsh-client-ui-quote — 把任意选区变成可审阅的引用对象
```

正文（模板字段一个不缺）：

```markdown
### 仓库地址
https://github.com/BangBang-03/dsh-client-ui-quote

### 一句话价值
在 DSH 里选中任意一段文字，就能把它变成带来源的可审阅引用：进输入框、发出后合成胶囊、原文留高亮与序号、可跳回、可进右侧栏清单审阅与导出。

### 能力分类
界面与体验

### 安装命令
dsh plugin --profile web add dsh-client-ui-quote

### 兼容与运行要求
DSH ≥ 0.2.0-rc.2 的 web / 桌面客户端；Node ≥ 18。插件跑在渲染进程里，headless profile 没有 UI。

### 许可证
MIT

### 截图 / 演示
https://github.com/BangBang-03/dsh-client-ui-quote/tree/main/docs/screenshots （浮层 / 评论框 / 胶囊卡片 / 引用清单四张 + 24 秒轮播）

### 补充说明
- 所有路径只写草稿、不代发；引用内容只存本机，不上报、不进模型上下文（除你主动发送的那条）。
- 侧边对话默认用宿主半创建的内置隐藏线程，不依赖 dsh-better-sidebar；父会话离线时该线程只读。
- 已知限制见根 README 的「已知限制」。

### 提交前自查
- [x] 仓库已公开
- [x] 已添加 GitHub topic：dsh-plugin
- [x] README 包含安装命令
- [x] 插件导出 apply(ctx) 模块
- [x] 仓库根目录包含 package.json
```

### dsh.market issue

标题：`[提交插件] dsh-client-ui-quote`；字段按模板填：

```markdown
## 插件信息

- **GitHub 仓库地址**：https://github.com/BangBang-03/dsh-client-ui-quote
- **插件类型**：cordis-plugin
- **一句话简介**：DSH 划词引用：选中文字变成带来源的可审阅引用，发送后合成胶囊、原文留高亮与序号、可跳回、可进清单审阅与导出。
- **作者自述简介**：[写这个插件是因为 DSH 里引用一段话只能靠复制粘贴，发送后就再也不知道它出自哪一句。它把引用当成有来源、可审阅的对象：坐标随消息走，所以刷新、换窗口、在清单里都能跳回原文；没发出去的引用不会在原文上留标记。所有路径只写草稿，绝不替你发送。欢迎试用后给我反馈。]
- **是否已打 dsh-plugin 相关 topic**：是，`dsh-plugin` / `deepseek-harness`
```

## 发布前

1. 把 `CHANGELOG.md` 顶部的 `Unreleased` 改成正式版本号（`## X.Y.Z — YYYY-MM-DD`），提交到 `main`。
2. 推 `main`（只跑测试、不发布），在真实 DSH 窗口点一遍：聚合条编辑/移除、回合尾按钮、打开文件与行范围、侧边对话（内置隐藏线程）、JSON 导出、清单页底部的 Star 链接。
3. 发正式版：在 `main` 头打 `vX.Y.Z` 标签并推送。标签会同时触发两件事：**npm `latest` 发布** 与 **GitHub Release 创建**（正文取自 CHANGELOG 同名小节；已存在则更新 notes，重跑安全）。
4. 发完确认三处一致：npm 的 `latest` dist-tag、仓库 Releases 页的最新一条、`git ls-remote --tags` 的标签指向同一个提交。

## 已复核

`npm test` **715 组**离线断言（check 12 + capsule 493 + panel 163 + host 47）；真浏览器（1600×2000 视口）51/51；隔离 DSH web 实例中工作区 link 与 npm 包均加载成功，`__dshQuote` 可用、`conversation` / `inputTriggers` / `sidebarRight` / `sidebarRightTabs` 可见、`probe().nativeSideChat === true`；`npm pack --dry-run` 包含 README、四张截图、GIF、`docs/*.md` 与 `submission/`。真实窗口的四条交互路径仍需人工点击（聚合条编辑、回合尾按钮、打开文件与行范围、JSON 导出）。
