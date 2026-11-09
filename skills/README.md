# skills

仓库内的 agent 流程说明。每个子目录一份 `SKILL.md`（可执行流程，唯一权威）与一份 `README.md`（给人看的适用场景与边界）。本目录不在 `package.json` 的 `files` 白名单里，不随 npm 包发布。

| 目录 | 用途 |
| --- | --- |
| [`docs/`](docs/README.md) | 文档同步：用户说「更新文件 / 更新文档 / 更新日志」时要动哪些文件，版本号、断言数、三语词条怎么对齐。 |
| [`release/`](release/README.md) | 推送与发版：推 `main`（只跑测试）、标签发版、`promote.ps1 -Tag`、发版前 A–F 六组交付自查与 Release 验收。 |

## 约定

- 改流程先改 `SKILL.md`，再同步该目录的 `README.md` 与根 `AGENTS.md` 的对应红线（R16 / R17 / R20 / R21）。
- 流程会引用仓库外的 `promote.ps1`、`.dsh-quote-work/` 与工作区根 `PLUGIN-WORKFLOW.md`——它们只是操作说明，不要把脚本或工作稿搬进仓库（R22）。
- 新增子目录时必须同时补 `SKILL.md` 与 `README.md`。
