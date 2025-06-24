"use strict";

const path = require("node:path");
const LogBook = require("../lib/index.js");

const ROOT = "logs";

const log = async () => {
  const dir = path.resolve(ROOT, "logs");
  const logger = await new LogBook({ dir });
  const logs = [
    "string",
    10,
    125.123,
    Infinity,
    NaN,
    -1,
    true,
    false,
    { test: [1, 2,], test2: ["test", 22, true, { test: 1, bool: true, big: 1n }] },
    new Map([[() => { }, 2], [{ a: "a" }, { value: 33 }]]),
    new Set([[1, 2], [0, [123]]]),
    new Error("test"),
    123n,
    async () => { },
    new WeakMap(),
    {},
    [],
    Symbol("Symbol value1"),
    new Proxy({}, {}),
    new Date(),
  ];

  for (const log of logs) {
    logger.log(log);
    logger.error(log);
    logger.warn(log);
    logger.info(log);
  }
};

const rotation = async () => {
  const dir = path.resolve(ROOT, "logs");
  const logger = await new LogBook({ dir, rotation: 5000 });
  const logs = [new Date(),];

  const timer = setTimeout(() => {
    for (const log of logs) {
      logger.log(log);
      logger.error(log);
      logger.warn(log);
      logger.info(log);
    }
    timer.refresh();
  }, 2000);
};

const cursor = async () => {
  const dir = path.resolve(ROOT, "logs");
  const logger = await new LogBook({ dir, rotation: 5000 });
  logger.error("test");
  const logger2 = await new LogBook({ dir });
  const t1 = setTimeout(() => {
    logger.error("test");
    t1.refresh();
  }, 1000);
  const t2 = setTimeout(async () => {
    for await (const e of logger2.cursor("error")) {
      console.log(e);
    }
    t2.refresh();
  }, 2000);
};

const del = async () => {
  const dir = path.resolve(ROOT, "logs");
  const logger = await new LogBook({ dir, rotation: 5000 });
  const logger2 = await new LogBook({ dir });
  const t1 = setTimeout(() => {
    const date = new Date();
    logger.error(date);
    logger.log(date);
    logger.info(date);
    logger.warn(date);
    if (!logger2.closed) t1.refresh();
  }, 1000);
  const d = setTimeout(async () => {
    await Promise.all([
      logger2.delete("error"),
      logger2.delete("log"),
      logger2.delete("info"),
      logger2.delete("warn"),
    ]);
    d.refresh();
  }, 10000);
};

const close = async () => {
  const dir = path.resolve(ROOT, "rotation");
  const logger = await new LogBook({ dir, rotation: 5000 });
  logger.error("test");
  const logger2 = await new LogBook({ dir });

  const t1 = setTimeout(() => {
    logger.error("test");
    if (!logger2.closed) t1.refresh();
  }, 1000);

  setTimeout(() => {
    logger2.close();
  }, 5000);

  const t2 = setTimeout(async () => {
    const cursor = logger2.cursor("error");
    if (!cursor) return void clearTimeout(t2)
    for await (const e of cursor) {
      console.log(e);
    }
    if (!logger2.closed) t2.refresh();
  }, 2000);
};

const range = async () => {
  const dir = path.resolve(ROOT, "rotation");
  const logger = await new LogBook({ dir, rotation: 5000 });

  const errors = logger.cursor("error", { from: 1720765270800, to: 1730765270800 });
  for await (const log of errors) {
    console.log({ log });
  }

  const errors2 = logger.cursor("error", { from: 1720765270800, });
  for await (const log2 of errors2) {
    console.log({ log2 });
  }

  const errors3 = logger.cursor("error", { from: 1720765270800, });
  for await (const log3 of errors3) {
    console.log({ log3 });
  }
};

const tests = [
  // log,
  // rotation,
  // cursor,
  // del,
  close,
  // range
];

module.exports = () => {
  (async () => {
    for (const test of tests) await test();
  })();
};
