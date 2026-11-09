# skills/docs

文档同步流程的说明目录。可执行的清单在 [`SKILL.md`](SKILL.md)，这份 README 只说明它管什么、不管什么。

## 适用场景

- 「更新文件 / 更新文档 / 更新日志 / 同步文档 / 改 README」。
- 新增或修改功能、发版、改断言数、改对外文案之后，需要把多处文档一起对齐。

## 覆盖范围

- **默认文件集**：根 `README.md`、`AGENTS.md`、`CHANGELOG.md`、`test/README.md`、`docs/design.md`、`docs/testing.md`、`docs/release.md`、`docs/README.en.md`、`docs/distribution.md`、`submission/`、`CONTRIBUTING.md`。用户说那句话时按这套执行，不用反问「改哪几处」。
- **三条强制同步**：版本号（`package.json` / README / CHANGELOG / `docs/distribution.md` 逐字一致）、断言数（R17）、三语词条（R15）。
- **更新日志写法**：平时写进 `## Unreleased`（Added / Fixed / Changed / Docs），发版时变成 `## X.Y.Z — YYYY-MM-DD`——`publish.yml` 靠这个标题截取 Release notes。

## 边界

- 红线本身（R1–R22）不在默认范围内：改红线要同时改根 `README.md` 的「已知限制」与 `AGENTS.md`，两处不一致时以 README 的实测记录为准。
- 工作稿不进仓库：`.dsh-quote-work/`、报告、截图工作区（R22）。
- 对外投稿与第三方仓库操作先问再做。
