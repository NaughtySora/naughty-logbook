# Description

- File system logger with rotation.
- Reading/deleting logs.
- Closing logger channel.

## Types

`type Channels = Array<"log" | "error" | "info" | "warn">`\
`type Channel = Channels[number]`

`interface QueryOptions {`\
  `from?: number;`\
  `to?: number;`\
`}`

`interface LogBookOptions {`\
  `dir: string;`\
  `rotation?: number;`\
`}`

`class LogBook {`\
  `constructor(options: LogBookOptions);`\
  `cursor(name: Channel, query?: QueryOptions): AsyncGenerator<Buffer<ArrayBufferLike> & string>;`\
  `delete(name: Channel, query?: QueryOptions): Promise<void>;`\
  `log(...logs: any[]): void;`\
  `error(...logs: any[]): void;`\
  `info(...logs: any[]): void;`\
  `warn(...logs: any[]): void;`\
  `close(): void;`\
  `closed: boolean;`\
`}`

## Example

```js
  const DAY = 24 * 60 * 60 * 1000;
  const dir = path.resolve("/", "logs");
  const logger = await new LogBook({ dir, rotation: DAY });

  logger.error(new Error("Error message"));
  logger.log("Something happen");

  const cursor = logger.cursor("error", { to: Date.now() });
  for await (const error of cursor){
    // do smth with log content
  }

  // deletes all logs but not currently open stream
  await logger.delete("error");

  // logger will no longer works
  logger.close(); // stop logging process, remove rotation timers, stream/fd closed
```
