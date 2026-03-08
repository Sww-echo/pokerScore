# PokerScore 后端设计文档

## 1. 文档目标

本文档用于指导 PokerScore H5 的后端设计与落地实现。

目标是：

- 支撑移动端 H5 的创建房间、加入房间、实时转分、实时同步、结算与重开局
- 与现有前端数据结构尽量对齐，减少前后端联调成本
- 在 V1 先做可上线的最小闭环，同时为后续接微信登录、历史记录、撤销、风控预留空间

## 2. 当前业务边界

已确认的业务规则：

- 允许游客进入
- 支持微信登录，但不强依赖微信环境
- 浏览器访问时可输入昵称或使用默认昵称
- 分值允许出现负数
- 任意房间成员都可以点击结算
- 结算后允许重新开启并继续记分
- 转分仅记录“分”，不涉及真实支付

V1 后端必须提供：

- 身份建立
- 房间创建
- 房间加入
- 房间详情查询
- 房间成员列表
- 单人/多人转分
- 房间内实时同步
- 结算生成
- 结算结果查询
- 重新开局

## 3. 推荐技术方案

## 3.1 推荐栈

建议采用：

- `Node.js 24`
- `NestJS`
- `PostgreSQL`
- `Redis`
- `Socket.IO`
- `Prisma`
- `JWT`

选择原因：

- 现有前端已经是 TypeScript，后端继续用 TypeScript 成本最低
- H5 + 房间实时同步场景下，`Socket.IO` 比纯 WebSocket 更省接入成本
- `PostgreSQL` 适合事务、审计流水、结算快照
- `Redis` 适合房间在线状态、Socket 广播、短期缓存

## 3.2 架构分层

后端建议按以下分层设计：

1. `API 层`
   - REST API
   - Socket.IO Gateway
2. `应用层`
   - 房间服务
   - 成员服务
   - 转分服务
   - 结算服务
   - 鉴权服务
3. `领域层`
   - 房间状态机
   - 分数守恒规则
   - 结算算法
   - 并发校验
4. `基础设施层`
   - PostgreSQL
   - Redis
   - JWT
   - 日志/监控

## 3.3 MVP 与正式版边界

为了控制复杂度，建议分两阶段：

### MVP

- 单体服务
- REST + Socket.IO
- PostgreSQL 持久化
- Redis 做房间在线态和 Socket 扩展
- 不引入消息队列
- 不做复杂权限系统

### 稍后增强

- 微信 OAuth 正式接入
- 最近一笔转分撤销
- 房间历史列表
- 结算导出
- 多实例横向扩容

## 4. 核心设计原则

后端设计必须满足以下原则：

### 4.1 服务端权威

分数、转分流水、结算状态必须以服务端为准。

前端只发送“命令”，不可信任前端自行算分结果。

### 4.2 流水优先

分数本质是转分流水的汇总结果。

后端既要保存：

- 原始流水 `transfer_record`
- 当前成员余额 `room_member.score`

这样可以兼顾：

- 快速展示
- 审计追溯
- 异常修复

### 4.3 回合隔离

因为“结算后允许重开局”，所以不能把一个房间的所有转分永久混在一起。

必须引入“局/回合”概念。

建议新增：

- `room_round`

每次重新开局，本质上创建一个新的 `room_round`。

这样可以避免：

- 历史转分影响新一局
- 结算快照与新流水混淆
- 查询历史时拆分困难

### 4.4 幂等与并发控制

移动端点击、多端重复提交、断网重发都很常见。

所有修改类接口都应支持：

- `requestId`
- 幂等校验
- 事务执行

## 5. 逻辑架构

```text
H5 Frontend
  ├─ REST API
  └─ Socket.IO

Backend App
  ├─ Auth Module
  ├─ Room Module
  ├─ Member Module
  ├─ Transfer Module
  ├─ Settlement Module
  └─ Realtime Module

Storage
  ├─ PostgreSQL
  └─ Redis
```

建议 REST 负责：

- 创建
- 查询
- 补拉全量
- 鉴权

建议 Socket 负责：

- 加房订阅
- 实时广播
- 在线状态变化
- 转分成功广播
- 结算广播
- 重开广播

## 6. 核心领域模型

