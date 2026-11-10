# Changelog

## Unreleased

_（下一轮）_

## 0.14.4 — 2026-11-10

### Changed

- **解析层合一**：两个引用解析器（`splitQuoteRuns` / `splitDecodedQuote`）各写一遍的「剥代码围栏」收成 `unfenceQuote`，「用 ``` 还是 ~~~」收成 `fenceFor`（写侧、两个 Markdown 导出、侧聊问题共用），行尾归一化收成 `withLf`（**只用于解析侧**；写入侧 `blockLines` 仍按 `\r?\n` 切行，裸 `\r` 不变成新的一行）。
- **样式表安装合一**：`ensureStyle` / `ensureCapsuleStyle` / `installPanelStyle` / `installSideChatStyle` 四份「查 id → 建 style → 挂 head → 返回拆卸器」合成 `ensureStyleNode` / `installStyleNode`。
- **浮动节点挂载点合一**：六处 `body ?? documentElement` 判断收成 `hostRootOf`——其中 `ensureBar` / `toast` 原本根本没有兜底。
- **评论框状态装配合一**：`openCommentFor` / `startRevision` / `startDraftEdit` 三份逐字相同的状态赋值收成 `beginCommentBox`。
- **侧聊去重合一**：三个后端各写一遍的「同会话只跑一次」收成 `oncePerSession`；`inputShell` 与 `inputShellFor` 两份近似实现合成一份（前者少了 `input.for(scope)` 退路）。
- **小件**：`quoteMetaShown`（清单页对快照的纯查询）、`draftSnapshot` / `draftOccurrences`（草稿快照与 occurrence 校验各写两遍）、`legacyCandidateOf`（v1 坐标读两遍）、`anchorRectMark`、`disposeAll`、`quoteTabService` 走 `serviceOf`、`sideChatTitle` 复用 `firstLineOf` 但先经 `blockLines` 去首尾空行、`tryBetter`（侧聊的 better 回退两次查找）与清单两个导出按钮共用 `exportName` / `exportButton`；顺手修掉 `state` 对象的错位缩进、列 0 的注释与重复 JSDoc。两个入口文件现在没有重复的 5 行代码块。

### Added

- **「让模型逐条回应」的勾选会记住**：之前每次打开评论框都回到 `replyByDefault`；现在勾选/取消会写回配置，下一次引用、改引用、编辑引用都沿用上一次的选择，刷新后仍保留。新增 2 组断言。

### Fixed

- **英文 / 俄文界面下「插入失败」提示仍是中文**：`commit()` 先 `close()`（它把 `state.sessionId` 清空）再 `toast(translate("failed"))`，模块级翻译器只能回落中文。现在按进入时的 session 翻译。
- **带 CRLF 的消息解析出多余 `\r`**：`splitQuoteRuns` 只按 `\n` 切行，Windows 粘贴或宿主原样存储的 `\r\n` 会把 `\r` 留在引用正文里——胶囊显示它、Markdown 导出带着它，`rangeForQuote` 拿去原文里找永远对不上，原文高亮与跳回因此静默失效。现在两个解析器共用 `withLf` 归一化（旧消息只含 `\n`，解析结果不变）。新增 2 组断言。
- **`highlight: false` 时仍然画原文标记**：开关只在「没有任何文件行范围」时整块退出；读者打开过引用所在的文件（`openedRange` 非空）之后，关掉开关照样落矩形，读起来像「这个开关没用」。现在开关关闭即清空叠加层。新增 2 组断言。
- **升级后清单里的「已解决」显示成未解决**：清单页从 store 快照渲染，只按 `ref+原文` 键查；0.14.x 写的 `ref:` 旧键要等读者手动切一次状态才迁移。现在渲染路径也读旧键。新增 2 组断言。
- **毫秒时间戳的引用在 JSON 导出里丢时间**：`quoteListJson` 只收字符串时间，宿主种子用的 epoch 毫秒被写成空串。现在统一成 ISO。新增 1 组断言。
- **内置侧聊的「15 秒后重试」从未生效**：`openSideChat` 拿缓存的 `builtinSideChatState !== "unavailable"` 当闸门，首次探针失败后整页都不再尝试，`SIDECHAT_RETRY_MS` 那条重试路径不可达。现在过期状态会重新探一次；浮层门控 `sideChatBackend()` 与 `openSideChat` 共用 `builtinRetryOpen()`，且只在 native / better 都缺失时才放行，不抢既有的 native 回退。
- **多选插入读取草稿快照没有兜底**：`insertQuoteRows` 直接 `shell.state.getSnapshot()`，宿主在点击与读取之间拆掉会话作用域就整段抛出。现在与 `insertChip` 共用 `draftSnapshot`。
- **宿主半：一次注册失败就永久放弃路由**：`installed` 在 `webServer.register` 之前置位，注册抛错后再注入也不会重试。现在只有真正注册成功才算装上。
- **宿主半：请求体超限后仍可能被当成正常读取**：`readJsonBody` 在 reject 之后还会响应后续 `end` / `error`，超限请求可能继续入队。现在一次请求只结算一次。
- **宿主半：`requestRejection` 返回 `null` 被当成拒绝**：围栏的「放行」既有 `undefined` 也可能是 `null`，后者会让整条路由恒 403。现在两者都算放行。

- **连续引用多个片段时，草稿里的引用顺序倒置**：每次插入都落到草稿最上方（`start: 0`），同一轮的三段引用会变成 3-2-1；现在先从 shell 的 `occurrences` 算出最后一颗引用芯片之后的 detect 坐标（`quoteAppendOffset`），新引用接在它后面，插入后光标回到末尾，下一次继续往后接。新增 1 组断言；多选批量插入也按选择顺序。
- **引用清单把同一条消息里的多个引用块也倒序了**：`quoteRowsFromEntries` 原来直接 `rows.reverse()`，消息之间「新的在上」是对的，但同一条消息里的多个 `> ❝ …` 块也被一起倒过来；现在按消息分组后再倒序，消息内部保持原文顺序。新增 1 组断言。
- **回合尾引用把 process 组里的子行当成回答读进来**：宿主把工具/推理步骤包在 `data-step-process` 组里，组本身会被跳过，但组内子行也带 `data-chat-turn`；现在 `turnTextAt` 跳过任何位于 process 组内的行。新增 1 组断言。
- **回复徽章会切用户自己写的「引用N」**（R3）：徽章扫描原本只看文本形状，用户消息后若有引用胶囊，用户自己写的「引用1」也会被拆成可跳转徽章。现在先按行的 role / flow kind 排除读者文字，只切助手回复；徽章点击也带上自己的 ref，同一句两次引用不再落到第一处。新增 1 组断言。
- **输入框里只有一颗芯片时，编辑器被当成芯片**：`wireChips` 用 `textContent` 认芯片，空草稿只剩一颗芯片时编辑器文本与标签相同，整块编辑器被挂上悬停卡片、聚合条还会显示 ×2。现在跳过包含编辑器 / 可编辑区的祖先节点。新增 1 组断言。
- **俄语界面下逐条回应指令漏进胶囊**：剥离规则只认「指令 / Instruction」，俄语 `Инструкция:` 留在引用或评论里。现在三处共用一条可扩展规则；中英文旧消息的解析保持不变。新增 1 组断言。
- **超长引用被截断后丢失原文坐标**：`commit` 用截断后的文本写 source 表，`maxQuoteChars` 较小时高亮与跳回失效；现在坐标仍按完整选区保存，发送内容照旧截断。同时补上 chip 的 `origin` 传递与坐标表 `origin` 的落库回读，刷新后来源类型不再丢。新增 2 组断言。**复查补充**：完整选区作键会让「消息文本里没有 `│q1:`（被剥离、跨窗口、损坏）」时的无-ref 查表找不到坐标，现在同一条 source 表项额外记 `sentQuote`（发送措辞的键），`sourceFor` / `sourceCandidatesFor` / `clearSpentSources` 同时匹配两种措辞。
- **审阅状态只按 ref 归并**：同一条消息里的不同句子共用坐标，标记一句会把另一句也标成已解决。现在归一键是 `ref + 原文`，旧 `ref:` 键在首次读取时迁移，不丢已存状态。新增 1 组断言。
- **注入的会话上下文被当成线程消息**：隐藏线程种子的 `session-context` user/message 会出现在线程问题、带回与导出里。现在只接受显式 `source.kind="user"` 的 user/message（无 source 的旧日志照常）。新增 1 组断言。
- **JSON 导出被标成 Markdown**：`.json` 下载现在使用 `application/json;charset=utf-8`；同时移除 Blob 不可用时拼接 `data:` 大文件的兜底（R11），只走 Blob URL。新增 1 组断言。
- **清单行身份与本地索引**：行键包含完整 ref、原文与评论，长前缀相同的两条引用不再合并；本机索引按 seq 保留较新条目，并让最近使用的会话排到 LRU 尾部。新增 1 组断言。
- **兼容性与生命周期细节**：事件时间同时接受 ISO 字符串与毫秒时间戳；`closestAny` 取最近祖先而不是按选择器顺序；预览选区选择器改为数组，避免离线 DOM 不支持逗号选择器；芯片删除的 Backspace 只投到同一张 composer 卡片；剪贴板 `writeText` 的异步拒绝不再成为 unhandled rejection；卸载时清掉 toast 计时器。新增 1 组断言。
- **删除死代码 / 死配置**：`sideChatBoundary`、`prefillDraft` 的 boundary 分支、`textPointAt`、未使用的 `state.style/toast`、重复的 JSDoc 与不可达的 `mark === -1` 分支；`ensureSource` 统一走 `serviceOf`。

- **用多个对话/多个页签后，切回之前对话的原文高亮与序号可能不再出现**：`paintAnchors` 会跳过宿主当前看不见的转写（隐藏页签、收起的右侧栏），这是正确的；但重新显示页签只是 `hidden` / `aria-hidden` 属性变化，不是 childList 变更，旧代码因此不会重新调度绘制，原句上的高亮与序号要等下一次滚动或消息变更才回来。现在新增一个专门的可见性观察器，只在 `hidden` / `aria-hidden` 变化且目标包含会话转写时触发一次锚点重画；被遮住的页签也会在收起时立刻撤掉浮层上的序号，不再留在另一个对话上。`test/dom.mjs` 的 MutationObserver 垫片同步支持属性记录与 `attributeFilter`。新增 3 组断言：「可见时画出高亮与序号」「隐藏后撤回」「再显示时无需滚动即补画」。
- **同一行里的多条草稿引用互相顶掉高亮**：从同一条消息里先后选三句加进草稿，三句共用同一个 `│q1:` 坐标（`n` 只区分同一句的第几次出现，每句都是 1），而完整原文的缓存只按 ref 作键——记住第三句时把前两句的完整原文覆盖掉，下一次重画就让三句都用第三句去 `rangeForQuote`，前两句的高亮与序号因此提前消失（消息还没发出去）。现在完整原文按「ref + 这句原文」缓存，并同时兼容 chip 的 plain 形态与消息的 wire 形态；`quoteTextFor` 仍保留只给 ref 的旧读法。新增 1 组断言：「同一行的三句草稿引用保持三个不同的高亮区间」。

### 复查补充（提交前一轮独立复查）

- **前导空行让侧聊线程标题变空**：`sideChatTitle` 合并进 `firstLineOf` 后只取 `split("\n")[0]`，丢了 `blockLines` 剥首尾空行的能力；代码块 / 预览 / diff 选区常以空行开头，三个后端（fork 的 `sessions.rename` 且空标题被记住、隐藏线程种子、better 的 `Side: ` 标签）都会拿到空标题。现在先经 `blockLines` 再截断。新增 1 组断言。
- **截断引用在 wire ref 缺失时坐标查表失效**：见上条「超长引用」的复查补充。新增 1 组断言（用解析出的截断 `quote`、无 ref 查 `sourceFor` / `sourceCandidatesFor`）。
- **宿主半三处修复缺回归网**：`test/host.mjs` 补 3 组断言——围栏返回 `null` 应放行、超限请求体只结算一次（413）、注册抛错后同页再次注入能重试成功。
- **侧聊重探对浮层入口仍不可达**：见上条「15 秒后重试」的复查补充。新增 1 组断言（临时禁用 `sessions.fork` 构造无其它后端，断言浮层行可见且 `builtinRetryOpen()` 为真）。
- **裸 `\r` 归一化改变了写入侧**：`blockLines` 恢复 `split(/\r?\n/)`，`withLf` 只留给解析侧，写入的线格式与 0.14.3 逐字一致（600 组差分探针复核）。
- **断言分项口径**：把 `highlight: false` 一条的「新增 1 组」订正为 2 组，并在下方「断言」小节同时给出实跑数与净增数。

### 二次精简与复查（本轮）

- **本地存储读写合一**：`storedJson` / `storedObject` / `writeStored` 取代 6 处读、10 处写各自重复的 `try/catch + JSON.parse`；清单本机索引遇到数组形态的旧值不再静默吞掉后续写入。新增 1 组断言。
- **侧聊线程绑定归一化**：`threadBindingOf` 统一字符串与 `{ threadId, quotes }` 两种落库形态，`storedSideThread` / `sideThreadsOf` / `hostParentOfThread` / `mainSessionForThread` 四处重复判断收成一处。
- **导出围栏合一**：`fencedLines` 收拢两条 Markdown 导出与侧聊问题里「围栏 + info + 正文 + 收尾围栏」的三份拼装；`sourceCandidatesFor` 的去重键复用 `refTextKeyOf`。
- **修复：改这条引用丢掉来源角色**：`sourceFor` 返回的坐标不含 `role`，旧引用（没有 `│q1:` 的自带坐标）改一次后线格式里的「· 助手 / · 我」消失。现在角色随坐标返回。新增 1 组断言。
- **修复：`keepHighlight` 不追溯**：高亮在开关关闭时已被回合尾收回（`spent`），打开 `keepHighlight` 后这些标记不会回来，读起来像开关无效。现在打开时先解除 `spent` 再绘制，关闭后下一轮重新收回。新增 1 组断言。
- **修复：两条插入路径都失败时留下「孤儿高亮」**：坐标在插入前就落库，芯片和纯文本都失败时仍会被 `paintAnchors` 画出来。现在失败时把坐标压成草稿（不画），芯片真正落下时由 `rememberChip` 解除；文本兜底成功则照旧保留高亮。新增 1 组断言。
- **修复：清单「加载更早的消息」失败会清空列表**：失败的读结果被当成「空列表」接受，已显示的引用全部消失。现在失败时回退本机索引，至少保留当前列表。新增 1 组断言。
- **修复：宿主半丢弃没有 `source` 的用户消息**：只接受显式 `source.kind="user"`，宿主日志省略该字段时父会话背景整段为空。现在与客户端清单 / 线程回流同口径：显式注入的上下文仍跳过，缺失按原话读取。新增 1 组断言。
- **兼容性**：样式表里每一处 `color-mix()` 都补了前置 `rgba()` 回退（Chromium < 111 只丢一层色调，不丢整个控件），并加断言防回退。

### 断言

离线断言 **821 组**（check 12 + capsule 582 + panel 176 + host 51）；`npm test` 全绿。相对 0.14.3（784 组）净增 37 组：capsule +20 / panel +13 / host +4。Unreleased 各条按「新增」流水口径逐条标注，与净增口径的差额来自 2 组被改写替换的断言与部分条目的声明误差；数字一律以 `npm test` 实跑为准。

### Docs

- **社区协作配置补齐**：新增 Issue 表单（Bug / 功能建议 / 使用问题）与模板选择页 `config.yml`、项目标签清单 `.github/labels.yml`、`SECURITY.md`、`CODE_OF_CONDUCT.md`、`SUPPORT.md`；`CONTRIBUTING.md` 补「fork 流程」与「Issue 分诊」两节。插件行为与离线断言数不变。

## 0.14.3 — 2026-11-09

### Fixed

- **回合尾「引用提问 / 引用回答」在新版宿主上恒为空**（issue #5，合并 fork PR #4，[@hsthanb4](https://github.com/hsthanb4)）：`turnTail` 槽位传入的轮次是记录对象，`String(turn)` 得到 `[object Object]`，与行上的 `data-chat-turn` 永不相等；角色属性实际是 `data-chat-flow-kind`，助手行值是 `assistant-step`。现在轮次退化时从按钮所在行向上取真实轮次，`ROLE_ATTRS` 增加 `data-chat-flow-kind`、角色正则允许 `-`/`_` 后缀，并用 `CONVERSATION_KINDS` 白名单 + `data-step-process` 把思考/工具脚手架排除在整轮引用之外。新增 9 组断言。
- **回合尾按钮忽略宿主注入的翻译**（合并 fork PR #7，[@kesha4](https://github.com/kesha4)）：槽位声明了 `locale: NS`，宿主注入 `t`；组件原先用模块级 `translate()`，非中文读者仍看到中文兜底。现在优先 `props.t`，未注入时保持原中文路径。新增 2 组断言。
- **划词浮层撑出视口滚动条、菜单秒消失**（issue #8，采纳 fork PR #9 的定位修复、拒绝其全局样式，[@yxn3hc](https://github.com/yxn3hc)）：`#dsh-quote-bar` 补上初始 `left:0;top:0`，并让 `onScrollOrResize` 忽略自身浮层与刚定位完的短窗口内的 scroll 事件。**未采纳** PR #9 的 `html,body{overflow:hidden!important}`——它会冻结宿主滚动。新增 5 组断言。
- **长评论框不可滚动、悬停卡片滚轮闪退、聚合条不可横滚、删除错位与连带删除、全局按键被反复接管**（issue #10 第 1–6 项）：`.dshq-input` 改 `overflow-y:auto`；卡片内滚动不再被 `onPopoverViewport` 误判为页面滚动、`mouseleave` 给宽限期；聚合条把竖向滚轮映射为横向滚动且不锁页面；删除时按位置重新解析实时芯片并强制重建聚合条；`onKeyUp` 不再对带 Ctrl/Meta/Alt 的按键与空闲状态调用 `refresh()`。新增 1 组 CSS 断言，其余为事件路径、需真机复核。
- **斜杠命令切断 run 导致 `│q1:` 坐标行泄漏到气泡**（issue #11）：`splitQuoteRuns` 现在对松散文本同样剥离 `> ※ … │q1:` 与 `> ※ 指令：` 传输行。新增 5 组断言。
- **引用浮层浮在宿主设置面板之上**（issue #10 第 7 项）：聚合条、划词栏、toast、悬停卡片从 `2147483xxx` 降到 980–983，落在宿主 Modal 背景（`z-index:1000`）之下、输入框与宿主菜单（7–100）之上；设置面板打开时不会再被引用气泡盖住。新增 2 组断言。
- **切换会话后草稿聚合条不回来、再划词才“诈尸”**（issue #10 第 8 项）：宿主恢复草稿芯片时不会发生新的芯片插入，`wireChips` 的扫描闸门因此一直关着；现在把「输入框卡片集合变化」当作切会话信号重新布线（窗口唤醒也重新武装），恢复的芯片立刻带监听和聚合条。新增 3 组断言。
- **删除草稿芯片后原文高亮与序号不回收**（issue #10 第 9 项）：切会话恢复的芯片重新纳入账本后，删除会照常收回坐标；原文徽章改为按当前绘制顺序、按会话从 1 重排（按 `at` 升序），删掉一条后剩余序号前移，不再把历史引用累计进今天的编号。wire 里的 `n` 仍然冻结不动（它只用于同一句话的第几次出现），新引用的 `n` 也改为按同一句原文分配，不会因同轮另一句引用而偏移。新增 9 组断言。
- **记录型 turn 让回合结束收回失效**（PR #4 后续）：槽位自己的 `data-dshq-turn` 仍写 `String(turn)`，记录型宿主得到 `[object Object]`；`clearSpentSources` 拿它和胶囊的真实 turn 匹配，永远匹配不上，回复结束后原文高亮与序号不收回。现在 `turnNumberOf()` 先读记录里的 `turn` / `id` / `seq`，再回退到所在行的 `data-chat-turn`，`turnTextAt` 与 `clearSpentSources` 共用同一个解析。新增 2 组断言。
- **用户提问里以「思考 …」开头的段落被当成推理删掉**（PR #4 后续）：段落级兜底只在 `role === "assistant"` 时启用；用户自己的话一个字不动，答案里的推理段落仍会过滤。新增 1 组断言。
- **过程块文本与答案重复时会把答案剪掉**（PR #4 后续）：原来用 `body.replace(inner, "")` 删过程块，同名片段出现在答案里时会先删答案、留下过程副本。现在逐个子节点遍历并跳过 `data-step-process` 子树，只移除脚手架。新增 1 组断言。
- **未处理项**：issue #6（图片附件随引用）涉及范围红线 R19，留待确认，本轮未动。

