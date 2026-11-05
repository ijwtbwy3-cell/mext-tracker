/** Декларации типов для sql.js (пакет не поставляет собственные .d.ts). */

declare module "sql.js" {
  export type BindParams = unknown[] | Record<string, unknown>;

  export interface Statement {
    bind(params?: BindParams): boolean;
    step(): boolean;
    getAsObject(): Record<string, unknown>;
    free(): boolean;
  }

  export class Database {
    constructor(data?: ArrayLike<number> | null);
    run(sql: string, params?: BindParams): Database;
    prepare(sql: string): Statement;
    exec(sql: string): { columns: string[]; values: unknown[][] }[];
    export(): Uint8Array;
    close(): void;
  }

  export interface SqlJsStatic {
    Database: typeof Database;
  }

  export default function initSqlJs(config?: {
    locateFile?: (file: string) => string;
  }): Promise<SqlJsStatic>;
}
