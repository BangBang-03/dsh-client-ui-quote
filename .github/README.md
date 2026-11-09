# .github

GitHub 侧配置：CI / 发布工作流、PR 模板、issue 表单与标签清单。本目录不随 npm 包发布。

| 文件 | 触发 | 作用 |
| --- | --- | --- |
| `workflows/test.yml` | 每次 push / PR | `node --check lib/client.js` + `npm test`，Node 18 / 20 / 22 矩阵。 |
| `workflows/publish.yml` | `v*` 标签、手动 | 标签发 npm `latest` 并建 GitHub Release；手动触发（从 `main`）只重发稳定版。`main` 的 push 不发布。 |
| `pull_request_template.md` | 新建 PR | 三段式：改了什么 / 为什么 / 怎么验证。合并是 squash，**PR 标题会变成主干提交标题**。 |
| `ISSUE_TEMPLATE/bug.yml` | 新建 issue | Bug 表单：现象、复现、期望 / 实际、DSH 版本与运行形态、插件版本、`probe()` 输出、环境、截图；自动打 `bug` + `needs-triage`。 |
| `ISSUE_TEMPLATE/feature.yml` | 新建 issue | 功能建议表单：场景、方案、R19 范围红线、替代方案、参与意愿；自动打 `enhancement`。 |
| `ISSUE_TEMPLATE/question.yml` | 新建 issue | 用法 / 配置 / 兼容性咨询；自动打 `question`。 |
| `ISSUE_TEMPLATE/config.yml` | 新建 issue | 关闭空白 issue；contact links 指向「已知限制」、`docs/` 与 npm。 |
| `labels.yml` | 手动 / label-sync | 项目自建标签清单（`needs-triage`、`needs-repro`、`compat`、`area:*`、`blocked`）；GitHub 默认标签不在其中。 |

**标签要先建**：`labels.yml` 只是清单，标签本身要在仓库 Settings → Labels 建出来（或接 label-sync 同步）；不存在的标签不会被 issue 表单自动应用。

工作流细节见 [`workflows/README.md`](workflows/README.md)。发布需要仓库 Secret `NPM_TOKEN`（npm Automation token），缺失时工作流直接失败。分支与发版纪律见 [`../AGENTS.md`](../AGENTS.md) 的 R20 / R21 与 [`../skills/release/SKILL.md`](../skills/release/SKILL.md)（工作区根的 `PLUGIN-WORKFLOW.md` 只在本机，不在仓库里）。
