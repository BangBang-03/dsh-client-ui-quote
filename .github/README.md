# .github

GitHub 侧配置：CI / 发布工作流，以及 PR 模板。

| 文件 | 触发 | 作用 |
| --- | --- | --- |
| `workflows/test.yml` | 每次 push / PR | `node --check lib/client.js` + `npm test`，Node 18 / 20 / 22 矩阵。 |
| `workflows/publish.yml` | `v*` 标签、手动 | `v*` 标签发 npm `latest` 并建 GitHub Release；手动触发（从 `main`）只重发稳定版。`main` 的 push 不发布（没有预发布频道）。 |
| `pull_request_template.md` | 新建 PR | 三段式模板：改了什么 / 为什么 / 怎么验证。合并是 squash，**PR 标题会变成主干提交标题**，描述会变成提交正文。 |

工作流细节见 [`workflows/README.md`](workflows/README.md)。发布需要仓库 Secret `NPM_TOKEN`（npm Automation token）；缺失时工作流会失败。分支与发布纪律见 [`../AGENTS.md`](../AGENTS.md) 和 [`../skills/release/SKILL.md`](../skills/release/SKILL.md)；工作区根的 `PLUGIN-WORKFLOW.md` 保留推送通道与事故复盘（不在本仓库，GitHub 上不可点）。
