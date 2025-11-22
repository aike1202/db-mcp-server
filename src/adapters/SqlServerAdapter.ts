import sql from 'mssql';
import { IDatabaseAdapter, TableInfo, ColumnInfo } from '../interfaces/IDatabaseAdapter.js';

export class SqlServerAdapter implements IDatabaseAdapter {
  private pool: sql.ConnectionPool | null = null;
  private config: string;

  constructor(url: string) {
    // mssql 驱动支持解析类似 mssql://username:password@server/database 的连接字符串
    // 但需要注意，mssql 官方驱动对 URL 的支持可能有限，或者需要特定的 options
    // 这里我们直接传递 url，mssql.connect 支持连接字符串
    this.config = url;
  }

  async connect(): Promise<void> {
    try {
      // 处理 self-signed certificate 错误，这在开发环境中很常见
      // 我们需要解析 URL 并添加 encrypt: false 或 trustServerCertificate: true
      // 为了简单，我们尝试直接连接，如果用户在 URL 中指定了参数最好
      // 另一种方法是修改 config 对象
      
      // 在 mssql v6+ 中，连接字符串支持比较完善
      this.pool = await sql.connect(this.config);
      console.error('Successfully connected to SQL Server database');
    } catch (error) {
      console.error('Failed to connect to SQL Server database:', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.close();
      this.pool = null;
    }
  }

  async query<T = any>(query: string, params: any[] = []): Promise<T[]> {
    if (!this.pool) throw new Error('Database not connected');

    const request = this.pool.request();
    
    // 简单的参数替换逻辑：将 ? 替换为 @p0, @p1... 并绑定参数
    let sqlWithParams = query;
    
    // 只有当有参数时才进行处理
    if (params && params.length > 0) {
      // 这是一个简化的替换，它不会忽略字符串常量中的 ?
      // 对于复杂的 SQL，这是一个已知的限制
      const parts = sqlWithParams.split('?');
      if (parts.length - 1 !== params.length) {
        // 参数数量不匹配，或者 SQL 中没有 ? 但传入了 params
        // 在这种情况下，我们直接尝试执行原 SQL（或者报错）
        // 为了健壮性，如果数量不匹配，我们不进行替换，让数据库报错
      } else {
        sqlWithParams = parts.reduce((acc, part, index) => {
          if (index < params.length) {
            const paramName = `p${index}`;
            request.input(paramName, params[index]);
            return acc + part + `@${paramName}`;
          }
          return acc + part;
        }, '');
      }
    }

    const result = await request.query(sqlWithParams);
    return result.recordset as T[];
  }

  async execute(query: string, params: any[] = []): Promise<any> {
    if (!this.pool) throw new Error('Database not connected');

    const request = this.pool.request();
    
    let sqlWithParams = query;
    if (params && params.length > 0) {
       const parts = sqlWithParams.split('?');
       if (parts.length - 1 === params.length) {
          sqlWithParams = parts.reduce((acc, part, index) => {
            if (index < params.length) {
              const paramName = `p${index}`;
              request.input(paramName, params[index]);
              return acc + part + `@${paramName}`;
            }
            return acc + part;
          }, '');
       }
    }

    const result = await request.query(sqlWithParams);
    return {
      rowsAffected: result.rowsAffected,
    };
  }

  async listTables(): Promise<string[]> {
    const sql = `
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_TYPE = 'BASE TABLE'
    `;
    // 内部调用不需要参数转换
    const result = await this.pool!.request().query(sql);
    return result.recordset.map((row: any) => row.TABLE_NAME);
  }

  async describeTable(tableName: string): Promise<TableInfo> {
    if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
      throw new Error('Invalid table name');
    }

    const sql = `
      SELECT 
        COLUMN_NAME, 
        DATA_TYPE, 
        IS_NULLABLE, 
        COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = @tableName
    `;
    
    const request = this.pool!.request();
    request.input('tableName', tableName);
    const result = await request.query(sql);
    const columns = result.recordset;

    if (columns.length === 0) {
      throw new Error(`Table ${tableName} not found`);
    }

    const columnInfos: ColumnInfo[] = columns.map((col: any) => ({
      name: col.COLUMN_NAME,
      type: col.DATA_TYPE,
      nullable: col.IS_NULLABLE === 'YES',
      default: col.COLUMN_DEFAULT
    }));

    return {
      name: tableName,
      columns: columnInfos
    };
  }

  async getTableDDL(tableName: string): Promise<string | null> {
    // SQL Server 获取 DDL 通常需要 sp_helptext (仅适用于视图/存储过程) 或查询 sys 表
    // 这里暂时返回 null
    return null;
  }
}
