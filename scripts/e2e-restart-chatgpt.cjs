const assert = require("node:assert/strict");
const { execFile, spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const path = require("node:path");
const { promisify } = require("node:util");
const WebSocket = require("ws");
const { launchChatGptProcess } = require("../lib/chatgpt-process.cjs");
const {
  DEFAULT_THEME,
  REMOVE_EXPRESSION,
  buildInstallExpression,
  buildThemeCss,
} = require("../lib/theme.cjs");

const execFileAsync = promisify(execFile);
const HOST = "127.0.0.1";
const PORT = 9237;
const resultPath = path.resolve(process.argv[2] || path.join(__dirname, "..", "build", "e2e-restart-result.json"));
const scheduledTaskName = process.argv[3] || "";

function powershellArgs(script) {
  return ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script];
}

async function writeResult(result) {
  await fs.mkdir(path.dirname(resultPath), { recursive: true });
  await fs.writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
}

async function cleanupScheduledTask() {
  if (!scheduledTaskName) return;
  try {
    await execFileAsync("schtasks.exe", ["/Delete", "/TN", scheduledTaskName, "/F"], {
      windowsHide: true,
      timeout: 10000,
    });
  } catch {
    // The test result matters more than task cleanup; the caller also checks it.
  }
}

async function locateChatGpt() {
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

async function stopInstalledChatGpt(directory) {
  const script = `
    $root = $env:THEME_STUDIO_CHATGPT_DIR
    Get-CimInstance Win32_Process -Filter "Name = 'ChatGPT.exe'" -ErrorAction SilentlyContinue |
      Where-Object { $_.ExecutablePath -and $_.ExecutablePath.StartsWith($root, [StringComparison]::OrdinalIgnoreCase) } |
      ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  `;
  await execFileAsync("powershell.exe", powershellArgs(script), {
    windowsHide: true,
    timeout: 15000,
    env: { ...process.env, THEME_STUDIO_CHATGPT_DIR: directory },
  });
}

async function isInstalledChatGptRunning(directory) {
  const script = `
    $root = $env:THEME_STUDIO_CHATGPT_DIR
    $match = Get-CimInstance Win32_Process -Filter "Name = 'ChatGPT.exe'" -ErrorAction SilentlyContinue |
      Where-Object { $_.ExecutablePath -and $_.ExecutablePath.StartsWith($root, [StringComparison]::OrdinalIgnoreCase) } |
      Select-Object -First 1
    if ($match) { Write-Output 'true' } else { Write-Output 'false' }
  `;
  const { stdout } = await execFileAsync("powershell.exe", powershellArgs(script), {
    windowsHide: true,
    timeout: 10000,
    env: { ...process.env, THEME_STUDIO_CHATGPT_DIR: directory },
  });
  return stdout.trim().toLowerCase() === "true";
}

async function waitForExit(directory, timeoutMs = 20000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (!(await isInstalledChatGptRunning(directory))) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("The existing ChatGPT process tree did not exit in time.");
}

async function waitForJson(url, child, timeoutMs = 45000) {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < timeoutMs) {
    if (child.exitCode !== null) {
      throw new Error(`The replacement ChatGPT process exited early with code ${child.exitCode}.`);
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

async function waitForVisibleWindow(timeoutMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const script = `
      $needle = '--remote-debugging-port=${PORT}'
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
    });
    if (stdout.trim()) {
      const result = JSON.parse(stdout.trim());
      if (result.handle > 0 && result.title) return result;
    }
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
  throw new Error("The replacement ChatGPT process never exposed a visible window.");
}

function fallbackLaunch(executable) {
  const child = spawn(executable, [], {
    detached: true,
    stdio: "ignore",
    windowsHide: false,
    env: { ...process.env },
  });
  child.once("error", () => {});
  child.unref();
}

async function main() {
  const executable = await locateChatGpt();
  const directory = path.dirname(executable);
  await writeResult({ passed: false, stage: "starting", executable });
  // Let the task-launching command return before the desktop app is stopped.
  await new Promise((resolve) => setTimeout(resolve, 1800));

  try {
    await stopInstalledChatGpt(directory);
    await waitForExit(directory);

    const child = await launchChatGptProcess({
      executable,
      host: HOST,
      port: PORT,
      detached: false,
    });

    const [version, window] = await Promise.all([
      waitForJson(`http://${HOST}:${PORT}/json/version`, child),
      waitForVisibleWindow(),
    ]);
    assert.match(version.Browser || "", /Chrome|Chromium/i);

    const targets = await waitForJson(`http://${HOST}:${PORT}/json/list`, child);
    const target = targets.find((item) => item.type === "page" && item.webSocketDebuggerUrl);
    assert.ok(target, "No ChatGPT page target was available for theme injection");

    const css = buildThemeCss({ ...DEFAULT_THEME, enabled: true });
    const install = await sendCdp(target.webSocketDebuggerUrl, "Runtime.evaluate", {
      expression: buildInstallExpression(css),
      returnByValue: true,
    });
    assert.equal(install.result.value, true, "Theme expression did not run successfully");

    const verify = await sendCdp(target.webSocketDebuggerUrl, "Runtime.evaluate", {
      expression: `Boolean(document.getElementById("chatgpt-theme-studio-style") && document.documentElement.dataset.themeStudio === "active")`,
      returnByValue: true,
    });
    assert.equal(verify.result.value, true, "Theme style was not present after injection");

    const screenshot = await sendCdp(target.webSocketDebuggerUrl, "Page.captureScreenshot", { format: "png" });
    assert.ok(screenshot.data?.length > 1000, "The relaunched ChatGPT window did not render a usable screenshot");

    const remove = await sendCdp(target.webSocketDebuggerUrl, "Runtime.evaluate", {
      expression: REMOVE_EXPRESSION,
      returnByValue: true,
    });
    assert.equal(remove.result.value, true, "Theme removal expression did not run successfully");

    await writeResult({
      passed: true,
      stage: "complete",
      executable,
      browser: version.Browser,
      debugHost: HOST,
      debugPort: PORT,
      window,
      targets: targets.length,
      injection: "installed, verified, and removed",
      screenshotBytes: Buffer.from(screenshot.data, "base64").length,
      completedAt: new Date().toISOString(),
    });
    await cleanupScheduledTask();
  } catch (error) {
    await writeResult({
      passed: false,
      stage: "failed",
      executable,
      error: error.stack || error.message,
      completedAt: new Date().toISOString(),
    });
    if (!(await isInstalledChatGptRunning(directory))) fallbackLaunch(executable);
    await cleanupScheduledTask();
    process.exitCode = 1;
  }
}

main().catch(async (error) => {
  await writeResult({
    passed: false,
    stage: "fatal",
    error: error.stack || error.message,
    completedAt: new Date().toISOString(),
  }).catch(() => {});
  await cleanupScheduledTask();
  process.exitCode = 1;
});
