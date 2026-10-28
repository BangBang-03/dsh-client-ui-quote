# test

离线回归网。没有测试框架，全部是 Node 脚本；`npm test` 依次跑四套，共 **708 组**断言。

| 文件 | 组数 | 覆盖 |
| --- | --- | --- |
| `check.mjs` | 12 | 清单字段、`exports`、图标、两份 locale 词典、槽位注册、`codec.serialize`、无强制 peer、`files` 发货白名单、截图被根 README 引用。 |
| `capsule.mjs` | 489 | 输入框 → 发送后链路：线格式、芯片插入、胶囊、悬停卡片、跳回、高亮（含草稿坐标不落色、`promoteSource` 转正后才补画、**草稿芯片删掉后标记收回 / 回来再补画 / 胶囊已在页面时迟到的转正自愈 / 发送缝隙里的收回让路 / 窗口唤醒重扫补胶囊**）、草稿聚合条（含发送后回收节点残留标记不撑条）、侧边对话（内置隐藏线程 / fork / better）、逐条徽章、diff 引用。 |
| `panel.mjs` | 163 | 引用清单页：解析、搜索、Markdown/JSON 导出、读取、注册、审阅工作台、本机索引、侧线程回流、底部 Star 链接。 |
| `host.mjs` | 44 | 宿主半：隐性上下文种子（继承切点 → 收口回合包着 `session-context` 消息 → descriptor）、切点与 descriptor 顺序、`agents.create` 参数、探针与同源围栏、路由注册与卸载。 |
| `dom.mjs` | — | 最小 DOM / MutationObserver / Range / `localStorage` 垫片。新用到的 DOM API **先补这里**，否则 `capsule.mjs` 在 Node 里直接挂。 |
| `capsule.html` | 51 项 | 真浏览器版，`file://` 直接打开；结果写进页面标题与 `#probe-out`。视口要给足（1600×2000），否则浮层摆放的两条几何断言会因空间不够而失败。 |

## 命令

```bash
npm test                 # check + capsule + panel + host
node test/check.mjs      # 只跑清单/契约
node test/capsule.mjs    # 只跑发送后链路
node test/panel.mjs      # 只跑清单页
node test/host.mjs       # 只跑宿主半（隐藏线程创建）
```

## 红线

- 新增行为必须带断言；**不许删断言或放宽期望值换绿**。
- 若断言数变化，根 README 四处、`docs/design.md` 一处与 CHANGELOG 一处的数字要同步（708 = 12 + 489 + 163 + 44）。
- 测试跑在 `dom.mjs` 垫片上：先垫 API，再写实现，不要反过来为了过测试而改期望。
