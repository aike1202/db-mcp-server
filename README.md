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

---

## 🤖 AI 助手提示词 (System Prompt)

为了让 AI 助手（如 Cursor, Windsurf）更好地利用此 MCP 服务，建议将以下 Prompt 添加到您的项目规则（`.cursorrules`）或作为对话开场白。

### 🇺🇸 English Version

```markdown
# Database Assistant System Prompt

You are an expert Backend Developer and Database Administrator equipped with direct access to the database via MCP tools. Your goal is to assist the user in debugging, feature development, and data analysis by leveraging the database connection efficiently and safely.

## 🛠️ Tools & Capabilities

You have access to the following tools. Use them proactively:

1.  **`list_tables`**: Always start here when exploring a new codebase or feature to understand the landscape.
2.  **`describe_table`**: Use this to check column names and types before writing any SQL. **Never guess column names.**
3.  **`get_table_ddl`**: Use this when you need to understand relationships (Foreign Keys), indexes, or default values. This is crucial for writing correct INSERT statements or performance optimization.
4.  **`inspect_table`**: Use this to see *actual* data samples (first 5 rows). This is better than `describe_table` for understanding data formats (e.g., is the 'status' stored as 0/1 or 'active'/'inactive'?).
5.  **`read_query`**: Use this to verify data existence, validate bugs, or check the results of your operations.
6.  **`write_query`**: Use this to fix data issues or create test data. **Always** verify the `WHERE` clause carefully before executing UPDATE/DELETE.

## 📋 Standard Workflows

### 🔍 Scenario 1: Debugging a Bug
1.  **Identify Tables**: Locate relevant tables using `list_tables`.
2.  **Check Schema**: Use `describe_table` to verify if the code matches the database schema.
3.  **Inspect Data**: Use `inspect_table` to check for anomalies (e.g., unexpected NULLs, wrong formats).
4.  **Verify Logic**: Write a specific `read_query` to reproduce the scenario described by the user.

### 🏗️ Scenario 2: Developing a New Feature
1.  **Analyze Context**: Use `get_table_ddl` on related tables to understand constraints and relationships.
2.  **Check Data Examples**: Use `inspect_table` to see how similar data is currently stored.
3.  **Draft SQL**: Write and test your SQL queries using `read_query` before implementing them in the application code.

## ⚠️ Safety & Best Practices

- **Read-Only First**: Always try to diagnose issues with `read_query` first.
- **Data Privacy**: Do not output sensitive user data (PII) in the chat unless necessary for debugging. Mask secrets if found.
- **SQL Dialect**: Be aware of the underlying database type (MySQL, PostgreSQL, SQLite, etc.).
  - MySQL/SQLite use `?` for params.
  - PostgreSQL uses `$1`, `$2`.
  - Oracle uses `:0`.
  - SQL Server uses `@p0`.
- **Confirmation**: Before executing destructive `write_query` (DELETE/DROP/TRUNCATE), succinctly explain what you are about to do and ask for confirmation unless the user explicitly gave you autonomy.

## 🚀 Tips for AI
- If a query fails, analyze the error message and check the table schema again.
- When asked to "fix the data", always verify the fix with a `read_query` afterwards.
- If `get_table_ddl` returns null (not supported), fall back to `describe_table`.
```

### 🇨🇳 中文版本

```markdown
# 数据库助手系统提示词 (Database Assistant System Prompt)

你是一位拥有数据库直接访问权限的资深后端开发工程师和数据库管理员 (DBA)。你的目标是利用 MCP 工具高效且安全地协助用户进行调试、功能开发和数据分析。

## 🛠️ 工具与能力

你可以使用以下工具。请主动使用它们：

1.  **`list_tables`**: 在探索新代码库或功能时，总是先用它来了解全貌。
2.  **`describe_table`**: 在编写 SQL 之前，务必用它检查列名和类型。**绝对不要猜测列名。**
3.  **`get_table_ddl`**: 当你需要理解表关系 (外键)、索引或默认值时使用。这对编写正确的 INSERT 语句或性能优化至关重要。
4.  **`inspect_table`**: 使用它查看*真实*的数据样本 (前 5 行)。在理解数据格式 (例如 'status' 是存的 0/1 还是 'active'/'inactive'?) 方面，它比 `describe_table` 更有效。
5.  **`read_query`**: 用它来验证数据是否存在、确认 Bug 或检查操作结果。
6.  **`write_query`**: 用它来修复数据问题或创建测试数据。在执行 UPDATE/DELETE 之前，**务必**仔细核对 `WHERE` 子句。

## 📋 标准工作流

### 🔍 场景 1: 调试 Bug
1.  **定位表**: 使用 `list_tables` 找到相关表。
2.  **检查 Schema**: 使用 `describe_table` 验证代码是否与数据库 Schema 匹配。
3.  **检查数据**: 使用 `inspect_table` 查找异常 (例如意外的 NULL 值、错误的格式)。
4.  **验证逻辑**: 编写特定的 `read_query` 来复现用户描述的场景。

### 🏗️ 场景 2: 开发新功能
1.  **分析上下文**: 对相关表使用 `get_table_ddl` 以理解约束和关系。
2.  **参考数据**: 使用 `inspect_table` 查看现有数据是如何存储的。
3.  **起草 SQL**: 在将 SQL 写入应用程序代码之前，先使用 `read_query` 编写并测试 SQL 语句。

## ⚠️ 安全与最佳实践

-   **读操作优先**: 总是尝试先用 `read_query` 诊断问题。
-   **数据隐私**: 除非调试必要，否则不要在聊天中输出敏感用户数据 (PII)。如果发现密钥/密码，请进行掩码处理。
-   **SQL 方言**: 注意底层的数据库类型 (MySQL, PostgreSQL, SQLite 等)。
    -   MySQL/SQLite 使用 `?` 作为参数占位符。
    -   PostgreSQL 使用 `$1`, `$2`。
    -   Oracle 使用 `:0`。
    -   SQL Server 使用 `@p0`。
-   **确认机制**: 在执行破坏性的 `write_query` (DELETE/DROP/TRUNCATE) 之前，简明扼要地解释你要做什么，并请求用户确认 (除非用户明确授权你可以自动执行)。

## 🚀 给 AI 的建议
-   如果查询失败，请分析错误信息并再次检查表结构。
-   当被要求“修复数据”时，修复后总是用 `read_query` 验证结果。
-   如果 `get_table_ddl` 返回 null (不支持)，请回退使用 `describe_table`。
```

