# AGENTS.md

**dsh-client-ui-quote** —— DSH（DeepSeek Harness）的划词引用插件：选中 → 浮层（评论 / 添加到对话 / 侧边对话）→ 原生 `reference-chip` → 发送后胶囊 → 原文高亮、跳回、引用清单、侧边线程。

本页写给要在这个仓库里动手的 agent：**第一节是红线，第二节是路由表**。开工前先读三处：本页、`README.md` 的「功能」表、「已知限制」。分支与发布纪律另有 `../PLUGIN-WORKFLOW.md`。

- 仓库真身在 `C:\Users\15812\Desktop\dsh\dsh-client-ui-quote`；`Desktop\dsh-client-ui-quote` 是指向它的软链。同一棵树，别在两个路径之间复制文件。
- 分支拓扑：GitHub 只有 **`main` 一个长期分支**（默认分支、开发线、发版线）。产物只有一档：打 `vX.Y.Z` 标签发 npm `latest`；**`main` 的普通 push 只跑测试、不发布**（2026-10-28 起 `lab` 预发布频道已删除，`lab` dist-tag 冻结在 `0.13.1-lab.61`）。
- 行号会漂。本页括号里的行号只是 2026-10-20 的锚点，**以函数名/常量名为准**（`rg "function jumpToSource" lib/client.js`）。
- 产品行为不要只看代码猜：README 的功能表是验收口径，改行为要同时改它。
- 用户说「更新文件 / 更新文档 / 更新日志」时，按 `skills/docs/SKILL.md` 的默认文件集执行，不要反问「改哪几处」。

---

## 一、红线

违反任何一条，改动应当被回滚，而不是「先合了再补」。

### 1.1 结构与生命周期

| # | 红线 | 为什么 | 违规长什么样 |
| --- | --- | --- | --- |
| R1 | 客户端功能只住在 `lib/client.js`；`lib/index.js` **只**承载隐藏侧聊线程的创建路由与种子，不承载其它功能 | 客户端 bundle 只有一个提示词/胶囊入口；host 半只补客户端公开面做不到的一件事——用 `agents.create` 建 `origin: "subagent"` 的种子会话。把浮层/胶囊搬进 host 半会让序列化与热重载全部变复杂 | 在 host 半加通用服务、别的路由、文件读写，拆新模块，引 TS、打包器、CSS 文件 |
| R2 | 客户端 bundle 内只 `require("react")`；host 半只允许 Node 内置模块与 `ctx.get` 宿主服务，不写 `peerDependencies` | `@deepseek-ai/dsh*` 的 peer 是唯一被 preflight 强校验的字段，写错整行会被 `disabled`；`check.mjs` 对未知 require 直接抛；host 半静态 import DSH 包会把插件版本绑死在宿主构建上 | 客户端引 lodash / 日期库；host 半 `import "@deepseek-ai/dsh-*"`；写 `peerDependencies`，改用 ESM `import` 客户端 bundle（bundle 是 vendor-CJS 工厂） |
| R3 | 不搬移、不改写、不删除宿主的 React 节点。胶囊 = 给原 run 加 `display:none`，再在它**前面**插入自己的节点；徽章只切**助手**消息的文本（用户自己写的「引用1」一个字都不许动），且原文必须能还原 | 那些节点归 React 所有，搬移会在下一次渲染时炸出第二颗胶囊或丢内容；用户消息里的编号是草稿的一部分 | `replaceWith`、改宿主节点文本、`innerHTML`、把 run 挪进自己的容器、在用户消息上切徽章、切完不还原 |
| R4 | 高亮、卡片、浮层、toast 一律是浮层（`position: fixed/absolute`），并且卸载要干净（`uninstall*` 系列成对） | 插件会被禁用、热重载；残留节点就是关不掉的黄条 | 往 transcript 里塞 `<mark>`；卸载只清样式不清节点 |
| R5 | `sessions.retain()` 必须配 `release()`；用现成的 `withSession` | 不释放会把会话钉在内存里 | 直接 `retain` 后忘记 release，或把 reference 存进模块级变量 |
| R6 | document 级单例走引用计数（`holdRuntime` / `releaseRuntime`），不挂在某个输入框座位的 effect 上 | 胶囊、浮层监听、快捷键都是 document 级，而座位会重挂、会不在 | 在 `QuoteSelection` 的 effect 里装胶囊增强器 |

