"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const {test} = require("node:test");

test("exercise context follows the engine's current seed without changing state", () => {
  const callbacks = {};
  const link = {addEventListener(name, callback) { callbacks[name] = callback; }};
  const location = {href: "https://netstudy.local/laboratorio/?exercise=services&seed=1&mode=operational"};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "journey-navigation.js"), "utf8"), {
    document: {querySelector: () => null, querySelectorAll: () => [link]}, window: {location},
  });
  assert.equal(link.href, location.href);
  location.href = location.href.replace("seed=1", "seed=42");
  callbacks.click();
  assert.equal(link.href, location.href);
});

test("the active lesson scrolls into view inside the mobile sidebar list", () => {
  const active = {offsetHeight: 30, getBoundingClientRect: () => ({top: 480})};
  const sidebar = {
    clientHeight: 240,
    scrollHeight: 650,
    scrollTop: 0,
    getBoundingClientRect: () => ({top: 100}),
    querySelector: () => active,
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "journey-navigation.js"), "utf8"), {
    document: {querySelector: () => sidebar, querySelectorAll: () => []},
  });
  assert.equal(sidebar.scrollTop, 300);
});