## 6.1 用户 User

用户分两类：

- 游客
- 微信用户

建议用户模型：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid | 用户 ID |
| auth_type | enum | `guest` / `wechat` |
| nickname | varchar(32) | 默认昵称 |
| avatar_url | varchar(255) | 头像 URL，可空 |
| wechat_openid | varchar(64) | 微信唯一标识，可空 |
| device_id | varchar(64) | 游客设备标识，可空 |
| status | enum | `active` / `disabled` |
| created_at | timestamp | 创建时间 |
| updated_at | timestamp | 更新时间 |

说明：

- 游客首次进入时生成一个匿名用户
- 微信登录后可绑定到已有游客账号，也可直接新建账号

## 6.2 房间 Room

房间是长期容器，回合是临时业务状态。

建议房间模型：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid | 房间 ID |
| code | varchar(8) | 房间码，唯一 |
| name | varchar(64) | 房间名 |
| owner_user_id | uuid | 创建者 ID |
| status | enum | `active` / `settled` / `closed` |
| current_round_no | int | 当前局号 |
| last_settled_at | timestamp | 最近结算时间，可空 |
| created_at | timestamp | 创建时间 |
| updated_at | timestamp | 更新时间 |

说明：

- V1 虽然“任意成员可结算”，仍建议保留 `owner_user_id`
- 后续做房主管理、解散房间、踢人时会用到

## 6.3 房间成员 RoomMember

一个用户进入一个房间后，会形成一个房间成员关系。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid | 房间成员 ID |
| room_id | uuid | 房间 ID |
| user_id | uuid | 用户 ID |
| nickname | varchar(32) | 房间内显示昵称 |
| avatar_url | varchar(255) | 房间内头像 |
| seat_label | varchar(16) | 座位标记，可空 |
| score | int | 当前局净分 |
| is_online | boolean | 当前是否在线 |
| joined_at | timestamp | 加入时间 |
| last_active_at | timestamp | 最后活跃时间 |
| left_at | timestamp | 主动离开时间，可空 |

说明：

- `score` 只代表当前局
- 同一房间同一用户原则上只保留一个有效成员记录
- 若房间内昵称冲突，服务端自动追加后缀，例如 `阿凯(2)`

## 6.4 房间回合 RoomRound

这是 V1 最关键的业务实体。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid | 回合 ID |
| room_id | uuid | 房间 ID |
| round_no | int | 第几局 |
| status | enum | `active` / `settled` |
| started_at | timestamp | 开局时间 |
| settled_at | timestamp | 结算时间，可空 |
| settled_by_member_id | uuid | 谁发起了结算，可空 |
| version | bigint | 版本号，用于并发控制 |

说明：

- 创建房间时自动创建 `round_no = 1`
- 重开时新增 `round_no = current_round_no + 1`
- 所有转分、结算快照都归属于某一局

## 6.5 转分流水 TransferRecord

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid | 流水 ID |
| transfer_batch_id | uuid | 所属转分批次 |
| room_id | uuid | 房间 ID |
| round_id | uuid | 回合 ID |
| from_member_id | uuid | 转出成员 |
| to_member_id | uuid | 转入成员 |
| score | int | 正整数 |
| created_at | timestamp | 创建时间 |

约束：

- `score > 0`
- `from_member_id != to_member_id`

说明：

- 多人转分在后端拆成多条 `transfer_record`
- 前端“多人转分”只是批量提交，不应改变底层模型

### 6.5.1 转分批次 TransferBatch

在真实数据库实现中，建议额外引入 `transfer_batch`：

- 一次前端提交对应一个 `transfer_batch`
- 一个 `transfer_batch` 下可以拆出多条 `transfer_record`
- `requestId` 应放在 `transfer_batch` 上做唯一约束

原因：

- 前端多人转分是一次请求
- 一次请求可能生成多条流水
- 若把 `requestId` 直接放在 `transfer_record` 且做唯一约束，会与多人转分冲突

因此推荐实现方式是：

- `transfer_batch(request_id)` 保证幂等
- `transfer_record` 只保存真实记分明细

