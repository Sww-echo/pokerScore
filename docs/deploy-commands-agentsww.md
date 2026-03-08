# PokerScore 部署命令手册

适用前提：

- 服务器系统：`Ubuntu 22.04`
- 域名：`agentsww.com`
- 部署方式：`Nginx + PM2 + Node.js + PostgreSQL`
- 前后端部署在同一台云服务器
- PostgreSQL 也直接部署在这台云服务器
- 当前仓库路径最终放在：`/srv/pokerscore/current`

如果你的服务器系统不是 Ubuntu，这份手册需要调整。

## 1. 服务器初始化

### 1.1 更新系统

```bash
sudo apt update && sudo apt upgrade -y
```

### 1.2 安装基础软件

```bash
sudo apt install -y curl git nginx unzip build-essential
```

### 1.3 安装 Node.js 24

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

### 1.4 安装 PM2

```bash
sudo npm install -g pm2
pm2 -v
```

### 1.5 安装 PostgreSQL

```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

### 1.6 安装 Certbot

```bash
sudo apt install -y certbot python3-certbot-nginx
```

## 2. 域名检查

先确认 `agentsww.com` 已经解析到你的服务器公网 IP。

可在本地或服务器上检查：

```bash
ping agentsww.com
```

如果 DNS 还没生效，先不要继续申请 HTTPS。

还要确认云服务器安全组和系统防火墙已经放行：

- `80`
- `443`

## 3. 上传代码

推荐方式一：服务器直接 `git clone`

```bash
sudo mkdir -p /srv/pokerscore
sudo chown -R $USER:$USER /srv/pokerscore
cd /srv/pokerscore
git clone 你的仓库地址 current
cd /srv/pokerscore/current
```

如果你不是通过 Git，而是手动上传代码包，则目标目录也统一放到：

```bash
/srv/pokerscore/current
```

## 4. 安装项目依赖

### 4.1 安装前端根依赖

```bash
cd /srv/pokerscore/current
npm install
```

### 4.2 安装后端依赖

```bash
cd /srv/pokerscore/current/server
npm install
```

## 5. 配置数据库

### 5.1 创建本机数据库和账号

进入 PostgreSQL：

```bash
sudo -u postgres psql
```

在 `psql` 中执行：

```sql
CREATE USER pokerscore WITH PASSWORD '请替换成强密码';
CREATE DATABASE pokerscore OWNER pokerscore;
GRANT ALL PRIVILEGES ON DATABASE pokerscore TO pokerscore;
\q
```

### 5.2 限制 PostgreSQL 仅本机访问

建议检查：

```bash
sudo ss -lntp | grep 5432
```

理想情况是只监听：

```text
127.0.0.1:5432
```

如果你改过 PostgreSQL 配置，确保不要对公网开放 `5432`。

## 6. 配置环境变量

### 6.1 前端生产环境变量

```bash
cd /srv/pokerscore/current
cp .env.production.example .env.production
```

确认内容为：

```env
VITE_API_BASE_URL=/api/v1
VITE_WS_BASE_URL=https://agentsww.com
```

如果你还没申请证书，只是先临时通过 `HTTP` 跑通，可以先改成：

```env
VITE_API_BASE_URL=/api/v1
VITE_WS_BASE_URL=http://agentsww.com
```

### 6.2 后端生产环境变量

```bash
cd /srv/pokerscore/current/server
cp .env.production.example .env
```

然后编辑：

```bash
nano /srv/pokerscore/current/server/.env
```

建议填写为：

```env
PORT=3000
JWT_SECRET=请替换成至少32位随机字符串
JWT_EXPIRES_IN=7d
APP_H5_BASE_URL=https://agentsww.com
DATABASE_URL=postgresql://pokerscore:你的数据库密码@127.0.0.1:5432/pokerscore
REDIS_URL=redis://127.0.0.1:6379
ROOM_CODE_LENGTH=6
```

如果你当前还没上 HTTPS，只是先做联调，可以临时改成：

```env
APP_H5_BASE_URL=http://agentsww.com
```

## 7. 初始化数据库表

当前仓库更适合先用 SQL 初始化。

执行：

```bash
psql "postgresql://pokerscore:你的数据库密码@127.0.0.1:5432/pokerscore" -f /srv/pokerscore/current/docs/sql/init-v1.sql
```

## 8. 生成 Prisma Client

```bash
cd /srv/pokerscore/current
npm run server:prisma:generate
```

## 9. 构建项目

### 9.1 构建前端

```bash
cd /srv/pokerscore/current
npm run build
```

### 9.2 构建后端

```bash
cd /srv/pokerscore/current/server
npm run build
```

## 10. 配置 PM2 启动后端

先复制示例配置：

```bash
cp /srv/pokerscore/current/deploy/pm2/pokerscore-server.ecosystem.config.cjs /srv/pokerscore/current/deploy/pm2/pokerscore-server.ecosystem.config.local.cjs
```

如果需要，编辑：

```bash
nano /srv/pokerscore/current/deploy/pm2/pokerscore-server.ecosystem.config.local.cjs
```

启动：

```bash
cd /srv/pokerscore/current/server
pm2 start /srv/pokerscore/current/deploy/pm2/pokerscore-server.ecosystem.config.local.cjs
pm2 save
pm2 startup
```

查看状态：

```bash
pm2 status
pm2 logs pokerscore-server
```

## 11. 配置 Nginx

复制示例配置：

```bash
sudo cp /srv/pokerscore/current/deploy/nginx/pokerscore.conf.example /etc/nginx/sites-available/pokerscore.conf
```

如需调整，可编辑：

```bash
sudo nano /etc/nginx/sites-available/pokerscore.conf
```

启用站点：

```bash
sudo ln -sf /etc/nginx/sites-available/pokerscore.conf /etc/nginx/sites-enabled/pokerscore.conf
```

如果默认站点还在，建议移除：

```bash
sudo rm -f /etc/nginx/sites-enabled/default
```

检查配置：

```bash
sudo nginx -t
```

重载 Nginx：

```bash
sudo systemctl reload nginx
```

## 12. 先用 HTTP 跑通

先直接访问：

```text
http://agentsww.com
```

再检查接口：

```bash
curl http://agentsww.com/api/v1/health
```

如果这里不通，不要急着申请证书，先把下面几项排通：

- `Nginx` 是否已成功加载站点配置
- `PM2` 中后端是否正常运行
- `dist` 是否已构建完成
- 域名 `A` 记录是否已经生效

## 13. 申请 HTTPS

确认 `HTTP` 已跑通后，再执行：

```bash
sudo certbot --nginx -d agentsww.com
```

成功后检查：

```bash
curl -I https://agentsww.com
curl https://agentsww.com/api/v1/health
```

如果你的健康接口路径不是这个，也可以直接用浏览器打开首页确认。

如果 `certbot` 申请失败，优先检查：

- 域名是否真实解析到了当前服务器
- `80` 端口是否对公网开放
- 当前 `Nginx` 是否已经能正常响应 `http://agentsww.com`
- `server_name` 是否就是 `agentsww.com`

