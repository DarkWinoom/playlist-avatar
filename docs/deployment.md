# Deployment / 部署

The default `compose.yaml` starts one application process in one non-root container. It provides the web page, anonymous playlist parsing and bounded cover forwarding. No database, music server, host directory or persistent application volume is needed. The image uses a pinned official Node24 digest and includes runtime license notices.

默认 `compose.yaml` 只启动一个非root应用容器，提供网页、匿名歌单解析及受限封面转发，无需数据库、音乐服务、宿主目录或应用持久卷。镜像固定官方Node24 digest，并包含第三方许可原文。

## Settings / 配置

Copy `.env.example` to `.env` and edit only what your deployment needs. Restart/recreate the service after changing settings with `docker compose up -d --no-build`. Keep any optional key private.

复制 `.env.example` 为 `.env`，按需要修改，然后用 `docker compose up -d --no-build` 重建服务。配置可选Key后不要公开此文件。

| Setting | Meaning / 含义 |
| --- | --- |
| APP_PORT | Host port; use a free port. 宿主端口，须空闲。 |
| BIND_ADDRESS | Default127.0.0.1: this computer only. 默认只允许本机访问。 |
| PUBLIC_ORIGIN | Exact browser protocol+host+port, without a path. 精确浏览器协议、主机和端口，不含路径。 |
| PLAYLIST_AVATAR_IMAGE | Actual loaded local image tag, or your approved registry tag after publishing. 实际已加载的本地镜像名；发布后可改为获准的注册表名称。 |
| LASTFM_API_KEY | Optional server-only key; empty disables Last.fm. 可选服务端Key，空值禁用Last.fm。 |
| ALLOWED_SERVICES | Optional JSON profiles; [] disables private sources. 可选JSON档案，[]禁用私人来源。 |

The fixed protections include256MiB memory / no extra swap, one logical CPU,128MiB V8 old-space,64pids, read-only root,16MiB tmpfs, dropped capabilities and no-new-privileges. Logs rotate at5MiB×2. An internal HTTP health check runs every30seconds. `stop`/SIGTERM closes active server connections with a bounded shutdown period. These limits do not describe measured idle usage.

固定保护为256MiB内存、不增加Swap、一个逻辑CPU、128MiB V8 old-space、64pids、根文件系统只读、16MiB tmpfs、移除capabilities和禁止新增权限。日志5MiB×2轮转，内部HTTP健康检查每30秒一次；停止/SIGTERM会关闭在途连接并有退出截止。这些限制与实用量分开报告。

## HTTPS / NAS

For another device, use an HTTPS reverse proxy you administer. Set `PUBLIC_ORIGIN=https://your-real-hostname` (replace with your real origin) and forward to the container's8080port. Preserve its Host header and COOP/COEP/CSP/security headers. Bind the service only where the proxy can reach it; choose BIND_ADDRESS or a Docker network intentionally. The application exposes no TLS listener and no built-in public-site account gate.

其他设备访问应使用自己管理的HTTPS反向代理，将PUBLIC_ORIGIN替换为真实HTTPS origin，再转发到容器8080端口，保留匹配的Host及COOP/COEP/CSP等安全头。明确选择BIND_ADDRESS或Docker网络，使服务只对代理可达。应用本身没有TLS监听，也没有公共网站账号门禁。

Do not remove origin checks or browser security requirements to make a wrong address work. Browser image hashing, persistent works and worker APIs depend on the secure context. Loopback HTTP is the supported local option; ordinary remote HTTP is not. A proxy address change gives the browser a different library, so export backups at the old address first.

不要通过移除origin检查或浏览器安全条件来适配错误地址。图片哈希、持久作品和worker能力依赖安全上下文。本机回环HTTP可用，普通远程HTTP不在支持范围内。代理地址变化会切换浏览器作品库，先在旧地址导出备份。

## Image archives / 镜像包

Source build chooses the Docker host architecture automatically. Supplied `amd64` and `arm64` archives have explicit local tags listed in [release.md](release.md). Load the matching file with `docker load -i <file>`, select its tag through PLAYLIST_AVATAR_IMAGE and run `docker compose up -d --no-build`. A successful ARM smoke under emulation does not establish compatibility with every NAS model.

源码构建自动使用Docker主机架构。镜像包的amd64/arm64对应本地名称见[release.md](release.md)。用 `docker load -i <文件>` 加载对应包，通过PLAYLIST_AVATAR_IMAGE选择正确名称，再运行 `docker compose up -d --no-build`。ARM仿真运行成功不能代表所有NAS型号已实测。
