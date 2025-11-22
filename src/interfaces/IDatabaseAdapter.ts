export interface TableInfo {
  name: string;
  columns?: ColumnInfo[];
}

export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  key?: string;
  default?: string;
  extra?: string;
}

export interface IDatabaseAdapter {
  /**
   * 连接数据库
   */
  connect(): Promise<void>;

  /**
   * 关闭连接
   */
  close(): Promise<void>;

  /**
   * 执行只读查询 (SELECT)
   */
  query<T = any>(sql: string, params?: any[]): Promise<T[]>;

  /**
   * 执行写操作 (INSERT, UPDATE, DELETE, etc.)
   */
  execute(sql: string, params?: any[]): Promise<any>;

  /**
   * 获取所有表名
   */
  listTables(): Promise<string[]>;

  /**
   * 获取表结构详情
   */
  describeTable(tableName: string): Promise<TableInfo>;

  /**
   * 获取表的创建语句 (DDL)
   * 可选实现，如果数据库不支持或实现困难，可返回 null
   */
  getTableDDL(tableName: string): Promise<string | null>;
}
