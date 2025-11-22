import pg from 'pg';
import { IDatabaseAdapter, TableInfo, ColumnInfo } from '../interfaces/IDatabaseAdapter.js';

export class PostgresAdapter implements IDatabaseAdapter {
  private pool: pg.Pool;

  constructor(url: string) {
    this.pool = new pg.Pool({
      connectionString: url,
    });
  }

  async connect(): Promise<void> {
    try {
      // 测试连接
      const client = await this.pool.connect();
      client.release();
      console.error('Successfully connected to PostgreSQL database');
    } catch (error) {
      console.error('Failed to connect to PostgreSQL database:', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const result = await this.pool.query(sql, params);
    return result.rows;
  }

  async execute(sql: string, params: any[] = []): Promise<any> {
    const result = await this.pool.query(sql, params);
    return {
      rowCount: result.rowCount,
      command: result.command,
      oid: result.oid,
      rows: result.rows // RETURNING clause support
    };
  }

  async listTables(): Promise<string[]> {
    const sql = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;
    const rows = await this.query<{ table_name: string }>(sql);
    return rows.map(row => row.table_name);
  }

  async describeTable(tableName: string): Promise<TableInfo> {
    // 简单的表名验证
    if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
      throw new Error('Invalid table name');
    }

    const sql = `
      SELECT 
        column_name, 
        data_type, 
        is_nullable, 
        column_default
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = $1
    `;
    
    const columns = await this.query<any>(sql, [tableName]);

    if (columns.length === 0) {
      throw new Error(`Table ${tableName} not found`);
    }

    const columnInfos: ColumnInfo[] = columns.map(col => ({
      name: col.column_name,
      type: col.data_type,
      nullable: col.is_nullable === 'YES',
      default: col.column_default
    }));

    return {
      name: tableName,
      columns: columnInfos
    };
  }

  async getTableDDL(tableName: string): Promise<string | null> {
    // PostgreSQL 获取完整 DDL 比较复杂，需要 pg_dump 或查询 pg_catalog
    // 这里暂时返回 null，后续可以优化
    return null;
  }
}
