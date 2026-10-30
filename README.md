# KeyVideo

KeyVideo 是一款面向电商服装的 AI 视频工作台：在无限画布/时间轴中完成模特换装、分镜生成、图生视频、剪辑与导出。前端为 React + TypeScript + Vite，桌面壳为 Tauri 2，后端为 Express 微服务，云端素材可选 Supabase + 阿里云 OSS。

## 目录

- `src/`：前端应用（编辑器、画布、时间轴、AI 网关客户端）
- `backend/`：Express API、SSO、任务历史、图片代理、OSS 上传、MCP 服务
- `src-tauri/`：桌面端配置与 Rust 壳
- `docs/`：SSO 接入与运行报告
- `supabase/migrations/`：可审计的数据库升级脚本
- `tests/`：前端纯逻辑测试

## 环境要求

- Node.js 22+（前端测试使用 `--experimental-strip-types`）
- npm 10+
- 可选：Rust stable + Tauri 依赖（仅桌面构建需要）
- 可选：Supabase 项目、阿里云 OSS Bucket、Sandbase/AI 网关账号

## 本地开发

```powershell
npm install
cd backend
npm install
cd ..
```

复制并填写后端环境变量（不要提交真实值）：

```powershell
Copy-Item backend/.env.example backend/.env
```

至少需要：

- `OSS_REGION` / `OSS_ACCESS_KEY_ID` / `OSS_ACCESS_KEY_SECRET` / `OSS_BUCKET`
- `SANDBASE_API_KEY`（图像/视频生成）或 `TEXT_LLM_API_KEY`
- 如需账号登录：`SSO_*` 或 `SSO_SESSION_SECRET`；旧版 Supabase 登录还需 `SUPABASE_URL` / `SUPABASE_ANON_KEY`

启动两个进程：

```powershell
cd backend
npm start
```

```powershell
npm run dev
```

前端默认访问 `http://127.0.0.1:5173`，后端默认 `http://127.0.0.1:3001`（`HOST` 默认只绑定回环地址）。生产 Web 部署时把前端静态产物放到反向代理下，并将 `/api` 转发到后端。

## 统一登录（SSO）

完整回调地址、环境变量和流程见 [`docs/SSO.md`](./docs/SSO.md)。`client_secret` 只放在 `backend/.env`，不要写进任何 `VITE_` 变量。

## 数据库（Supabase）

1. 在开发库的 Supabase SQL Editor 中按文件名顺序执行 [`supabase/migrations/`](./supabase/migrations/) 内的迁移。首先执行 [`20261030_00_create_keyvideo_tables.sql`](./supabase/migrations/20261030_00_create_keyvideo_tables.sql)，再执行：
   - [`supabase/migrations/20261030_asset_privacy.sql`](./supabase/migrations/20261030_asset_privacy.sql)
   - [`supabase/migrations/20261030_model_assets_update.sql`](./supabase/migrations/20261030_model_assets_update.sql)

   这三份迁移只创建或配置 KeyVideo 使用的 `ai_video_projects`、`model_assets`、`audio_assets`，不会修改 `media_assets` 或其他表。旧版 [`src/utils/create_table.sql`](./src/utils/create_table.sql) 保留用于参考，不建议直接执行到包含其他业务对象的数据库。

素材默认私有：只有 `is_public = true` 或 `auth.uid() = user_id` 的行可读。需要共享的品牌素材请显式标记：

```sql
UPDATE public.model_assets SET is_public = true WHERE id = '<asset-id>';
```

> 生产库迁移需单独评审、备份并验证；不要在应用启动时自动执行。

## 生产部署

### 反向代理与 TLS

- 必须通过受信任域名 + HTTPS 暴露 API；桌面发布由仓库变量 `VITE_BACKEND_URL` 注入，CI 会拒绝非 `https://` 或缺失的值。
- 反向代理终止 TLS 后转发到后端；确保 `ALLOWED_ORIGINS` 包含前端实际源。
- 不要在生产使用 `API_AUTH_DISABLED`（`NODE_ENV=production` 时会忽略）。

### Docker

```bash
cd backend
docker compose up -d --build
```

- 容器以非 root 用户运行，`/app/data` 由命名卷 `keyvideo-data` 持久化任务历史与画布状态。
- 内置健康检查访问 `/api/health`。
- 不要把 `backend/.env` 打进镜像（`.dockerignore` 已排除）；通过 compose 的 `env_file` 注入。

### 桌面端

```powershell
npm run tauri build
```

发布仅由 `v*` 标签触发，标签必须与 `src-tauri/tauri.conf.json` 版本一致。macOS 双架构与 Windows 安装包上传到同一 draft release。

## 测试与检查

```powershell
# 前端：纯逻辑测试 + tsc + eslint + 构建
npm test

# 仅类型检查 / lint
npm run check

# 后端：SSO、鉴权、幂等、图片代理、OSS、生成限制、沙箱提交、MCP
cd backend
npm test
```

CI（`.github/workflows/ci.yml`）在 push/PR 上分别运行前后端测试。

## 常见问题

- **请求 401**：检查 `Authorization: Bearer <session>` 是否存在且未过期；SSO 登出后 token 会立即撤销。
- **请求 503 `auth_not_configured`**：后端未配置 SSO 或 Supabase 鉴权。
- **生成 429 `DAILY_QUOTA_EXCEEDED` / `CONCURRENCY_LIMIT`**：调整 `AI_DAILY_TASK_LIMIT` / `AI_MAX_CONCURRENT_TASKS`，或等待并发任务结束。
- **素材上传成功但列表不显示**：确认已执行素材隐私迁移；非公开素材只有所有者可见。
- **桌面端连不上后端**：确认 `VITE_BACKEND_URL` 为 HTTPS 生产地址，且该地址的 `/api` 路由可用。
- **容器重启后任务历史丢失**：确认 `keyvideo-data` 卷已挂载且 `DATA_DIR=/app/data`。

## 安全边界

- 后端只读取 `backend/.env`；任何密钥都不得进入前端构建产物。
- 付费生成接口在提交上游前完成输入校验与用户额度检查。
- 公开图片代理仅允许受信任媒体域名，并限制重定向、响应大小与速率。
