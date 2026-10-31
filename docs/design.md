# 设计说明

> 从 [`README.md`](../README.md) 移出来的深度内容：为什么这么设计、和同类差在哪、清单与打包契约、文件结构、下一步。
> 面向改代码的人；功能表与已知限制仍在根 README。

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

- **内置隐藏线程（默认）**：本插件的宿主半注册 `POST /ui-quote/api/sidechat.start`（同源围栏 `connection.requestRejection`，探针返回可用性）。正式调用时从在线父会话取**最近几轮用户与助手的原话**（跳过工具事件与注入上下文，上限 8000 字），做成一条 `source.kind = "session-context"` 的 `user/message`，放进一个收口回合；回合的第一条是**空内容的 `system/message`**（受保护的系统头），上下文排在它后面——首个真实回合的 `system/message` 只有在这个头之后才合法，否则重载时报 `system/message requires a protected first surface head`、之后每次发送都 `subagent/not-resumable`（v4 的回合缺这个头，v5 没有回合，都栽在这里）。再用宿主 `agents.create` 建一个 **`origin: "subagent"`** 的子会话；descriptor 与会话标题都用 `Side: <引用首行>`。**不复制父会话日志**，所以侧聊里看不到主会话那一长串历史。会话列表隐藏它，页签用本插件自己的 `quote-sidechat` 页打开（`dsh-resource://quote-sidechat/session/<child>?parent=<sessionId>&mode=continuable`；页体渲染宿主的嵌入式 `conversation.content`），宿主缺页签注册能力时退回内置 `subagentchat` 页。自营页固定 `hero: false`；v6 种子带收口回合，子会话通常不是 `blank`；若宿主仍判 `blank`，`ConversationSession` 返回 null（视图区没有 DOM），视图槽里的空态块负责撑住布局、把输入条留在页底，引用以**原生芯片**写进它的草稿（宿主没有芯片面时退回块引用），不写任何可见的边界文案——「只作背景、别继续执行」的指令在隐性上下文里。
- **父会话在线时可继续**：隐藏线程是 `continuable` 子会话，父会话在线时自营页自己的输入框、流式输出与工具调用都能用；自营页固定 `hero: false`（宿主 `ConversationContent` 在 hero 为真时只画欢迎页与禁用输入条），phase 走 `settling → active`；v6 种子带收口回合，子会话直接是聊天页，宿主仍判 `blank` 时空态兜底；父会话关闭后是否可写由宿主对 `continuable` 子会话的规则决定（通常只读），重新打开父会话即可继续。这个限制来自宿主对子会话的规则，不是本插件的额外依赖。
- **子 agent 创建后立即释放**：宿主的子代理 resume（打开页签时的历史加载、内置页的发送）要从磁盘冷开子会话，活句柄会让它失败并报 `subagent/not-resumable`——真机里 v6 种子建出的子会话本身已通过存储校验器，仍因活句柄在历史加载时被拒。现在创建完、定完标题就 `dispose`，只把会话留在磁盘上；自营页的发送走标准会话路径，同样从磁盘打开这份合法的日志。
- **共享 `Side:` 约定**：与 dsh-better-sidebar 的侧聊线程使用同一套持久约定（`origin: "subagent"` + `Side: ` 标题）。装不装 better-sidebar 都不冲突：它的自动打开会忽略这类标题；它的侧聊列表也会列出我们的线程，我们的引用清单也会扫到它的 `Side:` 线程。路由、存储键与 descriptor provider（`ui-quote`）全部独立。
- **回退链**：宿主半不可用（旧宿主、`agents.create` 失败、父会话不在线）→ `sessions.fork` + 本插件 `quote-sidechat` 页签（线程以普通 fork 出现在会话列表）→ better-sidebar（仅显式 `sideChatBackend: "better"` 或最后兜底）→ 无。所有后端都只写草稿、不发送。
- **写进输入框**：页签打开后，`ctx.get("conversation").input.shell(childId)` 拿到子会话的输入框外壳（`SessionInputShell`），走与主输入框同一条 `prefillQuoteDraft`：外壳有 `insertReference` 时写**原生引用芯片**（芯片的 `ref` 里带那条引用的线格式，发送时由 `codec.serialize` 还原，和主会话完全同形），没有芯片面时退回**纯块引用**（`>` 逐行前缀，不带 `❝` 标记——那两个标记是主会话胶囊增强器的识别符，侧边线程用不上）。输入框里已经有你写的内容时，引用接在下面、空行隔开；**不发送，也不碰别的东西**。子会话的输入框要等页签挂载后才存在（`shell(id)` 在此之前会抛「resolved no binding」），所以这里按 200ms 轮询等它出现；外壳在而 `setDraft` / `insertReference` 都不在（版本对不上）则立刻放弃，不空等 5 秒。
- **没发出去的引用不落到原文上**：第三项会为这条引用预先算好坐标（跳回与悬停卡片都要它），但坐标以 `draft` 记在表里，`paintAnchors` 跳过它——原文上**不会**出现高亮与序号徽标。读者把侧边对话关掉、或者根本不发送，主会话的文面上干干净净；只有这句引用真的以胶囊形态出现在某条 transcript 里（`capsuleFor` 认到同一个 ref），`promoteSource` 才把它转正并立刻补画标记。
- **回复结束即收回**：引用作为胶囊发出去后，回合尾的 `data-dshq-turn` 是完成信号；`paintAnchors` 把该回合胶囊对应的 source 标成 `spent`，坐标保留（跳回/卡片/清单照常），高亮与序号不再绘制。`keepHighlight: true` 可保留常亮。
- **放弃动作要把选区还回去**：浮层自己的 `mousedown` 调了 `preventDefault()`（否则点行的一瞬间选区就没了），所以它必须自己收尾——`close()` 见到 `state.keptSelection` 就 `removeAllRanges()`，取消 / `Esc` / 点别处都不会留下一块再也点不掉的高亮。
- **一条主会话一条线程**：线程 id 按主会话记住，优先读本插件自己的 `dsh-client-ui-quote:v1:sidechat-thread`；隐藏线程的父会话记在 `dsh-client-ui-quote:v1:sidechat-target`。旧版 better-sidebar 的 `dsh-sidebar:v1:sidechat-thread` 只作为旧线程迁移的只读回退，不再优先于我们自己的记忆。第二次点第三项不再新建线程，只把新引用接进同一条线程的输入框。
- **防重复**：同一会话的请求还在途中时，再次点击直接并入第一次（模块级 `Map<sessionId, Promise>` 记账，结算后自行清除）。
- **失败路径**：隐藏线程创建被拒（父会话不在线 / 宿主服务缺失）→ 自动退回 `sessions.fork`，不重复建线程；`sessions.fork` 拒绝、或页签两种地址都打不开 → toast「侧边对话没有打开，请重试。」；线程已开、草稿没能写进去 → toast「侧边对话已打开，但引用没能写进它的输入框」。

