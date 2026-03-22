# Todo 模块 E2E 测试覆盖

## 模块概述

**路由**: `/login`, `/`

## 功能清单与测试覆盖

| 功能点     | 描述                             | 优先级 | 状态 | 测试文件               |
| ---------- | -------------------------------- | ------ | ---- | ---------------------- |
| 登录重定向 | 未登录访问首页时跳转登录页       | P0     | ✅   | `auth.feature`         |
| UI 登录    | 默认账号登录并进入任务看板       | P0     | ✅   | `auth.feature`         |
| 创建任务   | 已登录用户创建任务并显示在 Later | P0     | ✅   | `crud.feature`         |
| 完成任务   | 已登录用户完成任务并进入 Done    | P0     | ✅   | `crud.feature`         |
| 删除任务   | 已登录用户删除任务               | P0     | ✅   | `crud.feature`         |
| 重命名任务 | 双击任务标题后更新任务名         | P1     | ✅   | `crud.feature`         |
| 拖拽分栏   | 任务在 Later/Today/Done 之间拖拽 | P1     | ✅   | `bucket.feature`       |
| 离线同步   | 离线创建任务后恢复在线自动同步   | P2     | ✅   | `offline-sync.feature` |

## 测试文件结构

- `auth.feature`: 登录态与路由守卫
- `crud.feature`: 创建、完成、删除、重命名
- `bucket.feature`: 拖拽分栏
- `offline-sync.feature`: 离线队列同步

## 测试执行

```bash
cd allinone && docker compose up -d
cd ../todo && VITE_API_BASE_URL=http://127.0.0.1:2910/api/v1 vp dev --port 3000
cd ../todo && vp run e2e:cleanup
cd ../todo && BASE_URL=http://127.0.0.1:3000 API_BASE_URL=http://127.0.0.1:2910/api/v1 vp run e2e:dry-run
cd ../todo && BASE_URL=http://127.0.0.1:3000 API_BASE_URL=http://127.0.0.1:2910/api/v1 vp run e2e:test -- --tags "@P0"
```

## 已知问题

- 需要本地已经安装 Playwright Chromium 浏览器。
- `e2e:test` 会在测试前后自动清理 `e2e-*` 用户、todo 和默认组织数据；也可以手动执行 `vp run e2e:cleanup`。

## 更新记录

- 2026-03-22: 初始化 Cucumber + Playwright E2E 基础设施并覆盖 Todo 核心旅程。
