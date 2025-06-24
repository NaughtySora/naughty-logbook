"use strict";

const { createWriteStream, promises: fs, mkdirSync, accessSync, } = require("node:fs");
const path = require("node:path");
const formatter = require("./formatter.js");
const setTimeoutLong = require("./setTimeoutLong.js");
const { misc } = require("naughty-util");

const file_timestamp = /^(?:.+_)(?<time>\d+)(?:\.log)$/;

const createFolderSync = (path) => {
  try {
    accessSync(path);
  } catch {
    mkdirSync(path);
  }
};

const collection = new Map();

const CHANNELS = ["log", "error", "info", "warn"];

class LogBook {
  #queues = {
    log: [], error: [],
    warn: [], info: [],
  };
  #timers = [];
  #streams = {};
  #meta = {};
  #dir;
  #rotation;
  #closed = false;

  constructor({ dir, rotation } = {}) {
    const instance = collection.get(dir);
    if (instance) return instance;
    this.#dir = dir;
    this.#rotation = rotation;
    this.#init();
    collection.set(dir, this);
    return this.#check();
  }

  async #check() {
    if (!Number.isFinite(this.#rotation)) return this;
    for (const type of CHANNELS) this.#expired(type);
    return this;
  }

  async #stat(path) {
    const rotation = this.#rotation;
    try {
      const { birthtimeMs, size } = await fs.stat(path);
      const timestamp = Math.floor(birthtimeMs);
      const now = Date.now();
      const diff = now - timestamp;
      const expired = diff > rotation;
      const delay = expired ? rotation : rotation - diff;
      return { delay, expired, size };
    } catch {
      return { delay: rotation, expired: false };
    }
  }

  async #expired(type) {
    if (this.#closed) return;
    const { path } = this.#meta[type];
    const { delay, expired, size } = await this.#stat(path);
    try {
      if (expired) {
        if (size === 0) await this.#delete(type, path);
        else await this.#rotate(type, path);
      }
      this.#schedule({ type, delay });
    } catch { }
  }

  async #schedule({ type, delay }) {
    const timers = this.#timers;
    let timer = setTimeoutLong(() => {
      const position = timers.indexOf(timer);
      timers.splice(position, 1);
      timer = null;
      clearInterval(timer);
      this.#expired(type);
    }, delay);
    timers.push(timer);
  }

  async #rotate(type, path) {
    try {
      this.#closeStream(type);
      const now = Date.now();
      const to = path.replace(/\..+$/, (ext) => `_${now}${ext}`);
      await fs.rename(path, to);
    } catch { }
  }

  async #delete(type, path) {
    try {
      this.#closeStream(type);
      await fs.unlink(path);
    } catch { }
  }

  #initLogFolders() {
    const dir = this.#dir;
    createFolderSync(dir);
    for (const type of CHANNELS) {
      createFolderSync(path.resolve(dir, type));
    }
  }

  #init() {
    this.#initLogFolders();
    for (const type of CHANNELS) {
      this.#streams[type] = null;
      this.#meta[type] = { path: this.#path(type), type, paused: false };
    }
  }

  #open(type) {
    try {
      const stream = createWriteStream(this.#path(type), { flags: "a+" });
      const prev = this.#streams[type];
      this.#streams[type] = stream;
      if (prev) {
        prev.end();
        prev.destroy();
      }
      this.#resume(type);
      return stream;
    } catch { }
  }

  #stringify(logs) {
    let result = `${new Date().toISOString()}: \n`;
    for (const log of logs) {
      try {
        result += `${formatter(log)} \n`;
      } catch (e) {

        result += "Error while parsing logs \n";
      }
    }
    return result + "\n";
  }

  #path(type) {
    return path.resolve(this.#dir, type, `${type}.log`);
  }

  #resume(type) {
    const queues = this.#queues;
    const queue = queues[type];
    while (queue.length > 0) {
      process.nextTick(() => {
        const logs = queue.shift();
        this.#write(logs);
      });
    }
    this.#meta[type].paused = false;
  }

  #write(logs, type) {
    if (this.#closed) return;
    const stream = this.#streams[type] ?? this.#open(type);
    if (!stream || !stream.writable || stream.writableCorked) {
      return void this.#queues[type].push(logs);
    }
    const paused = this.#meta[type].paused;
    try {
      const writable = stream.write(this.#stringify(logs), "utf-8");
      if (!writable && !paused) {
        this.#meta[type].paused = true;
        stream.once("drain", () => this.#resume(type));
      }
    } catch { }
  }

  #closeStream(type) {
    const stream = this.#streams[type];
    if (!stream || stream.destroyed) return;
    this.#meta.paused = true;
    this.#streams[type] = null;
  }

  async *#readDir(dir, { from, to }) {
    const source = await fs.readdir(dir);
    while (source.length > 0) {
      const name = source.shift();
      const matching = name.match(file_timestamp);
      if (!matching) continue;
      const time = parseInt(matching?.groups?.time, 10);;
      if (!Number.isFinite(time)) continue
      if (!misc.inRange(time, from, to)) continue;
      yield name;
    }
  }

  close() {
    if (this.#closed) return;
    const timers = this.#timers;
    for (const type of CHANNELS) {
      this.#closeStream(type);
    }
    timers.forEach(clearTimeout);
    timers.length = 0;
    this.#closed = true;
    collection.delete(this.#dir);
  }

  cursor(type, { from = 0, to = Infinity, encoding = "utf8" } = {}) {
    if (this.#closed) return;
    if (!CHANNELS.includes(type)) {
      throw new Error(`Incorrect channel ${type}`);
    }
    const dir = path.resolve(this.#dir, type);
    const names = this.#readDir(dir, { from, to });
    const self = this;
    async function* gen() {
      if (self.#closed) return;
      for await (const name of names) {
        yield fs.readFile(path.resolve(dir, name), { encoding });
      }
    }
    return gen();
  }

  async delete(type, { from = 0, to = Infinity } = {}) {
    if (this.#closed) return;
    const dir = path.resolve(this.#dir, type);
    const names = this.#readDir(dir, { from, to });
    for await (const name of names) {
      await fs.unlink(path.resolve(dir, name));
    }
  }

  log(...logs) {
    this.#write(logs, "log");
  }

  error(...logs) {
    this.#write(logs, "error");
  }

  info(...logs) {
    this.#write(logs, "info");
  }

  warn(...logs) {
    this.#write(logs, "warn");
  }

  get closed() {
    return this.#closed;
  }
}

module.exports = LogBook;