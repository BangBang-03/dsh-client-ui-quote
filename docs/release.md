# 开发与发布

> 拓扑与纪律的权威版本是 [`skills/release/SKILL.md`](../skills/release/SKILL.md)；这里是给用户和贡献者看的运行方式与推送通道。

## 运行方式：`link` / canary / stable 三种运行方式

- **`link`——日常开发（最快）**：profile 里依赖写成 `link:C:/…/dsh-client-ui-quote`，窗口直接加载仓库里的文件。改完 `Ctrl+Shift+R` 硬刷新就生效，不必发版。
- **canary——每次 push 的打包产物**：仓库只有 `main` 一个分支；每推一次（纯文档 / CI 改动会被 `paths-ignore` 跳过），CI 就把 `下一个补丁版本-lab.<run_number>`（例如 `0.12.10-lab.59`）发到 npm 的 **`lab`** dist-tag，不碰 `latest`。装它：`pnpm install dsh-client-ui-quote@lab`——用来验证「打包后的产物」，而不是工作区文件。
- **stable——用户装到的版本**：发版 = 在 `main` 上改好版本与 CHANGELOG 并提交、`npm test` 跑绿，然后打 `vX.Y.Z` 标签推上去；CI 发到 npm 的 `latest` 并建 GitHub Release。没有第二条分支要快进，也没有「先 lab 再 main」的搬运。

本机切换这三档（这台开发机专用的辅助脚本，不在仓库里）：`node .dsh-quote-work/profile-mode.mjs link|lab|stable|status`。换完在窗口里 `Ctrl+Shift+R` 生效；只有宿主半有改动时才需要重启桌面端。

断言入口只有一个：`npm test`（708 项：check 12 + capsule 489 + panel 163 + host 44）；`.github/workflows/test.yml` 在每次 push / PR 上用 Node 18/20/22 各跑一遍，`publish.yml` 里 `prepublishOnly` 再跑一次才发。

**推送通道**：`git push` 优先，但本机 `github.com:443` **时通时不通**（2026-10-19 实测：短时可用、随后连续超时，每次失败等约 21 秒）。日常用工作区根的 `promote.ps1`：先试 git，失败自动转 REST 兜底（`.dsh-quote-work/publish-release.mjs`、`.dsh-quote-work/push-branch.mjs`，`-Channel rest` 可跳过探测），并核对远端 SHA。**别混用两条通道**：REST 重建的提交时区归一到 `+0000`，内容相同但 SHA 不同，同一分支混推会分叉（`git status` 看着干净，远端却多一条平行提交）；恢复就先 `git fetch`、确认 `git diff <本地> <远端>` 为空，再把本地线 reset 到远端。

一键执行：`pwsh -File promote.ps1 -Repo dsh-client-ui-quote -Tag vX.Y.Z`（测试 → 推 `main` → 打标签 → 核对远端三个 ref）。仓库内的 `skills/release/SKILL.md` 把「推 main / 发版 / 失败处理 / 验收」固化成逐步清单，日常以这份为准；工作区根的 `PLUGIN-WORKFLOW.md` 保留推送通道与事故复盘（里面的双分支拓扑是 0.12.9 之前的历史）。

**发布运维备忘**（给未来的自己）：

- 发布用的是 90 天期 granular token（勾选 **Bypass 2FA**——npm 2026-08 起强制 CI 直发必须带这个标记），**2027-01-09 到期**。到期前重签：npmjs.com → Access Tokens → Generate New Token → Granular → 勾 Bypass 2FA、Read and write (publish and stage)、All packages、90 days → 生成后 `gh secret set NPM_TOKEN --repo BangBang-03/dsh-client-ui-quote`（gh 需已登录）。
- npm 对**新账号的首包**有安全审核 hold：发布成功后包页会短暂显示 `0.0.0-stage` 占位，属于正常现象，审核自动放行（本包 0.10.0 实测约 1 小时内过审），无需人工操作。
- npm 官方的长期方向是 Trusted Publishing（OIDC 直发）：2027-01 废弃 bypass-2FA 直发之前，建议在包 Settings → Trusted Publisher 登记 `BangBang-03/dsh-client-ui-quote` + `publish.yml`，并在 workflow 里加 `id-token: write` 权限与 `--provenance` 参数。
