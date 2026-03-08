# PokerScore 云服务器部署清单

## 1. 推荐部署方式

建议先用单机部署跑通：

- `Nginx`：负责静态资源、HTTPS、反向代理
- `Frontend(dist)`：Vite 构建后的静态文件
- `Node.js 24 + PM2`：运行 `server/dist/main.js`
- `PostgreSQL`：直接部署在当前云服务器
- `Redis`：当前版本未强依赖，可先不启用，仅保留配置

推荐域名方案：

- `https://agentsww.com`：前端 H5
- `https://agentsww.com/api/v1`：后端 API
- `https://agentsww.com/socket.io/`：Socket.IO 握手路径

如果根域名已经有别的站点在跑，推荐把 PokerScore 挂到子路径：

- `https://agentsww.com/poker/`：前端 H5
- `https://agentsww.com/poker/api/v1`：后端 API
- `https://agentsww.com/poker/socket.io/`：Socket.IO 握手路径

补充说明：

- `HTTP` 可以临时联调使用
- 正式上线建议必须切到 `HTTPS`
- 原因是登录态、令牌传输、扫码分享链路都更适合在 `HTTPS` 下运行

## 2. 上线前准备

### 2.1 云服务器基础信息

需要确认：

- 操作系统建议 `Ubuntu 22.04 LTS`
- 已开放端口 `22`、`80`、`443`
- `5432` 不对公网开放，仅允许本机访问
- 已绑定域名并将 `A 记录` 指向云服务器公网 IP

### 2.2 本项目运行要求

需要安装：

- `Node.js 24`
- `npm 11+`
- `PM2`
- `Nginx`
- `PostgreSQL 15+`

可选：

- `Redis 7+`
- `Certbot` 或其他 HTTPS 证书工具

## 3. 代码目录建议

建议统一放在：

```bash
/srv/pokerscore/current
```

目录结构示例：

```bash
/srv/pokerscore/current
├─ dist
├─ docs
├─ prisma
├─ server
│  ├─ dist
│  ├─ node_modules
│  └─ .env
├─ src
├─ package.json
└─ package-lock.json
```

## 4. 环境变量

### 4.1 前端环境变量

参考文件：

- [/.env.production.example](/C:/Users/sww/Desktop/project/pokerScore/.env.production.example)

生产建议：

```env
VITE_APP_BASE_PATH=/poker/
VITE_API_BASE_URL=/poker/api/v1
VITE_WS_BASE_URL=https://agentsww.com
VITE_WS_PATH=/poker/socket.io
```

如果还没申请证书，只是先临时联调，可以先写成：

```env
VITE_APP_BASE_PATH=/poker/
VITE_API_BASE_URL=/poker/api/v1
VITE_WS_BASE_URL=http://agentsww.com
VITE_WS_PATH=/poker/socket.io
```

说明：

- `VITE_APP_BASE_PATH=/poker/` 用于让前端静态资源和路由都挂在 `/poker`
- `VITE_API_BASE_URL=/poker/api/v1` 代表前端通过同域 Nginx 反代访问子路径 API
- `VITE_WS_BASE_URL` 建议只写协议加域名
- `VITE_WS_PATH=/poker/socket.io` 用于把 Socket.IO 握手也放到子路径

### 4.2 后端环境变量

参考文件：

- [server/.env.production.example](/C:/Users/sww/Desktop/project/pokerScore/server/.env.production.example)

生产建议：

```env
PORT=3001
JWT_SECRET=replace-with-a-strong-secret
JWT_EXPIRES_IN=7d
APP_H5_BASE_URL=https://agentsww.com/poker
DATABASE_URL=postgresql://postgres:password@127.0.0.1:5432/pokerscore
REDIS_URL=redis://127.0.0.1:6379
ROOM_CODE_LENGTH=6
```

如果现在先跑 `HTTP`，则同步改成：

```env
APP_H5_BASE_URL=http://agentsww.com/poker
```

说明：

- `JWT_SECRET` 必须换成高强度随机字符串
- `APP_H5_BASE_URL` 必须是实际访问 H5 的域名
- 当前代码不依赖 Redis 才能启动，但建议先把 `REDIS_URL` 配好，便于后续扩展

## 5. 服务器初始化清单

### 5.1 安装 Node.js 24

可任选 `nvm` 或官方二进制。

确认版本：

```bash
node -v
npm -v
```

### 5.2 安装 PM2

```bash
npm install -g pm2
pm2 -v
```

### 5.3 安装 Nginx

