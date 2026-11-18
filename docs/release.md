# 开发与发布

> 拓扑与纪律的权威版本是 [`AGENTS.md`](../AGENTS.md) 的 R20 / R21；发布流水线见 [`.github/workflows/publish.yml`](../.github/workflows/publish.yml)。这里是给用户和贡献者看的运行方式与推送通道。

## 运行方式：`link` / stable 两种

- **`link`——日常开发（最快）**：profile 里依赖写成 `link:C:/…/dsh-client-ui-quote`，窗口直接加载仓库里的文件。改完 `Ctrl+Shift+R` 硬刷新就生效，不必发版。
- **stable——用户装到的版本**：发版 = 在 `main` 上改好版本与 CHANGELOG 并提交、`npm test` 跑绿，然后打 `vX.Y.Z` 标签推上去；CI 发到 npm 的 `latest` 并建 GitHub Release。`main` 的普通 push 只跑测试，不发布。

早先还有一档 **canary**（`main` 每次 push 发一个 `-lab.N` 到 npm 的 `lab` dist-tag，用来验证打包产物）。2026-10-28 删掉了：打标签时 `prepublishOnly` 本来就会跑全套断言，验证打包产物在本机 `npm pack` 后装 tarball 即可，不值得为此把 73% 的版本号变成预发布。`lab` dist-tag 冻结在 `0.13.1-lab.61`，不删，老命令仍可安装。

本机切换档位（这台开发机专用的辅助脚本，不在仓库里）：`node .dsh-quote-work/profile-mode.mjs link|stable|status`。换完在窗口里 `Ctrl+Shift+R` 生效；只有宿主半有改动时才需要重启桌面端。