## 6.6 结算快照 SettlementSnapshot

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid | 快照 ID |
| room_id | uuid | 房间 ID |
| round_id | uuid | 回合 ID |
| settled_by_member_id | uuid | 发起结算成员 |
| settled_at | timestamp | 结算时间 |
| ranking_json | jsonb | 排名结果 |
| suggestions_json | jsonb | 建议转账方案 |

说明：

- 结算页展示的数据必须来自快照，不应实时重新计算历史局
- 这样可以避免后期算法升级导致旧账单结果漂移

## 6.7 房间事件日志 RoomEvent

建议保留一张轻量事件表，便于排障和后续做操作历史。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid | 事件 ID |
| room_id | uuid | 房间 ID |
| round_id | uuid | 回合 ID，可空 |
| event_type | varchar(32) | 事件类型 |
| operator_member_id | uuid | 操作人，可空 |
| payload_json | jsonb | 事件内容 |
| created_at | timestamp | 创建时间 |

事件类型示例：

- `room_created`
- `member_joined`
- `member_reconnected`
- `transfer_created`
- `settlement_created`
- `room_reopened`

## 7. 数据库表建议

建议最少建立以下表：

- `user`
- `room`
- `room_member`
- `room_round`
- `transfer_batch`
- `transfer_record`
- `settlement_snapshot`
- `room_event`

建议关键索引：

- `room(code)` 唯一索引
- `room_member(room_id, user_id)` 唯一索引
- `room_round(room_id, round_no)` 唯一索引
- `transfer_batch(request_id)` 唯一索引
- `transfer_record(round_id, created_at)` 索引
- `settlement_snapshot(round_id)` 唯一索引

## 8. 前后端契约建议

当前前端核心类型为：

- `RoomState`
- `RoomMember`
- `TransferRecord`
- `SettlementSnapshot`

后端响应建议尽量对齐该结构：

```json
{
  "code": "826531",
  "name": "周末德州局",
  "status": "active",
  "updatedAt": "2026-03-08T12:00:00.000Z",
  "version": 12,
  "roundNo": 1,
  "members": [],
  "transfers": [],
  "settlement": null
}
```

建议新增但前端可暂时忽略的字段：

- `version`
- `roundNo`
- `avatarUrl`
- `ownerUserId`
- `currentUserMemberId`

这样后续支持并发控制和更复杂 UI 时，不需要再改接口骨架。

## 9. REST API 设计

统一前缀建议：

- `/api/v1`

统一响应建议：

```json
{
  "code": 0,
  "message": "ok",
  "data": {}
}
```

错误响应建议：

```json
{
  "code": 4001001,
  "message": "房间不存在",
  "data": null
}
```

## 9.1 鉴权接口

### `POST /api/v1/auth/guest`

作用：

- 游客身份初始化

请求：

```json
{
  "nickname": "牌友123",
  "deviceId": "web-uuid"
}
```

响应：

```json
{
  "user": {
    "id": "u_xxx",
    "nickname": "牌友123",
    "authType": "guest"
  },
  "token": "jwt-token"
}
```

### `POST /api/v1/auth/wechat/login`

作用：

- 微信登录回调换取业务 Token

说明：

- V1 可以先占位，正式联调时再接微信 OAuth

## 9.2 房间接口

### `POST /api/v1/rooms`

作用：

- 创建房间并自动加入当前用户

请求：

```json
{
  "roomName": "周末德州局",
  "nickname": "阿凯"
}
```

响应：

```json
{
  "roomCode": "826531",
  "room": {}
}
```

### `POST /api/v1/rooms/{roomCode}/join`

作用：

- 加入房间

请求：

```json
{
  "nickname": "新牌友"
}
```

规则：

- 房间不存在则报错
- 已在房间内则返回最新房间快照
- 若昵称冲突，由服务端处理重名

### `GET /api/v1/rooms/{roomCode}`

作用：

- 获取房间全量快照

说明：

- 页面首次进入
- Socket 重连后补拉
- 刷新恢复

### `GET /api/v1/rooms/{roomCode}/invite`

作用：

- 获取邀请信息

响应示例：

```json
{
  "roomCode": "826531",
  "inviteLink": "https://domain.com/room/826531"
}
```

## 9.3 转分接口

### `POST /api/v1/rooms/{roomCode}/transfers`

作用：

- 提交一笔或多笔转分

请求：