```bash
sudo apt update
sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

### 5.4 安装 PostgreSQL

当前推荐就是同机部署数据库，至少完成：

- 创建数据库 `pokerscore`
- 创建独立数据库用户
- 配置密码
- 确认仅本机访问

## 6. 项目部署步骤

### 6.1 上传代码

任选一种：

- `git clone`
- CI/CD 发布到服务器
- 上传压缩包后解压

### 6.2 安装依赖

在项目根目录：

```bash
npm install
```

在 `server` 目录：

```bash
cd /srv/pokerscore/current/server
npm install
```

### 6.3 配置生产环境变量

前端：

```bash
cp /srv/pokerscore/current/.env.production.example /srv/pokerscore/current/.env.production
```

后端：

```bash
cp /srv/pokerscore/current/server/.env.production.example /srv/pokerscore/current/server/.env
```

然后按真实域名、本机数据库连接串、JWT 密钥修改。

### 6.4 生成 Prisma Client

在项目根目录执行：

```bash
npm run server:prisma:generate
```

### 6.5 初始化数据库

当前推荐直接用本机 PostgreSQL 执行初始化 SQL：

- [docs/sql/init-v1.sql](/C:/Users/sww/Desktop/project/pokerScore/docs/sql/init-v1.sql)

注意：

- 当前仓库还没有正式迁移文件时，建议先用 `init-v1.sql`
- 等后面 Prisma migration 完整建立后，再切到 migration 流程

### 6.6 构建前端

在项目根目录：

```bash
npm run build
```

构建结果在：

- `/srv/pokerscore/current/dist`

### 6.7 构建后端

在 `server` 目录：

```bash
cd /srv/pokerscore/current/server
npm run build
```

构建结果在：

- `/srv/pokerscore/current/server/dist`

## 7. 启动后端服务

### 7.1 用 PM2 启动

参考文件：

- [deploy/pm2/pokerscore-server.ecosystem.config.cjs](/C:/Users/sww/Desktop/project/pokerScore/deploy/pm2/pokerscore-server.ecosystem.config.cjs)

启动示例：

```bash
cd /srv/pokerscore/current/server
pm2 start /srv/pokerscore/current/deploy/pm2/pokerscore-server.ecosystem.config.cjs
pm2 save
pm2 startup
```

检查状态：

```bash
pm2 status
pm2 logs pokerscore-server
```

## 8. 配置 Nginx

参考文件：

- [deploy/nginx/pokerscore.conf.example](/C:/Users/sww/Desktop/project/pokerScore/deploy/nginx/pokerscore.conf.example)

建议流程：

1. 复制示例配置到：

```bash
/etc/nginx/sites-available/pokerscore.conf
```

2. 修改：

- `server_name`
- `root`

3. 建立软链：

```bash
sudo ln -s /etc/nginx/sites-available/pokerscore.conf /etc/nginx/sites-enabled/pokerscore.conf
```

4. 检查并重载：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 9. HTTPS 配置

推荐用 `Certbot`：

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d agentsww.com
```

建议按这个顺序做：

1. 先用当前 Nginx 配置跑通 `http://agentsww.com`
2. 确认前端首页和 `/api/v1/health` 可访问
3. 再执行 `certbot --nginx -d agentsww.com`
4. 执行 `sudo certbot renew --dry-run` 验证续期

完成后确认：

- 浏览器访问 `https://agentsww.com` 正常
- `https://agentsww.com/api/v1/health` 或健康接口可用

## 10. 上线验收清单

至少逐项检查：

- 首页可打开
- 创建房间成功
- 输入房间码加入成功
- 房间页能看到成员和分数
- 转分成功且页面实时更新
- 结算成功
- 结算页账单可见
- 重开局成功
- 刷新页面后能恢复当前房间数据
- Nginx 日志无大量 `502`
- PM2 日志无 Prisma 连接错误

## 11. 常见问题排查

### 11.1 前端能打开但接口报 404

优先检查：

- Nginx 是否代理了 `/api/v1/`
- 前端 `VITE_API_BASE_URL` 是否仍写成开发地址

### 11.2 接口 502

优先检查：

- 后端 PM2 是否在线
- `PORT=3001` 是否与 Nginx upstream 一致
- 后端 `.env` 是否存在

### 11.3 Prisma 连不上数据库

优先检查：

- `DATABASE_URL` 是否正确
- PostgreSQL 用户名密码是否正确
- PostgreSQL 是否真的监听在 `127.0.0.1:5432`
- 表结构是否已初始化

### 11.4 Socket 连接不上

优先检查：

- Nginx 是否代理 `/socket.io/`
- 前端 `VITE_WS_BASE_URL` 是否为正式域名
- 浏览器控制台是否有 WebSocket 或 CORS 错误

## 12. 发布顺序建议

建议固定顺序：

1. 备份数据库
2. 上传新代码
3. 安装依赖
4. 执行 Prisma generate / migrate
5. 构建前端
6. 构建后端
7. 重启 PM2
8. 重载 Nginx
9. 执行冒烟测试

## 13. 当前项目的上线结论

当前仓库已经具备：

- 前端构建能力
- 后端构建能力
- REST 接口
- Socket.IO 实时同步
- Prisma 数据模型

正式上线前还必须完成：

- 生产数据库初始化
- 生产域名和 HTTPS
- 后端 `.env` 实际配置
- Nginx 反向代理生效