### 1.2 数据与线格式

| # | 红线 | 为什么 | 违规长什么样 |
| --- | --- | --- | --- |
| R7 | **线格式只增不改**：`❝` / `❞` / `※ 指令：` / `※ … │q1:` 的语义、转义规则、剥离规则，改动必须兼容**已发出的旧消息**（旧消息没有转义层） | 已发送消息是纯文本，是唯一真相。改规则 = 历史引用全部错位——`❞` 截断引用、`※ │q1:` 静默丢行都真发生过 | 换标记字符、改 `REF_LINE` 正则、去掉 `escapeBodyLine`、让新字段挤进同一行 |
| R8 | 坐标随消息走（`│q1:<base64url>`），本机 `sourceIndex` 只是缓存 | 跨刷新、跨窗口、清单里「没被插件看着选中」的引用都要跳得回去 | 只把坐标写 localStorage；依赖「插入时插件正看着」 |
| R9 | 归一键 = `ref + 原文`（没有 ref 才退回 `text:` + 原文） | 同一句话从两个位置引用会互染「已修订」 | 只按原文建键 |
| R10 | 本机存储只用白名单键，统一 `dsh-client-ui-quote:v1:*` / `v2:*`；内容不出本机（不进模型上下文、不跨设备、不上报） | 用户的引用是隐私；宿主也没有同步通道 | 新键不带前缀；把审阅状态塞进消息文本发给模型 |
| R11 | 不写盘、不发外部网络请求。仅有的两个例外都是本机同源：本插件自己的 `POST /ui-quote/api/sidechat.start`（宿主半必须用 `connection.requestRejection` 做围栏）与 better-sidebar 的 `POST /sidebar/api/sidechat.start`；导出走 `Blob` 下载 | 客户端插件没有写盘接口，宿主也没给；引用是隐私，不能上报 | 加 `fetch` 上报、加 `fs`、自己拼 `data:` 大文件、把本地路由做成无围栏的开放端点 |

### 1.3 交互与降级

| # | 红线 | 为什么 | 违规长什么样 |
| --- | --- | --- | --- |
| R12 | **永不代发**：所有路径（含侧边对话、带回主会话）只写草稿 | 提问由用户写。`sidechat.start` 的 `question: ""` 是契约的一部分——非空会被当成线程第一条消息发出去 | 传非空 question、调发送接口、「顺手」帮用户发出 |
| R13 | 宿主服务/DOM 缺失 = 静默降级，绝不让整个插件挂掉 | 每个宿主契约都是探测而非保证：缺 `webServer` / `agents` / `connection` 时宿主半不注册路由或返回 503，客户端退回 fork；缺 better-sidebar、`CSS.highlights`、`consumeToken`、turnTail 槽位也都有兜底或直接隐藏 | 顶层 `throw`；`querySelector(...).foo` 空引用；把可选服务写进 bundle 的 `inject` 数组；host 半在 `apply` 里因缺服务抛错 |
| R14 | 公开 id 不改名：source `quote` + trigger `#`、命令 `ui-quote.quote/comment/sidechat/list`、tab `dsh-client-ui-quote/list`、locale 命名空间 `ui-quote`、class 前缀 `dshq-` | 用户改过的键位、已存的本地数据、离线断言都认这些名字 | 重命名 slot id / tab kind 图省事 |
| R15 | 文案三处同改：`lib/client.js` 的 `zh`/`en`、`locale/zh.json` + `locale/en.json`、`package.json` 的 description；行为变了顺带改 README 功能表 | `check.mjs` 逐键核对两份字典；插件页只读 `locale/*.json` | 只加中文；改了浮层文案忘了 README |

### 1.4 质量、范围与发布

