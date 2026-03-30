type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel: LogLevel =
  (process.env.LOG_LEVEL as LogLevel) || "info";

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

function formatEntry(level: LogLevel, context: string, message: string, meta?: Record<string, unknown>) {
  const entry: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    ctx: context,
    msg: message,
  };
  if (meta && Object.keys(meta).length > 0) {
    Object.assign(entry, meta);
  }
  return JSON.stringify(entry);
}

function createContextLogger(context: string) {
  return {
    debug(message: string, meta?: Record<string, unknown>) {
      if (shouldLog("debug")) process.stdout.write(formatEntry("debug", context, message, meta) + "\n");
    },
    info(message: string, meta?: Record<string, unknown>) {
      if (shouldLog("info")) process.stdout.write(formatEntry("info", context, message, meta) + "\n");
    },
    warn(message: string, meta?: Record<string, unknown>) {
      if (shouldLog("warn")) process.stderr.write(formatEntry("warn", context, message, meta) + "\n");
    },
    error(message: string, meta?: Record<string, unknown>) {
      if (shouldLog("error")) process.stderr.write(formatEntry("error", context, message, meta) + "\n");
    },
  };
}

export const log = {
  server: createContextLogger("server"),
  socket: createContextLogger("socket"),
  store: createContextLogger("store"),
  security: createContextLogger("security"),
  metrics: createContextLogger("metrics"),
  forContext: createContextLogger,
};
