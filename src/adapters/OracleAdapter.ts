import oracledb from 'oracledb';
import { IDatabaseAdapter, TableInfo, ColumnInfo } from '../interfaces/IDatabaseAdapter.js';

export class OracleAdapter implements IDatabaseAdapter {
  private connection: oracledb.Connection | null = null;
  private config: oracledb.ConnectionAttributes;

  constructor(url: string) {
    // 解析 URL: oracle://user:password@host:port/service_name
    // 示例: oracle://scott:tiger@localhost:1521/ORCL
    const parsed = new URL(url);
    
    this.config = {
      user: parsed.username,
      password: parsed.password,
      // connectString 格式: host:port/service_name
      connectString: `${parsed.hostname}:${parsed.port || 1521}/${parsed.pathname.slice(1)}`
    };
  }

  async connect(): Promise<void> {
    try {
      // 启用 Thin 模式（纯 JS 实现，无需二进制客户端）
      // 这种模式支持连接到 Oracle Database 12.1 及以上版本
      this.connection = await oracledb.getConnection(this.config);
      console.error('Successfully connected to Oracle database');
    } catch (error) {
      console.error('Failed to connect to Oracle database:', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.connection) {
      try {
        await this.connection.close();
      } catch (err) {
        console.error('Error closing Oracle connection:', err);
      }
      this.connection = null;
    }
  }

  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    if (!this.connection) throw new Error('Database not connected');

    // Oracle 使用 :0, :1 或 :name。为了兼容 ? 占位符，我们需要转换 SQL
    // 简单的正则替换 ? 为 :0, :1...
    let convertedSql = sql;
    let paramIndex = 0;
    while (convertedSql.includes('?')) {
      convertedSql = convertedSql.replace('?', `:${paramIndex++}`);
    }

    // 执行查询
    const result = await this.connection.execute(convertedSql, params, {
      outFormat: oracledb.OUT_FORMAT_OBJECT, // 返回对象而不是数组
      resultSet: false
    });

    return (result.rows || []) as T[];
  }

  async execute(sql: string, params: any[] = []): Promise<any> {
    if (!this.connection) throw new Error('Database not connected');

    let convertedSql = sql;
    let paramIndex = 0;
    while (convertedSql.includes('?')) {
      convertedSql = convertedSql.replace('?', `:${paramIndex++}`);
    }

    const result = await this.connection.execute(convertedSql, params, {
      autoCommit: true, // Oracle 默认不自动提交，这里设为 true
      outFormat: oracledb.OUT_FORMAT_OBJECT
    });

    return {
      rowsAffected: result.rowsAffected
    };
  }

  async listTables(): Promise<string[]> {
    // 获取当前用户可访问的表
    const sql = `
      SELECT table_name 
      FROM user_tables 
      ORDER BY table_name
    `;
    const rows = await this.query<{ TABLE_NAME: string }>(sql);
    return rows.map(row => row.TABLE_NAME);
  }

  async describeTable(tableName: string): Promise<TableInfo> {
    // 简单验证表名
    if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
      throw new Error('Invalid table name');
    }

    const sql = `
      SELECT column_name, data_type, nullable, data_default
      FROM user_tab_columns
      WHERE table_name = :0
      ORDER BY column_id
    `;
    
    // Oracle 通常将未加引号的表名存储为大写
    // 我们尝试查询两次，一次原样，一次全大写
    let columns = await this.query<any>(sql, [tableName]);
    if (columns.length === 0) {
      columns = await this.query<any>(sql, [tableName.toUpperCase()]);
    }

    if (columns.length === 0) {
      throw new Error(`Table ${tableName} not found`);
    }

    const columnInfos: ColumnInfo[] = columns.map((col: any) => ({
      name: col.COLUMN_NAME,
      type: col.DATA_TYPE,
      nullable: col.NULLABLE === 'Y',
      default: col.DATA_DEFAULT
    }));

    return {
      name: tableName,
      columns: columnInfos
    };
  }

  async getTableDDL(tableName: string): Promise<string | null> {
    try {
      const sql = `SELECT DBMS_METADATA.GET_DDL('TABLE', :0) AS DDL FROM DUAL`;
      // 使用大写表名尝试，因为 Oracle 默认大写
      const rows = await this.query<{ DDL: string }>(sql, [tableName.toUpperCase()]);
      if (rows.length > 0) {
        // Oracle 返回的是 LOB 对象，oracledb 驱动根据配置可能返回字符串或 Lob 对象
        // 我们的 query 方法配置了 OUT_FORMAT_OBJECT，通常会尝试读取
        // 如果返回的是 Lob，需要流式读取。但在 fetchAsString 配置下可以直接获取字符串
        // 这里假设驱动已经处理，或者是简单的字符串
        return rows[0].DDL;
      }
    } catch (error) {
      // Ignore
    }
    return null;
  }
}