| # | 红线 | 为什么 | 违规长什么样 |
| --- | --- | --- | --- |
| R16 | `npm test` 全绿才算改完；新增行为必须带断言；**不许删断言或放宽断言换绿** | 710 组离线断言是唯一的回归网；这条线断过一次——README 里的断言数曾经三处互相矛盾 | 注释掉失败断言、`try {} catch {}` 吞掉、把期望值改成实际值 |
| R17 | 数字以实跑为准：check **12** 组 + capsule **489** + panel **163** + host **46** = **710**；`README.md` 四处（「开发与发布」入口、工程化第 4 条、`npm test` 入口、自检合计）+ `docs/design.md` 一处（真机验证）+ CHANGELOG 一处必须同改 | 断言数是对外承诺的一部分，同类对比也引用它 | 手写一个新数字；只改一处 |
| R18 | 新增 DOM API 先补 `test/dom.mjs` 垫片；新增宿主契约要在 README「已知限制」写出处（app.asar 或真机实测版本） | 否则 `capsule.mjs` 在 Node 里直接挂；没有出处的契约下个版本就会静默失效 | 用 `TreeWalker`/`CSS.highlights`/`Range` 但不垫片；「应该就是这样」 |
| R19 | 范围红线：不做图片/截图引用、不做 Topic 系统、不做常显大块引用、不做翻译/改写类选区动作、不做原地编辑已发送消息（DSH 没有 API，只能追加修订） | 主线是「文本引用 + 坐标 + 发送后的管理」；每加一条支线都会冲淡它 | 「顺手」把插件做成笔记/标注平台 |
| R20 | 分支：**GitHub 只有一个长期分支 `main`**，它同时是默认分支、开发线与发版线；不要新建长期 `lab` 分支，也不要把 `main` 当"待验收区"再往回拷。已推送的 `main` 不 amend / 不 rebase / 不 `push --force`；入库的 `package.json` 不能是 `-lab.N` 之类的预发布号（CI 已不再产生，出现即为手误） | 双分支时代（≤0.12.9）每次发版要按顺序搬三个 ref、维持 ff 祖先关系，而"main 是备份"的理由不成立（同一远端一起丢）；产物身份本来就由标签与 dist-tag 表达，第二个长期分支没承载额外信息 | 重新引入 lab/dev 长期分支；amend 已推的 main；把 `-lab.N` 版本号提交进仓库 |
| R21 | 推送通道：`git` 优先，失败走 REST 兜底，**同一轮别来回切** | REST 重建的提交时区归一到 `+0000`，同内容不同 SHA → 平行提交（`git status` 干净，远端多一条线） | 手动一半 git 一半 REST；分叉后用 force 掩盖 |
| R22 | 不进仓库：`node_modules/`、`.workbuddy/`、报告与截图工作区（`.dsh-quote-work/`、`PLUGIN-*.md` 都在仓库外）；`package.json` 的 `files` 是 npm 发货白名单，别加工作文件 | 包体、CI 时间、以及「报告被发到 npm」都不该发生 | `git add -A` 把工作稿一起提交；把 `AGENTS.md` 加进 `files` |

---

## 二、路由表

### 2.1 按改动目标找位置

代码改动的主入口都在 `lib/client.js`；推送/发版流程在 `skills/release/SKILL.md`。「连带」是要一起看的东西，「断言」是必须仍然通过的那一组。

