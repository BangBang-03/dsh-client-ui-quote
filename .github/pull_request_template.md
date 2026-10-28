### 改了什么

> 一两句话。落在哪一块：浮层 / 芯片 / 胶囊 / 悬停卡片 / 引用清单 / 侧边对话 / 线格式 / 构建与文档

### 为什么这么改

> 触发场景与根因。修的是宿主契约时，写清哪一版 app.asar 实测（README「已知限制」要标出处）

### 怎么验证的

> 跑了 `node --check lib/client.js` / `npm test`（706 组）/ 真浏览器 `test/capsule.html`（51 项）？
> 桌面端还是 web、哪一版 DSH、有没有用隔离的 `DSH_HOME`？
> 自查：没删断言、没放宽期望；断言数变化已同步 README 四处 + `test/README.md` + CHANGELOG。填完请把这几行引导删掉。
