# 0.1.2 acceptance candidate / 验收候选

The editor now separates style parameters, fixed canvas positions and the image library. No-photo styles show no image/source tools. Photo styles use original illustrations until a picture is explicitly placed; choosing zero or one picture does not alter the layout. Imported pictures only enter the library. General colour/title, random, sort and weighting controls have been removed; repeatable composition numbers and Reset parameters replace hidden random changes.

编辑器分为风格参数、固定画布位置与独立图片库。无图风格没有图片/来源工具；有图风格默认填充原创插画，选零张或一张图不改布局。导入只入库；去掉通用颜色/标题、随机、排序和权重操作，构图编号可复现，提供恢复默认参数。

| Scope / 范围 | Actual evidence / 本轮结果 |
| --- | --- |
| Checks | 69 tests / 19 files, types/build and 56 runtime notices pass. JS gzip196.70kB, CSS7.47kB. |
| Geometry | 0/1/multiple image choices keep the same positions; same image may occupy several slots, each with independent framing. |
| Output | 24 default512px PNGs repeat pixel-exactly; HTML/Offscreen paths match. All17 styles with composition numbers change with a different number; other7 hide that control. Six actual2048 JPEG/WebP production-worker exports pass. |
| Library | DBv1→v2 preserves old work; work clearing retains library; removing a library image retains saved-work blobs. Linked project/library imports roll back on cancellation or the1000-entry library cap. |
| Backup | ZIP contains only this work's real pictures, no virtual slot files or unrelated library; repeated placement and per-slot crop restore. |
| Browser | Actual desktop drag/tap placement, multi-position reuse and Undo; uploaded2 original images and reopened named work with positions/pool intact. Real NetEase613 tracks/9 covers imported into library without changing current Mosaic, parameters, placements or chosen3 pictures. 375px layout inspected. |
| Images | playlist-avatar:0.1.2-local is built for amd64. ARM runtime remains unverified on this host; original baseline archives are retained. |

New drafts use fixed slots. Old recipes retain their stored appearance until an explicit style change/reset or image-placement operation converts them; their explicit layout, source metadata and saved blobs are retained. Native stats remain data in the library/backup rather than new editor controls. Image library capacity is up to1000 items within the existing500MiB browser storage budget; a work may choose50 pictures and display at most16 positions. The ordinary normalized import batch remains32MiB, working picture/history cache64MiB and prepared bitmaps64MiB.

新草稿采用固定槽位，旧作品保留原效果；用户明确切风格、重置或放图才转换。显式布局、来源数据与Blob保留；统计作为数据保留，不增加编辑操作。图片库最多1000条且总预算仍500MiB，本次最多选50张、画布最多16位置；普通规范化导入批次32MiB、工作素材/历史64MiB和位图64MiB预算保持。

Real advanced instances, physical phones/touch/IME/screen readers, Firefox/Safari and updated full-browser/GPU/20-round resource measurements are still unverified. Previous performance and two-architecture results below are historical. No public release or license decision is inferred; project code remains UNLICENSED and no push/upload has occurred.

真实高级实例、真机/触控/输入法/读屏、Firefox/Safari与新版整页/GPU/20轮资源测量仍未验证。下文旧性能与双架构结果仅为历史；未公开发布，UNLICENSED、未推送/上传。

---

# 0.1.1 historical candidate / 历史候选

The current local candidate adds a refined workbench, playlist import dialog, 24 compositions and direct photo editing. New workspaces start with Aura; existing drafts retain their saved template. Unused materials remain available and are included with image framing in saved works and ZIP backups. The previous 0.1.0 images and archives are retained as a rollback baseline.

当前本地候选完成工作台优化、歌单弹窗、24套构图和画布图片编辑；新工作区默认光晕，旧草稿按原模板恢复。备用素材与裁切完整保存及备份；0.1.0镜像与归档保留用于回退。

| Area / 项目 | Current evidence / 本轮结果 |
| --- | --- |
| Source checks | 62 tests / 18 files, types and production build pass; frozen dependencies and 56 runtime notices. |
| Templates | 24 distinct 512px PNGs plus 24 parameter/seed/framing variants; HTML/Offscreen export pixel parity. Mesh seed-only change also verified. |
| Production Workers | Duo/Bloom/Glass JPEG and WebP at actual 2048px; ZIP round-trip with four materials, two selected and framing retained. |
| Interaction | Actual Chromium mouse canvas swap, shelf-to-canvas replacement, crop drag with one Undo, deselect/reselect, saved work reopened with unused materials and framing. |
| Layout | Desktop Chromium at 320, 375, 768 and 1440px, dark theme and reduced motion; no claim of physical touch-device coverage. |
| Initial files | JS gzip about 207kB, CSS gzip 6.63kB. Previous whole-browser and container measurements below are historical, not rerun results for this editor. |
| linux/amd64 | playlist-avatar:0.1.1-local; versioned health/static/gzip/capabilities/security HTTP smoke passed at 18080. |
| linux/arm64 | playlist-avatar:0.1.1-arm64 built using native build stage and ARM runtime base. Current Docker host returns Exec format error for ARM Node; runtime and native ARM/NAS validation remain pending. |

