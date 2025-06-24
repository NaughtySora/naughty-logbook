"use strict";

const INT32 = 0x7FFFFFFF;

const setTimeoutLong = (callback, ms, ...params) => {
  let long = ms > INT32;
  let time = long ? INT32 : ms;
  let timer = setTimeout(() => {
    if (!long) {
      clearTimeout(timer);
      timer = null;
      return void callback(...params);
    }
    time = ms - time;
    long = time > INT32;
    timer.refresh();
  }, time);
  return timer;
};

module.exports = setTimeoutLong;
