# submission

插件市场 / 目录的投稿元数据。投稿是**人工动作**，需要仓库所有者账号，CI 不会代发。

| 文件 | 作用 |
| --- | --- |
| `BangBang-03__dsh-client-ui-quote.yml` | awesome-dsh-plugin 的条目：`url`、`name`、`category: ui`、中英双语 `description`。 |

## 现状（2026-10-28 核对）

- **已收录**：awesome-dsh-plugin（PR #6506，2026-10-17 合并；描述是旧版，待更新）、dsh.pub（自动）、dsh.market（自动，`curated: false`）、DSH 应用内市场（按 npm 包名可搜）。
- **未收录**：dsh-plugin.org（走 issue）、awesome-deepseek-harness（走 PR，**中英两个 README 各加一行**）。
- 各渠道入口、可粘贴的文案与待办清单见 [`../docs/distribution.md`](../docs/distribution.md)。

## 约定

- 描述文案与 `package.json` 的 `description`、根 README 的定位保持一致，改功能时一并检查。
- 版本、安装命令等身份信息以 `package.json` 与根 README 为准，这里不重复维护。
- 本目录不在 npm 的 `files` 白名单里，不会随包发布。