### 引用清单（右侧栏页面）

引用清单是这套能力里唯一**把引用当对象**的地方：它把一条会话发出去的引用与评论列成一张可搜索、可跳转、可导出的表。

- **数据来自会话自己的事件日志**，不是屏幕上的 DOM：`ctx.sessions.retain(sessionId, { source: "quoteList" })` → `await reference.ready` → `reference.binding.session` → `session.eventSource.getSnapshot().entries`，筛 `event.type === "user/message"`，取 `event.data.content` 里的文本块（注意 `user/message` 的记录就在 `event.data` 上，不是 `event.data.message`），再用 transcript 侧同一个 `splitQuoteRuns` 把 `> ❝ …` 块拆出来。读完立刻 `reference.release()`——保留一个永不放手的引用会把会话钉在内存里。因为读的是日志而不是 DOM，**屏幕上没有那条消息也照样列得出来**。
- **历史是分页的**：首屏只带最近若干条消息，`session.getSnapshot().hasMore` 为真时列表上方出现 `加载更早的消息`，点它调 `session.loadOlder()` 再重读一遍。
- **跳回原文**复用悬停卡片那一套（同一个 `jumpToSource`）：只有当初被本插件看着选中的引用才有坐标，所以只有那些行可点（`data-dshq-row="jumpable"`），其余行只是可读的文本。
- **导出**走浏览器：`URL.createObjectURL(new Blob([md], { type: "text/markdown;charset=utf-8" }))` + 一个带 `download` 的 `<a>`——宿主没有给客户端插件任何写盘的接口，这是 DSH 里现成的做法（`dsh-session-log-export` 的客户端半边就是这么下载的）。没有 `Blob` 时退回 `data:` URL。
- **注册形状**（两侧都必须声明，id 是同一个）：`ctx.sidebarRightTabs.register({ id: "dsh-client-ui-quote/list", kind: "quote-list", title, guide: [{ id: "quotes", commandId: "ui-quote.list", order: 20, title, description }] })` 声明**页面类型**（页面类型不写 `patterns`，按 kind 打开），`ctx.slots.register({ name: "sidebar.right.pane.tab", key: "dsh-client-ui-quote/list" }, Body)` 提供**页体**，标题座位 `sidebar.right.pane.tab.title`（同一个 key）提供页签文字。`guide` 数组是发现入口：右侧栏默认页就是指南页，里面每个 `guide` 条目一个胶囊，点开即 `openTab(kind)`。打开动作是 `ctx.get("sidebarRight").openTab("quote-list")`，`Alt+L` 与指南胶囊都走它。
- **页体拿到的 props**：座位注入的 `inject: (sessionId) => ({ sessionId, load, loadOlder, jump, save, loadThread, back, exportThread })`，页体本身只负责渲染——解析、过滤、Markdown、单行标签都是可离线断言的纯函数。
- **侧边线程回流**（页面底部那一节）：**侧边对话是独立会话，记忆不与主会话互通**——种子里的快照只是创建时的一次性上下文，之后主会话的新消息不会同步进去，侧聊的新消息也不会自动回流；要回流只有这里的 `带回主会话`（写草稿、不发送）或 `导出 Markdown`。线程 id 从本插件自己的线程记忆与 `sidechat-target` 表反向查出主会话，再用会话列表里的 `Side:` 子会话补扫；旧版 better-sidebar 的 `dsh-sidebar:v1:sidechat-thread` 只作为迁移回退。线程内容用同一个 `withSession` 读取（隐藏线程用 subagent 地址 `{parentSessionId, childSessionId, mode:"continuable"}`，fork 用 session id；`retain` → `ready` → `binding.session.eventSource` → `release`）。`带回主会话` 取线程**最后一条提问**与它之后的**最后一条回答**（提问以 `>` 块引用形式带上，超过 4000 字截断并标注），写进主会话的草稿——用的是第三项那条链路同一个 `prefillDraft`，所以也是「**写草稿、不发送**」，草稿里原有内容保留、回流内容空行接在下面。`导出 Markdown` 把整条线程每条消息按顺序落成文件。

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
| `dsh-sidenote`（3752/月） | 原生侧栏 + 多侧聊 + 划选注释 + 结论回流/存为正式会话 | 已做线程清单与「带回主会话」；默认就是内置隐藏线程（宿主半 + 自营 quote-sidechat 页 + 隐性上下文），fork 是退路 |
| `@kirkchinese/dsh-citeciter`（2028/月） | 每次划选一个持久只读 Topic + 草稿自动保存/多窗口合并 | 不做完整 Topic 系统；「新开线程」与草稿持久化已补 |
| `dsh-quote-annotate-pro`（2126/月） | 发送后引用块常显 3 行 + 自动编号 + 回合尾引用 | 坚持胶囊+悬停卡；回合尾引用已补，常显块不做默认 |
| `dsh-select-quote`（1212/月） | 待发批注按会话持久化，逐条编辑/删除/清空 | 聚合条已支持逐条编辑/移除、完整无障碍名与跨刷新恢复；删除优先用宿主 `consumeToken` 精确区间 |
| `dsh-selection-toolbar`（GitHub 安装） | 文本+图片、截图/详情、fork 侧聊 | 文本引用为主；图片/截图是明确空白，生态已有独立插件，不并入 |
| `@u2a5f/dsh-selection-annotations`（上轮 391/月） | 独立 JSON 块 + charStart/End + 读源精确定位 | 保留内联线格式；JSON 导出与源文件定位已补，不改成额外消息 |
| `dsh-quote-followup`（2088/月） | 原生 chip 只存文本+轮次，compaction 后仍有效 | chip 同样自包含；本机索引已补，清单不再只依赖事件日志 |

