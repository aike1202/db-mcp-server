import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function getLogFilePath(): string {
  if (process.env.MCP_LOG_PATH) {
    return path.resolve(process.env.MCP_LOG_PATH);
  }
  return path.join(__dirname, '../../logs/mcp-audit.jsonl');
}

const LOG_FILE = getLogFilePath();
const LOG_DIR = path.dirname(LOG_FILE);

// 确保日志目录存在
if (!fs.existsSync(LOG_DIR)) {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  } catch (e) {
    console.error('Failed to create log directory:', e);
  }
}

export interface LogEntry {
  timestamp: string;
  tool: string;
  query?: string;
  params?: any[];
  duration_ms: number;
  success: boolean;
  result_summary?: string;
  error?: string;
}

export class Logger {
  static log(entry: Omit<LogEntry, 'timestamp'>) {
    const fullEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      ...entry
    };

    const line = JSON.stringify(fullEntry) + '\n';

    try {
      fs.appendFileSync(LOG_FILE, line, 'utf8');
    } catch (e) {
      console.error('Failed to write to log file:', e);
    }
  }
}
