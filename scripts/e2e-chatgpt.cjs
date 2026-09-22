const assert = require("node:assert/strict");
const { execFile } = require("node:child_process");
const fs = require("node:fs/promises");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { promisify } = require("node:util");
const WebSocket = require("ws");
const { launchChatGptProcess } = require("../lib/chatgpt-process.cjs");

const execFileAsync = promisify(execFile);
const HOST = "127.0.0.1";

function powershellArgs(script) {
  return ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script];
}

async function locateChatGpt() {
  if (process.env.THEME_STUDIO_E2E_CHATGPT_EXE) {
    return path.resolve(process.env.THEME_STUDIO_E2E_CHATGPT_EXE);
  }
  const script = `
    $packages = @('OpenAI.Codex', 'OpenAI.ChatGPT-Desktop')
    foreach ($name in $packages) {
      $package = Get-AppxPackage -Name $name -ErrorAction SilentlyContinue |
        Sort-Object Version -Descending |
        Select-Object -First 1
      if ($package) {
        $candidate = Join-Path $package.InstallLocation 'app\\ChatGPT.exe'
        if (-not (Test-Path -LiteralPath $candidate)) {
          $candidate = Join-Path $package.InstallLocation 'ChatGPT.exe'
        }
        if (Test-Path -LiteralPath $candidate) {
          Write-Output $candidate
          break
        }
      }
    }
  `;
  const { stdout } = await execFileAsync("powershell.exe", powershellArgs(script), {
    windowsHide: true,
    timeout: 15000,
  });
  const executable = stdout.trim().split(/\r?\n/).filter(Boolean).at(-1);
  assert.ok(executable, "ChatGPT desktop app was not found");
  return executable;
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, HOST, () => {
      const { port } = server.address();
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

async function waitForJson(url, child, timeoutMs = 45000) {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < timeoutMs) {
    if (child.exitCode !== null) {
      throw new Error(`ChatGPT exited before its local debugging endpoint opened (code ${child.exitCode}).`);
    }
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1200) });
      if (response.ok) return response.json();
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error(`Timed out waiting for ${url}: ${lastError?.message || "no response"}`);
}

function sendCdp(webSocketUrl, method, params = {}) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(webSocketUrl);
    const id = 1;
    const timer = setTimeout(() => {
      socket.terminate();
      reject(new Error(`${method} timed out`));
    }, 5000);
    socket.once("open", () => socket.send(JSON.stringify({ id, method, params })));
    socket.on("message", (payload) => {
      const message = JSON.parse(payload.toString());
      if (message.id !== id) return;
      clearTimeout(timer);
      socket.close();
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
    });
    socket.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

async function findVisibleWindow(port, timeoutMs = 30000) {
  const started = Date.now();
  const portArgument = `--remote-debugging-port=${port}`;
  while (Date.now() - started < timeoutMs) {
    const script = `
      $needle = $env:THEME_STUDIO_E2E_PORT_ARG
      $match = Get-CimInstance Win32_Process -Filter "Name = 'ChatGPT.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -and $_.CommandLine.Contains($needle) -and -not $_.CommandLine.Contains('--type=') } |
        Select-Object -First 1
      if ($match) {
        $process = Get-Process -Id $match.ProcessId -ErrorAction SilentlyContinue
        if ($process) {
          [PSCustomObject]@{
            id = $process.Id
            handle = [Int64]$process.MainWindowHandle
            title = $process.MainWindowTitle
          } | ConvertTo-Json -Compress
        }
      }
    `;
    const { stdout } = await execFileAsync("powershell.exe", powershellArgs(script), {
      windowsHide: true,
      timeout: 8000,
      env: { ...process.env, THEME_STUDIO_E2E_PORT_ARG: portArgument },
    });
    if (stdout.trim()) {
      const result = JSON.parse(stdout.trim());
      if (result.handle > 0 && result.title) return result;
    }
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
  throw new Error("ChatGPT started but never exposed a visible, titled window.");
}

async function stopTestProcess(child) {
  if (!child?.pid || child.exitCode !== null) return;
  try {
    await execFileAsync("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], {
      windowsHide: true,
      timeout: 15000,
    });
  } catch {
    // The test process may already have exited during cleanup.
  }
}

async function removeTestProfile(profilePath) {
  const resolved = path.resolve(profilePath);
  const tempRoot = `${path.resolve(os.tmpdir())}${path.sep}`;
  if (!resolved.startsWith(tempRoot) || !path.basename(resolved).startsWith("chatgpt-theme-studio-e2e-")) {
    throw new Error(`Refusing to remove unexpected test profile: ${resolved}`);
  }
  await fs.rm(resolved, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
}

async function main() {
  const executable = await locateChatGpt();
  const port = await getFreePort();
  const profilePath = await fs.mkdtemp(path.join(os.tmpdir(), "chatgpt-theme-studio-e2e-"));
  let child;
  try {
    child = await launchChatGptProcess({
      executable,
      host: HOST,
      port,
      detached: false,
      env: {
        ...process.env,
        CODEX_ELECTRON_USER_DATA_PATH: profilePath,
      },
    });

    const [version, window] = await Promise.all([
      waitForJson(`http://${HOST}:${port}/json/version`, child),
      findVisibleWindow(port),
    ]);
    assert.match(version.Browser || "", /Chrome|Chromium/i);

    const targets = await waitForJson(`http://${HOST}:${port}/json/list`, child);
    const target = targets.find((item) => item.type === "page" && item.webSocketDebuggerUrl);
    assert.ok(target, "No ChatGPT page target was available for theme injection");

    const markerId = "chatgpt-theme-studio-e2e-marker";
    const installResult = await sendCdp(target.webSocketDebuggerUrl, "Runtime.evaluate", {
      expression: `(() => {
        const style = document.createElement("style");
        style.id = ${JSON.stringify(markerId)};
        style.textContent = ":root { --chatgpt-theme-studio-e2e: 1; }";
        document.head.appendChild(style);
        return Boolean(document.getElementById(${JSON.stringify(markerId)}));
      })()`,
      returnByValue: true,
    });
    assert.equal(installResult.result.value, true, "Theme marker was not installed");

    const screenshot = await sendCdp(target.webSocketDebuggerUrl, "Page.captureScreenshot", {
      format: "png",
    });
    assert.ok(screenshot.data?.length > 1000, "ChatGPT did not render a usable page screenshot");

    const removeResult = await sendCdp(target.webSocketDebuggerUrl, "Runtime.evaluate", {
      expression: `Boolean(document.getElementById(${JSON.stringify(markerId)})?.remove() ?? true)`,
      returnByValue: true,
    });
    assert.equal(removeResult.result.value, true, "Theme marker was not removed");

    console.log(JSON.stringify({
      passed: true,
      executable,
      debugPort: port,
      windowTitle: window.title,
      targets: targets.length,
      injection: "installed and removed",
      screenshotBytes: Buffer.from(screenshot.data, "base64").length,
    }, null, 2));
  } finally {
    await stopTestProcess(child);
    await new Promise((resolve) => setTimeout(resolve, 700));
    await removeTestProfile(profilePath);
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
