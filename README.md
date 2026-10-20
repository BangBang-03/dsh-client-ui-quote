# dsh-client-ui-quote

[![npm](https://img.shields.io/npm/v/dsh-client-ui-quote.svg)](https://www.npmjs.com/package/dsh-client-ui-quote)
[![downloads](https://img.shields.io/npm/dm/dsh-client-ui-quote.svg)](https://www.npmjs.com/package/dsh-client-ui-quote)
[![test](https://github.com/BangBang-03/dsh-client-ui-quote/actions/workflows/test.yml/badge.svg)](https://github.com/BangBang-03/dsh-client-ui-quote/actions/workflows/test.yml)

> 在 DSH 里**选中一句话**，浮出「评论 / 添加到对话 / 侧边对话」——把选区以 DSH 原生**引用芯片**插进输入框，或写进右侧栏那条独立侧边对话的输入框。Kimi Code 是最初的交互参照，但这一版已经不只对标 Kimi：引用落进草稿后会在原文留下高亮与序号、能跳回、能进清单审阅、能回流主会话、能让模型逐条回应——它把引用当成**有来源、可管理、可审阅的对象**，而不是一段一次性粘贴的文本。

## 30 秒上手

1. 安装：`dsh plugin --profile web add dsh-client-ui-quote`；桌面版在应用内插件页搜索同名包。
2. 在消息、文件预览、终端或 diff 里**选中一段文字**，浮层选「评论」或「添加到对话」。
3. 发送后回原文看高亮，悬停胶囊可**跳回**；右侧栏「引用清单」（`Alt+L`）可搜索、导出、审阅。

没有 `dsh-better-sidebar` 时，「侧边对话」自动 fork 一个继承上下文的子会话，用宿主内置的 `subagentchat` 页打开——仍然只写草稿，不替你发送。

选中正文 → 浮层动作 → 引用变成输入框里的行内胶囊（不是纯文本），评论也放在同一颗芯片里；发送之后，引用和评论**合成一颗胶囊**留在消息里，不会摊成一屏 `>` 行。第三项「侧边对话」则把引用写进右侧栏一条**独立的侧边线程的输入框**（一条主会话一条线程，反复点就反复追加），问什么由你写，主会话一点都不动。评论框里**引用正文本身也可编辑**（选多了当场裁）；从**文件预览、终端或 diff**划选的引用以**围栏代码块**的线格式发给模型，模型看到的是真正的代码块。引用落进草稿后，**原句在来源消息里留下高亮与序号**，输入框上方出现 **`引用 ×N`** 的聚合条；发送块里的坐标行前面还带一段人可读的 **`引自第 N 轮 · 助手`**，模型不用解码就知道这段话从哪来。

## 定位

2026-10 的 DSH 划词引用赛道已经不缺「选中→塞进输入框」：npm 上至少十几款插件在做同一件事，浮层形态高度同质。本插件的差异在引用**发送之后**——胶囊、原文高亮、跳回、清单审阅、侧线程回流、逐条徽章，以及预览/终端/diff 引用的 `path#Lx-Ly` 线格式。同类里值得放在一起看的有：`dsh-annotation`（最短路径批注）、`dsh-sidenote`（原生侧栏多侧聊）、`CiteCiter`（每次划选一个持久 Topic）、`dsh-quote-annotate-pro`（常显引用块 + 回合尾引用）、`dsh-select-quote`（待发批注持久化）、`dsh-selection-toolbar`（文本+图片）、`@u2a5f/dsh-selection-annotations`（独立 JSON 块）。哪些长处已经吸收、哪些不照抄，见「与同类插件的差异」。

## 界面

| 划词浮层 | 评论：引用与评论各一格，都能改 |
| --- | --- |
| ![选中文字后浮出「评论 / 添加到对话 / 侧边对话」，位置贴着选区](docs/screenshots/bar.png) | ![评论框：引用正文与评论分开可编辑，可勾选「让模型逐条回应」](docs/screenshots/comment.png) |

| 发送后的胶囊 + 悬停卡片 | 右侧栏的「引用清单」页 |
| --- | --- |
| ![悬停胶囊：引用、评论、跳回原文、改这条引用、复制](docs/screenshots/card.png) | ![引用清单：搜索本会话全部引用、跳回原文、导出 Markdown，底部是侧边线程回流](docs/screenshots/panel.png) |

四张界面轮播（24 秒，静态截图合成，非实时录屏）：

![界面总览：浮层 → 评论 → 胶囊卡片 → 引用清单](docs/screenshots/overview.gif)

## 功能

| 动作 | 行为 |
| --- | --- |
| **评论** | 浮层就地变成评论框（`写一句评论…` + `取消` / `添加到对话`）。评论框里**引用正文也在自己的输入框里、可以改**——选多了就当场裁掉。评论框打开期间，原选区用 Chromium 的 `CSS.highlights` 保持高亮，焦点进了输入框也不会丢参照；不支持该 API 的宿主静默退化，评论框里仍有原文。`Enter` 提交、`Esc` 关闭、引用或评论为空时确认按钮禁用；输入法组合输入不会误触发。 |
| **添加到对话** | 直接把引用加进输入框，不弹评论框。 |
| **侧边对话** | 把引用写进一条**独立的侧边对话**的输入框：优先用 dsh-better-sidebar 的侧边线程；没装/禁用时自动降级为**fork 一个继承主会话历史的子会话**，用宿主内置的 `subagentchat` 页在右侧栏打开，再把引用写进它的草稿。两种后端都**什么都不发送**，线程独立运行、不污染主会话，页签自动在右侧栏打开。同一条主会话只开一条线程，之后每次点都在同一条线程的草稿后面接着追加。鲸鱼蓝（`#4d6bfe`）的图标是它在浮层里的标识。**一条引用一条线程**：浮层里还有一项「另开侧边对话」，给这条引用单独开一条线程；之后对同一条引用再选侧边对话，回到的就是它自己的那条。引用清单页底部会列出这个会话的**全部侧边线程**，每条都能重新打开（原生兜底时同样用内置页打开）。 |
| **键盘直达** | `Alt+Q` 引用 / `Alt+C` 评论 / `Alt+B` 侧边对话——同一个浮层的三个动作，不弹浮层直接办。走 DSH 的快捷键服务注册，所以出现在设置里、可改键、与宿主键位冲突会在注册时报错；没有选区时返回 `pass`，按键不会被吞掉。 |
| **原文侧高亮** | 引用落进草稿或发出后，被引用的原句回到**来源消息**里留下淡黄高亮与**序号角标**（序号就是坐标里的同句序号，和 `「引用N」` 对得上）。滚动、流式输出、虚拟列表重新挂载都会重画；行不在视口里、文字已经变了、宿主不给 `Range` 时就静默跳过，**不改宿主的 DOM**（高亮是浮层，不是包一层 `mark`）。 |
| **聚合引用条** | 输入框上方一条 **`引用 ×N`**：每颗芯片一个摘要胶囊，点一下跳回原文（跳不到就把光标放到芯片上，一次退格删掉），悬停就是完整卡片；每条末尾有 **`✎` 编辑**与 **`×` 移除**：编辑把原引用与评论回填进注释框，确认后旧芯片让位、新芯片原地插入；移除优先走宿主自己的 `consumeToken`（按芯片的 detect 区间与 `draftRev` 做 CAS 精确删除，不会碰错别的文本），宿主没有这个读取面或同名芯片无法区分时才退回「聚焦芯片 + 退格」并提示。**整条索引存在本机**：宿主会跨刷新恢复草稿里的芯片，插件的索引也一起恢复，所以刷新后条、卡片与「打开文件」都还在。主会话与侧边线程各自的输入框各有一条；芯片删光时条自己消失。整条带 `role=toolbar`，每颗胶囊的可访问名是完整引用+评论，不是截断后的标签。 |
| **来源头** | 发送块尾部的坐标行前面多一段人可读的出处：**`※ 引自第 12 轮 · 助手 │q1:…`**，模型不解码也知道来自哪一轮、谁说的；角色属性宿主没给时就只写轮次。胶囊悬停卡片里同样显示 `引自第 12 轮 · 助手`，按界面语言本地化。 |
| **Diff 划选** | 在 diff / 每轮改动面板里划选也走同一个浮层：引用按**代码块**发，围栏信息位带探测到的文件路径与行号（`src/app.ts#L12`）；路径、行号是宿主 DOM 上的探测，拿不到就只带代码，不影响引用本身。有路径时卡片/清单可直接打开文件并定位到起始行。 |
| **清单多选插入** | 引用清单每行一个勾选框，`插入所选` 一次把多条引用写进输入框——每条各成一颗芯片、各自带坐标，不合并；芯片通路不可用时退回一段包含多个引用块的文本。这一栏是只读导航 + 批量插入，不做就地删除——删除与编辑在**草稿上方的聚合条**里做（宿主暴露了按区间消费 token 的 `consumeToken`；旧宿主没有这个读取面时才退回退格路径）。 |
| **审阅工作台** | 清单页把引用当**对象**管：每行一个 **`待处理 / 已解决`** 状态钮（点一下切换，行整体随之变淡），页首的 `只看未解决 (N)` 一键筛出没处理完的；每行可以打 **`#标签`**（回车添加、点 × 移除、点标签按它筛选，页首列出全部标签及数量）；勾选若干行后 `标记已解决 (N)` 批量落章，`插入所选` 批量送回输入框。状态与标签按引用坐标归一键（老引用退回按原文），记在本机 `localStorage`（`dsh-client-ui-quote:v1:quote-meta`，上限 800 条）——跨刷新仍在，不跨设备同步、不进模型上下文；`导出 Markdown` 的标题行会带上 `已解决` 与标签标记，没标过的行输出和从前逐字相同。 |
| **跳回原文** | 悬停卡片底部的 `跳回原文`：把引用当初所在的那条消息**停到视野上方 24px**（和宿主自己跳轮次一样的位置）并闪一下。坐标（消息行锚点 + 轮次 + 同句序号）在插入时**写进消息自己的文本**——一段只在线上存在的 `※ 引自第 N 轮 · 助手 │q1:…` 行（base64url 的 JSON），显示、胶囊、清单导出里都剥掉；它随消息本身走，所以跨刷新、跨窗口、以及清单页里根本没被本插件看着选中的引用都跳得回去。只在**引用自己那条会话的面板里**找，不跨会话误跳；被虚拟列表藏起来的行会让位给同轮次的可见行；压根没挂载的行靠滚动搜索一屏一屏地找出来——先往上找（引用总在比它更早的消息里），一路到顶还没找到就从最新处再来一遍；都找不到就明说（`原文已变`——消息还在、那段文字不在了；或 `原文不在当前视图里`）。 |
| **引用清单** | 右侧栏的一个**页面**：本会话发出去的引用与评论的清单。搜索框按引用/评论过滤、点一条跳回原文、`导出 Markdown` 落一个文件、历史没读完时可 `加载更早的消息`。它作为**页面类型**注册进右侧栏（`ctx.sidebarRightTabs.register`），并在指南页留下一个胶囊作入口；`Alt+L` 同样能打开。数据来自会话自己的事件日志（`ctx.sessions.retain` → `session.eventSource`），不依赖屏幕上有没有那条消息；**本机还留一份索引**：上下文压缩把消息裁掉之后，这些引用仍然列得出来。清单可以导出 **Markdown**（给人读）或 **JSON**（给工具读：版本化的 schema，带每条引用的来源坐标、文件、审阅状态与标签）；每行带着**自己那份坐标**（从消息文本的 `※ … │q1:…` 行读出来），所以没被本插件看着选过的引用也能跳。页面底部还有一行**宿主自检**：芯片精确删除是否可用、侧聊走 better-sidebar 还是 fork 兜底，不开控制台就能判断。 |
| **侧边线程回流** | 同一个页面底部是这条会话的**侧边线程**：显示它最后问的那个问题与消息条数，并给两个动作——**`带回主会话`** 把线程最后「问题 + 答案」写成主会话输入框里的草稿（**不发送**，你自己按发送），**`导出 Markdown`** 把整条线程落成一个文件。线程内容同样从它自己的事件日志读；没有线程时这一节只说明「还没有侧边线程」。 |
| **改这条引用** | 悬停卡片里的 `改这条引用`：把那条引用当初的**引用与评论都原样放回评论框**（引用正文、评论各占一个输入框，都能改），你改完按 `⏎` 就发出一条**新的**引用（DSH 没有编辑已发送消息的 API，这是唯一诚实的做法）。旧胶囊随即挂上 **`已修订`** 标记，卡片里直接显示改后的评论；**连正文一起改过的**，卡片里也把改后的原文亮出来。标记按引用原文记在本机，跨刷新仍在。 |
| **逐条回应** | 评论框里的一格**勾选项**（默认关）：勾上，这条引用的块尾就多一行**只有模型读得到的指令**——请按出现顺序把引用记为「引用1」「引用2」…并在回复中逐条对应。**指令随界面语言**：英文界面下要求模型用 `「Quote N」`，模型的回复里 `「引用N」` 与 `「Quote N」` 都会被认成徽章。模型的回复里每个这样的标签会变成一枚**小徽章**：悬停就是那条引用的完整卡片（含 `跳回原文` 与 `改这条引用`），点了就跳；编号超出这条消息引用数的标签保持纯文本。指令行与围栏一样只是**线上形态**，胶囊、卡片、导出里都不出现。 |
- 引用以 DSH 原生行内原子节点 `reference-chip` 插入（带图标的胶囊）；走「评论」时评论一起放进这颗芯片（芯片标签显示为 `引用摘要 · 评论摘要`），引用与评论始终是一体，草稿里不会散成两段。
- **代码引用**：线格式不再是纯块引用，而是 `> ❝ ``` ` / `> 代码行` / `> ``` ` —— 模型看到的是真正的围栏代码块；胶囊与悬停卡片随之换等宽字体、按代码的空白排版，引用清单导出时也落成 ``` 围栏而非 `>`。围栏只是线格式（传输时剥掉），胶囊上显示的仍是原始代码文本；正文里本身就有 ``` 时改用 `~~~` 围栏。**文件预览的引用还带着它出自哪个文件、哪些行**：宿主标了路径（预览头部的路径标签，或 DOM 上的路径属性）时就写进围栏的信息位——`> ❝ ``` src/app.ts#L12-L48`；预览按行渲染时连行号一起带上（GitHub 的 `#L` 写法）。**聊天转写里的代码块划选同样升级为代码引用**：选区两端都在同一个渲染代码块内时，围栏信息位带上渲染器声明的语言（`> ❝ ``` ts`），不再退化成普通块引用；跨出块边界的选区仍按普通引用发。模型由此可以直接读懂语言、打开文件、翻到这几行动手，清单导出的围栏行同样带着它；探测不到就维持原样，什么也不损失。**悬停卡片与引用清单里，这段来源是可点的 `文件预览 · src/app.ts · L12-L48 ↗`**：点一下用 `ctx.sidebarRight.openResource` 打开右侧栏的文档预览，并把 1 起算的起始行作为导航参数交给宿主；同一文件已打开时聚焦原 tab 并送一次新的导航 revision，不另开重复页签。预览打开后，被引的那几行会被标出来（预览自己的行号属性）。**来源有话说**：文件预览、终端、Diff、代码块各有各的标签，读者一眼知道这段话是从哪儿冒出来的。语言标签不是文件，不会出现「打开 ts」这样的死入口。
- **引用正文可以编辑**：评论框上半格是引用自己的输入框（评论在下半格），划选带进了提示符噪音或多选了几行，当场裁掉再发；「改这条引用」时旧正文回填同一格，改完随新引用发出。
- **选区保结构**：在聊天里划选到链接或行内代码时，引用会带上 Markdown 记号（`[标题](地址)`、`` `代码` ``），模型因此知道原文指向哪里；去掉记号的纯文本仍留在本机，**高亮与跳回照样对得上**。没有结构的选区（普通段落）逐字不变。
- **回合级引用**：每条回合的尾部多两个安静的按钮——**引用提问** / **引用回答**：把整轮的提问或回答按原文取出，进同一个评论框（可改、可评论），确认后成为一条带坐标的引用，坐标取自该轮第一行，照样能跳回原文。宿主没有这个槽位时按钮不出现，其它能力不受影响。
- 发送时由 DSH 回调本插件取「模型形态」：**`> ❝ …` 引用行 + 同一个块里的 `> ❞ …` 评论行**。消息里那段块会被就地换成 Kimi 那样的一颗胶囊
  （`❝ 引用摘要 │ 评论摘要`，鼠标移上去就能读到引用与评论的全文、点开可展开、悬停出现 `复制`），你自己写的话保持原样，模型收到的仍是完整引用文本。
- 浮层位置贴着选区**下方**（下方放不下时才挪到上方），配色在运行时从输入卡片 / 正文取样，深浅色主题都适配；中文/英文词条随界面语言切换。
- 芯片插入优先走 shell 的 `insertReference`；宿主只保留 scoped `slash/input-insert-reference` 事件时走事件通道；两者都不可用（拿不到 DSH 的输入触发服务或会话输入服务）才退回纯文本形态：直接写入 `> ❝ …`（评论接 `> ❞ …`）引用块。
- **配置与调试句柄**：本机 `localStorage` 里一组白名单开关（只存本机、不进模型上下文），以及 `window.__dshQuote` 调试句柄——见下节。

## 配置与调试

开关存在本机 `localStorage` 的 `dsh-client-ui-quote:v1:config`，键名白名单、类型不符或越界的值一律丢弃：

| 键 | 默认 | 作用 |
| --- | --- | --- |
| `minChars` | `1` | 选区短于这个字数就不弹浮层（防误选一两个字）。 |
| `maxQuoteChars` | `4000` | 引用超过这个字数就截断并提示；`0` 表示不限。 |
| `replyByDefault` | `false` | 「让模型逐条回应」是否默认勾上。 |
| `attribution` | `true` | 是否把可读的来源头（`引自第 N 轮 · 助手`）写进发给模型的线格式；关掉后仍保留可跳回的坐标。 |
| `highlight` | `true` | 是否绘制原文侧高亮。 |

调试句柄在浏览器控制台里可用：

```js
__dshQuote.config()                    // 当前开关
__dshQuote.setConfig({ minChars: 3 })  // 改开关（立即生效，落本机）
__dshQuote.state()                     // 浮层此刻的状态：选区、模式、路径、芯片数
__dshQuote.probe()                     // 宿主服务可见性（inputTriggers / conversation / sidebarRight / betterSidebar…）与索引规模
```

## 安装

要求：DSH ≥ 0.2.0-rc.2 的 **web / 桌面** 客户端（`package.json` 里 `engines.dsh` 声明的就是实测版本；插件运行在渲染进程里，headless profile 没有 UI）。

### 方式一：npm 包（推荐）

已发布到 npm：`dsh-client-ui-quote`（0.10.0 起上架；稳定版当前 **0.12.0**）。当前 `lab` 源码比稳定包多出：聚合引用条的**逐条编辑/移除**与完整可访问名、草稿芯片索引的**跨刷新恢复**、**代码引用的来源标签与打开文件定位（含行范围标记）**、**聊天代码块划选的自动围栏（带语言）**、**选区保结构（链接/行内代码）**、**回合级引用**、**逐条回应的双语标记**、**一引用一线程的侧边对话**、**引用清单的 JSON 导出与本机索引**、以及**配置项与 `window.__dshQuote` 调试句柄**；随下一个补丁版本发布，0.12.0 稳定包没有这些。

```bash
dsh plugin --profile desktop add dsh-client-ui-quote
```

npmmirror 与 npmjs 一般 10 分钟内同步，DSH 配置了镜像源即可国内直装。Electron 托管的 `desktop` profile 也可以在**应用内市场**里搜索本插件安装（`dsh plugin` 对这类 profile 会拒绝管理，这是 DSH 的限制，不是插件的问题）。

想跟开发线跑：`pnpm install dsh-client-ui-quote@lab`；切回稳定版：`@latest`。

### 方式二：手工注册为 profile 组合包（不用 CLI 时）

1. 把包装进 profile：`cd <DSH_HOME>/profiles/<profile> && pnpm add dsh-client-ui-quote`；
2. 编辑 `<DSH_HOME>/profiles/<profile>/package.json`：
   - `dependencies` 里应有 `"dsh-client-ui-quote": "^0.12.0"`（安装器会写）；
   - `dsh.profile.bundles` 追加 `"dsh-client-ui-quote"`；
3. 重启 DSH（profile 打开 `patchReload` 时也会自动重载）。

**不需要手写 loader 条目**：包自带的 `cordis.patch.yml` 就是组合包层补丁，会插入

```yaml
- insert:
    - id: ui-quote
      name: dsh-client-ui-quote
```

### 方式三：link 本地仓库（只给开发用）

```bash
git clone https://github.com/BangBang-03/dsh-client-ui-quote.git
dsh plugin --profile desktop add link:<clone-path>
```

link 的优点是改完刷新即生效；**日常运行请用方式一**，不要长期挂 link——那样市场/版本号都会绕着走。

### 开发与发布：`link` / `lab` / `stable` 三种运行模式

- **`link`——日常开发（最快）**：profile 里依赖写成 `link:C:/…/dsh-client-ui-quote`，窗口直接加载仓库里的文件。改完 `Ctrl+Shift+R` 硬刷新就生效，不必发版。
- **`lab`——云端预发布线**：`lab` 分支每 push 一次，CI 就把 `下一个补丁版本-lab.<run_number>`（例如 `0.11.4-lab.37`）发到 npm 的 **`lab`** dist-tag，不碰 `latest`。装它：`pnpm install dsh-client-ui-quote@lab`——用来验证「打包后的产物」，而不是工作区文件。
- **`stable`——用户装到的版本**：`main` 只接受从 `lab` 快进的提交（`git merge --ff-only lab`，不在 main 上直接提交）；发版 = 快进到 `main` 后打 `vX.Y.Z` 标签，CI 发到 npm 的 `latest`。

本机切换这三档（这台开发机专用的辅助脚本，不在仓库里）：`node .dsh-quote-work/profile-mode.mjs link|lab|stable|status`。换完在窗口里 `Ctrl+Shift+R` 生效；只有宿主半有改动时才需要重启桌面端。

两条线的断言入口相同：`npm test`（541 项：check 12 + capsule 376 + panel 153）；`.github/workflows/test.yml` 在每次 push / PR 上用 Node 18/20/22 各跑一遍，`publish.yml` 里 `prepublishOnly` 再跑一次才发。

**推送通道**：`git push` 优先，但本机 `github.com:443` **时通时不通**（2026-10-19 实测：短时可用、随后连续超时，每次失败等约 21 秒）。日常用工作区根的 `promote.ps1`：先试 git，失败自动转 REST 兜底（`.dsh-quote-work/publish-release.mjs`、`.dsh-quote-work/push-branch.mjs`，`-Channel rest` 可跳过探测），并核对远端 SHA。**别混用两条通道**：REST 重建的提交时区归一到 `+0000`，内容相同但 SHA 不同，同一分支混推会分叉（`git status` 看着干净，远端却多一条平行提交）；恢复就先 `git fetch`、确认 `git diff <本地> <远端>` 为空，再把本地线 reset 到远端。

两条线的完整流程（含「main 只做快进」、推 lab 与 main 的顺序、分叉事故的复盘）见工作区根目录的 `PLUGIN-WORKFLOW.md`，一键执行用 `pwsh -File promote.ps1 -Repo dsh-client-ui-quote`。

**发布运维备忘**（给未来的自己）：

- 发布用的是 90 天期 granular token（勾选 **Bypass 2FA**——npm 2026-08 起强制 CI 直发必须带这个标记），**2027-01-09 到期**。到期前重签：npmjs.com → Access Tokens → Generate New Token → Granular → 勾 Bypass 2FA、Read and write (publish and stage)、All packages、90 days → 生成后 `gh secret set NPM_TOKEN --repo BangBang-03/dsh-client-ui-quote`（gh 需已登录）。
- npm 对**新账号的首包**有安全审核 hold：发布成功后包页会短暂显示 `0.0.0-stage` 占位，属于正常现象，审核自动放行（本包 0.10.0 实测约 1 小时内过审），无需人工操作。
- npm 官方的长期方向是 Trusted Publishing（OIDC 直发）：2027-01 废弃 bypass-2FA 直发之前，建议在包 Settings → Trusted Publisher 登记 `BangBang-03/dsh-client-ui-quote` + `publish.yml`，并在 workflow 里加 `id-token: write` 权限与 `--provenance` 参数。

### 卸载

从 `dsh.profile.bundles` 与 `dependencies` 里移除该条目，重启 DSH（link 安装的包目录可以直接删）。

## 使用

1. 在会话正文、**文件预览**或**终端**里**拖动选中**一段文字（后两者没有自己的会话 id，引用会落进当前屏幕上那条会话，并且以**围栏代码块**的线格式发给模型；输入框内的选区属于改稿，不触发）。
2. 选区**下方**浮出浮层（下方空间不够时才改到上方），选择 **评论**、**添加到对话**、**侧边对话** 或 **另开侧边对话**。同一组动作也有键位：**`Alt+Q`** 直接引用、**`Alt+C`** 直接开评论框、**`Alt+B`** 直接开侧边对话（都在设置里可改；没有选区时按键原样让给其它快捷键）。
3. 前两个动作把引用放进输入框（评论模式下引用与评论在同一颗芯片里；**评论框上半格是引用正文本身，可以当场裁剪**；评论框里还有一格 **`让模型逐条回应`** 勾选项，勾上这条引用就带着逐条指令发出去），页面选区被清除、焦点交给输入框，可以接着写正式提问。
4. **另开侧边对话**给这条引用单独开一条线程（之后对同一条引用再选侧边对话，回到的就是它自己的那条）；**侧边对话**写的是另一条会话的输入框：右侧栏打开该线程的页签（标题取引用首行），引用以纯块引用形态落在它的草稿里，**不发送**；你接着在这条线程里写自己的问题、自己按发送。同一条主会话只会有一条侧边线程，第二次点第三项就把新引用接在草稿后面。同一会话上一次请求还在进行时，再次点击会并入第一次，不会开出两条重复线程。
5. 浮层收起条件：单击别处、选区清空、按 `Esc`、滚动会话、窗口尺寸变化，以及动作完成之后。双击选词不会把浮层关掉。
6. 发送出去以后，消息里那段块会显示成一颗**胶囊**：收起时是单行 `❝ 引用摘要 │ 评论摘要`，**鼠标移上去**会浮出一张卡片显示完整的引用与评论
   （输入框里那颗芯片同样可以悬停查看），点一下就在原地展开成全文，胶囊上悬停出现 `复制`。
   你自己写的话照旧显示在它下面；一条消息里引用了几处，就会出现几颗胶囊，中间的原话留在原来的位置。
7. 悬停卡片底部有 **`跳回原文`**：只对那些**本插件看着被选中**的引用出现（插入时记下了它所在的消息行 `data-chat-anchor-key` 与轮次），点一下就把那条消息**停到视野上方 24px**——和你用宿主自己的「跳到某一轮」是同一个落点——并闪烁一下。搜索只在这条引用**自己的会话面板**里进行（同一个锚点键在别的会话里也有时不会误跳），被 `hidden` 藏起来的行不算目标、会让位给同轮次的可见行，还没被虚拟列表挂载的行会一屏一屏地滚出来找——**先往上**（引用总在更早的消息里），到顶仍未找到就从最新处**再来一遍**；这套落点是宿主自己的做法：读 `[data-conversation-scroll]` 的 `scrollTop` 再连补几帧（虚拟列表挂载邻居时会改写偏移，一次性的 `scrollIntoView` 会落短）。真找不到时给一条 toast（`原文不在当前视图里`），而不是留一个点了没反应的按钮。
8. **引用清单**：右侧栏的「引用清单」页把这条会话发出去的所有引用与评论列成一张表（**导出 Markdown** 给人读，**导出 JSON** 给工具读；本机还留一份索引，上下文压缩把消息裁掉后清单仍列得出来）——**搜索框**按引用或评论过滤，点某一条就**跳回原文**（和悬停卡片上的按钮同一套落点），右上角**导出 Markdown** 存成文件；历史还没读完时列表上方会出现 **`加载更早的消息`**。入口有两个：右侧栏默认的**指南页**里有它的胶囊（点一下就在当前栏打开），或按 **`Alt+L`**（同样在设置里可改）。
9. **侧边线程回流**：同一个页面底部是这条会话的侧边线程（一条引用一条线程，所以这里可能不止一条）——显示它最后问的那个问题与消息条数。**`带回主会话`** 把线程最后的「问题 + 答案」写成主会话输入框里的草稿（**不发送**，你自己按发送；输入框里已有的内容会保留，回流内容接在下面）；**`导出 Markdown`** 把整条线程按顺序落成一个文件。没有线程时这一节只说明「这条会话还没有侧边线程」。
10. **回合级引用**：每条回合的尾部有 **引用提问 / 引用回答** 两个按钮——把整轮的提问或回答按原文取出，进同一个评论框（可改、可评论），确认后成为一条带坐标的引用。
11. **草稿里的引用**：输入框上方的 **`引用 ×N`** 条里，每条都能 `✎` 编辑（回填原引用与评论，旧芯片让位、新芯片原地插入）或 `×` 移除；刷新之后条、悬停卡与「打开文件」都还在。
12. **改这条引用**：悬停一张胶囊卡片，点 **`改这条引用`** —— 评论框把那条引用当初的**引用与评论都填回来**（各自一个输入框，都能改），你改完按 `⏎`（或点「添加到对话」）。发出的是一条**新的**引用：DSH 的消息是只追加的，没有编辑 API，所以「修改」只能这样表达。旧胶囊会立刻挂上 **`已修订`** 标记，它的卡片里显示改后的评论；连正文一起改过的，卡片里也显示改后的原文。标记按引用原文记在本机（`localStorage`），刷新后仍在。

## 工作原理

DSH 的输入框是 Lexical，没有 Kimi 的 `quote` 节点，但有一个通用的行内原子节点 `reference-chip`（`@文件` / `@会话` 提及用的就是它），而且**插件可以拥有自己的 chip**：

- 插件注册一个 reference source：

  ```js
  ctx.get("inputTriggers").registerSource({
    trigger: "#", name: "quote",
    candidates: () => [],
    codec: { clipboardText: (ref) => ref, serialize: (ref) => Promise.resolve(String(ref)) }
  });
  ```

  发送时 DSH 按 chip 的 `source` 找到 owner，调用 `codec.serialize(ref)` 取模型形态并替换进草稿。找不到 owner 会用
  `slash: no serializer for reference source "…"` 拒绝整条发送，所以插件在插入 chip 前先确保注册成功，注册不到就整体退回文本形态。
- 放入 chip 走会话输入服务：`ctx.get("conversation").input.shell(sessionId).insertReference(ref, span)`，其中
  `ref = { source, ref, label, appearance, clipboardText }`。`ref` 对 host 不透明，因此引用正文（`> …`）直接放在 `ref` 里，
  codec 保持无状态，草稿刷新后 chip 依然能还原。`appearance` 用 `session`（DSH 只认 `session` / `file` / `folder`），标签是引用正文的单行截断（48 字以内）。
- 浮层是一个挂到 `document.body` 的单例元素，注册在 `conversation.input.overlay` 槽位（会话作用域）的组件渲染 `null`，
  在 `useEffect` 里装配原生 DOM 事件：`selectionchange`（防抖）/ `pointerup` / `keyup` 读选区，`scroll` / `resize` / `Esc` / 外部点击收起。
- 每个会话把自己最新的 `inputActions` 注册进模块级表，浮层只对已注册会话的选区生效，插入时一定写进当前会话的输入框。
- 插件 ctx 存进模块级变量，chip 通路用它惰性解析 `inputTriggers` 与 `conversation` 两个服务：apply 时服务还没就绪也没关系，第一次插入时再试。

### 发送后的胶囊（transcript 侧）

发送出去的用户消息在 DSH 里是**纯文本**：`projectUserText` 只把 `@…` / `/技能` 变成行内 chip，其余原样渲染成
`white-space: pre-wrap` 的文本，`> ` 不会变成引用样式 —— 一屏 `>` 行就是这么来的。要做成 Kimi 那样一颗胶囊，
可用的路只有三条，前两条都被排除了：

- **换成原生 chip**：`@路径` 会渲染成文件 chip，但它是「蓝色文字 + 图标」，没有底/圆角，标签会被
  `split(/[\\/]/).at(-1)` 砍成 basename，点击还会调 `openFile()` 去开一个并不存在的路径；`@[标签](dsh-session:…)`
  的 session 线格式会被 host 的 `parseSessionReferenceText` 解析并在格式非法时抛 `SESSION_REFERENCE_INVALID_REFERENCE`，
  合法的又会真的去抓取被引用会话的 transcript（`MAX_REFERENCES = 3`）—— 语义不对。
- **做成附件**：`fileCard` 是原生卡片，但附件只能由粘贴/拖拽上传通路产生（发的是上传回执，模型要靠工具去读），
  引用正文反而进不了提示词。
- **插件自己画**（本插件采用）：`conversation.chat.node` 是按节点类型路由的 keyed 槽（`user` / `steering` / `context` … 由核心拥有），
  没有「每条消息一个钩子」的位置，所以胶囊画在 transcript 之上：

  - 序列化时在块首留**固有标记** `❝`（引用）与 `❞`（评论）：`> ❝ 第一行` / `> 后续行` / `> ❞ 评论` 共用一个块 —— 它是刷新、重开之后
    唯一还能认出「这段是引用 + 评论」的东西；一个块只对应一颗胶囊，所以芯片后面打的字不会被卷进评论里；
  - **文件预览/终端来源的引用**（`readSelection` 分得清选区落在哪个 host）序列化成 `> ❝ ``` ` / `> 代码行` / `> ``` `：
    模型读到块引用里一个真正的围栏代码块；`splitQuoteRuns` 解析时把首行的围栏（和收尾那一行）剥掉，胶囊拿到的仍是原始代码文本，
    渲染加 `data-code="true"`（等宽、`pre`、展开时横向滚动），卡片加 `dshq-pop-code`，侧边对话落进子线程草稿的则是不带标记的裸围栏；
    正文本身含 ``` 时序列化自动换 `~~~` 围栏。没有围栏的块照旧按普通引用解析，新旧消息互不影响；
    **预览引用的文件路径与行号**走的是围栏自带的信息位（`> ❝ ``` src/app.ts#L12-L48`）——Markdown 里这本来就是「渲染器不显示、模型读得到」的位置，
    `sanitizePath` 把带空白/围栏字符的伪路径挡掉。探测按两种宿主形状来：先在预览根（`[data-document-preview]`）里找宿主自己的路径标签
    （`[data-textpreview-path]`，完整路径在它的 `title` 里——标签在头部，与选区所在的 body 是兄弟分支），再退回「宿主或其祖先上的路径属性」；
    行号取自 `data-textpreview-line` 标记的行元素（`withLineRange` 拼成 GitHub 的 `#L` 写法，起止顺序自动归一）。两种都没命中就原样发；
  - **逐条回应的指令行**同样只是线上形态：勾了评论框里的开关，块尾多一行 `> ※ 指令：…`，`splitQuoteRuns` 按 `※ 指令` 前缀把它从块里剥掉，
    所以胶囊、卡片、清单导出全都看不到它；正文里恰好以 `※ 指令` 开头的行会被转义保护，回读时还原（见已知限制）。
  - 客户端插件用 `MutationObserver` 找「只含一个文本子节点、内部有 `❝`、位于 `[data-conversation-content]` 里」的那个 run，
    把整条消息拆成 `前文 / 引用 / 中间文字 / 引用 / 后文` 这样一串分段（`splitQuoteRuns`），给原 run 加 `display:none`，
    在它**前面**按顺序插入自己的元素：每段引用一颗胶囊，每段用户自己的话一个 `span.dshq-body`（保持 `pre-wrap`）——
    所以一条消息里引用了几处，就会出现几颗胶囊，中间的原话留在原来的位置；
  - 全程只隐藏、绝不搬移或删除 React 的节点；胶囊按 run 记账（`Map<run, {text, nodes}>`），文本没变就复用、变了就地重建、
    消息被删就把胶囊一起撤掉，React 重渲染不会出现第二颗胶囊；
  - 胶囊点击展开/收起（有选区时不触发），悬停出现 `复制`：收起时是单行 `❝ 引用… │ 评论…`（两端超出都省略），展开后两段各自换行；
    复制的是 Kimi 存 `display_text` 时的同一写法 `引用 · 评论`。样式用 `data-plugin="dsh-client-ui-quote"` 的 `<style>` 注入，
    配色取 `currentColor` 的 `color-mix`，无边框无阴影，深浅主题都不用额外适配。
  - 收起状态只有一行、读不全，所以**悬停会浮出一张卡片**（`#dsh-quote-popover`：单例、`position: fixed`、跟在锚点下方、贴底自动翻到上方、
    左右按视口夹取、鼠标从锚点移到卡片上不会把它关掉）：读全文不必先点开。**输入框里的芯片也接同一张卡片** ——
    芯片标签本来就被 `chipLabel` 截断过（引用 30 字 + 评论 22 字），插件按「标签 → 引用 / 评论」建索引，在 `[data-composer-card]`
    下认出这颗芯片后给它挂上同一张卡片，并打上 `data-dshq-chip="1"` 记账，卸载时摘掉钩子与索引。
    芯片标签在**每次悬停时重新解析**：React 下一条引用常常复用同一个芯片节点（节点没变、标签变了），
    所以卡片不会拿着挂载那一刻的旧内容；标签也对不上索引时宁可不出卡片，绝不显示别的引用的内容（芯片自带的 `❝` 前缀会被忽略）。
    卡片跟着锚点活：锚点一旦离开文档（发消息会把芯片拿走，而被移除的节点不会再发 `mouseleave`）卡片立刻收起，
    React 重渲染换掉胶囊时同理 —— 不会留下一张浮在空处的卡片。

### 逐条回应的回复徽章

指令行只是让模型**肯按编号回答**；让回答**连得回来**的是另一套覆盖层。模型按指令把每条回应标成 `「引用1」…「引用N」` 之后：

- 徽章增强器在**同一条会话面板**里找这条回复之前**最近的一条带胶囊的消息**（一次树序遍历同时解决「最近」和「在前」：走到徽章文本节点之前最后记账的那条 run 就是它），把它发出去的引用按顺序编号——第 N 颗胶囊就是「引用N」。
- 回复文本里的 `「引用N」` 于是被切成一枚 `span.dshq-ref` 徽章（**原文一个字不改**，只是套上底色和悬停行为）；编号超出那条消息引用数的标签（模型数错了，或有人在正文里自己写了「引用1」）保持纯文本——一枚点了没反应的徽章比没有徽章更糟。
- 徽章复用悬停卡片：`mouseenter` 就是那张卡（引用、评论全文，`跳回原文` 与 `改这条引用` 按坐标有无自动出现），点击等同清单页里点一行——有坐标就跳，没坐标无声。切分文本节点比胶囊那套「只隐藏、再旁边画」更进一步，规则也补得更紧：一个文本节点只切一次（账本记着原文）；React 重写了文本（值不再是账本里的首块）就整体撤掉重切；卸载时原文放回。这层只挂在**助手消息**的文本上——用户自己消息里的「引用1」是草稿的一部分，谁也不该动。
- 侧边线程（第三项）的围栏同样带路径（``` src/app.ts 的裸围栏），子线程的模型由此也知道代码出自哪个文件。

### 侧边对话（第三项）

第三项是本插件自己的扩展（Kimi 的浮层只有两项），融合了三家 agent 同类组件的优点：**Kimi Code 的 `/btw` 侧边聊天**——一键在侧边栏开一条继承主会话上下文的线程；**Qoder 的「在侧边任务中提问」**——同一会话进行中的创建请求自动并入第一次，失败只弹一条提示，绝不大张旗鼓；**WorkBuddy 的划选引用**——引用是线程里持久的内容，而不是一次性的草稿附件。与前两家不同的是**问什么由你来写**：引用只落进那条线程的输入框，不会被当成第一条消息替你发出去。样式上第三项用 DeepSeek 的鲸鱼蓝（`#4d6bfe`）画图标与悬停色，白底浅色主题是主基调，深色主题同一色相。

- **可用性探测**：`ctx.get("betterSidebar")` 存在、`getTab("sidechat")` 有注册、`isTabEnabled("sidechat")` 为真时走 better-sidebar；否则 `sessions.fork` 与 `sidebarRight.openResource` 都在时走原生 subagentchat 兜底；两种后端都不可用时第三项才整个隐藏——与「芯片通路不可用时退回纯文本」同一个哲学。
- **开线程**：`POST /sidebar/api/sidechat.start`，载荷 `{ sessionId, question: "" }`。**空 question 是关键**：better-sidebar 对非空 question 会调 `admitFirstContact` 把它当成线程的第一条消息发出去，而空 question 只把主会话的上下文快照挂到子线程上、一条消息都不发——引用于是不会替你提问，而「线程继承主会话上下文」仍然成立。
- **开页签**：拿到 `{ childId }` 后调 `betterSidebar.openTab({ type: "sidechat", id: "sidechat:<childId>", title: 引用首行, meta: { threadId: childId } }, { sessionId })`。`meta` 自 0.12.0 起是文档化的种子通道，会一路透传成原生页签的导航参数；`SideChatView` 正是按 `meta.threadId` 绑定线程——页签于是精确落在这条线程上，而不是又开一个空线程。
- **写进输入框**：页签打开后，`ctx.get("conversation").input.shell(childId)` 拿到子会话的输入框外壳（`SessionInputShell`），用 `setDraft(...)` 把引用的**纯块引用**形态（`>` 逐行前缀，不带 `❝` 标记——那两个标记是主会话胶囊增强器的识别符，侧边线程用不上）写成草稿：输入框里已经有你写的内容时，引用接在下面、空行隔开；**不发送，也不碰别的东西**。子会话的输入框要等页签挂载后才存在（`shell(id)` 在此之前会抛「resolved no binding」），所以这里按 200ms 轮询等它出现；外壳在而 `setDraft` 不在（版本对不上）则立刻放弃，不空等 5 秒。
- **一条主会话一条线程**：线程 id 按主会话记住——优先读 better-sidebar 自己写在 `dsh-sidebar:v1:sidechat-thread` 里的绑定（页签绑上哪条线程它就记哪条），其次读本插件自己的 `dsh-client-ui-quote:v1:sidechat-thread`。第二次点第三项不再新建线程，只把新引用接进同一条线程的输入框。
- **防重复**：同一会话的请求还在途中时，再次点击直接并入第一次（模块级 `Map<sessionId, Promise>` 记账，结算后自行清除）。
- **失败路径**：路由拒绝（better-sidebar 未挂载、父会话未运行等）或 `openTab` 抛错 → toast「侧边对话没有打开，请重试。」；线程已开、草稿没能写进去 → toast「侧边对话已打开，但引用没能写进它的输入框」。

### 引用清单（右侧栏页面）

引用清单是这套能力里唯一**把引用当对象**的地方：它把一条会话发出去的引用与评论列成一张可搜索、可跳转、可导出的表。

- **数据来自会话自己的事件日志**，不是屏幕上的 DOM：`ctx.sessions.retain(sessionId, { source: "quoteList" })` → `await reference.ready` → `reference.binding.session` → `session.eventSource.getSnapshot().entries`，筛 `event.type === "user/message"`，取 `event.data.content` 里的文本块（注意 `user/message` 的记录就在 `event.data` 上，不是 `event.data.message`），再用 transcript 侧同一个 `splitQuoteRuns` 把 `> ❝ …` 块拆出来。读完立刻 `reference.release()`——保留一个永不放手的引用会把会话钉在内存里。因为读的是日志而不是 DOM，**屏幕上没有那条消息也照样列得出来**。
- **历史是分页的**：首屏只带最近若干条消息，`session.getSnapshot().hasMore` 为真时列表上方出现 `加载更早的消息`，点它调 `session.loadOlder()` 再重读一遍。
- **跳回原文**复用悬停卡片那一套（同一个 `jumpToSource`）：只有当初被本插件看着选中的引用才有坐标，所以只有那些行可点（`data-dshq-row="jumpable"`），其余行只是可读的文本。
- **导出**走浏览器：`URL.createObjectURL(new Blob([md], { type: "text/markdown;charset=utf-8" }))` + 一个带 `download` 的 `<a>`——宿主没有给客户端插件任何写盘的接口，这是 DSH 里现成的做法（`dsh-session-log-export` 的客户端半边就是这么下载的）。没有 `Blob` 时退回 `data:` URL。
- **注册形状**（两侧都必须声明，id 是同一个）：`ctx.sidebarRightTabs.register({ id: "dsh-client-ui-quote/list", kind: "quote-list", title, guide: [{ id: "quotes", commandId: "ui-quote.list", order: 20, title, description }] })` 声明**页面类型**（页面类型不写 `patterns`，按 kind 打开），`ctx.slots.register({ name: "sidebar.right.pane.tab", key: "dsh-client-ui-quote/list" }, Body)` 提供**页体**，标题座位 `sidebar.right.pane.tab.title`（同一个 key）提供页签文字。`guide` 数组是发现入口：右侧栏默认页就是指南页，里面每个 `guide` 条目一个胶囊，点开即 `openTab(kind)`。打开动作是 `ctx.get("sidebarRight").openTab("quote-list")`，`Alt+L` 与指南胶囊都走它。
- **页体拿到的 props**：座位注入的 `inject: (sessionId) => ({ sessionId, load, loadOlder, jump, save, loadThread, back, exportThread })`，页体本身只负责渲染——解析、过滤、Markdown、单行标签都是可离线断言的纯函数。
- **侧边线程回流**（页面底部那一节）：线程 id 从线程记忆里反向查出主会话（本插件的 `dsh-client-ui-quote:v1:sidechat-thread` 与 better-sidebar 的 `dsh-sidebar:v1:sidechat-thread` 都是「主会话 → 线程」的表，这里倒着读）；线程内容用同一个 `withSession` 读取（`retain` → `ready` → `binding.session.eventSource` → `release`）。`带回主会话` 取线程**最后一条提问**与它之后的**最后一条回答**（提问以 `>` 块引用形式带上，超过 4000 字截断并标注），写进主会话的草稿——用的是第三项那条链路同一个 `prefillDraft`，所以也是「**写草稿、不发送**」，草稿里原有内容保留、回流内容空行接在下面。`导出 Markdown` 把整条线程每条消息按顺序落成文件。

### 与 Kimi Code 的对应关系（历史参照）

Kimi Code 仍是本插件最早的交互参照，但已不是唯一参照物；这一节保留它，是为了说明 `quote` 节点的语义来源。参照物是 Kimi Code 1.0.4 桌面端 bundle。Kimi 的浮层是 teleport 到 body 的 `.sab`（selection action bar），**一个元素两种模式**：
`menu` 模式两行（`评论` 切到评论模式、`添加到对话` 直接出引用），`comment` 模式为文本域 + `取消` / `添加到对话 ⏎`；
动作经 `onAction` → `insertComposerQuote(quote, comment, source)` 写入 composer，而 Kimi 的引用是 composer schema 里的行内原子节点 `quote`
（DOM 形如 `span.quote-pill[data-quote-text][data-quote-comment]`）。对照 Kimi Code 自己的会话记录能看到这个节点的真实形状：
**引用与评论是同一个 Tiptap 节点的 `attrs.text` / `attrs.comment`**（`{"type":"quote","attrs":{"text":…,"comment":…}}`，引用和评论从不拆成两段），
发给模型时展开成「`> 引用` + 空行 + 评论」，而它在会话里显示、存储用的 `display_text` 就是 `引用 · 评论`。
本插件逐条对应到 DSH：`.sab` → 本文的单例浮层，`quote` 节点 → DSH 的 `reference-chip`（两半都放进同一颗芯片的 `ref` 与标签），
`insertComposerQuote` → `registerSource` + `insertReference` + `codec.serialize`，发送后留在消息里的 `quote-pill` →
transcript 侧的 `.dshq-cap` 胶囊：一颗胶囊同时装引用与评论，`复制` 出来的也是 `引用 · 评论`（见上一节）。
浮层的第三项不在对应关系里——`.sab` 的 `menu` 模式只有两行，侧边对话是本插件自己的扩展（见上一节）。

## 与同类插件的差异

判断依据是 2026-10-20 的市场快照（`https://awesome-dsh-plugin.com/plugins.json`，**6084 条**；npm registry 的 `dsh-plugin` 关键词另有 9000+ 条，含大量无关包），以及逐个读过的 **20+ 款直接/邻接同类** README。小赛道，但很挤：「划选浮层 + 加进输入框」这个形态本身已经饱和。

| 同类 | 它做什么 | 我们的取舍 |
| --- | --- | --- |
| `@changfenhuang/dsh-annotation`（3513/月，148★） | 最短路径「选中→批注→逐条回应」；文件预览也能批注 | 保留评论+引用同一颗胶囊，多出清单/侧线程/修订；它的低摩擦值得学 |
| `dsh-sidenote`（3752/月） | 原生侧栏 + 多侧聊 + 划选注释 + 结论回流/存为正式会话 | 已做「一条引用一条线程」与线程清单；缺 better-sidebar 时用 fork + 原生 subagentchat 兜底 |
| `@kirkchinese/dsh-citeciter`（2028/月） | 每次划选一个持久只读 Topic + 草稿自动保存/多窗口合并 | 不做完整 Topic 系统；「新开线程」与草稿持久化已补 |
| `dsh-quote-annotate-pro`（2126/月） | 发送后引用块常显 3 行 + 自动编号 + 回合尾引用 | 坚持胶囊+悬停卡；回合尾引用已补，常显块不做默认 |
| `dsh-select-quote`（1212/月） | 待发批注按会话持久化，逐条编辑/删除/清空 | 聚合条已支持逐条编辑/移除、完整无障碍名与跨刷新恢复；删除优先用宿主 `consumeToken` 精确区间 |
| `dsh-selection-toolbar`（GitHub 安装） | 文本+图片、截图/详情、fork 侧聊 | 文本引用为主；图片/截图是明确空白，生态已有独立插件，不并入 |
| `@u2a5f/dsh-selection-annotations`（上轮 391/月） | 独立 JSON 块 + charStart/End + 读源精确定位 | 保留内联线格式；JSON 导出与源文件定位已补，不改成额外消息 |
| `dsh-quote-followup`（2088/月） | 原生 chip 只存文本+轮次，compaction 后仍有效 | chip 同样自包含；本机索引已补，清单不再只依赖事件日志 |

**2026-10-20 复扫补记**（同一份 6,084 条市场快照，补读上轮未收录的 11 款）：

- `dsh-sidecard-ask`（3,217/月，10-10 上架）：把「划词 → 独立子代理作答 → 侧边卡片」做成完整承载链（better-sidebar → 原生右栏/内置浮层兜底），说明侧边问答已是独立赛道；我们的侧边对话仍是引用附属，不扩成通用问答。
- `dsh-side-chat-plus`（1,920/月）与 `dsh-sidenote` 0.6：都把侧聊放进原生右栏；我们的「一条引用一条线程」仍是差异化，better-sidebar 缺失时已改用 `sessions.fork` + 内置 subagentchat 页兜底。
- `dsh-quote-reply`（GitHub 安装）：把引用放到输入框上方的独立层，经 `systemPrompt.context` 注入、回合尾显示「引用(N)」；我们坚持把坐标写进消息文本，换取导出/审阅/跨刷新，不改架构。
- `dsh-selection-quote`（594/月）与 `dsh-xwide-annotation`（1,148/月）：分别补了右键菜单/持续选区高亮与每条颜色/大纲；我们的清单已是大纲，颜色不是主线，右键菜单也不比现有浮层快。
- `dsh-code-quote`（776/月，粘贴 `路径:行` + 代码 → chip + pre-step 快照）与 `dsh-quote-to-agent`（引用分派子代理）是相邻赛道，不并入；`dsh-web-annotator`/`dsh-image-annotate` 进一步证明图片/网页批注应独立成插件。
- 本轮唯一落到代码的修正是：宿主其实有 `consumeToken`（`app.asar` 的 conversation shell），已用它替换「聚焦 + 合成 Backspace」；详见「已知限制」。

同一份快照里几个仍然很窄的格子：

- **「引用 + 评论合成单一可交互胶囊」**：仍是本插件独有；`dsh-annotation` 证明「选中→批注→逐条回应」有需求，差异在我们的**胶囊 + 清单 + 线程**组合，而不是单点机制。
- **待发引用管理**：`dsh-select-quote` 的按会话持久化、逐条编辑/删除/清空是这一格的老大；本插件现在补齐了**逐条编辑**（`✎` 回填原引用与评论，旧芯片让位、新芯片原地插入）与**跨刷新恢复**（芯片索引落本机，宿主恢复草稿芯片后它们重新算是我们的引用），我们不提供「一键清空全部」——按条删除更不容易误伤，删除与编辑都在草稿上方的聚合条里做。
- **代码引用回跳**：`@u2a5f` 已经读源文件算精确行号，`dsh-annotation` 能对文件预览批注并恢复；我们的卡片/清单现在显示 `文件预览 · path#Lx-Ly` 并能打开预览定位起始行、标出被引的行，还差 Markdown 预览的读源行号（要声明 `remote`，风险大于收益，先不做）。
- **多侧线程/原生侧栏**：`dsh-sidenote`/`CiteCiter` 已把多 Topic、草稿保存做完整；我们现在是**一条引用一条线程**（浮层里「另开侧边对话」，清单页列出全部线程），并已加 **fork + 内置 subagentchat** 兜底；仍没有 better-sidebar 那种把线程藏出会话列表的能力。
- **图片/截图**：`dsh-selection-toolbar` 与 Kimi 桌面端已经支持；我们仍是纯文本引用。
- **「原地编辑已发送的批注」**：DSH 仍没有编辑已发送消息的 API（侦察确认 `editMessage`/`updateMessage`/`rewriteMessage` 全树 0 命中），本插件走**追加式修订**；`dsh-plugin-message-edit` 走的是另一条路（原地保存 + 分支重生成 + 版本时间线），两条路线不冲突。

本插件相对同类的**可验证**优势集中在四件事上，都有离线断言兜底：

1. **语义而不是机制**：引用与评论是同一颗节点（对齐 Kimi 的 `quote` 节点 `{text, comment}`），一颗芯片 → 一个块 → 一颗胶囊 → 一张卡片 → 一次复制；机制（reference chip、DOM 增强）谁都能抄，这条链子不好抄。
2. **引用是带坐标的活对象**：`跳回原文` 在自己的会话面板里找行、按宿主的方式对齐到 24px，行被虚拟列表藏起来或没挂载都能找回来；坐标以「人可读来源头 + base64 尾巴」随消息走——前者让模型知道出处，后者让插件跨刷新回读。base64 确实占一点 prompt，这是用「不依赖本地表」换来的取舍。
3. **引用有下落**：清单页（搜索 / 跳转 / 导出 Markdown）+ 侧边线程回流（结论写回主会话草稿 / 导出线程），这两件事在同类里仍是少数。
4. **工程化**：541 项离线断言（含真跑 `sessions.retain` / `setDraft` / 下载链路）、每个宿主契约都在 README 里写明出处、每个版本都有可回读的 release。同类里做到同等断言规模的仍是少数。

反过来也要说清楚：**本插件不做的**——不做翻译/解释/改写/飞书投递类选区动作；不做图片/截图引用（**明确取舍**：图片引用要的是另一套胶囊/卡片/附件语义，是第二个产品的量级，塞进这里只会把「文本引用带坐标」这条主线冲淡；`dsh-selection-toolbar` 与 Kimi 桌面端已经做了，真要做建议独立成插件）；不做完整 Topic 系统；不做常显大块引用。它只把「引用」这一件事做穿——但「做穿」包括发送后的管理、来源闭环和审阅，不只是浮层。

**分发是另一块短板**：README 仍偏长，同类头部（`dsh-annotation`、`dsh-sidenote`、`CiteCiter`）都是短卖点 + GIF + 多市场收录；功能强度不等于装机量。`package.json` 的 description 已收紧到一句话，首屏已补徽章、「30 秒上手」与 24 秒静态轮播 GIF；多市场提交的文案、标签与检查表在 [`docs/distribution.md`](docs/distribution.md)，实际投稿仍需仓库所有者账号。

## 声明（package.json）

| 字段 | 作用 |
| --- | --- |
| `dsh.bundle.patch` | 指向 `cordis.patch.yml`：作为**组合包层补丁**插入 `ui-quote` 这一行 loader 条目。 |
| `dsh.client.platform: "web"` | 声明浏览器侧 bundle。host 还接受 `dsh.client.inject`（声明依赖的客户端包）、`external`（列非基线模块请求，默认 `[]`）、`immediately`（是否随启动立即实例化，默认 `false`）；本插件只用平台基线模块，故都不声明。 |
| `exports["./client"]` | 必须导出：host 用 `clientExportOf(pkg.exports)` 找 bundle。 |
| `exports["./package.json"]` | 必须导出：插件页元数据要解析 `<pkg>/package.json`。 |
| `exports["./locale/*.json"]` | 必须导出：host 通过 ESM 解析器逐个读语言文件。 |
| `icon` | 卡片图标。**相对路径**（不能绝对路径、不能带协议）、SVG/PNG/JPEG/WebP、≤ 256 KiB、realpath 后必须留在包目录内；host 读成 `data:` URL 交给插件页。 |
| `locale/<lang>.json` | `{"meta": {"title": …, "description": …}}`。`locale/en.json` 是英文锚点（host 以它所在目录为准扫描同目录 `*.json`，语言名取自文件名）；缺 `en.json` 就没词条，`en` 回退到 `package.json` 的 `name` / `description`。 |
| `engines.dsh`（清单根） | 声明兼容的 DSH 版本范围。当前 host 不校验它（声明式）。 |
| `dsh.manifestVersion: 1` | 清单格式号，同样只作文档。 |
| `peerDependencies` | **故意留空**：`@deepseek-ai/dsh*` 的 peer 范围是唯一被强制校验的兼容性字段，范围不满足时 preflight 会在组合期把该行 `disabled`（需要 `dsh plugin allow-version` 或 profile 的 `compatibility.json` 豁免）。本插件只 require 平台基线模块 `react`，不需要 peer。 |

`npm test` 会逐条复核上面这些：补丁文件、三个导出、图标类型与体积、中英词条、以及「没有会被强制校验的 peer」。

## 结构

```
package.json          DSH 插件清单（bundle patch + client 半 + icon + locale 导出）
icon.svg              插件页卡片图标（相对路径、≤ 256 KiB 的 SVG）
cordis.patch.yml      组合包层补丁：插入 ui-quote 这个 loader 条目
lib/index.js          host 半：只声明 apply()，不提供服务
lib/client.js         全部功能：vendor-CJS 工厂 + 浮层（三项动作）+ 输入框芯片 + 发送后胶囊 + 原文高亮/聚合条 + 侧边对话接线 + 引用清单页（含多选插入）
.github/workflows/test.yml  push / PR 的 Node 18/20/22 测试门
locale/zh.json        插件页卡片文案（中文）
locale/en.json        插件页卡片文案（英文）
test/check.mjs        离线自检（清单 + 组件契约）
test/dom.mjs          给离线自检用的最小 DOM / MutationObserver 垫片
test/capsule.mjs      离线自检（发送后胶囊 + 悬停卡片 + 跳回原文 + 键位 + 改这条引用 + 代码引用 + 文件路径打开 + 聊天代码块划选 + 选区保结构 + 回合级引用 + 逐条回应双语 + 草稿引用编辑/持久化 + 聚合条移除/无障碍 + 行范围标记 + 浮层不随座位失效，376 项断言）
test/panel.mjs        离线自检（引用清单：解析 / 搜索 / Markdown / 读取 / 导出 / 页面注册 + 文件路径打开 + 侧边线程回流 + 审阅工作台（状态 / 标签 / 批量）+ JSON 导出 + 本地索引，152 项断言）
test/capsule.html     真浏览器里跑同一套胶囊断言（51 项，可选）
```

功能完全在浏览器侧：`lib/client.js` 用 `window.__ModuleLoader__.load({ id, factory })` 注册，只 `require("react")`
（平台基线模块），不依赖 react-dom、CSS 文件或 host 半参与序列化；浮层样式是运行时注入的内联 `<style>`，
胶囊样式是 `<style data-plugin="dsh-client-ui-quote">`。

## 自检

```bash
node --check lib/client.js
npm test          # = node test/check.mjs && node test/capsule.mjs && node test/panel.mjs
```

`test/check.mjs` 用桩 `window.__ModuleLoader__` / 桩 `react` / 桩 host ctx 加载 bundle，断言模块 id、服务声明、
槽位注册（`conversation.input.overlay` / `quote-selection` / locale `ui-quote`）、两套词条（含侧边对话的中英标签）、
「组件渲染 null」，以及 reference source 只注册一次、`codec.serialize` 原样返回模型形态、菜单候选保持为空。
它还断言侧边对话的可用性探测：没有 `betterSidebar` 时返回 null、页签未注册或被停用时返回 null、齐备时返回服务本身，
外加 `sideQuestion`（纯块引用形态）与 `sideChatTitle`（首行 + 芯片式截断）两个纯函数，以及线程记忆与草稿预填那四个函数
（`storedSideThread` / `rememberSideThread` / `displayedThreadId` / `prefillDraft`）在导出面上确实存在。
它还会按 host 读取清单的方式复核 `package.json`：`dsh.manifestVersion` / `dsh.client.platform` / `engines.dsh` 的位置、
`dsh.bundle.patch` 指向的补丁文件确实插入了 `ui-quote`、四个 `exports`、图标（相对路径 + 类型 + ≤ 256 KiB）、
`locale/*.json` 的 `meta.title` / `meta.description`，以及「没有会被 preflight 拒绝的 `@deepseek-ai/dsh*` peer」。

`test/capsule.mjs` 在 `test/dom.mjs` 的最小 DOM 上真跑一遍胶囊：把 `check.mjs` 那套桩 ctx 换成会记账的版本，塞进一条
「用户文字 + 序列化引用」的 `span.plainRun`，然后断言 —— 每个引用 run 恰好一颗胶囊、原 run 只是 `display:none` 且仍在文档里、
用户自己的话另起 `span.dshq-body`、胶囊里是引用原文（有评论时评论在同一颗胶囊里且不会多出一颗）、`复制` 写出 `引用 · 评论`、
React 重渲染不会出现第二颗、引用变了就地重建、消息被删胶囊一起消失、卸载后 run 与样式表都恢复、手写的 `> ` 引用块不被误伤；
悬停胶囊或输入框芯片时浮出卡片（两段全文都在、贴底自动翻到上方、左右夹取不越界、离开后收起、锚点被移除 / 发出去后卡片跟着收起、
卸载后卡片消失且芯片钩子摘除、输入框里两颗芯片各显示自己的引用、节点被复用后显示当前那一条、标签对不上时不出卡片）；
菜单纵向位置（默认在选区下方、贴底改到上方、比视口还高时仍留在视口内）；
一条消息里引用两处时，两条引用各得一颗胶囊、两颗之间的原话仍在原位、相邻两条引用也不会被吞掉；
**代码引用**整条线格式（预览/终端来源序列化成块引用内的围栏、正文自带 ``` 时换 `~~~`、解析时围栏剥干净逐字还原、普通引用逐字 round-trip、
代码胶囊挂 `data-code` 且卡片走 `dshq-pop-code` 等宽排版、侧边线程落裸围栏）；
侧边对话整条链路在桩上真跑一遍——`sidechat.start` 的 URL / POST 形态与载荷（sessionId + **空 question**，也就是「什么都不发」）、
返回 `{childId}` 后 `openTab` 恰好一次且 `meta.threadId` 绑对线程、引用被 `setDraft` 写进那条线程的输入框（草稿里已有内容时接在下面、空行隔开）、
第二次点击复用记住的线程而不再创建、并发第二次点击并入第一次、外壳只暴露 `actions.setDraft` 时同样写得进去、
路由拒绝与 `openTab` 抛错都只落一条 toast 且绝不开页签、外壳没有 `setDraft` 时另落一条 toast、
线程记忆（自己的 map、host 的绑定优先、空 id 只忘自己的）、空引用不发请求；
跳回原文的坐标与落点（按引用原文归一化折叠与截断成键、坐标落进 `localStorage`、按 `data-chat-anchor-key` 在**引用自己那条会话的面板**里找到行、停到视野上方 24px 并闪一下、
同一个锚点键出现在别的会话面板里时不被误跳、被 `hidden` 藏起来的行让位给同轮次的可见行、还没挂载的行靠滚动搜索一屏一屏找出来并落在它身上、往上找到顶后从最新处再来一遍也能找到、都找不到时给 toast）；
三个键位的注册形状（id 前缀、Alt 默认值、平台键表、区域 `page` + `editable`、没有选区时 `resolve` 返回 `pass`、注册返回 disposer）；
**改这条引用**整条链路：挂载 `conversation.input.overlay` 座位（桩 react 按挂载语义跑 effect，于是会话真的注册进插件）、
卡片给出 `跳回原文` 与 `改这条引用` 两个动作、点后者把栏切到评论模式并**预填旧评论与旧正文**、
按确认后 `insertReference` 恰好一次（新芯片的 `ref` 带改后的评论）、旧引用被记为「已修订」并落进 `localStorage`、
旧胶囊挂上 `已修订` 徽标、它的卡片显示改后的评论（连正文改过的连改后原文一起显示）、空修订不算修订、
修订不改写引用原文本身、清空引用正文时确认按钮禁用、改后的正文随新芯片发出；
**浮层不跟着座位生死**（`conversation.input.overlay` 没挂载也能选中出栏、挂上两个会话座位既不叠加也不丢监听、
座位不在时用输入框自己的 `actions` 落芯片、无处可插时给 toast 而不是静默返回、effect 卸载/重装后监听恰好一份）；
（共 376 项，含文件路径与逐条回应的线上形态、`parseCodeSource`/`fileAddressFor` 与「卡片/清单点击打开 session 文件并带上起始行」、聊天代码块划选的语言探测与跨界降级、选区的链接/行内代码保真与纯文本回退、回合级引用的取文与坐标、英文逐条指令与「Quote N」徽章、草稿芯片索引的跨刷新恢复与聚合条编辑/移除、回复徽章的建立/重建/卸载与悬停卡片复用、无 better-sidebar 时 `sessions.fork` + 内置 subagentchat 的降级与复用，以及评论框两个输入区的自适应高度——引用正文那格曾经在被挂进栏之前就量高，读到 0 后被写成 `height:0`，首行因此被裁掉）。
`test/capsule.html` 是同一套断言的真浏览器版（51 项），用 `file://` 打开即可（页面会把结果写进标题与 `#probe-out`）。这一版修好了它**缺失的 `<body>` 标签**——脚本在 `<head>` 里执行时 `document.body` 为 null，这个页面以前在真浏览器里是直接坏的；并补上真 `Range` 的链接/行内代码断言（真浏览器的 `cloneContents()` 返回的是 DocumentFragment，不是元素——序列化器只认元素的话，链接在真浏览器里会退化成纯文本；离线桩现在也用真片段，不再放过这一类），另外补了 `CSS.highlights` 选区保持与关闭清理。

`test/panel.mjs` 单独跑引用清单页与侧边线程回流（152 项）：只认**持久**的 `user/message`（`transient`、助手消息、`data: null` 都跳过）、
引用按原文逐行拆出来而评论跟着同一条记录、最新一条排最前、空查询保持全量、引用与评论都能被搜到且忽略大小写、
Markdown 的标题/编号/块引用/评论行/时间戳与空列表兜底、超长引用在标题里被截断、非法时间导出为空；
读取侧用桩 `sessions.retain` 真跑一遍——读出两行且 `hasMore` 透传、**读完必须 release**（记录 `source: "quoteList"`）、
`loadOlder()` 被调用后重读、`retain` 抛错变成 `{ ok: false }` 而不是异常、解析不出 binding 时是 `no-session`；
导出断言下载文件名与 blob URL；注册侧断言页面类型（id/kind/title/guide 条目与 `commandId`）、页体的 keyed 座位与 `inject(sessionId)` 的四个能力、
标题座位、面板样式表真的进了 `<head>`、`openQuoteList()` 用 kind 打开以及宿主拒绝时不抛异常、
`Alt+L` 那个命令**没有选区也返回 handled**、四个命令的 id 依次是 `ui-quote.quote/comment/sidechat/list`，
以及单行的 markup（有坐标 → `jumpable` 且点击回调收到整行，无坐标 → `plain`）与页体外壳（标题、搜索框占位符、底部的侧边线程一节）。
侧边线程那一节另有 35 项：`sessionMessagesFromEntries` 认两种角色的文本存放位置（用户消息在 `event.data`、助手在 `event.data.message`）、工具结果与空消息不算、
顺序与 seq/时间透传；`threadConclusion` 取「最后一条提问 + 它之后的最后一条回答」、提问写成 `>` 块引用、只有提问/只有回答/空线程的三种退化、
超长截断并标注；`threadMarkdown` 的标题/编号/角色/时间与空线程兜底；`mainSessionForThread` 反向查两张线程记忆表（含 better-sidebar 的对象形态）；
`readSessionMessages` 真读一遍且 release；`loadThreadSummary` 给出问题与条数、没有线程时 `threadId` 为 null；
`bringThreadBack` 把结论写成**草稿**（原有草稿保留、空行隔开）、外壳没有 `setDraft` 时如实失败、没有线程时不乱写；
`exportThread` 的文件名与整条线程内容、以及 MIME 是 Markdown。

合计 **541 组**（check 12 + capsule 376 + panel 153），`npm test` 全绿。

## 已知限制

- **侧边对话依赖两个半公开接口**：dsh-better-sidebar（实测 0.25.0；`meta` 种子通道自 0.12.0、原生右侧栏承载自 0.19.0 起可用）
  的 `POST /sidebar/api/sidechat.start`（本插件靠「空 `question`」拿到一条**什么都不发**的新线程），
  以及 DSH 客户端自己的输入框外壳 `SessionInputShell.setDraft`（把引用写成子会话的草稿）。
  未安装、被禁用、或它的「侧边对话」页签在侧边卡片设置里被关掉时，浮层第三项**整个不渲染**；
  两个接口升级后若失效都不会静默：开不了线程 → toast「侧边对话没有打开，请重试。」，写得进不去草稿 → toast「侧边对话已打开，但引用没能写进它的输入框」；
  线程创建要求父会话处于运行态（历史归档会话会收到 409，同样落 toast）。
- **「改这条引用」是追加，不是原地编辑**：DSH 的 transcript 只追加（侦察确认全树没有 `editMessage` / `updateMessage` / `rewriteMessage` / 回收 API，只有**尚未进入会话**的队列条目可改）。所以修订发出一条新引用（评论、引用正文都可改），旧胶囊只挂 `已修订` 标记——标记存在**本机** `localStorage`（`dsh-client-ui-quote:v1:quote-revised`，按 **`ref + 引用原文`** 归一键、上限 60 条），同一句话从两个不同位置引用时互不影响；没有 ref 的旧引用仍按原文键读写。它不会跨标签页、跨设备同步，也不进入模型上下文；模型看到的是那条改后的新引用。正文改过后键仍是旧原文：`已修订` 挂在**旧**胶囊上（它的卡片里显示改后的原文与评论），改后的新胶囊不挂标。
- **代码引用的识别靠首行围栏**：`> ❝ ``` ` 开头的块按代码解析（围栏剥掉、胶囊等宽）。因此一条**普通**引用如果正文恰好以 ``` 或 `~~~` 开头（比如在 Markdown 文件预览里引用了源码），回读时也会被当成代码引用——显示上是等宽排版，文字不丢。
- **标记形状的正文会被转义**：一行以 `❝` / `❞` / `※` 或反斜杠开头时，写入线格式前加一个反斜杠、回读时还原。因此引用一段本身含 `❞` 或 `※ │q1:` 形状的文档，不会再被当成评论分隔符或坐标行截断/丢行；旧版本发出的消息没有这层转义，仍按旧规则解析。
- **文件预览的路径与行号是探测来的**：路径优先读宿主预览头部的路径标签（`[data-textpreview-path]` 的 `title`，实测 0.2.0-rc.2 的侧栏文档预览就是这个形状），其次探一组候选属性；行号只在预览按行渲染时可得（`data-textpreview-line`，纯文本视图有、高亮代码视图没有）。两者都拿不到就不带（引用形态与从前完全一样）；终端来源的引用没有路径可言。路径与行号写进围栏信息位，`sanitizePath` 把带空白或围栏字符的值挡掉。有路径时卡片/清单会显示并打开它；**Markdown 预览不提供源码行锚点**，打开后不会滚到行，切到纯文本/代码视图后再导航。导航只用起始行，行范围的结束行只用于显示。
- **聊天代码块的识别也依赖宿主 DOM**：选区两端都在同一个 `pre` 里才算代码块，语言从 `code`/`pre` 的 `language-*`/`lang-*` class 或 `data-language` 属性读；宿主换了渲染形状（不用 `pre`、语言标在别处）时，划选安静退化成普通块引用——引用本身不丢，只是少了围栏和语言。宿主若在 `pre` 里渲染行号沟槽，选区带进来的行号文本要靠评论框当场裁掉。
- **Diff 引用的路径与行号同样是探测来的**：先在 diff 卡片里找 `data-diff-path` / `data-file-path` / `data-diff-file` 等头标签（优先读 `title`），再退回祖先属性；行号读 `data-line-number` / `data-diff-line` / `data-line`。宿主换一套 diff DOM 时只会丢路径/行号，引用本身仍按代码块发。
- **多选插入按清单当前顺序写**：每条引用各成一颗芯片；宿主编辑器拒绝 chip 写入时整批退回一段文本块，不会重复插入已成功的条目。搜索框一变就清空勾选，避免“看不见的选中项”被插进去。
- **回复徽章依赖模型守格式**：模型没按指令输出 `「引用N」` 就没有徽章——无损，只是少了联动；输出越界的编号（数错了）保持纯文本。徽章的编号以回复**之前最近的一条带胶囊的消息**为准；切分的是助手消息的文本节点，DSH 若改了助手消息的渲染形态，徽章增强器要跟着调（与胶囊的 `isQuoteRun` 同一条既有限制）。
- 依赖 DSH 客户端的内部接口（`conversation.input.overlay` 槽位、`inputTriggers.registerSource`、`conversation.input.shell(id).insertReference` / `consumeToken`、scoped `slash/input-insert-reference`、`sessions.fork`、`sidebarRight.openResource`、
  `reference-chip` 节点），DSH 升级有可能失效。
- **引用清单页依赖右侧栏的两个服务**（`sidebarRightTabs` 与 `sidebarRight`，实测 0.2.0-rc.2）；宿主没有它们时页面不注册、`Alt+L` 给一条 toast
  （「引用清单打不开：右侧栏服务不可用」）而不是报错。它的数据来自会话事件日志，**历史是分页的**：只列已加载的消息，更早的要按 `加载更早的消息`；
  如果会话做过原生上下文压缩/裁剪，被裁掉的那些消息里的引用也不会出现在清单里。导出是浏览器下载（宿主没有给客户端插件写盘接口），
  文件名形如 `quotes-<sessionId>.md`；一行能不能跳看它自己带不带坐标——本版本发出的引用都带，更早发出的老引用没有坐标，那行只能当文本读。
- 仅 web / 桌面 profile；选区必须落在会话正文、文件预览、终端或 diff 里（输入框内的选区属于改稿，不触发）。
- 引用在输入框里显示为胶囊，编辑器中复制粘贴出去的是它的模型形态文本。
- transcript 胶囊是在 DSH 渲染结果之上做的覆盖层：它只隐藏原节点、不搬移 React 的节点，但若 DSH 改了消息的 DOM 结构
  （`[data-conversation-content]`、纯文本 run 的形态），需要跟着改 `isQuoteRun` / `capsuleFor`。
- 收起状态的胶囊是**单行**：很长或分段的引用与评论会被省略号截断 —— 鼠标悬停会浮出完整内容，也可以点一下直接在原地展开。
- 更新**之前**发出的老消息不会被变成胶囊：它们的文本里没有 `❝` 标记，插件无从辨认（重新引用一次即可）。
- **原文高亮用完整引用文本定位**：页面刚刷新、那颗胶囊还没渲染时，插件手里只有坐标表里的前 120 字身份键，长引用会先亮前 120 字；胶囊进入视口后补上全文并自动重画。行不在视口、被虚拟列表收起、或文字已经变了就不画，绝不改宿主 DOM。
- **评论框期间的原选区高亮依赖 `CSS.highlights`**：Chromium/Electron 支持；不支持时静默跳过，评论框里仍有引用正文，不影响引用本身。
- **聚合引用条的移除与编辑优先用宿主的 `consumeToken`**（实测 DSH 0.2.1-rc.2 的 conversation shell）：宿主把每个芯片投影成一条 occurrence（`offset`/`length`/`label`/`source`），`consumeToken({kind:"span", span:{start,end,draftRev}})` 在 `draftRev` 仍是当前版本时精确删掉这段区间；本插件据此计算 detect 区间（芯片在前面的 occurrence 会把坐标左移 `length - 1`）并带上紧跟的一个空格。宿主没有 `compose()`/`consumeToken`（旧版）或两条同标签芯片无法区分时，才退回「聚焦芯片 + 派发一次 Backspace」；两步都不成功时提示手动按一次退格，绝不做半删除的草稿。`✎` 编辑走同一条移除路径——旧芯片先让位，新芯片再原地插入。草稿芯片的索引存在本机（`dsh-client-ui-quote:v1:chip-index`），所以**刷新后**条、悬停卡与「打开文件」都还在——宿主本来就会恢复草稿里的芯片，索引跟着恢复，它们才重新算是本插件的引用。

- **回合级引用依赖宿主的回合尾槽位**：宿主把每条回合的尾部做成一个列表子槽位（`conversation.chat.turnTail`，`kind:"list"`、`scope:"session"`），本插件往里加一条。宿主没有这个槽位时按钮不出现——功能缺失，其它能力不受影响。
- **引用清单的本机索引只在本机**：它兜的是「上下文压缩把消息裁掉」这一种丢失，记录不进模型上下文、不跨设备、不跨浏览器；没读过的引用它当然也不知道。
- **侧边对话有两级后端**：优先 dsh-better-sidebar；未安装/禁用时降级为 `sessions.fork` + 宿主内置的 `dsh-resource://subagentchat/session/…` 页。fork 会复制主会话历史，并作为普通 fork 出现在会话列表；内置页的标题可能显示子会话 id（宿主读的是 subagent label，普通 fork 没有），但对话本身可用。未在侧聊里提问前执行「带回主会话」，可能取到复制过来的最后一轮，先在侧聊里问一句即可。两级都不可用时浮层里没有侧边对话那两行。

## 下一步

这一轮补掉了最后一个明确的代码缺口（宿主 `consumeToken` 精确删芯片）；剩下的是取舍与人工动作：

- **侧边对话的降级链**：已接通 `sessions.fork` + 内置 subagentchat 页；剩余的是 fork 在会话列表的可见性与内置页标题（宿主不把普通 fork 当 subagent），需要宿主提供隐藏/标签能力，或改走 subagent 后端。
- **Markdown 预览的行号**：要精修就得读源文件，而客户端必须声明 `remote` 才能拿到它；声明错会让 client bundle 在不匹配的宿主上**静默失效**（`dsh-quote-annotate` 上游就是这么死的）。所以先不声明——文件仍然打开，只是落在顶部而不是行上。
- **表格/列表/LaTeX 的结构保真**：链接与行内代码已做；表格要还原成 Markdown 表格，列表要还原成缩进，成本明显更高，留到有人真的需要时再做。
- **图片/截图引用**：明确不做（理由见「本插件不做的」）。真要做请独立成插件：图片引用要的是另一套胶囊/卡片/附件语义。
- **真机验证**：这一轮的宿主契约全部来自 `app.asar` 的一手文档，功能路径有 541 项离线断言；真浏览器（1600×2000 视口）同一套断言本轮复核 **51/51**。另外在**隔离的 DSH web 实例**（临时 `DSH_HOME`，端口 8790）里确认：插件进入 boot 列表、`window.__dshQuote` 可用、`conversation` / `inputTriggers` / `sidebarRight` / `sidebarRightTabs` 可见，`betterSidebar` 缺失而 `probe().nativeSideChat === true`——原生 fork 降级链的前置条件成立。欢迎页的交互点击被安全闸门拦下，因此下面五条仍需在真实窗口逐项点：聚合条编辑、回合尾的两个按钮、打开文件与行范围标记、另开侧边对话、JSON 导出。
- **市场收录与首屏**：README 已有截图、徽章、「30 秒上手」与 24 秒静态轮播 GIF；还差把插件提交到 dsh.market / dsh-plugin.org / dsh.pub / awesome-deepseek-harness —— 这些需要外部账号，是人工动作。

## 变更记录

见 [CHANGELOG.md](CHANGELOG.md)。

## License

[MIT](LICENSE)

---

### English

**dsh-client-ui-quote** — select any sentence in a DSH conversation and quote it into the composer, Kimi-Code style.
The floating bar opens **under** the selection (above it only when there is no room below) and offers **Comment**,
**Add to conversation**, and — the plugin's own addition — **Side chat**: the quote is written into the composer of one
independent side thread per main session — dsh-better-sidebar's side chat when installed, otherwise a fork of the source
session opened in the built-in subagent chat tab. Either way it inherits the main session's context and opens as a tab in
DSH's native right sidebar, drawn in DeepSeek's whale blue. Nothing is sent — the question that
thread answers stays yours to write, and clicking again appends the next quote to the same thread's draft. The quoted
text itself is editable in the comment box (trim the selection, correct a revision's wording), and a selection from the
file preview or the terminal travels to the model as a fenced code block. The quote — and the comment, kept together in the same
chip the way Kimi keeps both halves in one composer node — becomes DSH's native inline `reference-chip`, is serialized
back into a `> ❝ …` / `> ❞ …` blockquote when you send, and is then drawn as a single rounded **capsule** in the
transcript (`quote │ comment`, hover for the full text, click to expand, copy button), so a quote never floods the message with `>` lines —
the model still receives the full text. The same hover card opens over the composer chip, whose label has to be clipped,
and it closes with the chip as soon as the message is sent. Each chip resolves its own quote at hover time — React
reuses a chip node for the next quote, so a card can never show the previous one's text.
Screenshots: [floating bar](docs/screenshots/bar.png) · [comment box](docs/screenshots/comment.png) · [capsule hover card](docs/screenshots/card.png) · [quote list page](docs/screenshots/panel.png).
Install with `dsh plugin --profile desktop add dsh-client-ui-quote` (published on npm; DSH >= 0.2.0-rc.2, web/desktop client).
Test with `npm test`. MIT licensed.

Kimi Code is where the interaction started, not the whole comparison. As of 2026-10 the DSH market has at least a dozen quote/annotation plugins — `dsh-annotation`, `dsh-sidenote`, `CiteCiter`, `dsh-quote-annotate-pro`, `dsh-select-quote`, `dsh-selection-toolbar`, and others. The floating bar is table stakes; the differentiator here is what happens after the quote is sent: a source highlight and ordinal, jump-back, a searchable review list, side-thread bring-back, revisions, and per-quote reply badges. The draft's `引用 ×N` bar removes a quote through the host's `consumeToken` span CAS (exact occurrence coordinates, draft-revision guarded), falling back to the editor's own Backspace path on hosts without that face, with a manual-backspace hint if neither applies. A preview/diff quote's file now appears as a clickable `path#Lx-Ly` line in the hover card and the quote list; clicking it opens the right sidebar's document preview at the range's first line through `sidebarRight.openResource`, focusing an already-open tab instead of duplicating it. A selection inside one rendered chat code block is quoted as a fenced block carrying the renderer's language, and degrades to a plain blockquote when the selection crosses the block boundary. A quote that is still in the draft can be edited or removed from the aggregate bar, and the chip index is kept locally so a reload does not lose the bar, the hover card or the file it points at. A code quote shows its source (`文件预览 · src/app.ts · L12-L48`) and opens the sidebar's document preview at that line. Side chats are bound per quote — the overlay offers “Open another side chat”, and the quote list shows every thread of the session; without better-sidebar the same flow forks the session and opens the built-in subagent chat tab. The quote list exports Markdown and JSON, keeps a local index so a context compaction cannot empty it, and a small whitelisted set of switches plus a `window.__dshQuote` handle sits behind it all. The Chinese section above carries the current 2026-10 market comparison; this plugin is not a Kimi Code clone.

Two wire-only extras ride on the same pipeline: a per-quote reply toggle in the comment box (the block carries a
transport-only instruction, the model answers `「引用N」` by `「引用N」`, and each label becomes a badge that reopens
the quote's hover card), and a preview quote that puts its file into the fence's info string so the model can open
the file itself.
