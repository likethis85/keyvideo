# KeyVideo 统一登录（marius-sso）接入说明

KeyVideo 已接入公司统一登录（marius-sso）。登录入口仍然由 KeyVideo 后端发起，
`client_secret` 只存在后端环境变量中，浏览器只会接触一次性 `code` 和一次性
`sso_ticket`。

## 1. 回调地址

当前应用 `app_fe0050212c6a4e31b433` 已在 SSO 管理后台登记：

```text
http://127.0.0.1:3001/api/auth/sso/callback
```

本地开发时 `SSO_REDIRECT_URI` 必须使用这个地址，必须逐字符一致。

生产 Web 部署时，再在后台补登下面这个地址，并把 `SSO_REDIRECT_URI` 换成它：

```text
https://www.marius.com.cn/videos/api/auth/sso/callback
```

`/authorize` 服务端做精确字符串匹配，`http`/`https`、`localhost`/`127.0.0.1`、
结尾斜杠只要差一个字符都会返回 400。

## 2. 后端配置

在 `backend/.env`（不要提交到 Git）中添加：

```dotenv
SSO_BASE_URL=https://sso.marius.com.cn
SSO_CLIENT_ID=app_fe0050212c6a4e31b433
SSO_CLIENT_SECRET=管理后台给出的 secret
SSO_REDIRECT_URI=http://127.0.0.1:3001/api/auth/sso/callback
SSO_POST_LOGIN_REDIRECT=http://127.0.0.1:5173/
SSO_ALLOWED_RETURN_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,https://www.marius.com.cn,https://marius.com.cn,http://tauri.localhost,tauri://localhost
```

生产 Web 部署时改成：

```dotenv
SSO_REDIRECT_URI=https://www.marius.com.cn/videos/api/auth/sso/callback
SSO_POST_LOGIN_REDIRECT=https://www.marius.com.cn/videos/
```

可选配置：

- `SSO_SESSION_SECRET`：KeyVideo 自己签发的会话 JWT 的签名密钥。不填时由
  `SSO_CLIENT_ID + SSO_CLIENT_SECRET` 派生；更换 `client_secret` 会使所有已登录
  SSO 用户下线。
- `SSO_SESSION_TTL_SECONDS`：KeyVideo 会话有效期，默认 8 小时。
- `ALLOWED_ORIGINS`：需要包含前端实际域名，否则浏览器调用
  `/api/auth/sso/*` 会被 CORS 拒绝。
- `SSO_STATE_DIR`：state/ticket 的共享目录。未设置但设置了 `DATA_DIR` 时默认
  使用 `$DATA_DIR/sso-state`；多实例部署需挂载同一卷，否则请保持单实例或会话
  粘性。

配置完成后重启后端即可，前端不需要重新构建，也不会接触 `client_secret`。

## 2.1 API 鉴权

除 `/api/health`、`/api/auth/sso/*` 和只读的 `/api/ai/image-proxy` 外，所有
`/api/*` 接口都要求：

```http
Authorization: Bearer <KeyVideo 会话 JWT>
```

前端会自动从 SSO 会话或 Supabase 会话取 token 并附带。SSO 用户不需要配置
Supabase；如果要保留旧的 Supabase 邮箱密码登录，后端还需要配置：

```dotenv
SUPABASE_URL=https://your-supabase-instance.example.com
SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

本地临时调试可设置 `API_AUTH_DISABLED=true`，但 `NODE_ENV=production` 时该开关会被忽略。


## 3. 登录流程

```text
浏览器
  │ 点击「使用统一登录」
  ▼
GET  {backend}/api/auth/sso/start?return_to=...
  │ 302
  ▼
GET  https://sso.marius.com.cn/authorize?client_id=...&redirect_uri=...&state=...
  │ 用户在统一登录页完成验证
  ▼
GET  {backend}/api/auth/sso/callback?code=...&state=...
  │ 后端用 code + client_secret 调 POST /token
  │ 生成一次性 sso_ticket
  ▼
302  {前端页面}?sso_ticket=...
  │ 前端 POST /api/auth/sso/exchange
  ▼
KeyVideo 会话 JWT（存在浏览器 localStorage）
```

- `state`：后端生成，20 分钟有效，一次性消费。
- `sso_ticket`：后端生成，60 秒有效，一次性消费。
- `client_secret`：只参与后端到 SSO 的 `/token` 请求。
- KeyVideo 会话 JWT：由后端用 `SSO_SESSION_SECRET` 签名，前端只保存、不解析。

## 4. 接口

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| GET | `/api/auth/sso/status` | 是否已配置 SSO |
| GET | `/api/auth/sso/start` | 生成 state 并跳转统一登录页 |
| GET | `/api/auth/sso/callback` | SSO 回调：换 token、发一次性 ticket |
| POST | `/api/auth/sso/exchange` | 用 ticket 换 KeyVideo 会话 JWT |
| GET | `/api/auth/sso/session` | 校验会话 JWT，返回用户 |
| POST | `/api/auth/sso/logout` | 前端退出时通知后端（本地会话由前端清除） |

## 5. 自测

```powershell
# 后端单测
cd backend
npm test

# 前端类型检查、lint、构建
cd ..
npm run check
```

配置好 `client_id` / `client_secret` 后，启动后端和前端，点击「使用统一登录」，
应回到 KeyVideo 编辑器，右上角显示 SSO 用户；退出后回到登录页。
