# Backup, update and rollback / 备份、更新和回退

## Before changing anything / 变更前

1. In the old browser and old URL, save any draft you want to keep as a named project.
2. In Library, download each project's Backup ZIP to a folder outside browser storage. Save screenshots/finished images separately if needed.
3. Test one backup by importing it. The import creates a new project and preserves the original; open the copy and generate an image.
4. Record the exact old URL, browser profile, source version and image tag. Keep the old image or archive until the new version is accepted.

1. 在旧浏览器和旧网址，将需要的草稿保存为命名作品。
2. 在作品库逐个下载备份ZIP，放到浏览器存储之外；需要的成品图另存。
3. 试导入一个备份。恢复会创建新作品、保留原作品；打开副本并生成一张图，确认素材完整。
4. 记下旧网址、浏览器配置文件、源码版本及镜像名。新版本验收前保留旧镜像或镜像包。

Artwork lives in IndexedDB in that browser profile/origin. Container backups and image archives do not contain the browser's library. Clearing cookies/site data, using private browsing, uninstalling a browser or changing origin can remove or hide works. The500MiB app budget also remains subject to the browser's quota/eviction policy. The app reports failed saves instead of silently deleting projects.

作品位于对应浏览器配置文件和origin的IndexedDB。备份容器或镜像不包含浏览器作品库。清除网站数据、隐私浏览、卸载浏览器或切换origin，可能删除或隐藏作品。500MiB应用预算仍受浏览器配额/驱逐策略约束；应用会报告保存失败，不静默删作品。

## Update a local source build / 更新源码构建

After backing up, give the current image an explicit rollback tag:

备份后，给当前镜像保留一个明确回退名称：

```sh
docker tag playlist-avatar:0.1.1-local playlist-avatar:before-update
docker compose stop
```

If your selected image is `playlist-avatar:0.1.1-arm64`, use that tag as the first argument to `docker tag` instead. 若当前使用ARM镜像，上一条docker tag的第一个参数改为 `playlist-avatar:0.1.1-arm64`。

Replace the source files with the approved new version while retaining your private `.env`, then run:

保留自己的私有 `.env`，将源码替换为获准的新版本，然后运行：

```sh
docker compose up -d --build
docker compose ps
```

Use the same PUBLIC_ORIGIN and browser profile. Open a saved work, check material counts and export a PNG before treating the update as accepted. If using a supplied image instead, load the new archive, select its exact PLAYLIST_AVATAR_IMAGE tag, and run `up -d --no-build`.

保持PUBLIC_ORIGIN和浏览器配置文件不变。打开旧作品、确认素材数量并导出PNG，验证后再确认更新完成。若使用镜像包，则加载新包、设置其准确PLAYLIST_AVATAR_IMAGE名称，再执行 `up -d --no-build`。

## Rollback / 回退

Stop the new version and set `PLAYLIST_AVATAR_IMAGE=playlist-avatar:before-update` in `.env`, then:

停止新版本，在 `.env` 设置 `PLAYLIST_AVATAR_IMAGE=playlist-avatar:before-update`，然后：

```sh
docker compose up -d --no-build
```

An old application may not understand records written by a newer storage format. Keep pre-update ZIP backups. Import a supported backup as a copy, or temporarily use a separate origin/browser profile to inspect it without clearing the original library. Do not assume container rollback also rolls back IndexedDB. A future migration must preserve original records; this candidate supports its version1 format and a guarded legacy version0 copy migration.

旧应用不一定能读取新存储格式，请保留更新前的ZIP。将受支持备份恢复为副本，或用独立origin/浏览器配置文件检查，避免清空原库。容器回退不会同步回退IndexedDB。后续迁移需保留原记录；当前候选支持v1格式，以及保留原数据的v0复制迁移。

## Move browser/address / 换浏览器或地址

Export at the old address first. Open the new deployment/browser, then import the ZIPs. `http://127.0.0.1:8080`, `http://localhost:8080`, `http://127.0.0.1:18080` and your HTTPS host are separate origins. The application does not automatically discover or copy another browser's storage.

先在旧地址导出，再在新部署/浏览器导入。`http://127.0.0.1:8080`、`http://localhost:8080`、`http://127.0.0.1:18080`及HTTPS域名是不同origin，应用不会自动发现或搬运其他浏览器的存储。

Artwork packages contain selected normalized PNGs, generated thumbnails and recipe/source metadata. They exclude passwords, Last.fm keys, upstream cookies and remembered connection tokens. Imports enforce192MiB compressed input,256MiB expanded content,128entries,1MiB manifest and20MiB per material entry; unknown paths, duplicate entries and inconsistent references are rejected. A successful restore is a new project with remapped fingerprints, source positions and weights.

作品包包含所选规范化PNG、缩略图及配方/来源元数据，不含密码、Last.fm Key、上游Cookie和记住的连接令牌。导入限制为192MiB输入、256MiB展开、128条目、1MiB manifest及单素材条目20MiB；未知路径、重复条目和不一致引用会被拒绝。恢复新建作品，并同步映射指纹、来源位置和权重。

## Forget connections / 忘记连接

Disconnect closes active private reads; remembered temporary connection tokens are stored separately only when the user opts in. Forgetting persisted credentials requires confirmation. Restarting the server expires its in-memory sessions even if a token remains in the browser. Reconnect as the same authorized user when required. Clear works, settings and connections are separate explicit scopes.

断开连接会停止私人读取；只有用户明确选择记住时，临时连接令牌才单独保存。忘记持久凭据需确认。服务重启会丢失内存会话，浏览器里仍有令牌也需要重新连接。作品、设置和连接为独立清理范围。