| 要改的东西 | 主入口（行号锚点） | 连带 | 断言 |
| --- | --- | --- | --- |
| 浮层菜单 / 评论框 / 提交 | `ensureBar` 4670、`renderMenu` 4702、`renderComment` 4752、`commit` 5059、`close` 5010、`toast` 5037 | `STYLE_TEXT` 546、`applyTheme` 4629、`position` 4840 | capsule「where the selection menu sits」「comment box」 |
| 选区识别（正文/预览/终端/diff/代码块） | `readSelection` 1198；`previewPathOf` 1095、`diffPathOf` 1129、`chatCodeBlockOf` 1072 | `PREVIEW_SELECTOR` 403、`TERMINAL_SELECTOR` 404、`DIFF_SELECTORS` 411 | capsule「code quotes」「diff selection」 |
| 芯片插入（原生 → 事件 → 文本兜底） | `ensureSource` 1844、`insertionFace` 1923、`insertChip` 1972 | `chipRef` 1751、`chipLabel` 1759、`SOURCE_NAME` 453 | check「reference source」、capsule 的芯片插入段 |
| 线格式（写入 / 回读） | `quoteBlock` 1578、`splitQuoteRuns` 1626 | `QUOTE_MARK` 316、`COMMENT_MARK` 325、`REPLY_MARK` 336、`REF_PREFIX` 353、`escapeBodyLine` 1327 | capsule「the wire line」「marker-shaped body lines」 |
| 坐标（生成 / 解码 / 落库 / 迁移） | `encodeQuoteRef` 1493、`decodeQuoteRef` 1519、`saveSource` 2836、`sourceFor` 2892 | `REF_LINE` 360、`SOURCE_KEY` 494、`migrateSources` 2774 | capsule「the same sentence from two rows」「migration」「two windows」 |
| 发送后胶囊 | `capsuleFor` 2164、`isQuoteRun` 2129、`enhance` 4157、`installCapsules` 4292、`rescanCapsules`（install / 窗口唤醒重扫） | `CAPSULE_STYLE_TEXT` 596、`onCapsuleMutations` 4214、`onCapsuleWake` | capsule 的胶囊段（多引用/重渲染/消息删除/卸载/窗口唤醒重扫） |
| 原文高亮 + 序号 | `paintAnchors` 4007、`rangeForQuote` 3957、`quoteHighlightSupported` 3982、`clearQuoteHighlight` 3997、`retractChipSource` / `restoreChipSource` / `setChipRetracted`、`capsuleJumpKeys` / `refInTranscript`（迟到的转正与发送缝隙） | `QUOTE_HIGHLIGHT`（`dshq-quote`）、`SOURCE_HIGHLIGHT` 4876、`ANCHOR_LIMIT` 2325、`saveSource` 的 `chip` 标记、`capsuleOnSourcePage` | capsule「source-side highlight helpers」「草稿芯片删掉后标记收回」「胶囊已在页面时迟到的转正自愈」+ `test/dom.mjs` 的 Range |
| 悬停卡片（胶囊 + 输入框芯片） | `ensurePopover`、`fillPopover`、`placePopover`、`wireChips` | `chipInfoFor`、`CHIP_LIMIT`、`quoteRowMarkdown`（卡片的「复制为 Markdown」载荷） | capsule「the hover card」「the composer chip」 |
| 跳回原文 | `jumpToSource` 3442、`searchSourceRow` 3360、`alignRow` 3283、`landRow` 3308 | `JUMP_*` 442-445、`markJumpLost` 3416 | capsule「jump」整套 |
| 草稿聚合条（`引用 ×N`） | `ensureDraftBar` 3675、`syncDraftBars` 3811、`consumeDraftChip` 3746、`removeDraftChip` 3765 | `chipSpanOf` 3707、`PERSISTED_CHIP_KEY` 2293 | capsule「draft bar」 |
| 改这条引用（追加式修订） | `startRevision` 4943、`startDraftEdit` 4978、`rememberRevision` 3031、`revisedFor` 3048 | `REVISED_KEY` 513 | capsule「改这条引用」 |
| 逐条回应徽章 | `enhanceRefNode` 4471、`flushRefBadges` 4594 | `REF_LABEL` 4377、`replyInstruction`（zh/en） | capsule「逐条回应 / Quote N」 |
| 回合尾「引用提问/回答」 | `TurnTailQuote` 1045 | 槽位 `conversation.chat.turnTail`（`apply` 7417） | capsule 的回合尾段、check 的槽位断言 |
| 侧边对话（内置隐藏线程 / fork / better 三档；浮层里只有一行） | `sideChatBackend`、`hiddenSideChatRequest`、`probeBuiltinSideChat`、`startBuiltinSideThread`、`nativeSideChatRequest`、`openSideChat`、`openThreadTarget`、`openThreadTab`、`installNativeSideChatPage`；`sideChatService`、`mintedHiddenThread`（形状版本戳） | `SIDECHAT_BUILTIN_API`、`SIDECHAT_LABEL_PREFIX`、`SIDECHAT_TARGET_KEY`、`targetOfThread` / `threadRetainTarget`、`knownSideThreadIds`、`prefillDraft` / `prefillQuoteDraft`（芯片优先）、线程记忆、`SIDECHAT_API` | capsule「侧边对话」「原生侧聊页」、check 槽位断言 |
| 隐藏线程创建（宿主半，隐性上下文） | `lib/index.js` 的 `apply`（`ctx.inject(["webServer"])` → `handleSideChatRequest`）、`startSideChat`、`buildThreadSeed`（切点 → 一个收口回合包着 `session-context` 的 `user/message` → descriptor；回合是防 blank 欢迎页的）、`transcriptOf`、`threadLabel`、`parentSelection`、`presetOf` | `package.json` 的 host 入口、R1/R2/R11/R13、`inheritedEventCount` 必须 ≤ descriptor 的 seq、README「已知限制」的宿主契约出处 | `test/host.mjs` 全篇、真宿主探针、`verify-seed`（真构造器） |
| 引用清单页 | `QuoteListBody` 6328、`quoteRowElement` 6142、`readQuoteRows` 6788、`loadOlderQuotes` 6922、`openQuoteList` 7137 | `quoteTabService` 7118、`QUOTE_TAB_*` 529-531、`PANEL_STYLE_TEXT` 5858 | panel 全篇 |
| 清单导出 / 单条复制 | `quoteListMarkdown`、`quoteRowMarkdown`（单条，复制按钮的载荷）、`quoteListJson`、`downloadText` | `MARKDOWN_MIME`、`wireSourceLabel` | panel「Markdown export」「one quote, copied as Markdown」 |
| 审阅工作台（状态/标签/批量） | `quoteMetaFor` 3115、`setQuoteStatus` 3142、`markRowsResolved` 3152、`addQuoteTag` 3171 | `QUOTE_META_KEY` 516、`REVIEW_STATUSES` 3069 | panel「the review workbench」 |
| 侧边线程回流 | `loadThreadSummary` 6993、`bringThreadBack` 7006、`exportThread` 7028、`loadThreadList` 6957 | `THREAD_LIMIT` 536、`threadConclusion` 6093 | panel「side thread」 |
| 快捷键 | `registerShortcut` 7175、`registerPlaceShortcut` 7204 | `shortcutDefaults` 7165 | capsule 键位段、panel「shortcut」 |
| 配置开关 / 调试探针 | `sanitizeConfig` 249、`config` 273、`setConfig` 287、`installProbe` 7221、`failureSnapshot` 1804 | `CONFIG_KEY` 226、`CONFIG_RANGES` 243 | capsule 的配置段（默认值/清洗/落库）+ 探针段 |
| 装配与槽位注册 | `apply` 7265、`QuoteSelection` 5820、`inject` 7156 | 晚到服务用 `ctx.inject([...])`（7394）；**不要**改 bundle 的 `inject` 数组除非真加了必需服务 | check 全篇（槽位/词典/渲染 null） |
| 词条 / 插件页文案 | `zh` 54、`en` 138；`locale/zh.json`、`locale/en.json`；`package.json` description | README 功能表与首屏 | check「dictionaries」「locale metadata」 |
| 清单与打包契约 | `package.json`（`files` / `exports` / `dsh` / `icon` / `engines`）、`cordis.patch.yml`、`icon.svg` | `docs/design.md`「声明（package.json）」 | check「manifest」「bundle patch」「exports」「icon」 |
| 推送 / 发版流程 | `skills/release/SKILL.md` | 工作区根 `promote.ps1`、`.github/workflows/publish.yml`；分支与通道见 R20/R21 | `npm test` 710 + 远端 `main`/标签一致 |