断言入口只有一个：`npm test`（821 项：check 12 + capsule 582 + panel 176 + host 51）；`.github/workflows/test.yml` 在每次 push / PR 上用 Node 18/20/22 各跑一遍，`publish.yml` 里 `prepublishOnly` 再跑一次才发。发版前还要完整跑一遍[六组交付自查](#发版前交付自查闸门)（门禁与断言、版本与数字、文案与契约、包内容、线格式与降级、发布面），自查不过不发版。

**推送通道**：`git push` 优先，但本机 `github.com:443` **时通时不通**（2026-10-19 实测：短时可用、随后连续超时，每次失败等约 21 秒）。日常用工作区根的 `promote.ps1`：先试 git，失败自动转 REST 兜底（`.dsh-quote-work/publish-release.mjs`、`.dsh-quote-work/push-branch.mjs`，`-Channel rest` 可跳过探测），并核对远端 SHA。**别混用两条通道**：REST 重建的提交时区归一到 `+0000`，内容相同但 SHA 不同，同一分支混推会分叉（`git status` 看着干净，远端却多一条平行提交）；恢复就先 `git fetch`、确认 `git diff <本地> <远端>` 为空，再把本地线 reset 到远端。

一键执行：`pwsh -File promote.ps1 -Repo dsh-client-ui-quote -Tag vX.Y.Z`（测试 → 推 `main` → 打标签 → 核对远端三个 ref）。日常以本文档与 [`AGENTS.md`](../AGENTS.md) 的 R20 / R21 为准；工作区根的 `PLUGIN-WORKFLOW.md` 保留推送通道与事故复盘（里面的双分支拓扑是 0.12.9 之前的历史）。

## 发版前交付自查（闸门）

> 本节原在仓库的 `skills/release/SKILL.md`；该目录已移除，内容以本节为准。

**每次发版都要完整跑一遍，一项不落。** 时点是改完版本 / CHANGELOG / README、`npm test` 跑绿之后，`git commit -m "chore(release): vX.Y.Z"` 之前——此时工作区应当是「只差发版」的状态。`PREV` 始终指上一个发版标签，所以 `git diff "$PREV" -- <path>` 查的是这一版的全部改动（已提交 + 未提交）。

| 组 | 查什么 | 怎么查 | 通过标准 |
| --- | --- | --- | --- |
| A1 | 改动集合只有发版文件 | `git status --porcelain` | 只有 `package.json`、`CHANGELOG.md`、`README.md`、`docs/distribution.md`（断言数变了再加 `docs/design.md`、`test/README.md`、`AGENTS.md`）；**没有 `??` 未跟踪项** |
| A2 | 语法门 | `node --check lib/client.js` | 无输出 |
| A3 | 四套离线断言 | `npm test`；`node test/check.mjs` 数 `OK` 行 | 全绿；四套数字与 `AGENTS.md` R17 记录**逐字一致**（不一致就先按 R17 同步文档，见 B3） |
| A4 | 断言没被削弱 | `git diff "$PREV" -- test/` | 没有删断言、没有把期望改成实际值换绿；新增断言能在 diff 里逐条指出（R16） |
| B1 | 版本五处一致 | `npm pkg get version`；README「稳定版当前」+ 安装示例 `"^X.Y.Z"`；`CHANGELOG.md` 小节；`docs/distribution.md` 版本行 | 同一个 `X.Y.Z` |
| B2 | CHANGELOG 形状 | `grep -n "^## $V " CHANGELOG.md` | 恰好 `## X.Y.Z — YYYY-MM-DD`；`publish.yml` 按 `## ${VERSION} ` 前缀截取 Release notes |
| B3 | 断言数全仓无旧值 | `grep -rn "离线断言" --include=*.md . --exclude-dir=.dsh-memory --exclude-dir=.workbuddy --exclude-dir=.mimosa`，再看各处的「N 组 / N 项」 | 除 `CHANGELOG.md` 历史小节外，所有数字 = 本次实跑总数；覆盖 R17 列出的全部文件 + `docs/testing.md`、`docs/release.md`、`docs/distribution.md`、本文档的写法示例、仓库外 `promote.ps1` 提示文案 |
| B4 | 标签空位 | `git tag --list "v$V"`；`git ls-remote --tags origin "refs/tags/v$V*"` | 本地与远端都为空 |
| C1 | 中英（含 ru）词条 | `node test/check.mjs`；本轮 diff | 词典键一致；R15 的 `zh`/`en`、`locale/*.json`、`package.json` description 成对改 |
| C2 | 公开 id 没被顺手改名 | `git diff "$PREV" -- lib/ locale/` | `SOURCE_NAME`、命令、tab kind、class 前缀、存储键前缀与 R10/R14 一致 |
| C3 | README 口径 = 实际行为 | `git log --oneline "$PREV"..HEAD` 逐条对照功能表 / 已知限制 | 每条用户可见改动有对应行；新宿主契约写了出处（R18） |
| D1 | 发货白名单 | `npm pack --dry-run` | 有 `icon.svg`/`lib`/`locale`/`test`/`docs`/`cordis.patch.yml`/README/CHANGELOG/LICENSE；**没有** `AGENTS.md`、`CONTRIBUTING.md`、`submission/`、`.workbuddy/`、`.mimosa/`、报告或截图工作区 |
| D2 | `files` 没被顺手放宽 | `git diff "$PREV" -- package.json` | 只有 `version`（外加本轮明确要发的条目） |
| D3 | 体积同量级 | `npm pack --dry-run` 的 `total files` / `package size` | 与上一版同量级（0.14.4：32 files / 991 kB）；突增就查是不是混进了大文件 |
| E1 | 旧消息还能回读 | capsule 的 wire 组；本轮若碰过 `QUOTE_MARK`/`COMMENT_MARK`/`REPLY_MARK`/`REF_PREFIX`/`REF_LINE`/`escapeBodyLine` | 全绿；碰过就拿一条**旧版本**样本跑 `quoteBlock`/`splitQuoteRuns` round-trip，把结果贴进汇报（R7） |
| E2 | 坐标与本机键没改 | `git diff "$PREV" -- lib/client.js` | 没有改 `dsh-client-ui-quote:v1:`/`v2:` 前缀与 `REF_LINE` 形状（R8/R10） |
| E3 | 降级路径 | `node test/host.mjs`；check 的「no enforced peers」 | 全绿；缺 `webServer`/`agents`/`connection`/`betterSidebar` 仍是静默降级（R13） |
| F1 | 远端形状 | `git ls-remote --heads origin` | 只有 `refs/heads/main` |
| F2 | workflow 没被误改 | `git diff "$PREV" -- .github/` | 无意外改动；改了要能说清动机 |
| F3 | 凭证还在期 | 对照本文档的运维备忘 | `NPM_TOKEN` 未过期（2027-01-09）；临近先重签并 `gh secret set` |
| F4 | 包外没有泄漏 | `git status --porcelain`；`git ls-files` 里搜报告名 | 没有 `.dsh-quote-work/`、报告、截图工作区进入仓库（R22） |

一键自查（在仓库根执行，输出逐项对照上表）：

```bash
cd C:/Users/15812/Desktop/dsh/dsh-client-ui-quote
PREV=$(git describe --tags --abbrev=0); V=$(node -p "require('./package.json').version")
echo "PREV=$PREV  V=$V"

# A 门禁
git status --porcelain                                  # 只有发版文件，无 ??
node --check lib/client.js && echo "A2 syntax ok"
npm test 2>&1 | grep "checks passed"                    # capsule / panel / host
echo "check: $(node test/check.mjs | grep -c '^OK') 组"  # 期望 12
git diff "$PREV" -- test/ | head -30                    # 期望空，或本轮新增断言

# B 版本与数字
grep -n "稳定版当前" README.md
grep -n '"dsh-client-ui-quote": "\^' README.md
grep -n "^## $V " CHANGELOG.md
grep -rn "离线断言" --include=*.md . --exclude-dir=.dsh-memory --exclude-dir=.workbuddy --exclude-dir=.mimosa | grep -v CHANGELOG.md
git tag --list "v$V"; git ls-remote --tags origin "refs/tags/v$V*"

# C 文案与契约
node test/check.mjs | tail -1
git diff "$PREV" --stat -- lib/ locale/ package.json README.md

# D 包内容
npm pack --dry-run 2>&1 | grep -E "total files|package size"
npm pack --dry-run 2>&1 | grep -E "AGENTS\.md|CONTRIBUTING\.md|submission/|\.workbuddy/|\.mimosa/"   # 期望无输出

# E 线格式与降级
git diff "$PREV" -- lib/client.js | grep -E "^\+.*(QUOTE_MARK|COMMENT_MARK|REPLY_MARK|REF_PREFIX|REF_LINE|escapeBodyLine|dsh-client-ui-quote:v)"   # 期望无输出
node test/host.mjs | tail -1

# F 发布面
git ls-remote --heads origin                            # 只有 main
git diff "$PREV" --stat -- .github/
git status --porcelain --ignored=matching | head -6     # 只有本地忽略项
```

**判定与留痕**：

- 有红项：先修，再**从 A 组重跑**（改了文档数字也可能又变）。
- 本轮确实不涉及的项可以标「不适用」，但必须写原因，不能留空。
- 结论按组写进汇报：A3 的四个数字、B3 修掉的旧数字、D1 的文件数与体积、E1 是否碰过线格式、不适用项。要落盘就写到仓库外 `.dsh-quote-work/release-check-vX.Y.Z.md`（R22）。
- 自查结论是发版证据，不是礼貌步骤：用户问「自查做了吗」时，要能一句话给出六组结论。

**发布运维备忘**（给未来的自己）：

- 发布用的是 90 天期 granular token（勾选 **Bypass 2FA**——npm 2026-08 起强制 CI 直发必须带这个标记），**2027-01-09 到期**。到期前重签：npmjs.com → Access Tokens → Generate New Token → Granular → 勾 Bypass 2FA、Read and write (publish and stage)、All packages、90 days → 生成后 `gh secret set NPM_TOKEN --repo BangBang-03/dsh-client-ui-quote`（gh 需已登录）。
- npm 对**新账号的首包**有安全审核 hold：发布成功后包页会短暂显示 `0.0.0-stage` 占位，属于正常现象，审核自动放行（本包 0.10.0 实测约 1 小时内过审），无需人工操作。
- npm 官方的长期方向是 Trusted Publishing（OIDC 直发）：2027-01 废弃 bypass-2FA 直发之前，建议在包 Settings → Trusted Publisher 登记 `BangBang-03/dsh-client-ui-quote` + `publish.yml`，并在 workflow 里加 `id-token: write` 权限与 `--provenance` 参数。
