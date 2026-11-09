# test

离线回归网。没有测试框架，全部是 Node 脚本；`npm test` 依次跑四套，共 **780 组**断言。

| 文件 | 组数 | 覆盖 |
| --- | --- | --- |
| `check.mjs` | 12 | 清单字段、`exports`、图标、三份 locale 词典、槽位注册、`codec.serialize`、无强制 peer、`files` 发货白名单、截图被根 README 引用。 |
| `capsule.mjs` | 558 | 输入框 → 发送后链路：线格式、芯片插入、胶囊、悬停卡片、跳回、高亮（草稿坐标不落色、转正后补画、芯片删掉后收回、切会话恢复的芯片重新布线、回合结束收回、徽章按当前绘制重排）、浮层层级、草稿聚合条、侧边对话（隐藏线程 / fork / better）、逐条徽章、diff 引用、界面语言开关。 |
| `panel.mjs` | 163 | 引用清单页：解析、搜索、Markdown / JSON 导出、单条复制、读取、注册、审阅工作台、本机索引、侧线程回流、底部 Star 链接。 |
| `host.mjs` | 47 | 宿主半：隐性上下文种子（切点 → 收口回合：空 `system/message` 头 → `session-context` 消息 → descriptor）、切点与 descriptor 顺序、`agents.create` 参数、探针与同源围栏、路由注册与卸载。 |
| `dom.mjs` | — | 最小 DOM / MutationObserver / Range / `localStorage` 垫片。新用到的 DOM API **先补这里**，否则 `capsule.mjs` 在 Node 里直接挂。 |
| `capsule.html` | 51 项 | 真浏览器版，`file://` 直接打开，结果写进标题与 `#probe-out`；视口给到 1600×2000，否则浮层摆放的几何断言会失败。 |

## 命令

```bash
npm test                 # check + capsule + panel + host
node test/check.mjs      # 只跑清单/契约
node test/capsule.mjs    # 只跑发送后链路
node test/panel.mjs      # 只跑清单页
node test/host.mjs       # 只跑宿主半（隐藏线程创建）
```

## 约定

- 新增行为必须带断言；**不许删断言或放宽期望值换绿**。
- 断言数变化时，所有写到断言数的文档同步（R17）：`README.md`、`docs/README.en.md`、`docs/design.md`、`docs/testing.md`、`docs/release.md`、`docs/distribution.md`、`CONTRIBUTING.md`、`.github/workflows/README.md`、CHANGELOG。
- 先垫 API 再写实现，不要为了过测试改期望。