### 2.2 按症状找位置

| 症状 | 先看哪里 | 常见真因 |
| --- | --- | --- |
| 选中文字不出浮层 | `readSelection`、`attachListeners` 5744、`refresh` 5668 | 选区不在会话正文/预览/终端/diff 里；`minChars`；该会话没注册 `inputActions` |
| 浮层出现但插入失败 | `insertionFace` → `insertChip` → `insertPayload` | `inputTriggers` 或 `conversation` 不可见（退回纯文本引用块）；芯片写入被宿主拒绝 |
| 插入/删除/侧聊失败，说不清停在哪 | `probe().lastFailure`（`failureSnapshot` 1804） | `stage` 只有 source / insert / remove / sidechat；`detail` 是那一环的原因，不记正文 |
| 胶囊不出现 / 出现两颗 | `isQuoteRun`、`enhance`、`onCapsuleMutations`、`capsuleFor` | 宿主改了消息 DOM 形状；文本没变却重建；`run` 账本没对上 |
| 胶囊重复或消息删了还在 | `collectRuns`、`dropCapsule` | React 复用了 run 节点，账本按 `Map<run, …>` 记 |
| 跳不回去 | `coordinateOf`、`sourceFor`、`rowFor`、`walkForRow` | 坐标没进消息文本；行被虚拟列表藏着；跨消息选出的引用**故意没有坐标**（见 `readSelection`），不是 bug |
| 高亮只亮前 120 字 | `rangeForQuote`、`fullQuoteByRef` | 胶囊还没渲染，手里只有身份键 |
| 高亮滚动时落后 / 漂移 | `quoteHighlightSupported`、`paintAnchors`、`scheduleAnchors` | 走了浮层兜底（宿主没有 `CSS.highlights`）；若 API 在还漂，检查是否被 `clearQuoteHighlight` 后没有再 set |
| 删掉草稿芯片后原文高亮还在 / 第二条引用没有高亮（或芯片还在却提前灭了） | `syncDraftBars` 的 `cardChips` 比对、`retractChipSource` / `restoreChipSource`、`saveSource` 的 `chip` 标记、`paintAnchors` 里「draft + 胶囊已在页面」的迟到转正、`refInTranscript` | 坐标没带 `chip`（不是芯片路径写的）；芯片节点没被 `data-dshq-chip` 认出（与聚合条同一个前提）；整条输入框离页（切会话）按设计不算删除；页面上已有胶囊时按设计保留；**第二条没有高亮**多半是坐标卡在 `draft`（收回跑在转正之后），下一次重画看到胶囊就会自愈，仍不亮时先查胶囊在不在 DOM 里 |
| 草稿条删不掉 | `consumeDraftChip`、`chipSpanOf`、`health().token` | 宿主没有 `consumeToken`，或两条同标签芯片无法区分 → 退化为聚焦 + 退格 |
| 清单页打不开 / 空白 | `quoteTabService`、`apply` 里的 `ctx.inject([...])`、`readQuoteRows` | 右侧栏服务晚到（别改回 eager 注册）；`hasMore` 分页没点「加载更早的消息」 |
| 清单里少了旧引用 | `readQuoteRows` + `mergeIndexedQuotes`、`QUOTE_INDEX_KEY` | 上下文压缩裁掉了消息；本机索引没覆盖到 |
| 模型看不懂引用 | `codec.serialize` → `quoteBlock` | 路径/行号被 `sanitizePath` 挡掉；`※` 开头的正文被转义，模型读到反斜杠 |
| 侧边对话整项消失 | `sideChatAvailable`、`sideChatBackend`、`builtinSideChatState`、`nativeSideChatAvailable` | 探针失败且 fork / better 也不可用（设计如此，不报错） |
| 侧边对话开了但没草稿 | `prefillDraft`、`writeDraft`、`displayedThreadId` | 子会话外壳还没挂载（200ms 轮询）；隐藏线程用内置 `subagentchat` 页，外壳可能晚于 5 秒；外壳版本没有 `setDraft` |
| 隐藏线程创建失败 / 显示成普通 fork | 宿主半 `apply`、`startSideChat`、`probeBuiltinSideChat`、`probe().sideChatBuiltin` | `webServer` / `agents` / `connection` 没就绪；父会话不在线（409）；`agents.create` 拒绝；客户端按设计退回 fork |
| 侧聊显示「历史加载失败：subagent descriptor is unavailable」 | 宿主半 `buildThreadSeed` 的继承切点与 `inheritedEventCount`；客户端 `mintedHiddenThread`（形状版本戳）/ `hiddenThreadReadable` | descriptor 的 `seq` 落在 `inheritedEventCount` 之前（没标 `session/end-seed{inherited:true}`，或标记被补在末尾）；这类子会话永远读不出来，客户端下一次点会丢弃它并新建。**别用 `sessions.retain` 判断这类线程**：retain 对坏线程照样成功，只有历史 RPC 会拒 |
| 线程在 better-sidebar 与我们的清单里重复 | `SIDECHAT_LABEL_PREFIX`、`knownSideThreadIds`、`targetOfThread` | 两边共享 `Side: ` 持久约定，这是有意为之；不是两套数据互相覆盖 |
| 英文界面混中文 | `zh`/`en` 成对检查、`translateFor` 2119 | 只加了一边；导出函数里写死中文 |
| `npm test` 挂了 | 先看是哪一套：check / capsule / panel | 新增 DOM API 没垫片；新增词条没进两份字典；manifest 字段动了 |
| 推 main / 发版 / 标签或 publish CI 失败 | `skills/release/SKILL.md`、工作区根 `promote.ps1`、`.github/workflows/publish.yml` | 版本未 bump、标签已存在、未跟踪工作稿阻塞、git 与 REST 混用、CHANGELOG 小节缺失 |

