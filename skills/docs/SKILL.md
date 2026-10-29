---
name: docs
description: Use when 用户说「更新文件」「更新文档」「更新日志」「同步文档」「改 README」，或新增/修改功能、发版、改断言数、改对外文案之后需要把多处文档一起对齐（仓库 dsh-client-ui-quote）。
---

# 文档同步：一句话就是一组文件

用户说「**更新文件**」或「**更新文档**」= 跑本文第 1 节的**默认文件集**。
用户说「**更新日志**」= 只处理第 3 节的 CHANGELOG（含发版时把它变成正式小节）。
两种说法都不需要再问「改哪几处」——默认集合是固定的；只有当你发现某处改动会**改变红线本身**时才回问。

## 1. 默认文件集（一句话的默认含义）

| 文件 | 它管什么 | 什么时候必须动 |
| --- | --- | --- |
| `README.md` | 落地页：三句卖点、功能表（**验收口径**）、安装、使用、配置、已知限制、自检入口 | 行为变了（功能表）、版本变了（「稳定版当前」+ 安装示例）、新增/删除了已知限制、断言数变了 |
| `AGENTS.md` | 红线 R1–R22、路由表、文件地图、自检清单 | 新增/改动红线、新增文件或脚本、断言数变了（R16/R17）、分支或发版流程变了 |
| `CHANGELOG.md` | 面向用户与 Release notes 的唯一来源 | 每个用户可见的改动；发版时把 `## Unreleased` 变成 `## X.Y.Z — YYYY-MM-DD` |
| `test/README.md` | 四套断言各自覆盖什么 | 断言数、套件职责变了 |
| `docs/design.md` | 工作原理、同类对照、`package.json` 声明、结构、下一步 | 架构/取舍变了；R17 的「真机验证」那条就在这里 |
| `docs/testing.md` | 断言细节、真浏览器版 51 项 | 测试策略或套件变了 |
| `docs/release.md` | link / stable、推送通道、发布运维 | 发布流程、分支拓扑、npm 通道变了 |
| `docs/README.en.md` | 英文全文 | 英文卖点或功能列表变了 |
| `docs/distribution.md`、`submission/` | 渠道状态、可粘贴文案、市场条目 | 版本变了、功能亮点变了、渠道规则变了 |
| `CONTRIBUTING.md` | 外部贡献者的最短路径 | 断言数、PR 规则、CI 门槛变了 |

**不在仓库但属于同一件事的**：GitHub 的 About 描述与 topics（见 `docs/distribution.md` 的上游口径）。改完代码不需要动，但版本里程碑或定位变化时值得一起看。

## 2. 三条强制同步（漏了就是错）

1. **版本号**（发版时）：`package.json` 的 `version`、README 的「稳定版当前 **X.Y.Z**」与安装示例 `"^X.Y.Z"`、CHANGELOG 的 `## X.Y.Z — YYYY-MM-DD`、`docs/distribution.md` 的版本行——**四处逐字一致**。
2. **断言数（R17）**：`README.md` 四处（「开发与发布」入口、工程化第 4 条、`npm test` 入口、自检合计）+ `docs/design.md` 一处（真机验证）+ `CHANGELOG.md` 一处；连带 `test/README.md`、`AGENTS.md` 的 R16/R17 与文件地图、仓库外 `promote.ps1` 的提示文案。数字必须来自 `npm test` 的实跑输出，不许手写推算。
3. **中英词条（R15）**：`lib/client.js` 的 `zh`/`en`、`locale/zh.json`、`locale/en.json`、`package.json` 的 `description` 成对改。这是代码改动，不属于「只更新文档」，但只要碰了文案就必须一起走。

## 3. 「更新日志」的写法

- **平时**：写进 `## Unreleased`，用小节区分：`### Added` / `### Fixed` / `### Changed` / `### Docs`。每条写**发生了什么、影响谁**，不写 commit hash。
- **发版时**：把 `## Unreleased` 下这一轮的内容挪成 `## X.Y.Z — YYYY-MM-DD`，`Unreleased` 留 `_（下一轮）_`。`publish.yml` 会用 `## ${VERSION} ` 前缀截取这一段当 GitHub Release notes，所以**标题格式不能改**。
- 断言数那一条单独成行（R17 要求），格式：`离线断言 **715 组**（check 12 + capsule 493 + panel 163 + host 47）；新增 N 组：…`。
- 修外部贡献者的东西：点名 `@用户名` 与 PR 编号。

## 4. 自检

```bash
node --check lib/client.js
npm test                       # check 会验 README 截图引用、两份词典、manifest
git show --stat HEAD           # 确认改到的文件集合就是第 1 节里该动的那些
```

- `check.mjs` 有一条硬断言：`docs/screenshots/*` 里的每个文件都必须被**根 README** 引用——改 README 时最容易碰坏。
- 改完在回复里**列出改了哪些文件、哪些没改以及为什么**（例如「AGENTS 没动：它不含版本号，断言数也没变」）。用户问「改了吗」时要能一句话答上。

## 5. 边界

- **红线本身**（R1–R22）不在这份 skill 的默认范围里：改红线要同时改 README 的「已知限制」，两处对不上时以 README 的实测记录为准。
- 不把工作稿带进仓库：`.dsh-quote-work/`、报告、截图工作区都在仓库外（R22）。
- 第三方仓库、外部账号、对外投稿无论「更新」什么，都先问再做（见工作区记忆里的边界规则）。
- `main` 的普通 push **只跑测试、不发布**；只有打 `v*` 标签才发版。这是预期行为，不是漏发。
