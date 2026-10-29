# 自检

> 根 README 只留入口；这里放四套断言与真浏览器版本的细节。

```bash
node --check lib/client.js
npm test          # = node test/check.mjs && node test/capsule.mjs && node test/panel.mjs && node test/host.mjs
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
座位不在时用输入框自己的 `actions` 落芯片、无处可插时给 toast 而不是静默返回、effect 卸载/重装后监听恰好一份、
**放弃动作不留高亮**（浮层 `mousedown` 保住的选区在 `Esc` / 取消退场时被还回去））；
（共 493 项，含文件路径与逐条回应的线上形态、`parseCodeSource`/`fileAddressFor` 与「卡片/清单点击打开 session 文件并带上起始行」、**表格单元格 / 表格行 / 段落 / 列表项 / `<br>` 边界的引用高亮**、**侧聊坐标在发出前不着色、`promoteSource` 转正后才补画**、**草稿芯片删掉（没发送）后原文高亮与序号收回、芯片回来或胶囊出现才补画（已有胶囊/整个输入框离页不误收）**、**胶囊已在页面时迟到的转正会自愈、发送缝隙里的收回会让路**、**输入框已有文字时引用置顶并将原文另起一行**、聊天代码块划选的语言探测与跨界降级、选区的链接/行内代码保真与纯文本回退、回合级引用的取文与坐标、英文逐条指令与「Quote N」徽章、草稿芯片索引的跨刷新恢复与聚合条编辑/移除、回复徽章的建立/重建/卸载与悬停卡片复用、原生 `quote-sidechat` 页签的注册 / 地址 / 标题 / retain-release、页签注册后 hidden 线程开自营页、自营页固定聊天态（blank 子会话不画 hero、视图区带空态）、内置 subagentchat 的降级与复用，以及评论框两个输入区的自适应高度——引用正文那格曾经在被挂进栏之前就量高，读到 0 后被写成 `height:0`，首行因此被裁掉）。
`test/capsule.html` 是同一套断言的真浏览器版（51 项），用 `file://` 打开即可（页面会把结果写进标题与 `#probe-out`）。这一版修好了它**缺失的 `<body>` 标签**——脚本在 `<head>` 里执行时 `document.body` 为 null，这个页面以前在真浏览器里是直接坏的；并补上真 `Range` 的链接/行内代码断言（真浏览器的 `cloneContents()` 返回的是 DocumentFragment，不是元素——序列化器只认元素的话，链接在真浏览器里会退化成纯文本；离线桩现在也用真片段，不再放过这一类），另外补了 `CSS.highlights` 选区保持与关闭清理。

`test/panel.mjs` 单独跑引用清单页与侧边线程回流（163 项）：只认**持久**的 `user/message`（`transient`、助手消息、`data: null` 都跳过）、
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
超长截断并标注；`threadMarkdown` 的标题/编号/角色/时间与空线程兜底；`mainSessionForThread` 反向查本插件线程表、`sidechat-target` 与旧的 better-sidebar 表；
`readSessionMessages` 真读一遍且 release；`loadThreadSummary` 给出问题与条数、没有线程时 `threadId` 为 null；
`bringThreadBack` 把结论写成**草稿**（原有草稿保留、空行隔开）、外壳没有 `setDraft` 时如实失败、没有线程时不乱写；
`exportThread` 的文件名与整条线程内容、以及 MIME 是 Markdown。

`test/host.mjs` 不需要浏览器：它直接 import 宿主半，用桩 `agents` / `agentPresets` / `sessionTitle` / `webServer` 驱动。断言包括：`Side: ` 标签的前缀与截断；种子固定一个收口回合（`session/end-seed{inherited:true}` → `turn/start` → `step/start` → **空 `system/message` 头** → `source.kind="session-context"` 的 `user/message` → `step/end` → `turn/end` → `subagent/descriptor`）、`inheritedEventCount` 恒为 0、上下文字段只收用户与助手的原话（最新在后、8000 字上限、跳过 `runtime-context` 与工具事件）、空日志也有可读文案；descriptor 排在切点之后且 seq 连续；`agents.create` 收到 `origin: "subagent"` / `parentSession` / `isSeeded` / `inheritedEventCount` / 父会话当前模型路由 / preset setup / 清空继承 inbox / 固定标题；探针、409、503、403、405、404 与 `apply` 的注册/卸载全部有断言。

合计 **715 组**（check 12 + capsule 493 + panel 163 + host 47），`npm test` 全绿。