### 断言

离线断言 **780 组**（check 12 + capsule 558 + panel 163 + host 47）；`npm test` 全绿。

### Docs

- **文档收敛为「简介 + 红线」**：根 `README.md` 重写为简洁的项目简介（简介、界面截图、功能一览、安装、目录结构、配置、自检、已知限制），逐条功能长文与排障细节继续留在 `docs/`；`AGENTS.md` 只保留红线 R1–R22 与路由表（按改动目标 / 按症状 / 文件地图），移除术语表、命令清单与自检清单；`docs/README.en.md` 同步重写为精简英文版。各目录 README（`docs`、`docs/screenshots`、`lib`、`locale`、`test`、`submission`、`.github`、`.github/workflows`）按现状重写，并为 `skills`、`skills/docs`、`skills/release` 新增目录 README，补齐「每个目录都有 README」。插件行为与离线断言数不变。

## 0.14.2 — 2026-11-07

### Fixed

- **DSH 0.2.2 解码后的引用仍能变成胶囊**：0.2.2 的 `message-quotes` 会把用户消息里的 Markdown blockquote 解码后渲染到 `[data-quote-preview]`（每行 `> ` 被 `quoteTextOf` 剥掉），发送后的引用因此不再以 `> ❝ …` 形态出现在 DOM 里；`splitQuoteRuns` 只认 `>` 开头的块，于是整段被当成普通文本重画——原文气泡、没有胶囊、`※ 引自… │q1:` 传输行原样露出。现在 `isQuoteRun` 把宿主 surface 让给 `isHostQuote`，`splitDecodedQuote` 读取解码形态（`❞` 评论、`※ 指令` 与 `│q1:` 坐标、代码围栏都能还原），`enhance` 以整个 surface 为单位隐藏并插入胶囊；宿主原生引用（没有 `❝`）保持原样。新增 12 组断言。