## 14. 验证证书自动续期

```bash
sudo certbot renew --dry-run
```

如果这个命令通过，说明自动续期流程基本正常。

如果你前面为了先跑通 `HTTP`，把环境变量临时写成了 `http://agentsww.com`，这里还要补一步：

1. 把 `/srv/pokerscore/current/.env.production` 里的 `VITE_WS_BASE_URL` 改回 `https://agentsww.com`
2. 把 `/srv/pokerscore/current/server/.env` 里的 `APP_H5_BASE_URL` 改回 `https://agentsww.com`
3. 在项目根目录重新执行 `npm run build`
4. 执行 `pm2 restart pokerscore-server`
5. 执行 `sudo systemctl reload nginx`

## 15. 上线后的验证顺序

### 15.1 验证前端首页

浏览器打开：

```text
https://agentsww.com
```

### 15.2 验证后端健康状态

```bash
curl https://agentsww.com/api/v1/health
```

### 15.3 验证完整业务

按顺序操作：

1. 创建房间
2. 新开一个浏览器无痕窗口加入房间
3. 执行一次转分
4. 确认两端页面同步刷新
5. 点击结算
6. 查看结算页
7. 点击重开局

## 16. 更新发布命令

以后你每次发版，可以按这个顺序执行：

```bash
cd /srv/pokerscore/current
git pull
npm install
cd /srv/pokerscore/current/server
npm install
cd /srv/pokerscore/current
npm run server:prisma:generate
npm run build
cd /srv/pokerscore/current/server
npm run build
pm2 restart pokerscore-server
sudo systemctl reload nginx
```

如果数据库结构有变更，再额外执行：

```bash
psql "你的DATABASE_URL" -f /srv/pokerscore/current/docs/sql/init-v1.sql
```

注意：

- 如果生产库已经有正式迁移方案，不要反复用初始化 SQL 覆盖旧库
- 当前这个命令仅适合你第一次建库或明确知道 SQL 差异可控的情况

## 17. 常用排查命令

### 查看 PM2 日志

```bash
pm2 logs pokerscore-server
```

### 查看 Nginx 错误日志

```bash
sudo tail -f /var/log/nginx/error.log
```

### 查看 Nginx 访问日志

```bash
sudo tail -f /var/log/nginx/access.log
```

### 检查 3000 端口是否监听

```bash
ss -lntp | grep 3000
```

### 检查 PostgreSQL 是否启动

```bash
sudo systemctl status postgresql
```

### 查看证书状态

```bash
sudo certbot certificates
```

## 18. 我对你当前项目的建议

你现在最合适的上线方式就是：

- 单机应用服务器
- 同域部署 `agentsww.com`
- Nginx 托管前端 + 反代后端
- PM2 常驻后端
- PostgreSQL 直接跑在本机，仅监听 `127.0.0.1`

这套方案够你先稳定跑起来，后面真的有流量了，再考虑：

- Redis 真正接入在线态和多实例 Socket 广播
- CI/CD 自动发布
- Docker 化
