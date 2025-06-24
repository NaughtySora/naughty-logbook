"use strict";

const last_comma = /,$/;

const formatPrimitive = (value) => {
  if (typeof value === "bigint") return `${value}n`;
  if (typeof value === "symbol") return value.toString();
  if (typeof value === "undefined") return "undefined";
  return value;
};

const isPrimitive = (value) => typeof value !== "object" && typeof value !== "function";

const formatter = (value) => isPrimitive(value) ? formatPrimitive(value) : formatLinkType(value);

const formatArray = (array) => {
  let result = "[";
  for (const value of array) {
    const serialized = formatter(value);
    result += `${serialized}, `;
  }
  result = result.trim().replace(last_comma, "");
  return result += "]";
};

const formatObject = (value) => {
  let result = "{";
  for (const entries of Object.entries(value)) {
    const serialized = formatter(entries[1]);
    result += `${entries[0]}: ${serialized}, `;
  }
  result = result.trim().replace(last_comma, "");
  result += "}";
  return result;
};

const formatEntries = (array) => {
  let result = "[";
  for (const value of array) {
    const key = formatter(value[0]);
    const serialized = formatter(value[1]);
    result += `[${key}, ${serialized}], `;
  }
  result = result.replace(last_comma, "").trim();
  return result += "]";
};

const formatLinkType = (value) => {
  if (typeof value === "function") return "function";
  if (value === null) return "null";
  if ("toJSON" in value) return JSON.stringify(value);
  if (Array.isArray(value)) return formatArray(value);
  if (value instanceof Error) return value?.stack ?? "Error, no stack";
  if (Object.getPrototypeOf(value).constructor === Object) {
    return formatObject(value);
  }
  if ("entries" in value && Symbol.iterator in value) {
    return formatEntries(value.entries());
  }
  return "{}";
};

module.exports = formatter;