# 安全策略

## 支持范围

- 只维护 npm `latest` 与 `main` 的最新提交；旧版本请先升级再复现。
- 插件支持 DSH `>=0.2.0-rc.2`；宿主自身的问题请报给 DSH，不在这里处理。

## 报告漏洞

**不要开公开 issue。**

优先用 GitHub 的私密报告：仓库 **Security** 页 → **Report a vulnerability**（Security Advisories）。
如果该入口未开启，开一个**不含细节**的 issue，只写「需要一个私密的安全报告渠道」，维护者会联系你。

报告请尽量带上：

- 受影响的插件版本与 DSH 版本 / 运行形态（桌面 / web）；
- 复现步骤与影响（例如引用内容是否可能离开本机）；
- 你希望的修复时限；如果愿意，附上补丁思路。

## 安全模型

- 引用正文、评论、坐标只在本机：插件不写盘、不上报、不把引用内容发进模型上下文（你主动发送的引用块除外）。
- 客户端唯一的网络请求是**同源**本地路由：`POST /ui-quote/api/sidechat.start`（宿主半用 `connection.requestRejection` 做同源围栏）与 better-sidebar 的 `POST /sidebar/api/sidechat.start`。
- 导出走浏览器 `Blob` 下载，不经过服务器。
- 本地存储只用 `dsh-client-ui-quote:v1:*` / `v2:*` 前缀的 `localStorage` 键。

因此重点关注：同源围栏绕过（CSRF / DNS rebinding 等）、把引用内容带出本机、隐藏线程种子注入、能让宿主崩溃的输入。需要本机代码执行或已经攻陷宿主的前提不算本插件的漏洞。

## 响应

个人维护的项目：目标 **7 天内**确认收到，修复时间按影响面约定；不提供漏洞赏金。
