# 🗄️ Database MCP Server

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/MCP-SDK-green.svg)](https://modelcontextprotocol.io/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Database MCP Server** 是一个通用的数据库连接服务，基于 [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) 构建。它允许 AI 助手（如 Claude Desktop, Cursor, Windsurf）直接与您的关系型数据库进行交互，安全地查询数据、分析表结构，甚至在授权的情况下执行数据修改。

> ⚠️ **测试状态说明 (Status)**:
> 目前 **MySQL** 适配器已经过作者的充分测试和验证。
> 针对 **PostgreSQL, SQLite, SQL Server, Oracle** 的支持是基于标准驱动实现的实验性功能。虽然理论上可以正常工作，但可能存在边缘情况。
> **非常欢迎社区反馈！** 如果您在使用非 MySQL 数据库时遇到问题，请提交 Issue 帮助改进。

---

## ✨ 核心特性

*   **多数据库支持**: 一套代码，兼容 MySQL, PostgreSQL, SQL Server, Oracle, SQLite。
*   **智能分析**:
    *   `inspect_table`: 自动预览数据，无需猜测 SQL 语法。
    *   `get_table_ddl`: 获取建表语句，帮助 AI 理解复杂的表约束和索引。
*   **安全可控**:
    *   **只读模式**: 通过环境变量一键禁用所有写操作，保护生产数据。
*   **零依赖部署 (Oracle)**: 使用 Thin Mode，无需安装笨重的 Oracle Instant Client。

---

## 🔌 支持的数据库

| 数据库 | 协议前缀 | 连接字符串示例 | 测试状态 |
| :--- | :--- | :--- | :--- |
| **MySQL** | `mysql://` | `mysql://user:pass@localhost:3306/db` | ✅ Verified |
| **PostgreSQL** | `postgres://` | `postgres://user:pass@localhost:5432/db` | 🧪 Beta |
| **SQLite** | `file://` | `file:///path/to/data.db` | 🧪 Beta |
| **SQL Server** | `mssql://` | `mssql://sa:pass@localhost:1433/db` | 🧪 Beta |
| **Oracle** | `oracle://` | `oracle://user:pass@localhost:1521/service` | 🧪 Beta |

---

## 🚀 快速开始

### 1. 安装与构建

```bash
git clone https://github.com/your-username/db-mcp-server.git
cd db-mcp-server
npm install
npm run build
```

### 2. 配置 (Windsurf / Cursor)

在您的 MCP 配置文件中（通常位于 `%APPDATA%\Cursor\User\globalStorage\mcp-server-config.json`），添加如下配置：

```json
{
  "mcpServers": {
    "my-database": {
      "command": "node",
      "args": ["C:/path/to/db-mcp-server/build/index.js"],
      "env": {
        "DATABASE_URL": "mysql://root:password@localhost:3306/testdb",
        "MCP_DB_READ_ONLY": "false"
      }
    }
  }
}
```

> **注意**: 请将 `args` 中的路径替换为您实际的项目构建路径。

---

## 🛠️ 工具列表 (Tools)

AI 助手将获得以下工具：

*   **`read_query`**: 执行 SELECT 查询。
    *   *参数*: `query` (SQL 语句)
*   **`write_query`**: 执行 INSERT/UPDATE/DELETE (受只读模式控制)。
    *   *参数*: `query` (SQL 语句)
*   **`list_tables`**: 列出数据库中的所有表。
*   **`describe_table`**: 查看特定表的字段结构、类型和默认值。
    *   *参数*: `table_name`
*   **`get_table_ddl`**: 获取表的完整 CREATE TABLE 语句（支持 MySQL, SQLite, Oracle）。
    *   *参数*: `table_name`
*   **`inspect_table`**: 智能预览表的前 5 行数据。
    *   *参数*: `table_name`

---

## ⚙️ 环境变量

| 变量名 | 描述 | 默认值 |
| :--- | :--- | :--- |
| `DATABASE_URL` | **(必填)** 数据库连接字符串 | - |
| `MCP_DB_READ_ONLY` | 是否开启只读模式。设为 `true` 将禁用 `write_query`。 | `false` |
| `MCP_LOG_PATH` | 自定义日志文件路径（绝对路径）。 | `logs/mcp-audit.jsonl` |

---

## ❓ 常见问题 (FAQ)

**Q: 连接 SQL Server 失败？**
A: 请确保 SQL Server 启用了 TCP/IP 协议，并且防火墙允许 1433 端口。如果遇到证书错误，尝试在连接字符串中添加 `?encrypt=false`（视驱动支持情况而定）。

**Q: Oracle 连接报错？**
A: 我们使用的是 Thin Mode，请确保您的数据库版本支持（Oracle 12.1+）。无需配置 `tnsnames.ora`，直接使用 `host:port/service_name` 格式。

**Q: 为什么我看不到 `write_query` 工具？**
A: 请检查环境变量 `MCP_DB_READ_ONLY` 是否被设置为了 `true`。

---

## 📄 License

MIT