```json
{
  "requestId": "req_xxx",
  "items": [
    {
      "toMemberId": "m_2",
      "score": 20
    },
    {
      "toMemberId": "m_3",
      "score": 15
    }
  ]
}
```

处理规则：

- 操作人默认为当前登录成员
- 服务端把 `A -> B/C` 拆成多条流水
- 同事务内更新所有接收方与发起方余额
- 房间已结算则拒绝转分

响应：

```json
{
  "room": {},
  "createdTransfers": []
}
```

## 9.4 结算接口

### `POST /api/v1/rooms/{roomCode}/settlements`

作用：

- 生成当前局结算结果

请求：

```json
{
  "requestId": "req_settle_xxx"
}
```

规则：

- 任意房间成员都可发起
- 若当前局已结算，则直接返回已有快照
- 结算时锁定当前局，禁止新的转分写入

响应：

```json
{
  "settlement": {}
}
```

### `GET /api/v1/rooms/{roomCode}/settlements/current`

作用：

- 查询当前局结算快照

## 9.5 重开局接口

### `POST /api/v1/rooms/{roomCode}/reopen`

作用：

- 新建下一局

请求：

```json
{
  "requestId": "req_reopen_xxx"
}
```

规则：

- 若当前局仍为 `active`，可按产品规则决定是否允许强制重开
- 建议 V1 要求只有当前局已结算时才能重开

说明：

- 当前前端允许“结算后继续开局”，后端按新建 `room_round` 实现
- 成员保留，当前局分数重置为 0
- 转分流水从新局开始重新累计

## 10. WebSocket 设计

建议命名空间：

- `/ws`

建议客户端连接后先带上：

- `token`
- `roomCode`

## 10.1 客户端发起事件

### `room:join`

加入 Socket 房间并订阅实时数据

### `room:leave`

离开房间

### `room:ping`

心跳保活

说明：

- 修改类操作仍建议走 REST
- Socket 主要用于订阅广播

这样更容易做幂等、审计和网关层排错

## 10.2 服务端广播事件

### `room:snapshot`

全量房间快照

触发时机：

- 成员刚进入房间
- 刷新重连
- 补拉失败后兜底

### `room:member_joined`

有新成员加入

### `room:member_online_changed`

成员上下线变化

### `room:transfer_created`

有新转分产生

数据建议直接返回：

- 新增流水
- 最新成员分数
- 房间版本号

### `room:settlement_created`

当前局已结算

### `room:reopened`

房间进入新一局

## 11. 关键业务流程

## 11.1 创建房间

1. 校验 Token
2. 创建房间
3. 创建首局 `room_round`
4. 创建房主成员记录
5. 返回房间快照
6. 记录 `room_created` 事件

## 11.2 加入房间

1. 按房间码查房间
2. 校验房间是否可加入
3. 若用户已存在成员记录，则视为重连
4. 若不存在则创建成员记录
5. 返回房间快照
6. 广播成员加入或重连事件

## 11.3 转分

1. 校验当前用户是否属于房间
2. 获取当前 `active round`
3. 对 `room_round` 加行锁
4. 校验局状态为 `active`
5. 批量插入转分流水
6. 更新成员分数
7. 更新房间 `updated_at`
8. 提交事务
9. 广播 `room:transfer_created`

## 11.4 结算

1. 校验成员身份
2. 对当前 `room_round` 加行锁
3. 若已结算则返回已有快照
4. 拉取当前局成员分数
5. 运行结算建议算法
6. 写入 `settlement_snapshot`
7. 更新 `room_round.status = settled`
8. 更新 `room.status = settled`
9. 广播 `room:settlement_created`

## 11.5 重开局

1. 校验当前局已结算
2. 新建下一局 `room_round`
3. 批量清零成员当前局分数
4. 更新 `room.current_round_no`
5. 更新 `room.status = active`
6. 广播 `room:reopened`

## 12. 结算算法建议

V1 使用经典的“债权债务抵消”即可。

输入：

- 所有成员当前净分

步骤：

1. 找出所有正分成员
2. 找出所有负分成员
3. 按绝对值排序
4. 让最大债务人与最大债权人优先匹配
5. 直到所有金额平掉

输出：

