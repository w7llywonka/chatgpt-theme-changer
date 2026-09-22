const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const test = require("node:test");
const {
  buildDebugArgs,
  launchChatGptProcess,
} = require("../lib/chatgpt-process.cjs");

test("builds loopback-only Chromium debugging arguments", () => {
  assert.deepEqual(buildDebugArgs({ host: "127.0.0.1", port: 9237 }), [
    "--remote-debugging-address=127.0.0.1",
    "--remote-debugging-port=9237",
  ]);
});

test("launches ChatGPT visibly and waits for spawn confirmation", async () => {
  const child = new EventEmitter();
  child.unref = () => { child.unrefCalled = true; };
  let call;
  const spawnImpl = (executable, args, options) => {
    call = { executable, args, options };
    queueMicrotask(() => child.emit("spawn"));
    return child;
  };

  const result = await launchChatGptProcess({
    executable: "C:\\ChatGPT.exe",
    host: "127.0.0.1",
    port: 9237,
    env: { TEST_VALUE: "yes" },
    spawnImpl,
  });

  assert.equal(result, child);
  assert.equal(call.executable, "C:\\ChatGPT.exe");
  assert.deepEqual(call.args, [
    "--remote-debugging-address=127.0.0.1",
    "--remote-debugging-port=9237",
  ]);
  assert.equal(call.options.windowsHide, false);
  assert.equal(call.options.detached, true);
  assert.equal(call.options.env.TEST_VALUE, "yes");
  assert.equal(child.unrefCalled, true);
});