**2026-10-20 复扫补记**（同一份 6,084 条市场快照，补读上轮未收录的 11 款）：

- `dsh-sidecard-ask`（3,217/月，10-10 上架）：把「划词 → 独立子代理作答 → 侧边卡片」做成完整承载链（better-sidebar → 原生右栏/内置浮层兜底），说明侧边问答已是独立赛道；我们的侧边对话仍是引用附属，不扩成通用问答。
- `dsh-side-chat-plus`（1,920/月）与 `dsh-sidenote` 0.6：都把侧聊放进原生右栏；我们的「一条主会话一条线程 + 隐性上下文」仍是差异化，默认已改成宿主半创建的隐藏子会话 + 自营 `quote-sidechat` 页（fork 与 better-sidebar 都是退路/增强）。
- `dsh-quote-reply`（GitHub 安装）：把引用放到输入框上方的独立层，经 `systemPrompt.context` 注入、回合尾显示「引用(N)」；我们坚持把坐标写进消息文本，换取导出/审阅/跨刷新，不改架构。
- `dsh-selection-quote`（594/月）与 `dsh-xwide-annotation`（1,148/月）：分别补了右键菜单/持续选区高亮与每条颜色/大纲；我们的清单已是大纲，颜色不是主线，右键菜单也不比现有浮层快。
- `dsh-code-quote`（776/月，粘贴 `路径:行` + 代码 → chip + pre-step 快照）与 `dsh-quote-to-agent`（引用分派子代理）是相邻赛道，不并入；`dsh-web-annotator`/`dsh-image-annotate` 进一步证明图片/网页批注应独立成插件。
- 本轮唯一落到代码的修正是：宿主其实有 `consumeToken`（`app.asar` 的 conversation shell），已用它替换「聚焦 + 合成 Backspace」；详见「已知限制」。