### 2.3 文件地图

| 文件 | 作用 |
| --- | --- |
| `lib/client.js`（≈8.4k 行） | 客户端全部功能。顺序：locale → 配置 → 常量（线格式/选择器/存储键）→ 选区读取 → 线格式 → 芯片插入 → 胶囊/卡片 → 坐标表 → 高亮 → 草稿条 → 侧聊 → 清单页 → 快捷键 → `apply` |
| `lib/index.js`（≈500 行） | host 半，只做隐藏侧聊线程：`/ui-quote/api/sidechat.start` 路由（同源围栏）、隐性上下文种子（切点 → `session-context` 消息 → descriptor）、`agents.create`、标题固定与卸载清理。不要再往这里加别的功能 |
| `cordis.patch.yml` | 组合包层补丁，插入 `ui-quote` loader 条目 |
| `package.json` | 清单（`dsh.bundle.patch` / `dsh.client.platform` / 四个 `exports` / `icon` / `engines.dsh`）+ `files` 白名单 + 测试脚本 |
| `icon.svg` | 插件页卡片图标（相对路径、≤ 256 KiB、realpath 必须留在包内） |
| `locale/zh.json`、`locale/en.json` | 插件页卡片文案；`en.json` 是扫描锚点 |
| `test/check.mjs` | 12 组：manifest、导出、图标、词典、槽位注册、`codec.serialize`、无强制 peer |
| `test/capsule.mjs` | 489 组：输入框 → 发送后（线格式、胶囊、卡片、跳回、复制为 Markdown、高亮、草稿条、隐藏侧聊 / fork / better（含侧聊草稿的芯片注入）、徽章、diff） |
| `test/panel.mjs` | 163 组：清单页（解析、搜索、导出、单条复制 Markdown、读取、注册、审阅、JSON、本机索引、线程回流、底部 Star 链接） |
| `test/host.mjs` | 46 组：宿主半（标签 / 隐性上下文种子 / 收口回合（避免 blank 欢迎页）/ 截断超长单条消息 / 空日志兜底 / 切点与 descriptor 顺序 / `agents.create` 参数 / 探针 / 围栏 / 路由注册与卸载） |
| `test/dom.mjs` | 最小 DOM / MutationObserver / Range / localStorage 垫片；新 API 先补这里 |
| `test/capsule.html` | 真浏览器版（51 项），`file://` 打开，结果写进标题与 `#probe-out` |
| `docs/screenshots/*` | README 用的四张截图 + 24 秒轮播 GIF（静态合成） |
| `docs/design.md`、`docs/testing.md`、`docs/release.md`、`docs/README.en.md` | 从根 README 移出的深度内容：设计原理与同类对照、自检细节、开发与发布/推送通道、英文全文。根 README 只留功能表、已知限制与入口 |
| `docs/distribution.md`、`submission/*.yml` | 市场提交材料；投稿是人工动作，需要仓库所有者账号 |
| `skills/release/SKILL.md` | 推送与发版流程：推 `main`（只跑测试）、标签发版、`promote.ps1 -Tag`、CHANGELOG/Release 验收；不进 npm 包 |
| `skills/docs/SKILL.md` | 文档同步：用户一句「更新文件 / 更新日志」时要动哪些文件，版本号四处、断言数（R17）与中英词条（R15）怎么对齐；不进 npm 包 |