No public registry, push/upload or project distribution license has been selected. Project-owned code remains UNLICENSED. Actual Last.fm/self-hosted instances, physical phones/IME/screen readers and Firefox/Safari are still unverified. The browser library remains on the same origin; updating this local container does not clear its data. Updated source and image packages use 0.1.1 names and supplied checksums.

未公开发布、推送或上传；自有代码继续UNLICENSED。真实高级服务、真手机/输入法/读屏及Firefox/Safari仍未验证。作品库地址不变，本机更新不清除数据。新版交付包使用0.1.1文件名与校验值。

---

# 0.1.0 historical baseline / 历史基线

Local development and packaging are ready for owner acceptance. No Git remote, public registry or publishing destination is configured; nothing has been pushed/uploaded. Project-owned code remains UNLICENSED until the owner selects a public distribution license. Runtime dependency texts for56 packages and Lucide notices are included in source/images. Ordinary use documentation is complete in [English](../README.md) and [Chinese](../README.zh-CN.md).

本地开发与打包供项目所有者验收。尚未配置Git remote、公共注册表或发布目的地，没有推送/上传。自有代码保持UNLICENSED，公开发行许可由所有者决定；源码和镜像包含56个运行依赖及Lucide许可。普通用户英文/中文说明均已提供。

## Actual image names / 实际镜像

| Architecture | Local tag | Archive |
| --- | --- | --- |
| linux/amd64 | playlist-avatar:0.1.0-local | playlist-avatar-0.1.0-amd64.tar.gz |
| linux/arm64 | playlist-avatar:0.1.0-arm64 | playlist-avatar-0.1.0-arm64.tar.gz |

These local tags exist on the validation machine. They are not published registry URLs. Both images were built from the same application source with Node24.21, pnpm11.19 frozen dependencies,52 tests/type/build checks, precompressed JS/CSS and generated notices. Both run as uid1000 with the production resource protections. ARM ran through Docker Desktop emulation on an x86 host; real ARM NAS models were not tested. HTTP smoke covers health, capabilities, JavaScript/gzip/immutable caching, original PNG thumbnail and security headers. Anonymous NetEase/QQ metadata and actual JPEGs also passed on both architectures before the final static-delivery/public-range-guard rebuild.

镜像名称在本机确实存在，不是已发布URL。两个架构使用相同应用源码、Node24.21及pnpm11.19冻结依赖，完成52项测试/类型/构建、JS/CSS预压缩和许可生成；以uid1000运行并施加正式资源保护。ARM为x86主机上的Docker Desktop仿真，未测试真实ARM NAS。HTTP smoke涵盖健康、能力、JavaScript/gzip/不可变缓存、原创PNG和安全头；最后静态传输及公开分段边界重建之前，两架构匿名网易/QQ及真实JPEG也已通过。

Each compressed runtime image is about78MiB; image archives and SHA-256 values are listed in the supplied `SHA256SUMS`. Registry-layer bytes, Docker's image-size field, unpacked filesystem size and archive bytes are different metrics. The source ZIP excludes local planning/evidence, Git history, credentials, caches and generated dependency directories. Image archives contain runtime web/server files and notices rather than the developer workspace.

各架构压缩运行镜像约78MiB，镜像包校验值见交付的SHA256SUMS。注册表layer字节、Docker image-size字段、展开文件系统与压缩包字节是不同口径。源码ZIP不含本地方案/证据、Git历史、凭据、缓存或依赖目录；镜像包仅保留运行网页/服务及许可，不包含开发工作区。

## Verified scope / 已验证范围

| Area | Evidence summary / 结果 |
| --- | --- |
| Core sources | Real anonymous NetEase200/QQ67, actual JPEGs; formal Chromium imports and PNG exports. 真实匿名数据与封面，正式界面闭环。 |
| Templates/exports | 16 distinct compositions; empty/minimum/typical/small checks, deterministic snapshots,9 PNG/JPG/WebP size combinations and transparent/circular behavior. 16模板及真实编码、快照与透明/圆形检查。 |
| Local works | IndexedDB restore, saved blobs, undo, quota rollback, trash/cancel/recover, ZIP import/migration and race checks. 本地素材完整保存、配额/迁移/竞态/确认检查。 |
| Data/security | D0–D8/F01–F20 evidence matrix; fixed-response500/2301-record cases, URL/IP/redirect/size guards,26 negative cases,43 private Nav/Jelly/session cases and8 isolated container pressure checks. 合成与真实结果分列。 |
| Container budget | M6 candidate:301.402s/31 external samples, idle CPU0.267%, cgroup boundaries66.695MiB; typical observed63.281MiB; fixture-pressure106.504MiB including driver/upstream. 不是配额替代实测。 |
| Preview performance | D1 isolated production preview/worker harness,20 rounds: p95 transition16.86ms/direct16.85ms, feedback max64.43ms,2048 PNG218–291ms,0 runtime errors/idle frames/long tasks. 隔离预览模块测量，不伪称全部浏览器/设备。 |
| Initial files | JS gzip-equivalent about200KiB, CSS about4KiB; final server also serves actual precompressed assets. 初始包体与实际压缩传输。 |