同一份快照里几个仍然很窄的格子：

- **「引用 + 评论合成单一可交互胶囊」**：仍是本插件独有；`dsh-annotation` 证明「选中→批注→逐条回应」有需求，差异在我们的**胶囊 + 清单 + 线程**组合，而不是单点机制。
- **待发引用管理**：`dsh-select-quote` 的按会话持久化、逐条编辑/删除/清空是这一格的老大；本插件现在补齐了**逐条编辑**（`✎` 回填原引用与评论，旧芯片让位、新芯片原地插入）与**跨刷新恢复**（芯片索引落本机，宿主恢复草稿芯片后它们重新算是我们的引用），我们不提供「一键清空全部」——按条删除更不容易误伤，删除与编辑都在草稿上方的聚合条里做。
- **代码引用回跳**：`@u2a5f` 已经读源文件算精确行号，`dsh-annotation` 能对文件预览批注并恢复；我们的卡片/清单现在显示 `文件预览 · path#Lx-Ly` 并能打开预览定位起始行、标出被引的行，还差 Markdown 预览的读源行号（要声明 `remote`，风险大于收益，先不做）。
- **多侧线程/原生侧栏**：`dsh-sidenote`/`CiteCiter` 已把多 Topic、草稿保存做完整；我们现在是**一条主会话一条线程**（清单页列出全部线程），默认后端是**宿主半创建的隐藏子会话**（`origin: "subagent"` + 自营 `quote-sidechat` 页，不出现在会话列表），fork 与 better-sidebar 是退路/增强。
- **图片/截图**：`dsh-selection-toolbar` 与 Kimi 桌面端已经支持；我们仍是纯文本引用。
- **「原地编辑已发送的批注」**：DSH 仍没有编辑已发送消息的 API（侦察确认 `editMessage`/`updateMessage`/`rewriteMessage` 全树 0 命中），本插件走**追加式修订**；`dsh-plugin-message-edit` 走的是另一条路（原地保存 + 分支重生成 + 版本时间线），两条路线不冲突。

