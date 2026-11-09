# skills/release

推送与发版流程的说明目录。可执行的清单在 [`SKILL.md`](SKILL.md)（含发版前交付自查 A–F 六组），这份 README 只说明范围与入口。

## 适用场景

- 「推 main / 推送」：提交后推 `main`，不打标签；普通 push **只跑测试，不发布**。
- 「发版 / 发布正式版 / release / 打 vX.Y.Z」。
- 发布后核对 Actions、Release、npm `latest`，或排查推送超时、标签冲突、publish CI 失败。

## 覆盖范围

- **分支拓扑**：只有 `main` 一个长期分支（默认分支、开发线、发版线）；产物身份靠 `vX.Y.Z` 标签与 npm `latest`。
- **一键执行**：工作区根 `pwsh -File promote.ps1 -Repo dsh-client-ui-quote -Tag vX.Y.Z`（测试 → 推 `main` → 打标签 → 核对远端 ref）。
- **发版前必须完整跑一次 A–F 六组自查**：门禁与断言、版本与数字、文案与契约、包内容、线格式与降级、发布面；任何一项不过就停在 `main` 修完重跑，不 bump、不打标签。
- **推送通道**：`git` 优先、REST 兜底，同一轮不来回切（R21）。

## 边界

- 不负责市场投稿、profile 两档切换、宿主安装排障（见 [`../../docs/distribution.md`](../../docs/distribution.md) 与根 README）。
- 用户没有明确说「发版 / 打标签」时，只做 `main` 推送。
- 本目录不随 npm 包发布；`promote.ps1` 与 `.dsh-quote-work/` 在仓库外。
