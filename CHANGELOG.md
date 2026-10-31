# Changelog

## Unreleased

### Fixed

- **回合尾的两个按钮在新版宿主上恒报「这一轮没有可引用的内容」**：turnTail 槽位把「轮次」作为记录（对象）传入，`String(turn)` 得到 `[object Object]`，永远匹配不上消息行上的 `data-chat-turn`；角色属性实际是 `data-chat-flow-kind`（不在 `ROLE_ATTRS` 里）；助手行的值是 `assistant-step`，被 `^(assistant|bot|model|ai)$` 的锚定正则排除。三处都改成容忍：轮次不是数字时从按钮所在行向上取最近的 `data-chat-turn`；`ROLE_ATTRS` 增加 `data-chat-flow-kind`；角色正则允许 `-`/`_` 后缀。新增 3 组断言。
- **引用整轮时不再带上思考过程与工具过程**：一轮里的推理组与工具调用组都带 `data-step-process`，它们和正文同属一个 `data-chat-turn`，原先会被拼进「引用回答」的原文里。现在跳过 `data-step-process` 行，并从保留下来的行里剔掉嵌套的过程子树。新增 2 组断言。
- **推理行的另一种形状也不再混进引用**：有的宿主给推理单独一种 flow kind（`assistant-reasoning` 一类），角色后缀规则会把它当成正文；展开后推理还会以「思考 …」段落的形式直接出现在正文文本里。现在按 kind 过滤推理行，并丢掉以 `思考` + 空白/冒号开头、以及折叠标记 `已完成分析` 的段落。新增 2 组断言。

## 0.14.1 — 2026-10-31

### Changed

- **引用高亮在回合结束后收回**：引用作为胶囊发出后，回合尾的 `data-dshq-turn` 作为完成信号，`paintAnchors` 把对应 source 标成 `spent`；坐标保留（跳回/卡片/清单照常），高亮与序号不再绘制。`keepHighlight: true` 可保留常亮。新增 1 组断言。

### Docs

- **DSH 0.2.1-rc.5 兼容性复核**：`engines.dsh` 保持 `>=0.2.0-rc.2`（只有下限、没有上限），DSH 的加载前检查在 0.2.1-rc.5 上判定通过，不会像写了上界的插件那样被禁用。实机复核了宿主半路由（同源围栏返回本插件的 403 JSON）、`webServer.register` / `connection.requestRejection` / `agents.create` 的 `seed` 与 `inheritedEventCount`、`subagent/descriptor` v3，以及客户端槽位与 DOM 属性（`conversation.chat.turnTail`、`data-chat-turn`、`reference-chip`）。README「已知限制」与 `docs/design.md` 的声明说明同步更新；插件行为与离线断言数不变。

### 断言

离线断言 **735 组**（check 12 + capsule 513 + panel 163 + host 47）。

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