- 排名
- 建议转账列表

要求：

- 总和必须为 0
- 尽量减少建议转账笔数

## 13. 并发控制与一致性

这是后端实现最容易出问题的地方。

## 13.1 必须保证的约束

- 同一局内成员分数总和始终为 0
- 已结算局不能再写入新流水
- 同一个 `requestId` 不能重复记账
- 同一时间只能有一个结算成功

## 13.2 推荐手段

- 所有写接口使用数据库事务
- 对 `room_round` 使用 `SELECT ... FOR UPDATE`
- 接口支持 `requestId`
- 房间快照返回 `version`
- 前端可选带 `expectedVersion`，后端可做乐观校验

## 13.3 失败处理

若广播失败：

- 事务不要回滚
- 客户端通过下一次 `GET /rooms/{roomCode}` 补拉全量

结论：

- 数据库提交成功优先
- 实时广播失败不影响账务正确性

## 14. 鉴权与权限建议

## 14.1 Token 设计

建议双 Token：

- `accessToken`
- `refreshToken`

MVP 可先简化为单 Token，但至少要带：

- `userId`
- `authType`
- `deviceId`

## 14.2 房间权限

V1 权限规则：

- 只有房间成员可以查看房间详情
- 只有房间成员可以转分
- 只有房间成员可以结算
- 只有房间成员可以重开局

V1 不做：

- 房主独占结算
- 房主踢人
- 复杂角色权限

## 14.3 安全建议

- 房间码不可预测性要足够，建议 6 位随机数字或 6~8 位字母数字
- 所有写接口必须校验 JWT
- 所有接口必须校验当前用户与当前房间成员关系
- 接口层限流，防止恶意刷房间码

## 15. 在线状态设计

成员 `is_online` 不建议完全依赖数据库轮询。

推荐做法：

- Socket 连接成功时写 Redis 在线态
- 心跳续期
- 断开时立即更新 Redis
- 异步回写数据库 `last_active_at`

前端显示：

- 房间成员头像在线态
- 最近活跃时间可后续扩展

## 16. 日志与监控

至少要有：

- 接口访问日志
- 转分写入日志
- 结算日志
- Socket 连接日志
- 异常堆栈日志

核心监控指标：

- 每分钟创建房间数
- 每分钟转分次数
- WebSocket 在线连接数
- 结算成功率
- API 错误率
- 平均响应时长

## 17. 部署建议

## 17.1 环境划分

- `dev`
- `test`
- `prod`

## 17.2 部署形态

建议：

- 后端服务 1 个容器
- PostgreSQL 1 套
- Redis 1 套
- Nginx 做反向代理

## 17.3 环境变量建议

```env
PORT=3001
APP_ENV=prod
JWT_SECRET=xxx
JWT_EXPIRES_IN=7d
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
WECHAT_APP_ID=xxx
WECHAT_APP_SECRET=xxx
ROOM_CODE_LENGTH=6
```

## 18. 推荐开发顺序

建议按以下顺序开发：

1. 用户游客登录
2. 创建房间
3. 加入房间
4. 房间快照查询
5. WebSocket 入房订阅
6. 单人转分
7. 多人转分
8. 实时广播
9. 结算
10. 重开局
11. 微信登录接入

## 19. 与现有前端的适配建议

当前前端的本地 Store 已经具备以下结构：

- `createRoom`
- `joinRoom`
- `transferScores`
- `settleRoom`
- `reopenRoom`

后端落地时建议新增 `src/services/apiRoomService.ts` 替换本地 mock 服务。

替换策略：

1. 保持前端 `RoomState` 结构不大改
2. 先把 REST 接口接通
3. 再接 Socket 广播
4. 最后去掉本地 mock 计算逻辑

这样风险最小。

## 20. 最终建议

PokerScore 的后端核心不是“登录”，而是“房间回合 + 转分流水 + 实时同步 + 结算快照”。

因此实现时必须优先保证：

- 回合模型正确
- 转分写入有事务
- 结算快照可追溯
- 房间广播可补偿

若只做一个能稳定上线的 V1，推荐你优先完成：

- 游客登录
- 房间 + 回合模型
- 转分流水
- 结算快照
- REST + Socket.IO

这是最小但完整的闭环。
