# Optional sources / 可选高级来源

The ordinary public NetEase/QQ and local-image workflow requires none of this configuration. A deployment administrator chooses exact profiles; the browser cannot supply an arbitrary upstream address. Default Compose starts no additional music service.

普通网易/QQ公开歌单和本地图片流程不需要这些配置。允许档案由部署管理员明确选择，浏览器不能随意指定上游地址。默认Compose不启动额外音乐服务。

| Adapter / 适配 | Target / 目标 | Current validation / 当前验证 |
| --- | --- | --- |
| Last.fm | Native top-albums periods / recent completed tracks | Fixed responses; real key/API unverified. 固定响应通过，真实Key/API未验证。 |
| Navidrome/OpenSubsonic | Navidrome0.64.2 candidate; API1.16.1 | Fixed本人/会话/集合 checks; real instance unverified. 模拟通过，真实实例未验证。 |
| Jellyfin | 12.1.0 target; 10.11 family accepted by adapter | Fixed authentication/Users-Me isolation; real instance unverified. 模拟通过，真实实例未验证。 |
| Private NetEase compatible API | Explicitly configured implementation; protocol reference Enhanced a91ea | Implemented/source-reviewed; authentication has no fixture or real-instance validation. 已实现及源码审查，鉴权尚无模拟或真实实例验证。 |
| QQ private API | No verified private-session implementation | Disabled/unavailable. 未开放。 |

These are implementation targets, not compatibility badges. Do not enter real private credentials into an untrusted deployment. Use your own account and configured service. No account/MFA system is built into this application.

上述是适配目标，不是已兼容标识。只向可信部署输入自己的凭据，并使用已配置的本人服务。应用不自建音乐账号/MFA系统。

## Last.fm

Set LASTFM_API_KEY in private `.env` and recreate the container. In **More sources → Last.fm**, the user provides their username and an original period (7day/1month/3month/6month/12month/overall) for top albums, or recent completed tracks. Now-playing entries are excluded. Missing Key leaves ordinary public/local flows available. Keys never enter the browser's artwork recipe.

在私有 `.env` 配置LASTFM_API_KEY并重建容器。在“更多来源→Last.fm”填写用户名，热门专辑使用平台原生期间，或选择最近已完成播放。正在播放的条目会排除。没有Key时普通流程仍可用，Key不进入浏览器作品配方。

## Allowed profiles / 允许档案

ALLOWED_SERVICES is a JSON array with at most16 explicit profiles. Names and IDs are local display values. Replace the following reserved example address with your own actual HTTPS endpoint; it is not a supplied service:

ALLOWED_SERVICES是最多16个明确档案的JSON数组，名称和ID为本地显示信息。将以下保留示例地址替换为自己的真实HTTPS服务；示例并不是已提供的实例：

```dotenv
ALLOWED_SERVICES=[{"id":"my-library","kind":"subsonic","name":"My library","baseUrl":"https://music.example.invalid","allowPrivate":false,"implementation":"Navidrome 0.64.2 / OpenSubsonic 1.16.1"}]
```

Supported kinds are subsonic, jellyfin and netease-api. A qq-api profile is recognized but refuses private connections. Credentials belong in the user's opt-in connection dialog, not baseUrl, image URLs, recipe fields or the profile name. Private IP/host access additionally requires allowPrivate:true and an exact configured destination; it never enables a general proxy. Docker loopback addresses point inside the container, not to the host; select your actual Docker/network endpoint intentionally.

支持subsonic、jellyfin和netease-api。qq-api可识别配置但拒绝私人连接。凭据应在用户主动连接时填写，不放进baseUrl、图片URL、配方或档案名。访问私网还需allowPrivate:true和明确目的地，不会变成通用代理。Docker里的回环地址指容器内部，需明确选择自己的Docker/网络服务地址。

The configured origin, scheme, port and path prefix bound all redirects and requests. Every destination is checked; private data is neither shared in the anonymous cache nor served across owners/realms. Subsonic verifies the returned username, Jellyfin verifies Users/Me, and NetEase checks that a request without the supplied cookie is not globally logged in. An unsafe shared-cookie service is rejected.

档案的协议、主机、端口和路径前缀限制全部请求/跳转，逐目的地核查。私人数据不进入匿名共享缓存，也不能跨本人/会话读取。Subsonic验证返回用户名，Jellyfin核查Users/Me；网易API会测试不带所给Cookie的请求不能已有全局登录。共享Cookie服务会被拒绝。

Connections use an HttpOnly same-site browser owner cookie plus an opaque temporary token. Maximum128 sessions /24hours. Secrets remain in server memory; optional remembered browser tokens are separate from projects. Disconnect, expiry and client cancellation abort affected work. After server restart, reconnect. A plaintext deployment/network path should be replaced with trusted HTTPS before using private credentials.

连接同时需要HttpOnly同站浏览器owner Cookie和不透明临时token，最多128会话/24小时。上游秘密在服务端内存，用户可选记住的浏览器token与作品分开保存。断开、过期和客户端取消会终止受影响任务；重启后需要重连。使用私人凭据前，请将不可信明文访问路径改为可信HTTPS。

The user has no authorized real test instances/key for this candidate. Fixed-response tests verify adapter behavior and security boundaries; authenticated real imports, media availability and target-version compatibility still require an authorized instance. Ordinary anonymous imports have separate real-platform evidence.

本候选没有用户授权的真实测试实例/Key。固定响应只能证明适配行为与安全边界，真实鉴权导入、媒体可用性及目标版本兼容还需合法实例。普通匿名导入另有真实平台证据。
