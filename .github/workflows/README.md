# .github/workflows

两条独立通道：测试门与发布门。

## `test.yml`

- 触发：所有 `push` 与 `pull_request`。
- 矩阵：Node 18 / 20 / 22（对应 `engines.node >= 18`）。
- 步骤：`node --check lib/client.js` → `npm test`（706 组离线断言）。
- 插件没有运行期依赖，所以不跑 install。

## `publish.yml`

- `v*` 标签：发 `latest`，并按 `CHANGELOG.md` 同名小节建/更新 GitHub Release。
- 手动 `workflow_dispatch`：从 `main` 触发时只重发稳定版（标签已存在就更新 notes）。
- `main` 的普通 push **不发布**，只跑 `test.yml`；需要验证打包产物时在本机 `npm pack` 后装 tarball。
- 需要 Secret `NPM_TOKEN`；`prepublishOnly` 会先跑完全部离线断言，失败不发包。

历史上有一条 `publish-canary`（`main` push → npm `lab` dist-tag 的 `-lab.N` 预发布），2026-10-28 已删除；`lab` dist-tag 冻结在 `0.13.1-lab.61`，不再更新。