### Docs

- **README 全量对齐现状**：根 README 的安装命令（`desktop` / `web` profile）、`dsh plugin` 对 desktop profile 的说明、DSH 兼容复核（0.2.2-rc.1）与侧聊退路计数按实测更正；`docs/README.en.md` 重写为覆盖当前功能、配置与限制的英文版；`docs/README.md` 补齐文档索引；`lib/README.md` 修正 host 半职责与行数；`test/README.md` 补上三语词典与语言开关覆盖；`locale/README.md`、`submission/README.md`、`.github/README.md`、`.github/workflows/README.md` 同步插件页文案来源、市场状态与 PR 模板。插件行为与离线断言数不变。
- **发版前必须完整做一次交付自查**：`skills/release/SKILL.md` 新增「发版前交付自查（闸门）」A–F 六组——门禁与断言、版本与数字、文案与契约、包内容（`npm pack --dry-run` 白名单与体积）、线格式与降级、发布面（远端形状 / workflow / 凭证 / 工作稿），并写进「不可违反」第 10 条与正式发版的第 3 步；`skills/docs/SKILL.md`、`AGENTS.md`、`docs/release.md` 同步指向它。顺手修掉文档里残留的 715 组旧断言数（`CONTRIBUTING.md`、`docs/release.md`、`docs/distribution.md`、`docs/design.md`）与「`submission/` 在 npm 包里」的错误描述。插件行为与离线断言数不变。

