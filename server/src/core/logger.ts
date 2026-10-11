type Level = "debug" | "info" | "warn" | "error";
const order: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export interface Logger {
  debug(msg: string, extra?: object): void;
  info(msg: string, extra?: object): void;
  warn(msg: string, extra?: object): void;
  error(msg: string, extra?: object): void;
}

export function createLogger(
  level: Level = "info",
  write = (line: string) => console.log(line),
): Logger {
  const emit =
    (l: Level) =>
    (msg: string, extra: object = {}) => {
      if (order[l] < order[level]) return;
      write(JSON.stringify({ tid: new Date().toISOString(), nivå: l, melding: msg, ...extra }));
    };
  return { debug: emit("debug"), info: emit("info"), warn: emit("warn"), error: emit("error") };
}
