# KeyVideo TODO

本清单来自对前端、Tauri、后端、Supabase、OSS、导入导出与发布流程的静态复核。优先级按安全与数据风险排序；完成事项时请补充回归测试并勾选。

> 边界说明：本文件仅记录待办，不代表已执行生产部署、线上数据库迁移或生产数据写入。涉及生产或数据库的条目，必须在单独评审、备份、迁移和发布流程中明确执行。

## P1：安全与数据正确性

- [x] **先鉴权，再处理幂等缓存。** 已抽出 `backend/idempotency.js` 并安装在鉴权与限流之后；键包含用户、方法、路由、客户端 key 与规范化 body 哈希，`Map` 有硬上限并按最旧条目淘汰，5xx 不缓存。前端批量 key 已纳入 `imageSrc`，显式重试附加 `retryToken` 生成新 key。`backend/idempotency.test.js` 覆盖未登录、跨账号、同 key 不同 body、并发合并、5xx 重试与高基数淘汰；`tests/core.test.ts` 覆盖参考图变化与重试 key。
- [x] **避免上游任务提交的模糊重试造成重复计费。** 已抽出 `backend/sandbaseSubmit.js`：只为用户与请求提供稳定的 `Idempotency-Key`（按用户 + 请求 key + payload 哈希生成），仅对可证明未受理的 408/429 自动重试，网络错误、超时、5xx 与畸形 2xx 一律失败并暴露同一幂等键供显式重试；批量路由按分镜追加 shot 后缀，避免相同分镜被合并。`backend/sandbaseSubmit.test.js` 覆盖“上游已受理但连接断开后只发一次且重试沿用同一键”、429/408 重试、5xx/网络错误不重试与用户/负载隔离。
- [x] **让长耗时生图接口可恢复。** `/api/ai/background` 现登记 `background` 任务（含 userId/projectId）并支持 `?async=true` 返回 `taskId`：客户端改为异步提交后轮询（上限 360 秒），不再受 180 秒同步超时限制；同步调用仍返回兼容的 base64。`/api/ai/task/:taskId` 对 processing/pending 的图片任务做 3 秒节流的惰性上游状态刷新（表有 2000 条硬上限），因此进程重启或断连后客户端继续轮询即可恢复终态。场景图片改用同源图片代理下载后再上传 OSS，避免 media.sandbase.ai 的 CORS 失败。故障注入与真实重启未做端到端测试。
- [x] **明确云端素材列表的隐私边界。** `audio_assets`/`model_assets` 新增 `is_public`（默认 `false`），SELECT 策略改为仅 `authenticated` 且 `is_public OR auth.uid() = user_id`，移除匿名 `USING (true)`；前端查询改为显式列（不再拉取 `user_id`），并保留显式共享能力。已同步更新 `src/utils/create_table.sql` 并新增可追踪迁移 `supabase/migrations/20261030_asset_privacy.sql`（含回滚说明与标记公共素材示例）。生产库仍需在单独发布流程中执行迁移并回归匿名/跨账号访问；现有跨用户共享素材执行后会变为各自私有，如需共享须显式 `is_public = true`。
- [x] **生产 API 全链路改为 HTTPS。** 发布工作流不再硬编码明文 HTTP IP，改为读取仓库变量 `VITE_BACKEND_URL`；构建前强制校验变量存在且以 `https://` 开头，并扫描 `src`/`src-tauri` 拒绝遗留旧地址 `203.205.89.231`，否则 CI 失败。运维需在仓库 Variables 中配置受信任的 HTTPS 域名（例如 `https://www.marius.com.cn/videos`）后才能发布。
- [x] **把 OSS 对象删除权绑定到对象所有者。** 已抽出 `backend/uploads.js`：上传写入 `audio/<sanitized-user-id>/...` 并带 `x-oss-meta-keyvideo-owner` 元数据；删除要求 URL 属于配置 bucket 且 key 位于当前用户前缀内，路径穿越/跨用户/遗留根目录对象一律 403，路由自身也会拒绝未认证请求。`backend/uploads.test.js` 覆盖自有删除、跨用户拒绝、遗留对象、错误 bucket、上传类型/大小限制与 owner 转义。`vite.config.ts` 的开发上传中间件待 P2 单独收紧。
- [x] **限制 AI 生成的可计费输入与额度。** 已新增 `backend/generationLimits.js` 并在所有付费上游调用前校验：提示词长度/非空、图片引用协议与大小、视频时长 1–20 秒、单图任务单图、参考图上限 9 张、批量 ≤10 镜且每镜逐项校验、抠图强度与放大参数范围；相对路径仅允许 `public/` 内且拒绝 `..`。额度按用户 UTC 日计数（默认 200，`AI_DAILY_TASK_LIMIT`）并限制并发（默认 6，`AI_MAX_CONCURRENT_TASKS`），批量按镜数计费，响应 429 并带 `code`/`Retry-After`；并发槽在提交完成或响应结束时幂等释放。已接入 mannequin/tryon/background/inpaint/upscale/video task/batch。`backend/generationLimits.test.js` 覆盖无效输入、边界值、日额度、跨日重置、并发限制与容量上限。
- [x] **收紧公开图片代理。** 已抽出 `backend/imageProxy.js`：仅允许 `https://media.sandbase.ai`，每一跳重定向先做 SSRF 校验与主机白名单检查（最多 3 跳），响应体流式读取并按字节上限中止，整条请求有总超时，按客户端 IP 分钟限流且限流表有硬上限。`backend/imageProxy.test.js` 覆盖私网重定向、逐跳校验、分块超大响应、响应头/响应体超时、非图片响应与限流。SSRF 与超时公共函数已移到 `backend/remoteUrl.js`。
- [x] **实现可撤销的 SSO 会话。** `/logout` 现读取 Bearer token，校验后按 `jti` 加入带过期时间的撤销表（硬上限 10000，可通过 `SSO_REVOKED_SESSION_CAPACITY` 调整），`verifySessionToken` 与 API 鉴权中间件默认检查撤销状态；无效 token 仍统一返回 204。前端登出会先带上 token 再清除本地会话。`sso.test.js` 与 `auth.test.js` 覆盖登出后 `/session` 和受保护 API 立即 401。
- [x] **为每位云端用户生成唯一默认工程 ID。** `src/utils/aiProjectFactory.ts` 新增 `createProjectId()`（优先 `crypto.randomUUID`，含无 crypto 回退）与 `migrateLegacyProjectIds()`；新默认工程使用随机 ID，加载时把遗留零 UUID 工程及活动工程指针迁移为新 ID 并写回本地，避免第二个 Supabase 用户撞全局主键。`tests/core.test.ts` 覆盖 UUID 格式/唯一性、遗留 ID 迁移、重复遗留 ID 去重与幂等不改动。
- [x] **修复 `model_assets` 的更新 RLS。** 已在 `src/utils/create_table.sql` 与迁移 `supabase/migrations/20261030_model_assets_update.sql` 中添加 `FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)`，覆盖前端重命名与场景重生成；跨用户更新由 RLS 拒绝。生产库需按顺序执行素材隐私与 UPDATE 两个迁移，并在发布评审中回归重命名/重生成/跨用户拒绝。
- [x] **统一 SSO 与 Supabase 云资产的身份路径。** 模型、场景与 BGM 上传均先读取 Supabase session：无 session（SSO 用户）直接写入本地库并使用已上传的 OSS URL，不再尝试 `user_id = null` 的插入；云端插入失败时 BGM/模特均回退为本地记录（保留同一 OSS 对象，避免孤儿），模特上传提示改为“已保存到模特库（云端不可用时自动保存到本地）”，BGM 仍区分本地/云端。已通过 `tsc` 与 ESLint；未做 Supabase 故障注入测试。
- [ ] **让 SSO 登录状态存储支持生产实例拓扑。** `backend/sso.js` 的 OAuth state 和一次性 ticket 都只存在当前 Node 进程内；回调/兑换被负载均衡到另一实例，或部署重启发生在登录中途时，state/ticket 会丢失。使用带 TTL 的共享存储，或强制并验证会话粘性与部署行为，并覆盖跨实例回调、重启和过期测试。
- [x] **按用户隔离 Tauri 本地视频素材。** `local_video_assets` 新增 `owner_id` 列与索引；初始化时通过 `PRAGMA table_info` 检测并为旧表补列，旧版无主记录由首个打开且有权限的账号一次性认领。`getLocalVideos`、`saveLocalVideo`、`deleteLocalVideo` 均按当前 scope 过滤（未登录用 `owner_id IS NULL`），保存时拒绝覆盖其他账号的同 ID 记录，删除返回真实 `rowsAffected`。浏览器 IndexedDB 回退继续沿用 scope 键。已通过 `tsc` 与 ESLint；运行时迁移需在 Tauri 桌面环境验证。
- [x] **按工程保存时间轴状态。** `src/App.tsx` 已将时间轴图层、画幅和分镜缓存迁移到工程 ID 命名空间，并对旧账号级键执行一次兼容迁移；切换工程时先加载目标工程状态再允许自动保存。
- [x] **按工程隔离分镜恢复缓存。** 分镜现按工程键 `projectStorageKey(projectId,'storyboards')` 保存并一次性兼容迁移旧账号级数据；i2v 时间轴媒体层新增 `storyboardId` 属性，重载时由 `findStoryboardForLayer()` 先按 storyboard ID 匹配，旧层才回退 `media_i2v_<index>_`；已删除/替换分镜不会把别的视频恢复到当前工程。`tests/core.test.ts` 覆盖重排后按 ID 匹配、旧层索引回退、分镜删除返回空与非 i2v 图层。快速切换仍依赖现有 project-scoped 键，未做浏览器级并发切换测试。
- [ ] **让账号切换使旧异步任务失效并固定存储所有者。** `src/hooks/useProjectLifecycle.ts` 的工程加载没有清理/身份代次校验，迟到的结果仍会调用父级 setter；`src/hooks/useAssetLibrary.ts` 虽阻止卸载后的 UI 更新，却仍会把迟到的云端素材结果写入 `localDB`。而 `src/utils/db.ts` 的 `setScope` 修改全局 scope，异步操作在各次 `get`/`set` 调用时才解析键；账号切换期间，旧账号响应可能污染新账号本地缓存或覆盖新账号工程状态。为异步加载绑定身份快照、切换时取消/忽略过期结果，并确保写入沿用发起时的 owner；覆盖快速 A→B 切换、响应乱序、登出及云端素材缓存场景。
- [x] **让工程包真正往返恢复。** 当前导出调用已写入 AI 分镜、模特、参考图、场景和主提示词，导入时会同步恢复到当前工程；Blob 仍按工程包中的可序列化引用处理，完整二进制素材归档另列为后续工作。
- [x] **让单分镜视频接口兑现 UI 选择。** 后端 `/api/video/task` 当前只映射 Kling 3.0 Omni，因此 UI 仅保留 `kling-v3-omni` 选项；新增 `src/config/videoModels.ts`（唯一支持列表 + `normalizeVideoModel`），旧 localStorage 中的 viduq2/veo/MiniMax 会自动归一到 Kling，生成与重生成入口对不支持模型直接阻止。`generateVideoTask` 不再把 `gatewayUrl`/`gatewayToken` 发给后端（后端自管凭据）。`tests/core.test.ts` 覆盖模型归一化。后续新增模型时必须先在后端实现 payload 映射再放开 UI。
- [x] **导入无限画布时更新运行时状态。** 新增 `src/utils/canvasImport.ts`（校验节点/连线/视口并以 `CustomEvent` 通知当前工程）与 `useCanvasStore` 的导入监听：导入后立即替换节点、连线、视口并重置选中/历史，避免 500ms 自动保存用旧状态覆盖导入数据；事件按 projectId 过滤，`normalizeCanvasState` 拒绝非数组节点与非法视口。`src/App.tsx` 两个导入入口在写 LocalDB 后同时广播。`tests/core.test.ts` 覆盖非法载荷、连线缺省与视口校验。未做导入失败时的跨状态回滚（时间轴与画布仍分步应用）。
- [ ] **修复生成任务恢复与结果匹配。** `src/hooks/useGenerationTaskRecovery.ts` 的试衣轮询到最大次数后没有清除 active 标记或生成状态；视频轮询失败后保留 `videoTaskId`，projects 变化会立即再次轮询；跨工程去重只用 `storyboardId`，相同分镜 ID 会互相跳过。`src/hooks/useRecentStoryboardRecovery.ts` 又把所有非视频任务按返回顺序套到分镜上，任务数不足时重复第一张，可能用试衣图覆盖整组分镜。为终态任务停止自动轮询并允许有退避的显式重试，超时后复位 UI，按 project/task/shot ID 精确匹配，登出/卸载时取消轮询；测试失败、超时、多工程同 ID、混合任务和账号切换。
- [x] **修复 MediaRecorder 导出取消和规格。** 兼容导出现在区分取消与完成，按目标画布尺寸渲染，遵守关闭音频选项，并按实际 MP4/WebM 容器命名、展示和释放资源。
- [x] **让归档操作名实相符。** 当前明确命名为“本地归档”，将成片保存为可恢复的 Data URL，并检查本地写入结果；真实云端归档列表、下载和删除仍需单独接入云存储能力。
- [ ] **让本地云端项目同步幂等、按变更运行并保持新旧顺序。** 部分完成：新增 `src/utils/projectSyncScheduler.ts` 并在 `useAIProjectAutosave` 使用——按项目串行同步、只保留最新待同步快照、跳过未变化项目，失败后允许后续显式调度重试；`tests/core.test.ts` 覆盖串行、旧快照丢弃、重复跳过与失败重试。仍未做稳定资源 URL 回写本地项目、OSS 上传缓存/去重和孤儿对象清理，其他 hooks 的直接同步也未统一走该调度器。
- [x] **批量导入视频时保留原时间轴素材。** 新增 `src/utils/batchTimelineMerge.ts`：只替换 `properties.storyboardId` 与本次完成分镜匹配的媒体层，图片、音频、字幕、其他视频均保留；新片段按分镜序号排序并追加在剩余媒体最后一帧之后，重复导入不会产生重复图层。`applyAllCompletedToTimeline` 改为调用该纯函数。`tests/core.test.ts` 覆盖混合图层保留、同分镜替换、追加位置与重复导入去重。

