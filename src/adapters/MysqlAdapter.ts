import mysql from 'mysql2/promise';
import { IDatabaseAdapter, TableInfo, ColumnInfo } from '../interfaces/IDatabaseAdapter.js';

export class MysqlAdapter implements IDatabaseAdapter {
  private pool: mysql.Pool | null = null;
  private config: mysql.PoolOptions;

  constructor(url: string) {
    this.config = {
      uri: url,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      // 保持长连接存活
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
    };
  }

  async connect(): Promise<void> {
    try {
      this.pool = mysql.createPool(this.config);
      // 测试连接
      const connection = await this.pool.getConnection();
      connection.release();
      console.error('Successfully connected to MySQL database');
    } catch (error) {
      console.error('Failed to connect to MySQL database:', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    if (!this.pool) throw new Error('Database not connected');
    
    const [rows] = await this.pool.execute(sql, params);
    return rows as T[];
  }

  async execute(sql: string, params: any[] = []): Promise<any> {
    if (!this.pool) throw new Error('Database not connected');
    
    const [result] = await this.pool.execute(sql, params);
    return result;
  }

  async listTables(): Promise<string[]> {
    const rows = await this.query<{ [key: string]: string }>('SHOW TABLES');
    return rows.map(row => Object.values(row)[0]);
  }

  async describeTable(tableName: string): Promise<TableInfo> {
    // 验证表名以防止 SQL 注入 (简单验证)
    if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
      throw new Error('Invalid table name');
    }

    const columns = await this.query<any>(`DESCRIBE ${tableName}`);
    
    const columnInfos: ColumnInfo[] = columns.map((col: any) => ({
      name: col.Field,
      type: col.Type,
      nullable: col.Null === 'YES',
      key: col.Key,
      default: col.Default,
      extra: col.Extra
    }));

    return {
      name: tableName,
      columns: columnInfos
    };
  }

  async getTableDDL(tableName: string): Promise<string | null> {
    try {
      const sql = `SHOW CREATE TABLE ${tableName}`;
      const rows = await this.query<any>(sql);
      if (rows.length > 0) {
        return rows[0]['Create Table'];
      }
      return null;
    } catch (error) {
      return null;
    }
  }
}
