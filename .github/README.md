# .github

GitHub 侧配置：CI / 发布工作流与 PR 模板。本目录不随 npm 包发布。

| 文件 | 触发 | 作用 |
| --- | --- | --- |
| `workflows/test.yml` | 每次 push / PR | `node --check lib/client.js` + `npm test`，Node 18 / 20 / 22 矩阵。 |
| `workflows/publish.yml` | `v*` 标签、手动 | 标签发 npm `latest` 并建 GitHub Release；手动触发（从 `main`）只重发稳定版。`main` 的 push 不发布。 |
| `pull_request_template.md` | 新建 PR | 三段式：改了什么 / 为什么 / 怎么验证。合并是 squash，**PR 标题会变成主干提交标题**。 |

工作流细节见 [`workflows/README.md`](workflows/README.md)。发布需要仓库 Secret `NPM_TOKEN`（npm Automation token），缺失时工作流直接失败。分支与发版纪律见 [`../AGENTS.md`](../AGENTS.md) 的 R20 / R21 与 [`../skills/release/SKILL.md`](../skills/release/SKILL.md)（工作区根的 `PLUGIN-WORKFLOW.md` 只在本机，不在仓库里）。