### 断言

离线断言 **740 组**（check 12 + capsule 518 + panel 163 + host 47）。

## 0.14.1 — 2026-10-31

### Changed

- **引用高亮在回合结束后收回**：引用作为胶囊发出后，回合尾的 `data-dshq-turn` 作为完成信号，`paintAnchors` 把对应 source 标成 `spent`；坐标保留（跳回/卡片/清单照常），高亮与序号不再绘制。`keepHighlight: true` 可保留常亮。新增 1 组断言。

### Docs

- **DSH 0.2.1-rc.5 兼容性复核**：`engines.dsh` 保持 `>=0.2.0-rc.2`（只有下限、没有上限），DSH 的加载前检查在 0.2.1-rc.5 上判定通过，不会像写了上界的插件那样被禁用。实机复核了宿主半路由（同源围栏返回本插件的 403 JSON）、`webServer.register` / `connection.requestRejection` / `agents.create` 的 `seed` 与 `inheritedEventCount`、`subagent/descriptor` v3，以及客户端槽位与 DOM 属性（`conversation.chat.turnTail`、`data-chat-turn`、`reference-chip`）。README「已知限制」与 `docs/design.md` 的声明说明同步更新；插件行为与离线断言数不变。

### 断言

离线断言 **728 组**（check 12 + capsule 506 + panel 163 + host 47）。