### 2.4 命令

```bash
node --check lib/client.js                 # 语法门（CI 也先跑这个）
npm test                                   # check + capsule + panel + host，710 组
node test/check.mjs                        # 只跑清单/契约
node test/capsule.mjs                      # 只跑发送后链路
node test/panel.mjs                        # 只跑清单页
node test/host.mjs                         # 只跑宿主半（隐藏线程创建）

# 真浏览器：直接打开 test/capsule.html（file://），51 项，结果写进标题与 #probe-out

# 本机三档运行（脚本在仓库外的工作区，不进包）
node .dsh-quote-work/profile-mode.mjs link|stable|status

# 提升与发版（脚本在工作区根 C:\Users\15812\Desktop\dsh）
pwsh -File C:\Users\15812\Desktop\dsh\promote.ps1 -Repo dsh-client-ui-quote [-Tag vX.Y.Z] [-Channel rest] [-SkipTests]
# 完整流程与验收见 skills/release/SKILL.md
```

### 2.5 改完的自检

- [ ] `npm test` 全绿；若新增断言，README 四处 + `docs/design.md` 一处 + CHANGELOG 一处的数字已同步（R17）。
- [ ] 新行为有断言，且跑在 `test/dom.mjs` 垫片上——没有为了让测试过而放宽期望（R16）。
- [ ] 旧消息兼容：拿一条旧版线格式样本跑 `quoteBlock` / `splitQuoteRuns` round-trip，`> ❞ …`、`※ │q1:…`、正文自带代码围栏，三者都不串行（R7）。
- [ ] 宿主缺失路径：在桩里删掉 `betterSidebar` / `webServer` / `agents` / `consumeToken` / `CSS.highlights`，功能降级、不抛错（R13）；宿主半缺 `webServer` 时路由不存在，缺 `agents` 时探针 503。
- [ ] 隐藏线程回归：`node test/host.mjs` 全绿；真宿主（临时 `DSH_HOME` + web profile）探针返回 `available:true`（R18 的 host 契约出处写进 README）。
- [ ] 中英词条、`locale/*.json`、`package.json` description、README 功能表同改（R15）。
- [ ] `git status` 只有预期文件；没有 `.workbuddy/`、没有报告、没有把 `AGENTS.md` 加进 `files`（R22）。
- [ ] 提交在 `main`，信息形如 `feat(scope): 中文说明` / `fix(scope): …` / `docs: …`；要发版按 `skills/release/SKILL.md` 走 `promote.ps1 -Tag`（R20、R21）。

