#!/usr/bin/env node
import 'dotenv/config';
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { MysqlAdapter } from "./adapters/MysqlAdapter.js";
import { OracleAdapter } from "./adapters/OracleAdapter.js";
import { PostgresAdapter } from "./adapters/PostgresAdapter.js";
import { SqliteAdapter } from "./adapters/SqliteAdapter.js";
import { SqlServerAdapter } from "./adapters/SqlServerAdapter.js";
import { IDatabaseAdapter } from "./interfaces/IDatabaseAdapter.js";
import { Logger } from "./utils/logger.js";

const server = new Server(
  {
    name: "db-mcp-server",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 获取配置
const DB_URL = process.env.DATABASE_URL;
const IS_READ_ONLY = process.env.MCP_DB_READ_ONLY === 'true';

if (!DB_URL) {
  const msg = "Error: DATABASE_URL environment variable is required";
  console.error(msg);
  Logger.log({
    tool: 'system',
    duration_ms: 0,
    success: false,
    error: msg
  });
  process.exit(1);
}

if (IS_READ_ONLY) {
  console.error("Starting in READ-ONLY mode. Write operations are disabled.");
}

function getDatabaseAdapter(url: string): IDatabaseAdapter {
  if (url.startsWith('mysql://')) {
    return new MysqlAdapter(url);
  } else if (url.startsWith('postgres://') || url.startsWith('postgresql://')) {
    return new PostgresAdapter(url);
  } else if (url.startsWith('file://') || url.startsWith('sqlite://') || url.endsWith('.db') || url.endsWith('.sqlite')) {
    return new SqliteAdapter(url);
  } else if (url.startsWith('mssql://') || url.startsWith('sqlserver://')) {
    return new SqlServerAdapter(url);
  } else if (url.startsWith('oracle://')) {
    return new OracleAdapter(url);
  } else {
    throw new Error(`Unsupported database protocol. Supported: mysql, postgres, sqlite, mssql, oracle`);
  }
}

let db: IDatabaseAdapter;
try {
  db = getDatabaseAdapter(DB_URL);
} catch (error) {
  const msg = "Configuration error: " + (error instanceof Error ? error.message : String(error));
  console.error(msg);
  Logger.log({
    tool: 'system',
    duration_ms: 0,
    success: false,
    error: msg
  });
  process.exit(1);
}

// 定义 Tools
const READ_QUERY_TOOL: Tool = {
  name: "read_query",
  description: "Execute a read-only SQL query (SELECT). MySQL/SQLite use '?', PostgreSQL uses '$1', SQL Server uses '@p0', Oracle uses ':0'.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "The SQL SELECT query to execute" },
      params: { type: "array", items: {}, description: "Optional parameters for the query" }
    },
    required: ["query"]
  },
};

const WRITE_QUERY_TOOL: Tool = {
  name: "write_query",
  description: "Execute a write SQL query (INSERT, UPDATE, DELETE, CREATE, DROP, ALTER). Use with caution.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "The SQL query to execute" },
      params: { type: "array", items: {}, description: "Optional parameters for the query" }
    },
    required: ["query"]
  },
};

const LIST_TABLES_TOOL: Tool = {
  name: "list_tables",
  description: "List all tables in the database.",
  inputSchema: {
    type: "object",
    properties: {},
  },
};

const DESCRIBE_TABLE_TOOL: Tool = {
  name: "describe_table",
  description: "Get the schema information for a specific table.",
  inputSchema: {
    type: "object",
    properties: {
      table_name: { type: "string", description: "The name of the table to describe" }
    },
    required: ["table_name"]
  },
};

const GET_TABLE_DDL_TOOL: Tool = {
  name: "get_table_ddl",
  description: "Get the CREATE TABLE statement (DDL) for a specific table. Useful for understanding constraints, indexes, and defaults.",
  inputSchema: {
    type: "object",
    properties: {
      table_name: { type: "string", description: "The name of the table" }
    },
    required: ["table_name"]
  },
};

const INSPECT_TABLE_TOOL: Tool = {
  name: "inspect_table",
  description: "Get the first 5 rows of a table to understand the data distribution and format.",
  inputSchema: {
    type: "object",
    properties: {
      table_name: { type: "string", description: "The name of the table to inspect" }
    },
    required: ["table_name"]
  },
};

// Tool 列表处理
server.setRequestHandler(ListToolsRequestSchema, async () => {
  const tools = [
    READ_QUERY_TOOL,
    LIST_TABLES_TOOL,
    DESCRIBE_TABLE_TOOL,
    GET_TABLE_DDL_TOOL,
    INSPECT_TABLE_TOOL,
  ];

  // 仅在非只读模式下暴露写工具
  if (!IS_READ_ONLY) {
    tools.push(WRITE_QUERY_TOOL);
  }

  return { tools };
});