## 0.14.0 — 2026-10-29

### Added

- **界面语言开关**（`language`）：`"auto"`（默认）跟随宿主语言，`"zh"` / `"en"` / `"ru"` 把本插件文案固定为中文 / 英文 / 俄文，不受宿主设置影响。`translateFor()` 在 `auto` 之外直接查对应词典，缺失的键回退为键名而不是另一种语言。新增 5 组断言（默认 auto、固定 ru、固定 en、非法值丢弃、恢复 auto）。
- **俄语词典（`ru`）**：合并社区 PR #3（[@skyfishalex](https://github.com/skyfishalex)）——`lib/client.js` 的 `ru` 词典（85 键）、`locale/ru.json`（卡片标题与描述）、`test/check.mjs` 的 locale 目录校验扩到 `zh`/`en`/`ru`；README 的语言说明改为「中文/英文/俄文」。此前俄语界面回退到中文。

### Changed

- 合并后补齐 `ru` 词典里缺的 `sideChatEmpty`（贡献者分支早于 0.13.4 才有的键），并把 `locale/README.md` 与 `CONTRIBUTING.md` 里「两份字典成对」的约定扩到三语。

### 断言

离线断言 **727 组**（check 12 + capsule 505 + panel 163 + host 47）。

## 0.13.4 — 2026-10-29

### Fixed

- **隐藏线程第二次发送报 `subagent/not-resumable`**（issue #2）：真实原因是会话存储要求**第一个 surface 节点是受保护的系统头**（`system/message` append），而旧种子把上下文 `user/message` 放在最前——首个真实回合的 `system/message` 在重载时被判 `system/message requires a protected first surface head`，之后每次发送都以 `subagent/not-resumable` 失败（v4 的收口回合缺这个头，v5 的无回合种子更不用说）。现在种子是一个收口回合：`turn/start` → `step/start` → **空内容的 `system/message`（头）** → 隐性上下文 → `step/end` → `turn/end` → descriptor（+ 可选 `model/selection`）。**2026-10-29 真机验证通过**：同一线程连发两条，磁盘日志里 system 头是 kind=system-prompt、content=0，turn 2 与 turn 3 都是 completed，各有 request/header。侧边对话在**本插件自己的 `quote-sidechat` 页签**里进行，发送走标准会话路径，从磁盘打开这份合法的日志；子 agent 创建完、定完标题就 `dispose`（活句柄会让宿主的子代理 resume 失败——真机里 v6 子会话的历史加载就是这样被拒的）。隐藏线程形状版本戳升到 `v: 6`，旧线程下一次点击自动替换。断言：种子形状改写为「受保护 system 头 + 收口回合 + 上下文位置」，另有「自营页签注册后 hidden 线程开自营页」1 组。
- **自营侧聊页的 blank 兜底（v6 种子通常不会走到）**：宿主 `ui-conversation` 的 `ConversationContent` 在 `hero` 为真时渲染欢迎页（「探索未至之境」）与 hero 输入条（未选工作区时禁用），引用芯片落不进去。自营页固定 `hero: false`、phase 走 `settling → active`；宿主若仍把子会话判成 blank，空态块兜底。断言补「blank 子会话仍走聊天态」「打开中/父会话可用性未知时先 settling」2 组。
- **blank 兜底：视图区没有 DOM 时侧聊页只剩输入卡**（宿主 `ConversationSession` 在 `session.blank` 时直接 `return null`）：输入卡被排到页签栏下方，`引用 ×N` 条盖住页签条。自营页在视图槽里补一个空态块（首条消息后自动隐藏），把输入条放回页底。断言补「视图区空态」1 组。离线断言 **715 组**（check 12 + capsule 493 + panel 163 + host 47）；新增 4 组：自营页签、blank 仍走聊天态、settling、视图区空态。

_（下一轮）_

## 0.13.3 — 2026-10-29

### Changed

- 删掉 0.13.2 里的临时诊断路由 `resume.diag`（定位 issue #2 用的脚手架）及其 2 组断言：它是同源围栏内的只读诊断，对用户不可见，但不该随包长期发布。侧聊的模型选择修复本身不变。离线断言 712 → **711**（host 48 → 47）。

## 0.13.2 — 2026-10-29

### Fixed

- **隐藏侧聊线程首次发送必失败**（issue #2）：种子里那个「收口的小回合」从未真正请求过模型，子会话因此没有 `modelSelection` 投影，标准 preset 的 persona 里 `{{model}}` 取不到值，任何一轮都会以 `prompt variable "{{model}}" has no value for this assembly (section "deployment:persona-prefix")` 结束。现在创建线程时按宿主自己的做法（`api-session-controller`）补两件事：`setup` 里装 `system-prompt/assemble` 钩子注入 `provider` / `model`，种子里追加一条 `model/selection` 让投影有值（重建时也读得到）。父会话的模型路由本来就取到了，只是没落到子会话。
- 离线断言 **712 组**（check 12 + capsule 489 + panel 163 + host 48）：新增「种子带父会话模型路由」「`setup` 装钩子并 append 一次」。

### Added

- **临时诊断路由 `POST /ui-quote/api/resume.diag`**（同源围栏内，只读诊断）：在宿主进程里直接调 `agents.resume`，把被 `subagent/not-resumable` 吞掉的真实错误原样带回——用于定位 issue #2（隐藏侧聊线程首次发送即失败）。定完位就删。
- 离线断言 **710 组**（check 12 + capsule 489 + panel 163 + host 46）；新增 2 组：诊断路由对「父会话不在线」的答复、以及把 `resume` 的 `message` / `code` / `cause` 原样回传。

### Changed

- 删掉 canary 预发布频道：`main` 的 push 只跑测试，不再往 npm 发 `-lab.N`（它占了全部 62 个版本里的 45 个）。发版只在打 `v*` 标签时发生；`lab` dist-tag 冻结在 `0.13.1-lab.61`，老命令仍可安装但不再更新。要验证打包产物用本机 `npm pack` 后装 tarball。