Resource/performance measurements refer to the M6 candidate, not a claim that every later packaging edit was fully rerun for five minutes/twenty rounds. Later changes are confined to corrected recipe source ranks/backup IDs, scanned ranges/session expiry cleanup and static delivery. Their targeted regressions and final image smoke pass. The retained local evidence includes failed initial runs and corrections; it is deliberately excluded from release artifacts.

资源/性能数据来自M6候选，不冒称之后每次打包编辑都重复了五分钟/二十轮。后续仅修正配方来源位置/备份ID、扫描范围/过期清理及静态传输，有针对性回归和最终镜像烟测。本地保留初轮失败及修复证据，发行物不打包这些工作资料。

## Unverified / 未验证

The actual named four-blob Mosaic was reopened and exported at2048px while the application server was stopped, using the already loaded editor and warmed worker/assets. Normal amd64 stop took1491ms, exit0/noOOM; ARM emulation stop took1685ms, exit0/noOOM. An earlier ARM stop returned137 in209ms without sufficient diagnostics, so its cause remains unknown. Browser works survived the stop/start cycle and the HTTP smoke passed after restart. This warm-cache case does not establish first-use export of an uncached optional module while offline.

实际四素材命名Mosaic作品在应用服务停止时重开并导出2048px，使用已加载编辑器和暖缓存worker/素材。amd64停止1491ms、exit0/无OOM；ARM仿真停止1685ms、exit0/无OOM。更早一次ARM停止209ms返回137，缺少诊断，原因仍未知。浏览器作品经过停止/启动仍保留，重启烟测通过。该暖缓存例不代表离线时首次使用尚未缓存的可选模块也可导出。

- Real Last.fm key/API, Navidrome/OpenSubsonic, Jellyfin and private NetEase instances. Nav/Jelly have fixtures; private NetEase authentication has implementation/source review only. QQ private sessions remain unavailable.
- Physical Android/iPhone/NAS, real touch/IME/screen readers, Firefox and Safari/WebKit. Desktop Chromium viewport tests are separated from these.
- Absolute renderer/worker/compositor/GPU and export-memory peaks. Memory API recorded one23,190,768-byte estimate; its after-run request did not finish in the15-second window. JS heap and a27,721,728-byte decoded estimate do not establish the≤256/384MiB total-memory goals.
- Production Node heapUsed/external are not measured externally. Cgroup/RSS/HWM and sampling overhead are separately reported.
- Hosted CI has not run because there is no remote. The local checks and two image builds are actual results.
- Public registry, project license and owner acceptance are pending. Local packaging does not authorize publication.

- 真实Last.fm、Navidrome/OpenSubsonic、Jellyfin和网易私人实例；Nav/Jelly有模拟验证，私人网易鉴权仅实现/源码审查，QQ私人未开放。
- 真手机/NAS、实际触控/IME/读屏、Firefox/Safari/WebKit；桌面Chromium视口仿真分列。
- renderer/worker/compositor/GPU及导出绝对峰值；一次Memory API估计约23MB，后测15秒无结果；JS堆/约27.7MB解码估计不能证明256/384MiB整页目标。
- 正式Node heapUsed/external未外部测量；cgroup/RSS/HWM与采样开销另记。
- 无remote，尚无Hosted CI结果；本地检查及两镜像构建均真实执行。
- 公共注册表、自有代码许可及最终用户验收待定，本地打包不构成公开发布授权。

## This workspace's acceptance instance / 本工作区验收入口

Open [http://127.0.0.1:18080](http://127.0.0.1:18080). The local instance uses Compose project `playlist-avatar-validation`; to stop/restart that specific instance, run `docker compose -p playlist-avatar-validation stop` / `docker compose -p playlist-avatar-validation start`. The generic README commands are for a new default deployment. The temporary ARM smoke container is cleaned up after validation. The user's unrelated service on8080 is untouched.

本机验收访问上述18080地址，特定项目名为playlist-avatar-validation，停止/重启使用带 `-p playlist-avatar-validation` 的命令；README通用命令面向新部署。临时ARM烟测容器在验证后清理，不动用户8080服务。