---

## 三、术语（读代码时对得上）

| 词 | 指什么 |
| --- | --- |
| 浮层 / bar | 选区下方那颗菜单与评论框，`#dsh-quote-bar`，单例挂 `document.body` |
| 芯片 / chip | 草稿里的原生 `reference-chip`，`ref` 里装引用正文，`codec.serialize` 取模型形态 |
| 线格式 / wire | 发出去的那段纯文本：`> ❝ …` / `> ❞ …` / `> ※ 指令：…` / `> ※ 引自第 N 轮 · 助手 │q1:…` |
| 胶囊 / capsule | 发送后在 transcript 里画出来的那颗 pill，一颗胶囊同时装引用与评论 |
| 卡片 / popover | 悬停胶囊或输入框芯片时浮出的全文卡，`#dsh-quote-popover` |
| 坐标 / ref | 消息行锚点 + 轮次 + 同句序号，编码进线格式尾巴，用于跳回 |
| 聚合条 / draft bar | 输入框上方的 `引用 ×N`，逐条跳回 / 编辑 / 移除 |
| 侧线程 / side thread | 挂在右侧栏的独立会话：一条主会话一条线程（早期按引用分线程的记录仍会复用）；引用只写它的草稿，不发送 |
| 清单 / quote list | 右侧栏的 `引用清单` 页，把引用当对象审阅、导出、批量插入 |

---

这份文档只写约束与入口，功能叙事在 `README.md`。改红线要同时更新本页与 README 的「已知限制」——两处对不上时，以 README 的实测记录为准，并把本页改回去。