## 0.13.0 — 2026-10-28

### Added

- 引用清单页最底下一行：**`★ 在 GitHub 上 Star`**。它是插件里唯一能回到仓库的入口，是一个普通 `<a target="_blank" rel="noreferrer noopener">`——不点击就不会打开任何页面，插件自身仍然不发任何请求（R11 不变）。
- 离线断言 **708 组**（check 12 + capsule 489 + panel 163 + host 44）；新增 2 组：「底部有一条指向仓库的链接（`a` + `target=_blank` + `noreferrer`）」「这行链接自身不触发任何动作」。

### Docs

- 根 README 从 540 行收到 233 行的落地页：首屏改成三句卖点 + 入口链接，界面截图提到功能表之前。深度内容按主题移出——设计原理与同类对照 → [`docs/design.md`](docs/design.md)，四套断言细节 → [`docs/testing.md`](docs/testing.md)，开发与发布/推送通道 → [`docs/release.md`](docs/release.md)，英文全文 → [`docs/README.en.md`](docs/README.en.md)。功能表与「已知限制」仍留在根 README（验收口径与宿主契约出处不变）。
- R17 的同步位置随之变成：`README.md` 四处 + `docs/design.md` 一处（真机验证）+ `CHANGELOG.md` 一处。

## 0.12.9 — 2026-10-28

### Fixed

