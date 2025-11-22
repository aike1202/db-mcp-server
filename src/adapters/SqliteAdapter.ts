import sqlite3 from 'sqlite3';
import { IDatabaseAdapter, TableInfo, ColumnInfo } from '../interfaces/IDatabaseAdapter.js';

export class SqliteAdapter implements IDatabaseAdapter {
  private db: sqlite3.Database | null = null;
  private dbPath: string;

  constructor(url: string) {
    // 处理协议前缀，提取文件路径
    if (url.startsWith('file://')) {
      this.dbPath = url.slice(7);
    } else if (url.startsWith('sqlite://')) {
      this.dbPath = url.slice(9);
    } else {
      this.dbPath = url;
    }
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('Failed to connect to SQLite database:', err);
          reject(err);
        } else {
          console.error('Successfully connected to SQLite database at', this.dbPath);
          resolve();
        }
      });
    });
  }

  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) reject(err);
          else {
            this.db = null;
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }

  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    if (!this.db) throw new Error('Database not connected');

    return new Promise((resolve, reject) => {
      this.db!.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows as T[]);
      });
    });
  }

  async execute(sql: string, params: any[] = []): Promise<any> {
    if (!this.db) throw new Error('Database not connected');

    return new Promise((resolve, reject) => {
      this.db!.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }

  async listTables(): Promise<string[]> {
    const sql = `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`;
    const rows = await this.query<{ name: string }>(sql);
    return rows.map(row => row.name);
  }

  async describeTable(tableName: string): Promise<TableInfo> {
    // 简单验证表名
    if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
      throw new Error('Invalid table name');
    }

    const sql = `PRAGMA table_info(${tableName})`;
    const columns = await this.query<any>(sql);

    if (columns.length === 0) {
      throw new Error(`Table ${tableName} not found`);
    }

    const columnInfos: ColumnInfo[] = columns.map((col: any) => ({
      name: col.name,
      type: col.type,
      nullable: col.notnull === 0,
      default: col.dflt_value,
      key: col.pk ? 'PRI' : undefined
    }));

    return {
      name: tableName,
      columns: columnInfos
    };
  }

  async getTableDDL(tableName: string): Promise<string | null> {
    const sql = `SELECT sql FROM sqlite_master WHERE type='table' AND name = ?`;
    try {
      const rows = await this.query<{ sql: string }>(sql, [tableName]);
      if (rows.length > 0) {
        return rows[0].sql;
      }
      return null;
    } catch (error) {
      return null;
    }
  }
}
