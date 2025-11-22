import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function getLogDir() {
  if (process.env.MCP_LOG_PATH) {
    const envPath = path.resolve(process.env.MCP_LOG_PATH);
    if (envPath.endsWith('.jsonl') || envPath.endsWith('.log')) {
      return path.dirname(envPath);
    }
    return envPath;
  }
  return path.join(__dirname, '../../logs');
}

const LOG_DIR = getLogDir();

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
  static getLogFile() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    return path.join(LOG_DIR, `mcp-audit-${dateStr}.jsonl`);
  }

  static log(entry: Omit<LogEntry, 'timestamp'>) {
    const fullEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      ...entry
    };

    const line = JSON.stringify(fullEntry) + '\n';
    const logFile = this.getLogFile();

    try {
      fs.appendFileSync(logFile, line, 'utf8');
    } catch (e) {
      console.error('Failed to write to log file:', e);
    }
  }
}
