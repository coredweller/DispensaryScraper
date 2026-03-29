import { createWriteStream, mkdirSync } from 'fs';
import type { WriteStream } from 'fs';

const date = new Date().toISOString().slice(0, 10);
const logDir = 'logs';

mkdirSync(logDir, { recursive: true });

const logStream: WriteStream = createWriteStream(`${logDir}/${date}.log`, { flags: 'a' });

export function log(msg: string): void {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  process.stdout.write(line);
  logStream.write(line);
}

export function closeLog(): void {
  logStream.end();
}
