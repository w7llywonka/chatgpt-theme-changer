const { spawn } = require("node:child_process");

function buildDebugArgs({ host, port }) {
  return [
    `--remote-debugging-address=${host}`,
    `--remote-debugging-port=${port}`,
  ];
}

function launchChatGptProcess({
  executable,
  host,
  port,
  env = process.env,
  detached = true,
  spawnImpl = spawn,
}) {
  return new Promise((resolve, reject) => {
    const child = spawnImpl(executable, buildDebugArgs({ host, port }), {
      detached,
      stdio: "ignore",
      // Hiding a GUI child can leave ChatGPT running without a visible window.
      windowsHide: false,
      env: { ...env },
    });

    const onError = (error) => reject(error);
    child.once("error", onError);
    child.once("spawn", () => {
      child.off("error", onError);
      if (detached) child.unref();
      resolve(child);
    });
  });
}

module.exports = {
  buildDebugArgs,
  launchChatGptProcess,
};