本插件相对同类的**可验证**优势集中在四件事上（语义节点、带坐标的活对象、引用的下落、工程化），根 README 的「[为什么是这一个](../README.md#为什么是这一个)」保留了这份清单与断言数；这里不重复，接着看取舍。

反过来也要说清楚：**本插件不做的**——不做翻译/解释/改写/飞书投递类选区动作；不做图片/截图引用（**明确取舍**：图片引用要的是另一套胶囊/卡片/附件语义，是第二个产品的量级，塞进这里只会把「文本引用带坐标」这条主线冲淡；`dsh-selection-toolbar` 与 Kimi 桌面端已经做了，真要做建议独立成插件）；不做完整 Topic 系统；不做常显大块引用。它只把「引用」这一件事做穿——但「做穿」包括发送后的管理、来源闭环和审阅，不只是浮层。

**分发是另一块短板**：同类头部（`dsh-annotation`、`dsh-sidenote`、`CiteCiter`）都是短卖点 + GIF + 多市场收录；功能强度不等于装机量。根 README 已按落地页收敛（截图、徽章、「30 秒上手」与 24 秒静态轮播 GIF），多市场提交的文案、标签与检查表在 [`docs/distribution.md`](distribution.md)，实际投稿仍需仓库所有者账号。

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
| `engines.dsh`（清单根） | 声明兼容的 DSH 版本范围。DSH 加载前的兼容性检查读取它：范围不满足时该行在组合期被 `disabled`（`dsh plugin allow-version` 或插件页豁免可放行）；有它时 dsh peers 不再参与判断。本插件是 `>=0.2.0-rc.2`（只有下限、没有上限），0.2.1-rc.5 判定通过。 |
| `dsh.manifestVersion: 1` | 清单格式号，同样只作文档。 |
| `peerDependencies` | **故意留空**：只有在清单没有 `engines.dsh` 时，DSH 才逐个校验 `@deepseek-ai/dsh` / `@deepseek-ai/dsh-*` peer；范围不满足时该行同样在组合期被 `disabled`（需要 `dsh plugin allow-version` 或 profile 的 `compatibility.json` 豁免）。本插件用根级 `engines.dsh` 声明，只 require 平台基线模块 `react`，不需要 peer。 |

`npm test` 会逐条复核上面这些：补丁文件、三个导出、图标类型与体积、中英词条、以及「没有 peerDependencies」。

## 结构

```
package.json          DSH 插件清单（bundle patch + client 半 + icon + locale 导出）
icon.svg              插件页卡片图标（相对路径、≤ 256 KiB 的 SVG）
cordis.patch.yml      组合包层补丁：插入 ui-quote 这个 loader 条目
lib/index.js          host 半：只提供隐藏侧聊线程的创建路由（/ui-quote/api/sidechat.start）
lib/client.js         客户端全部功能：vendor-CJS 工厂 + 浮层（三项动作）+ 输入框芯片 + 发送后胶囊 + 原文高亮/聚合条 + 侧边对话接线 + 引用清单页（含多选插入）
.github/workflows/test.yml  push / PR 的 Node 18/20/22 测试门
skills/release/SKILL.md    推送与发版清单（推 main / 标签发版 / promote.ps1 -Tag / Release 验收）
locale/zh.json        插件页卡片文案（中文）
locale/en.json        插件页卡片文案（英文）
test/check.mjs        离线自检（清单 + 组件契约）
test/dom.mjs          给离线自检用的最小 DOM / MutationObserver 垫片
test/capsule.mjs      离线自检（发送后胶囊 + 悬停卡片 + 跳回原文 + 键位 + 改这条引用 + 代码引用 + 文件路径打开 + 聊天代码块划选 + 选区保结构 + 回合级引用 + 逐条回应双语 + 草稿引用编辑/持久化 + 聚合条移除/无障碍/移除后原文标记收回 + 行范围标记 + 浮层不随座位失效，493 项断言）
test/panel.mjs        离线自检（引用清单：解析 / 搜索 / Markdown / 读取 / 导出 / 页面注册 + 文件路径打开 + 侧边线程回流 + 审阅工作台（状态 / 标签 / 批量）+ JSON 导出 + 本地索引 + 底部 Star 链接，163 项断言）
test/host.mjs         离线自检（宿主半：标签 / 隐性上下文种子（切点 + 收口回合：空 system 头 → 上下文消息 → descriptor；只带用户与助手的原话、8000 字上限、跳过注入上下文）/ 空日志兜底 / 继承切点与 descriptor 顺序 / agents.create 参数 / 探针 / 围栏 / 路由注册与卸载，47 项断言）
test/capsule.html     真浏览器里跑同一套胶囊断言（51 项，可选）
```

客户端功能完全在浏览器侧：`lib/client.js` 用 `window.__ModuleLoader__.load({ id, factory })` 注册，只 `require("react")`
（平台基线模块），不依赖 react-dom、CSS 文件或 host 半参与序列化；浮层样式是运行时注入的内联 `<style>`，
胶囊样式是 `<style data-plugin="dsh-client-ui-quote">`。`lib/index.js` 是唯一的宿主半边，只注册隐藏侧聊线程的创建路由与种子，
不参与浮层/胶囊/线格式；它只 import Node 内置模块，运行时全部通过 `ctx.get` 取宿主服务，没有 npm 依赖。

## 下一步

这一轮补掉了最后一个明确的代码缺口（宿主 `consumeToken` 精确删芯片）；剩下的是取舍与人工动作：

- **侧边对话的冷启动续聊**：内置隐藏线程已经解决「不装 better-sidebar 也能把线程藏出会话列表」；剩余的是父会话关闭后的继续提问——宿主渲染的会话页在父会话离线时只读，要完全对齐 better-sidebar 需要再搬一套 `agents.resume` / prompt 路由与自己的输入框，属于下一阶段。
- **Markdown 预览的行号**：要精修就得读源文件，而客户端必须声明 `remote` 才能拿到它；声明错会让 client bundle 在不匹配的宿主上**静默失效**（`dsh-quote-annotate` 上游就是这么死的）。所以先不声明——文件仍然打开，只是落在顶部而不是行上。
- **表格/列表/LaTeX 的结构保真**：链接与行内代码已做；表格要还原成 Markdown 表格，列表要还原成缩进，成本明显更高，留到有人真的需要时再做。
- **图片/截图引用**：明确不做（理由见「本插件不做的」）。真要做请独立成插件：图片引用要的是另一套胶囊/卡片/附件语义。
- **真机验证**：这一轮的宿主契约全部来自 `app.asar` 的一手文档，功能路径有 733 项离线断言；隐藏线程的 `agents.create` / 种子格式已在**隔离的 DSH web 实例**（临时 `DSH_HOME`，端口 8791，CLI 0.2.1-rc.3）里确认：宿主半通过 `ctx.inject(["webServer"])` 晚到注册，`POST /ui-quote/api/sidechat.start` 的探针返回 `{"ok":true,"value":{"available":true,"version":1}}`，说明 `agents` 服务与同源围栏都就绪。本轮又在**运行中的桌面端**（link 模式，重启后加载 `lib/index.js`）核对过一次：`/ui-quote/api/*` 下任意路径都先被围栏拦成 `403 {"code":"forbidden"}`，而同样方法打一个不存在的顶层路径是 `404`，说明前缀路由确实挂上了、并且先过围栏。真机证据把 v5 种子的缺陷钉死了：隐藏子会话（v5，无回合）在真实窗口里跑完了一个回合（6 条助手消息、工具调用、`turn/end` completed），但**第二次发送**时存储层重载日志，报 `stored log corrupt: SessionFormatError: system/message requires a protected first surface head`，客户端收到 `subagent/not-resumable`。原因是会话存储把**第一个 surface 节点**当作受保护的系统头，而 v5 种子的首个 surface 节点是上下文 `user/message`。v6 种子（收口回合，第一条是空 `system/message` 头）已用宿主的 `assertReleasedV4Relationships` 与真 `Session` 构造器验证 **10/10**（含首个回合 append / replace 两种写法）；持久化 worker 的真实读取路径（`verifyJsonlCurrentGeneration`，就是报这条错的那个校验器）也接受了 v6 种子、v6 + 首回合、v6 + 两个回合（第二次发送的场景），并用这条真实 v5 日志复现了原来的 `system/message requires a protected first surface head` 拒绝。随后真机用 v6 种子建出的子会话（12:00）被存储校验器接受，但打开页签时的历史加载仍报 `subagent/not-resumable`——子 agent 当时还被保活，活句柄挡住了宿主的子代理 resume。改为创建后立即释放后，冷开路径合法。**2026-10-29 已在真实桌面窗口复核**：同一条隐藏线程（v6 种子）连发两条，存储层未再报格式错误，`turn 2` 与 `turn 3` 都是 `completed` 且各写入一条 `request/header`；页签由自营 `quote-sidechat` 渲染，输入框可写、引用草稿可落。冷启动（重启后再发）同样按这条路径走，尚无独立复测项。真浏览器（1600×2000 视口）同一套断言本轮复核 **51/51**。欢迎页的交互点击被安全闸门拦下，因此下面四条仍需在真实窗口逐项点：聚合条编辑、回合尾的两个按钮、打开文件与行范围标记、JSON 导出。
- **市场收录与首屏**：README 已有截图、徽章、「30 秒上手」与 24 秒静态轮播 GIF；还差把插件提交到 dsh.market / dsh-plugin.org / dsh.pub / awesome-deepseek-harness —— 这些需要外部账号，是人工动作。
