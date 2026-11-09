# lib

插件的两个出口，也是唯一的源码目录。没有构建步骤，没有运行期依赖：`client.js` 是 vendor-CJS 工厂，由宿主在渲染进程里加载；`index.js` 是宿主半，只做客户端公开面做不到的一件事——用 `agents.create` 建隐藏侧聊线程。

| 文件 | 作用 |
| --- | --- |
| `client.js`（≈9.3k 行） | 浏览器半：locale（zh / en / ru）→ 配置 → 常量（线格式 / 选择器 / 存储键）→ 选区读取 → 线格式 → 芯片插入 → 发送后胶囊 / 悬停卡片 → 坐标表与高亮 → 草稿聚合条 → 侧边对话 → 引用清单页 → 快捷键 → `apply` 装配。 |
| `index.js`（≈0.6k 行） | 宿主半：`POST /ui-quote/api/sidechat.start` 路由（`connection.requestRejection` 同源围栏）、隐性上下文种子（继承切点 → 收口回合：空 `system/message` 头 → 上下文 → descriptor）、`agents.create` 参数、标题固定与卸载清理。 |

## 改这里之前

- 客户端功能只加在 `client.js`；不拆新模块、不引 TS / 打包器 / CSS 文件，`index.js` 不加别的服务或路由。
- bundle 内只 `require("react")`；宿主半只用 Node 内置模块与 `ctx.get` 取到的服务，不静态 import `@deepseek-ai/dsh*`，不写 `peerDependencies`。
- 不搬移、不改写宿主 React 节点；胶囊是「隐藏原 run + 在前插入自己的节点」，且可还原。
- 线格式只增不改，旧消息必须继续可读；坐标随消息文本走，本机索引只是缓存。
- 宿主服务缺失时静默降级，绝不让整个插件挂掉。
- `npm test` 必须全绿；新增行为带断言，宿主侧改动先看 `test/host.mjs`。

完整红线见 [`../AGENTS.md`](../AGENTS.md) 的 R1–R22；功能口径见 [`../README.md`](../README.md)。