- 等待晚到的 `inputTriggers` / `shortcuts` 服务，并在服务提供者卸载时释放旧注册、重载后在新实例注册引用源与四个命令。（来自 [@samwei12](https://github.com/samwei12) 的 [#1](https://github.com/BangBang-03/dsh-client-ui-quote/pull/1)）
- 移除无法通过宿主校验的 Web 默认快捷键；保留 Web 命令及用户自定义能力，桌面仍为 `Alt+Q/C/B/L`。
- 离线断言 **706 组**（check 12 + capsule 489 + panel 161 + host 44）；新增 10 组回归断言，覆盖服务晚到、独立替换为新实例、旧实例释放、新实例恰好注册一次、插件卸载清理，以及 Web 无默认绑定。

## 0.12.8 — 2026-10-27

### Fixed

- 发送引用后，输入框上方的 `引用 ×N` 条有时不消失，只剩一个 `引用 ×1` 的空条——宿主发送后会把芯片节点回收成空输入框的 placeholder，我们打在芯片上的 `data-dshq-chip` 标记留在了被复用的节点上。旧逻辑按**标记数**算条数，于是把一个已经解析不出引用的节点也算成一条；它没有条目可点，却一直挂在输入框上方。现在 `wireChips` 与 `syncDraftBars` 都以 `chipInfoFor` 能否解析出引用为准：解析不出的标记会被摘掉、不计入条数；真芯片与残留标记并存时计数也只算真芯片。
- 离线断言 **696 组**（check 12 + capsule 480 + panel 160 + host 44）；新增 4 组断言：「回收节点上的残留标记不再撑起聚合条」「残留标记被摘掉」「真芯片与残留标记并存时计数仍为 1」「移除真芯片后条消失」。

## 0.12.7 — 2026-10-27

### Fixed

- 插件加载/重载后，已经发出的引用消息有时一直显示为线格式原文（`> ❝ … │q1:…`），而不是胶囊：消息文本本身就是持久载体（`❝` / `❞` / `│q1:` 是设计好的线格式，换客户端、刷新、没装插件时都还在），胶囊是客户端插件画上去的增强层；如果一条消息在插件重载/启动的缝隙里渲染，MutationObserver 可能没报到它，插件就不会再管它。现在每次安装都会全量重扫一遍已渲染的 transcript，另外窗口**重新可见或获得焦点**时也会 `rescanCapsules()` 补扫一次，把漏掉的 run 重新做成胶囊并隐藏原文。**没有加载插件的窗口（例如另一个 profile 的浏览器）仍会原样显示这段线格式——这是设计上的兜底，不是消息损坏**；看到原文时先确认该窗口是否启用了插件，刷新后应在几十毫秒内变成胶囊。
- 离线断言 **692 组**（check 12 + capsule 476 + panel 160 + host 44）；新增 2 组断言：「晚渲染的引用在重扫前保持原文」「窗口唤醒后的重扫把它变成胶囊并隐藏原文」。

## 0.12.6 — 2026-10-27

### Fixed

- 高亮偶尔失效、第二条引用「没有高亮」：`v0.12.5` 的收回逻辑有两条时间缝。其一，收回一旦跑在胶囊出现之后，坐标会卡在 `draft`，而转正只发生在胶囊创建那一刻——之后没有任何人再把它改回来，那条引用就一直不落色。现在 `paintAnchors` 把「draft + 页面上已经有它的胶囊」当作已发出的证据：下一次重画（滚动、任何 DOM 变化）就把它转正并补画，落库后刷新也不再生变。其二，发送后消息先以纯文本出现、胶囊晚一拍才增强，芯片在这道缝里消失曾被当成「读者反悔」把已发出的那句收回；现在收回前先看 transcript 文本里有没有这句的 `│q1:` 坐标，有就让路。用户 19:49 那次「两条引用一起发」留下的 `draft` 坐标，升级后回到那个会话、胶囊在页面上时会被自动补回来。
- 离线断言 **690 组**（check 12 + capsule 474 + panel 160 + host 44）；新增 4 组断言：「胶囊已在页面上时 draft 坐标照常落色」「这次迟到的转正会落库」「线上文本里已有坐标时芯片离开不收回」「那句已发出去的引用保持高亮」。

## 0.12.5 — 2026-10-27

### Fixed

- 草稿里的引用删掉后原文高亮还在：主会话「添加到对话 / 评论」把引用写成芯片时，坐标是当作「已发出」存进 `dsh-client-ui-quote:v2:quote-source` 的，读者随后在聚合条点 `×`（或直接退格删掉芯片）表示「不想添加了」，那张表却没有任何改动，于是原句上的淡黄高亮与序号一直留着——明明这条引用从没发出去。现在芯片写进草稿的坐标多带一个 `chip` 标记；`syncDraftBars` 每次扫描草稿时按卡片比对上一次看到的芯片，发现某颗芯片离开了一张**仍挂在页面上**的卡片、而页面上又没有它发出的胶囊时，就把对应坐标降级成 `draft`（`paintAnchors` 的既有跳过规则），高亮与序号随即收回并落库，刷新不会复活；芯片回来（宿主慢一拍才渲染回来、或读者又把同一句加回草稿）时 `restoreChipSource` 立刻补画。已经作为胶囊发出去过的同一段文字不受影响：`chip` 只写在草稿这次保存上，胶囊出现时 `promoteSource` 会清掉它；整个输入框离开页面（切会话）也不算删除。纯文本兜底（宿主没有芯片面）不会留下 `chip` 标记。
- 离线断言 **686 组**（check 12 + capsule 470 + panel 160 + host 44）；新增 11 组断言：「添加到对话写进草稿的坐标带 `chip` 且落库」「芯片还在草稿时照常落色」「删掉芯片（未发送）高亮收回」「收回状态落库、刷新不复活」「芯片回来时补画」「胶囊出现后转正补画」「页面上已有胶囊时不误收」「整个输入框离页不算删除」「两个草稿共用同一坐标时删一颗不收回、删最后一颗才收回」。

## 0.12.4 — 2026-10-26

### Fixed

- 取消侧边对话后原文仍留着高亮：第三项会为引用预先算坐标（跳回与悬停卡片要用它的序号），以前这一步直接落进原文高亮表，于是**只要点过第三项**，那段文字就被画上高亮与序号徽标——即使读者随即把侧边对话关掉、根本没发送。现在这类坐标以 `draft` 记在 `dsh-client-ui-quote:v2:quote-source` 里，`paintAnchors` 跳过它；只有当这句引用真的以胶囊形态出现在某条 transcript（`capsuleFor` 认到同一个 ref）时，`promoteSource` 才把它转正并补画标记。主会话「添加到对话 / 评论」与已发出的旧引用不受影响（它们保存时不带 `draft`）。
- 放弃浮层动作后选区仍在：浮层自己的 `mousedown` 调了 `preventDefault()`（不然点行的一瞬间选区就消失），但退场时没人把它还回去，`Esc` / 取消 / 点别处之后那段文字会以浏览器选区形态一直亮着。`close()` 现在见到 `state.keptSelection` 就 `removeAllRanges()`，动作路径与放弃路径都不再残留选区。
- 同一段文字「先发过、又侧聊一次」时高亮会消失：`draft` 是一次保存的属性，已经转正的坐标被侧聊那次保存覆盖回了草稿——本来亮着的高亮与序号徽标反而灭掉。现在 `draft` 只继承、不覆盖永久标记（`draft === true && 原条目是 draft` 才带上），反向的转正仍由一次普通保存（发送）完成。
- 离线断言 **675 组**（check 12 + capsule 459 + panel 160 + host 44）；新增「草稿坐标不落色 / 转正后才补画（含侧边对话端到端）」「已发出的坐标不会被同一段文字的侧聊保存降级」「`draft` 标记随表持久化，刷新不会复活标记」「放弃动作把保住的选区还回去」五组断言。

### Docs

- README 的侧边对话两处（操作流程第 4 步、实现小节）改回实际形态：引用以**原生芯片**写进侧聊输入框，块引用只是宿主没有芯片面时的兜底；并补上「没发出去的引用不落到原文上」「放弃动作要把选区还回去」两条。同时修掉 `test/panel.mjs` 159 项这个旧数字（实跑 160）。

## 0.12.3 — 2026-10-26

### Added

- 侧边对话默认内置隐藏线程，不再需要安装 dsh-better-sidebar：宿主半注册 `POST /ui-quote/api/sidechat.start`（同源围栏），从在线父会话取最近几轮原话做成一条隐性上下文（不复制日志），用宿主 `agents.create` 建 `origin: "subagent"` 子会话，并在宿主内置 `subagentchat` 页签打开；descriptor 与会话标题使用与 better-sidebar 共享的 `Side: ` 约定，装不装它都不冲突。宿主半不可用（旧宿主 / 父会话不在线 / 创建被拒）时自动退回 `sessions.fork` + 本插件原生 `quote-sidechat` 页签；`sideChatBackend: "better"` 才优先走 better-sidebar。
- 侧边线程记忆与清单：新增 `dsh-client-ui-quote:v1:sidechat-target` 记录隐藏线程的父会话；读取线程时用 subagent 地址 `{parentSessionId, childSessionId, mode:"continuable"}`；线程列表同时扫描会话列表里的 `Side:` 子会话，所以 better-sidebar（或旧版本）创建的线程也能在本插件里打开、带回和导出。
- 离线断言 **667 组**（check 12 + capsule 451 + panel 160 + host 44）；新增原生页签的地址解析、标题、资源 retain/release、页签注册与卸载断言，以及宿主半的隐性上下文合成（只收原话、8000 字上限、超长截断）/ 继承切点与 descriptor 顺序 / 收口回合 / `agents.create` 参数 / 探针与围栏断言。

### Fixed

- 侧聊草稿里的引用看起来像「我自己打的字」：之前只把引用写成 `> 原文` 的块引用塞进输入框，发出去就成了用户自己的话。现在侧聊草稿**优先用原生引用芯片**（`insertReference`，与主输入框同一条路径），芯片可见地属于引用来源、发送时也会还原成线格式；只有宿主没有芯片面时才退回块引用，且第二次追加不会覆盖已有草稿。
- 胶囊的悬停卡片也加了「复制为 Markdown」：同一个 `quoteRowMarkdown` 载荷，无论这条引用有没有坐标都能用（有坐标时出处行就是 `引自第 N 轮 · 助手`）。
- 引用清单每行多一个「复制」：把**单条**引用复制成 Markdown（原文块引用或代码围栏、评论、`引自第 N 轮 · 助手` 出处），可以直接粘进 PR / issue / 别的会话。之前只有整页导出，单条引用拿不出去——这是竞品调研里唯一明确的能力缺口（Aider `/copy-context`、Zed/Cline 的「带出处」都是这个形态）。
- 侧聊页打开后是一片「探索未至之境」欢迎页、输入框里也没有引用：宿主把「一个 turn 都没有」的会话算成 blank，blank 会话渲染欢迎页而不是聊天页（没有输入框，`prefillDraft` 无处可落）。种子现在把隐性上下文包进一个**已收口的小回合**（`turn/start` → `step/start` → 上下文消息 → `step/end` → `turn/end{done}`），会话不再是 blank，页签进正常聊天态；形状版本戳同时升到 v4，之前建出来的空白线程会在下一次点击时被替换。
- 侧边对话只剩**一项**：浮层里「侧边对话」与「另开侧边对话」两个按钮长得一样、语义要读第二行才分得清，现在只留「侧边对话」，一条主会话一条线程（早期按引用分线程的记录仍会识别并复用）。
- 侧聊打开时不再把主会话的历史铺在界面上：种子从「复制父会话整条日志」改成**一条隐性上下文**——先是 session/end-seed{inherited:true} 切点，再是一条 source.kind = session-context 的 user/message（只收用户与助手的原话、最新在后、上限 8000 字，跳过工具事件与注入上下文），最后是 descriptor。模型照旧拿到上下文，侧聊里只折叠成一行「上下文」；同时不再为复制整条日志付一遍 token。
- 侧聊草稿里不再写 `Side conversation boundary.` 那段元文案：「只作背景、别继续执行」的指令挪进隐性上下文，输入框里只剩这条引用本身。
- 隐藏线程的侧聊页一打开就「历史加载失败：subagent descriptor is unavailable」：种子把 `subagent/descriptor` 放在继承前缀里、又用整段种子的长度当 `inheritedEventCount`，宿主的 `api-session-controller` 要求 descriptor 的 `seq` 不小于继承切点，于是整条子会话的历史都读不出来。现在种子先落一条 `session/end-seed { inherited: true }` 标出切点，回合收口、工作目录与 descriptor 全部排在切点之后；嵌套侧聊的父 descriptor 留在继承前缀里，我们自己的那条排在后面（投影按最后一次生效）。
- 修复前造出的坏线程会被反复打开：`sessions.retain` 对它们**照样成功**（只有历史 RPC 拒绝），所以「试开一次」判断不出来。现在客户端给新建的线程盖形状版本戳（`dsh-client-ui-quote:v1:sidechat-target` 里的当前版本，现在是 `v: 4`），只复用自己盖过章的线程；better-sidebar 的、旧版本的、扫描发现的线程一律丢弃重建——一次误杀换永久自愈。
- 正文以 ``` 或 `~~~` 开头的普通引用在回读时丢了首行：识别代码引用只看首行围栏，却没有要求块尾有配对的收尾围栏，于是引用一段 Markdown 源码时那行被当围栏剥掉（只有一行的引用会整条消失，胶囊、悬停卡片与引用清单都少字）。现在围栏必须成对才算传输层——写出去的代码引用收尾围栏始终成对，旧消息解析不变；不成对的孤围栏按正文还原。

## 0.12.2 — 2026-10-22

### Changed

- 发布工作流：推 `v*` 标签时，除了发 npm `latest`，还会按 `CHANGELOG.md` 同名小节建 GitHub Release（已存在则更新 notes，重跑安全）；`publish-stable` 的 `contents` 权限从 read 提到 write。小节缺失时用一句兜底，不让文档缺失把已发布的 npm 包拖成失败。
- 纯文档提交不再切 lab 预发布：`publish.yml` 对 lab 分支加 `paths-ignore`（`*.md` / `docs/**` / `submission/**` / `.github/**`）；标签推送不受路径过滤影响，发版照常。
- 离线断言 **557 组**（check 12 + capsule 392 + panel 153），`npm test` 全绿。

### Fixed

- 表格里划选的引用不发高亮：Chromium 用 `\t` 分隔同一行的单元格、`\n` 分隔行，高亮却按文本节点直接拼接去找，永远对不上；现在按块级边界（单元格 / 行 / 段落 / 列表项 / `<br>`）还原后再量 Range，跨单元格、跨行、跨段落都能画回来。
- 输入框里已有文字时，引用芯片被粘在最后一句后面：现在引用落到草稿**最上方**，已写的文字另起一行接在下面，光标留在末尾。

## 0.12.1 — 2026-10-20

### Added

- 侧边对话原生降级：没有 `dsh-better-sidebar` 时用 `sessions.fork` 复制主会话历史，并把 fork 开进宿主内置的 `subagentchat` 右侧栏页；引用仍只写进它的草稿，不自动发送。
- 聚合条精确删除：优先调用宿主 conversation shell 的 `consumeToken`（detect 区间 + `draftRev` CAS），并带上芯片后的一个空格；旧宿主才退回「聚焦芯片 + Backspace」。编辑复用同一条路径。
- 芯片插入事件兜底：`shell.insertReference` 优先，`slash/input-insert-reference` 作为兼容通道；两者都不可用才退回纯文本引用块。
- 引用清单页的宿主自检：显示芯片精确删除能力与侧聊后端（better-sidebar / fork 兜底 / 不可用）。
- 评论框打开期间用 `CSS.highlights` 保持原选区高亮，关闭时清理。
- 持久引用高亮改用 `CSS.highlights`：浏览器直接绘制原句，滚动/流式输出/虚拟列表重排都跟手；不支持该 API 的宿主退回浮层矩形，序号徽章两条路径都有。
- `probe().lastFailure`：记录最后一个失败的环节（`source` / `insert` / `remove` / `sidechat`）与一句原因，只记阶段不记正文。
- 24 秒界面轮播 GIF、市场提交 YAML（`submission/`）与 `docs/distribution.md`。

### Changed

- `package.json` 描述不再以 Kimi 开头，改为「把任意选区变成可审阅的引用对象」。
- 离线断言 **549 组**（check 12 + capsule 384 + panel 153）；真浏览器 **51/51**（1600×2000 视口）；隔离 DSH web 实例中 `probe().nativeSideChat === true`。

### Fixed

- 修正「宿主没有删除 reference-chip 的 API」这一旧结论：conversation shell 实际暴露 `consumeToken`。
- 跨消息的选区不再谎报来源：起点与终点不在同一行时，不带轮次/角色、也不写可跳回坐标，原文照常发出。

## 0.12.0 — 2026-10-19

- 原文侧高亮与序号、`引用 ×N` 聚合条、可读来源头、线格式转义、diff 划选、清单多选插入、审阅工作台（状态 / 标签 / 批量）、双语插件页与包描述补齐。