## P2：可靠性、运维与质量

- [ ] **让任务历史上限按用户并保护运行任务。** `backend/server.js` 的持久任务存储只保留全局最近 100 条；其他用户的新请求可能挤掉尚在运行的任务，后台轮询和恢复会失去记录。为活跃任务保留独立索引，历史按用户分区并设置可配置保留策略，覆盖并发用户和长任务场景。
- [ ] **持久化部署数据并保护画布文件。** 部分完成：新增 `DATA_DIR`（默认代码目录，容器为 `/app/data`），任务历史与画布状态均写入该目录；`docker-compose.yml` 使用命名卷 `keyvideo-data` 持久化并配置健康检查；Dockerfile 改为 `npm ci --omit=dev`、`USER node`、`/app/data` 归属 node。任务历史已有临时文件 + 备份 + rename 原子写入；画布 JSON 仍为直接覆盖，恢复演练/画布原子写入尚未完成。
- [ ] **让超时和大小限制覆盖完整响应体。** 前后端 `fetchWithTimeout` 在收到响应头后就清除 timer；`arrayBuffer()`、`json()` 或视频流读取可无限等待。图片/视频服务还应在分配大缓冲区前按流限制字节数；验证慢速或永不结束的响应最终会中止并释放连接。
- [ ] **清理敏感日志。** 部分完成：已移除视频提交时的提示词/输入图片 URL、轮询结果 URL、storyboard 图片 URL 等直接内容日志；生成提交只记录模型与时长。尚未引入统一结构化日志（请求 ID、用户 ID 哈希、耗时、错误类别），其余 `console.error` 仍可能透出上游错误文本。
- [ ] **约束开发服务器上传面。** `vite.config.ts` 的 OSS 中间件没有鉴权、大小/扩展限制，并返回通配 CORS；Vite 配置也启用了 `cors: true`。将代理限制为本机开发用途，增加上传限制和来源检查，默认不暴露局域网，并验证恶意网页无法借开发服务器消耗 OSS。
- [x] **严格限制进程内缓存与限流表容量。** 抽出可测试的 `createTokenCache()`：Suppabase token 缓存按 TTL 过期并设硬上限（`AUTH_TOKEN_CACHE_MAX_ENTRIES`，默认 5000），更新已存在键不误删自身；按用户限流表新增 `API_RATE_BUCKET_CAPACITY`（默认 5000）并在清理过期项后按最旧顺序淘汰仍有效的桶；幂等缓存、SSO 撤销表与待处理 state/ticket 已有硬上限。`backend/auth.test.js` 覆盖过期、硬上限淘汰与同键刷新。未增加运行指标导出。
- [ ] **统一 MCP 与 HTTP 的画布存储及访问范围。** `backend/server.js` 将画布存成 `<userId>:<projectId>`，`backend/mcpServer.js` 却只用 `projectId` 作为键；MCP 写入的数据对 HTTP API 不可见，MCP 也会读取 task history 中所有用户的提示词和结果 URL。共享一套带用户上下文的存取接口，明确 MCP 的授权边界，并验证两种入口读写同一工程且不能越权枚举。
- [ ] **校验无限画布拓扑输入。** `/api/canvas/state/:projectId` 和 MCP `canvas_apply_ops` 接受节点/连线/视口对象后直接保存；未限制数量、字段尺寸、视口数值，也未校验连线端点。加入版本化 schema、节点/连线数量及元数据大小上限、数值边界和端点存在性检查，覆盖超大、畸形及悬空连线输入。
- [x] **修复 MCP JSON-RPC 错误响应。** `backend/mcpServer.js` 抽出可测试的 `processJsonRpcLine()`：解析失败返回 `-32700`，非法请求 `-32600`、未知方法 `-32601`、缺少工具名 `-32602`、工具执行失败 `-32603`，并保留已解析的请求 `id`；无 `id` 的通知不再输出响应；stdio 仅在作为主模块运行时启动。`backend/mcpServer.test.js` 覆盖解析错误、非法请求、未知方法、缺参、失败工具调用、initialize 与通知。
- [ ] **回收时间轴素材缓存与生成 Blob URL。** `src/hooks/useCanvasRenderer.ts` 将所有图片和视频永久保留在 cache refs，删除/替换图层时不释放视频解码资源；视频生成、重新生成与手动替换路径也会反复 `URL.createObjectURL`，但替换旧结果时没有统一撤销。按当前工程素材做缓存淘汰，暂停并卸载失效媒体，集中管理 Blob URL 并覆盖大量素材、替换、登出和卸载。
- [ ] **为超大图片的智能抠图设置资源上限。** `src/hooks/useCanvasRenderer.ts` 按原图宽高创建完整 `ImageData`、`Uint8Array(w*h)` 和逐像素坐标队列；超大用户图片会造成主线程长时间阻塞和高内存占用。抠图前限制像素数、缩放到受控分辨率或移至 Worker，并验证大图会平稳拒绝/降采样且不冻结编辑器。
- [ ] **清理 OSS 孤儿对象并校验删除失败。** 模特/场景/BGM 上传后若 Supabase 写入失败会遗留已上传对象；成功删除资产记录时也没有统一删除 OSS 对象。设计带所有者记录的删除/回滚和定期孤儿清理，避免因跨用户或上传中断误删，并测试 DB 写入失败、重试和删除部分失败。
- [ ] **统一前端网络超时策略。** `src/services/videoBatchTaskService.ts`、`src/utils/customApiRunner.ts` 及若干文件读取路径直接 `fetch`，没有超时/取消；提交任务或自定义接口无响应时界面可能永久停留在 submitting。复用带 AbortSignal 的请求层，并验证超时后 UI 恢复且后台任务可查询。
- [ ] **让视频剪辑属性在预览与导出中一致生效。** `Layer.properties` 定义了 `videoEndOffset`、`speed`、`loop`，分割服务也维护视频起止偏移，但 `useCanvasRenderer` 和 WebCodecs 导出按原始时间/时长播放，没有消费这些字段。明确支持的剪辑属性，补齐 UI、实时预览及两种导出引擎的一致计算；未支持的属性不要静默保存在工程包中。覆盖分割、裁切、变速、循环和导出对比。
- [ ] **把 Supabase 初始化脚本改为可追踪的迁移。** 部分完成：`create_table.sql` 的每个策略前加入 `DROP POLICY IF EXISTS`，脚本可在已初始化库重复执行不再报错；已新增 `supabase/migrations/20261030_asset_privacy.sql` 与 `20261030_model_assets_update.sql` 两个可审计升级脚本。尚未把全部建表/触发器拆成完整有序迁移历史，也未在真实空库/已有库上跑迁移验证。
- [x] **阻止发布工作流反复创建同一个版本。** 工作流改为只在推送 `v*` 标签时触发（移除 main/master 与手动触发），发布前校验标签名必须等于 `v` + `src-tauri/tauri.conf.json` 版本，`tauri-action` 的 `tagName` 改用实际推送标签而非固定 `app-v__VERSION__`，避免每次主分支推送生成重复发布；矩阵多架构仍上传到同一 draft release。
- [ ] **收紧桌面 WebView 权限。** `src-tauri/tauri.conf.json` 设置 `csp: null` 且 asset protocol scope 为 `**/*`。按实际 API/资源需求配置 CSP 与最小文件访问范围，验证本地素材、远程后端、预览与导出仍可用。
- [ ] **让本地保存失败可见。** 部分完成：`localDB.set` 失败时会派发 `keyvideo:local-save-failed` 事件，`src/App.tsx` 监听后 10 秒节流提示“本地保存失败，请清理后重试”；返回值语义保持 `boolean`。仍未实现失败写入的待重试队列/自动重试，也未覆盖配额耗尽与存储不可用的自动化测试。
- [ ] **避免跨账号复用前端生成请求。** `src/utils/aiGateway.ts` 的模块级 in-flight map 只按操作和 payload 去重；账号切换期间相同请求可能复用前一账号的 Promise。把身份/后端范围纳入去重作用域，并在登出时取消或清空旧请求。
- [ ] **补全 API 集成与回归测试。** 当前前端测试集中在纯工具函数，后端测试集中在 SSO/auth 单元逻辑；关键路由、RLS/OSS 边界、幂等、图片代理、批量生成、持久化与导出流程缺少端到端覆盖。为本清单 P1 事项建立可注入上游服务的路由测试和关键前端状态测试。
- [ ] **让 CI 覆盖后端、Rust 格式和依赖安全。** `.github/workflows/release.yml` 只运行前端 `npm test`，不运行 `backend/npm test`、`cargo fmt --check`、Rust 构建/测试或依赖审计。当前完整 npm 审计发现 8 个开发/构建依赖漏洞（7 高、1 中），生产依赖审计为 0；`cargo fmt --check` 在 `src-tauri/build.rs`、`src-tauri/src/lib.rs` 和 `src-tauri/src/main.rs` 失败，且当前环境没有 `cargo-audit`。修复格式、升级易受影响依赖并把前后端/Rust/审计检查加入独立 CI。
- [ ] **完善 README 与部署手册。** 根目录 `README.md` 仍是 Vite 模板，缺少真实安装、环境变量、Supabase/RLS 初始化、TLS/反向代理、Docker 持久化、桌面构建及故障排查说明。用 `.env.example` 和 CI 实际流程验证每条步骤。

## P3：清理与一致性

- [ ] **移除或说明重复的演示视频。** 根目录 `video.mp4` 与 `public/video.mp4` 均为 16,687,742 字节，SHA-256 相同（`8887EB425A9767FF09F5FC7DF67362A18946B67C288DFC3C84730E96DE5AC5E4`）；应用使用 `/video.mp4` 对应的 public 资源。确认根目录副本没有构建用途后删除，避免仓库重复保存约 16 MB 素材。
- [ ] **统一版本与包元数据。** 根 `package.json` 仍为 `0.0.0`，Tauri 配置与 Cargo 包使用 `0.1.0`，Cargo 描述/作者/许可证也保留模板值。确定单一版本来源并同步发布元数据，避免 tag、安装包和界面版本不一致。