// Tool 调用处理
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const startTime = Date.now();
  const { name, arguments: args } = request.params;
  
  // 提取 SQL 以便日志记录 (仅针对 query 相关工具)
  let sqlQuery = "";
  let sqlParams: any[] = [];
  if (args && typeof args === 'object') {
    if ('query' in args) {
      sqlQuery = (args as any).query;
      sqlParams = (args as any).params;
    }
  }

  try {
    let result: any;

    switch (name) {
      case "read_query": {
        const { query, params } = args as { query: string; params?: any[] };
        if (!query.trim().toLowerCase().startsWith("select")) {
           throw new Error("read_query only supports SELECT statements. Use write_query for modifications.");
        }
        const rows = await db.query(query, params);
        result = {
          content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
          _meta: { rows: rows.length } // 内部元数据用于日志
        };
        break;
      }

      case "write_query": {
        if (IS_READ_ONLY) {
          throw new Error("Write operations are disabled by configuration (MCP_DB_READ_ONLY=true).");
        }
        const { query, params } = args as { query: string; params?: any[] };
        const execResult = await db.execute(query, params);
        result = {
          content: [{ type: "text", text: JSON.stringify(execResult, null, 2) }],
          _meta: { ...execResult }
        };
        break;
      }

      case "list_tables": {
        const tables = await db.listTables();
        result = {
          content: [{ type: "text", text: JSON.stringify(tables, null, 2) }],
          _meta: { table_count: tables.length }
        };
        break;
      }

      case "describe_table": {
        const { table_name } = args as { table_name: string };
        const info = await db.describeTable(table_name);
        result = {
          content: [{ type: "text", text: JSON.stringify(info, null, 2) }],
          _meta: { columns: info.columns?.length || 0 }
        };
        break;
      }

      case "get_table_ddl": {
        const { table_name } = args as { table_name: string };
        const ddl = await db.getTableDDL(table_name);
        result = {
          content: [{ type: "text", text: ddl || "DDL not available for this table or database type." }],
          _meta: { found: !!ddl }
        };
        break;
      }

      case "inspect_table": {
        const { table_name } = args as { table_name: string };
        if (!/^[a-zA-Z0-9_]+$/.test(table_name)) {
           throw new Error("Invalid table name");
        }
        
        let query = `SELECT * FROM ${table_name} LIMIT 5`;
        let rows: any[] = [];
        
        try {
           query = `SELECT * FROM ${table_name} LIMIT 5`;
           rows = await db.query(query);
           sqlQuery = query;
        } catch (e) {
           try {
             query = `SELECT TOP 5 * FROM ${table_name}`;
             rows = await db.query(query);
             sqlQuery = query;
           } catch (e2) {
             try {
               query = `SELECT * FROM ${table_name} WHERE ROWNUM <= 5`;
               rows = await db.query(query);
               sqlQuery = query;
             } catch (e3) {
                throw new Error(`Failed to inspect table: ${e}`);
             }
           }
        }
        
        result = {
          content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
          _meta: { rows: rows.length }
        };
        break;
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    // 记录成功日志
    const duration = Date.now() - startTime;
    const meta = (result as any)._meta || {};
    Logger.log({
      tool: name,
      query: sqlQuery,
      params: sqlParams,
      duration_ms: duration,
      success: true,
      result_summary: JSON.stringify(meta)
    });

    // 清理内部元数据
    if ((result as any)._meta) delete (result as any)._meta;
    
    return result;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const duration = Date.now() - startTime;
    
    // 记录错误日志
    Logger.log({
      tool: name,
      query: sqlQuery,
      params: sqlParams,
      duration_ms: duration,
      success: false,
      error: errorMessage
    });

    return {
      content: [{ type: "text", text: `Error: ${errorMessage}` }],
      isError: true,
    };
  }
});

async function main() {
  try {
    Logger.log({
      tool: 'system',
      duration_ms: 0,
      success: true,
      result_summary: "Server starting"
    });

    // 先启动 Transport，避免数据库连接超时导致 MCP 初始化失败
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Database MCP Server running on stdio");

    // 异步连接数据库
    console.error("Connecting to database...");
    try {
      await db.connect();
      console.error("Database connected successfully");
      Logger.log({
        tool: 'system',
        duration_ms: 0,
        success: true,
        result_summary: "Database connected successfully"
      });
    } catch (dbError) {
      const errMsg = dbError instanceof Error ? dbError.message : String(dbError);
      console.error("Failed to connect to database:", dbError);
      console.error("Server will start in disconnected mode.");
      Logger.log({
        tool: 'system',
        duration_ms: 0,
        success: false,
        error: `Failed to connect to database: ${errMsg}`
      });
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("Fatal error:", error);
    Logger.log({
      tool: 'system',
      duration_ms: 0,
      success: false,
      error: `Fatal error: ${errMsg}`
    });
    process.exit(1);
  }
}

main();
