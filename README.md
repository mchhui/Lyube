# Lyube

个人时间记录应用，灵感来自苏联学者 **柳比歇夫**（Любишев）的时间统计法。

MVP 功能：开始/停止计时、手动补录、按日查看记录与合计时长。

## 技术栈

| 层 | 技术 |
|---|---|
| 后端 | Python · FastAPI · SQLite |
| 前端 | Node · Vite · TypeScript |
| 部署 | 单进程，适合个人本地/内网部署 |

## 快速开始

### 方式一：一键启动（推荐）

```powershell
# 在项目根目录执行，自动构建前端并启动
.\start.ps1
```

若提示「禁止运行脚本」，可改用 `.\start.bat`，或执行：

```powershell
powershell -ExecutionPolicy Bypass -File .\start.ps1
```

浏览器打开 **http://127.0.0.1:8000**

### 方式二：开发模式（前端热更新）

```powershell
.\dev.ps1
# 或 .\dev.bat（绕过脚本执行策略限制）
```

也可手动开两个终端：

```powershell
# 终端 1 - 后端
cd backend
.\.venv\Scripts\activate
python run.py

# 终端 2 - 前端
cd frontend
npm install
npm run dev
```

浏览器打开 **http://127.0.0.1:5173**（不要只开前端不开后端）

### 手动分步

```bash
cd backend && pip install -r requirements.txt && python run.py
cd frontend && npm install && npm run build   # 生产模式需要先 build
```

> 常见连不上原因：只开了前端没开后端，或访问 8000 但还没 `npm run build`。

## 数据存储

SQLite 数据库文件：`backend/data/lyube.db`

个人部署时备份此文件即可保留全部记录。

## API 概览

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/health` | 健康检查 |
| GET | `/api/entries` | 列表（可选 `?date=YYYY-MM-DD`） |
| GET | `/api/entries/running` | 当前进行中的任务 |
| POST | `/api/entries/start` | 开始计时 |
| POST | `/api/entries/{id}/stop` | 停止计时 |
| POST | `/api/entries` | 手动创建记录 |
| DELETE | `/api/entries/{id}` | 删除记录 |

## 后续规划

- 智能统计（分类汇总、趋势、周报）
- 任务标签与项目分组
- 数据导出
