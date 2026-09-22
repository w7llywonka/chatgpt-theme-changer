const { app, BrowserWindow, dialog, ipcMain, nativeImage, shell } = require("electron");
const { execFile } = require("node:child_process");
const fs = require("node:fs/promises");
const path = require("node:path");
const { promisify } = require("node:util");
const WebSocket = require("ws");
const {
  DEFAULT_THEME,
  REMOVE_EXPRESSION,
  buildInstallExpression,
  buildThemeCss,
  normalizeTheme,
} = require("./lib/theme.cjs");
const { launchChatGptProcess } = require("./lib/chatgpt-process.cjs");

const execFileAsync = promisify(execFile);
const DEBUG_PORT = 9237;
const DEBUG_HOST = "127.0.0.1";
const DEBUG_BASE = `http://${DEBUG_HOST}:${DEBUG_PORT}`;

let mainWindow = null;
let currentTheme = { ...DEFAULT_THEME };
let monitorTimer = null;
let chatGptInstall = null;
let applying = false;
const appliedTargets = new Map();

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) app.quit();

app.on("second-instance", () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
});

function statePath() {
  return path.join(app.getPath("userData"), "theme.json");
}

async function loadState() {
  try {
    currentTheme = normalizeTheme(JSON.parse(await fs.readFile(statePath(), "utf8")));
  } catch {
    currentTheme = { ...DEFAULT_THEME };
  }
  return currentTheme;
}

async function saveState(next) {
  currentTheme = normalizeTheme({ ...currentTheme, ...next });
  await fs.mkdir(path.dirname(statePath()), { recursive: true });
  await fs.writeFile(statePath(), `${JSON.stringify(currentTheme, null, 2)}\n`, "utf8");
  return currentTheme;
}

function powershellArgs(script) {
  return ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script];
}

async function locateChatGpt() {
  if (chatGptInstall) return chatGptInstall;

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

  try {
    const { stdout } = await execFileAsync(
      "powershell.exe",
      powershellArgs(script),
      { windowsHide: true, timeout: 15000 },
    );
    const executable = stdout.trim().split(/\r?\n/).filter(Boolean).at(-1);
    if (executable) {
      chatGptInstall = {
        executable,
        directory: path.dirname(executable),
      };
      return chatGptInstall;
    }
  } catch {
    // The friendly error is returned below.
  }

  return null;
}

async function isChatGptRunning(install) {
  if (!install) return false;
  const script = `
    $root = $env:THEME_STUDIO_CHATGPT_DIR
    $match = Get-CimInstance Win32_Process -Filter "Name = 'ChatGPT.exe'" -ErrorAction SilentlyContinue |
      Where-Object { $_.ExecutablePath -and $_.ExecutablePath.StartsWith($root, [StringComparison]::OrdinalIgnoreCase) } |
      Select-Object -First 1
    if ($match) { Write-Output 'true' } else { Write-Output 'false' }
  `;
  try {
    const { stdout } = await execFileAsync(
      "powershell.exe",
      powershellArgs(script),
      {
        windowsHide: true,
        timeout: 10000,
        env: { ...process.env, THEME_STUDIO_CHATGPT_DIR: install.directory },
      },
    );
    return stdout.trim().toLowerCase() === "true";
  } catch {
    return false;
  }
}

async function debugEndpointReady() {
  try {
    const response = await fetch(`${DEBUG_BASE}/json/version`, { signal: AbortSignal.timeout(900) });
    return response.ok;
  } catch {
    return false;
  }
}

async function getTargets() {
  const response = await fetch(`${DEBUG_BASE}/json/list`, { signal: AbortSignal.timeout(1400) });
  if (!response.ok) throw new Error(`Theme connection returned ${response.status}.`);
  const targets = await response.json();
  return targets.filter((target) => {
    if (target.type !== "page" || !target.webSocketDebuggerUrl) return false;
    if (target.url.startsWith("devtools://")) return false;
    return target.url.startsWith("app://") || /chatgpt/i.test(target.title || "");
  });
}

function sendCdp(webSocketUrl, method, params = {}) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(webSocketUrl);
    const id = 1;
    const timer = setTimeout(() => {
      socket.terminate();
      reject(new Error("Theme connection timed out."));
    }, 3500);

    socket.once("open", () => {
      socket.send(JSON.stringify({ id, method, params }));
    });
    socket.on("message", (payload) => {
      let message;
      try {
        message = JSON.parse(payload.toString());
      } catch {
        return;
      }
      if (message.id !== id) return;
      clearTimeout(timer);
      socket.close();
      if (message.error) reject(new Error(message.error.message || "Theme command failed."));
      else resolve(message.result);
    });
    socket.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

async function applyThemeToTargets({ force = false } = {}) {
  if (applying || !(await debugEndpointReady())) return { connected: false, applied: 0 };
  applying = true;
  try {
    const css = buildThemeCss(currentTheme);
    const expression = buildInstallExpression(css);
    const fingerprint = JSON.stringify(currentTheme);
    const targets = await getTargets();
    let applied = 0;

    for (const target of targets) {
      if (!force && appliedTargets.get(target.id) === fingerprint) continue;
      try {
        await sendCdp(target.webSocketDebuggerUrl, "Runtime.evaluate", {
          expression,
          returnByValue: true,
        });
        await sendCdp(target.webSocketDebuggerUrl, "Page.addScriptToEvaluateOnNewDocument", {
          source: expression,
        });
        appliedTargets.set(target.id, fingerprint);
        applied += 1;
      } catch {
        appliedTargets.delete(target.id);
      }
    }

    for (const targetId of appliedTargets.keys()) {
      if (!targets.some((target) => target.id === targetId)) appliedTargets.delete(targetId);
    }

    return { connected: true, applied, targets: targets.length };
  } finally {
    applying = false;
  }
}

async function removeThemeFromTargets() {
  if (!(await debugEndpointReady())) return { connected: false, removed: 0 };
  const targets = await getTargets();
  let removed = 0;
  for (const target of targets) {
    try {
      await sendCdp(target.webSocketDebuggerUrl, "Runtime.evaluate", {
        expression: REMOVE_EXPRESSION,
        returnByValue: true,
      });
      removed += 1;
    } catch {
      // A closing secondary window should not fail the reset.
    }
  }
  appliedTargets.clear();
  return { connected: true, removed };
}

function startMonitor() {
  clearInterval(monitorTimer);
  monitorTimer = setInterval(async () => {
    if (!currentTheme.enabled) return;
    try {
      await applyThemeToTargets();
    } catch {
      // Connection status is surfaced by the renderer's polling.
    }
  }, 1800);
  monitorTimer.unref?.();
}

async function stopChatGpt(install) {
  const script = `
    $root = $env:THEME_STUDIO_CHATGPT_DIR
    Get-CimInstance Win32_Process -Filter "Name = 'ChatGPT.exe'" -ErrorAction SilentlyContinue |
      Where-Object { $_.ExecutablePath -and $_.ExecutablePath.StartsWith($root, [StringComparison]::OrdinalIgnoreCase) } |
      ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  `;
  await execFileAsync(
    "powershell.exe",
    powershellArgs(script),
    {
      windowsHide: true,
      timeout: 15000,
      env: { ...process.env, THEME_STUDIO_CHATGPT_DIR: install.directory },
    },
  );
}

async function waitForChatGptExit(install, timeoutMs = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (!(await isChatGptRunning(install))) return true;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

async function launchChatGpt(install) {
  // Production builds ignore CODEX_ELECTRON_CHROMIUM_SWITCHES, so the local
  // debugging switches must be passed directly to the Chromium process.
  return launchChatGptProcess({
    executable: install.executable,
    host: DEBUG_HOST,
    port: DEBUG_PORT,
  });
}

async function waitForConnection(timeoutMs = 24000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await debugEndpointReady()) return true;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

async function activateTheme() {
  const install = await locateChatGpt();
  if (!install) {
    throw new Error("I couldn’t find the ChatGPT desktop app. Install or update it, then try again.");
  }

  currentTheme = normalizeTheme({ ...currentTheme, enabled: true });
  buildThemeCss(currentTheme);
  await saveState(currentTheme);

  if (await debugEndpointReady()) {
    const result = await applyThemeToTargets({ force: true });
    return { ...result, restarted: false };
  }

  const running = await isChatGptRunning(install);
  if (running) {
    const result = await dialog.showMessageBox(mainWindow, {
      type: "warning",
      title: "Restart ChatGPT?",
      message: "ChatGPT needs one restart to turn on custom backgrounds.",
      detail: "Any response currently generating will stop. Your chats and account data are not changed.",
      buttons: ["Cancel", "Restart & apply"],
      defaultId: 1,
      cancelId: 0,
      noLink: true,
    });
    if (result.response !== 1) return { cancelled: true };
    await stopChatGpt(install);
    if (!(await waitForChatGptExit(install))) {
      throw new Error("ChatGPT did not close completely. Close it from the system tray, then try again.");
    }
  }

  try {
    await launchChatGpt(install);
  } catch (error) {
    throw new Error(`ChatGPT closed, but Windows could not reopen it: ${error.message}`);
  }
  if (!(await waitForConnection())) {
    const reopened = await isChatGptRunning(install);
    throw new Error(reopened
      ? "ChatGPT reopened, but Theme Studio couldn’t connect. Close ChatGPT completely and try once more."
      : "ChatGPT closed, but the relaunch exited unexpectedly. Open ChatGPT normally, then try again.");
  }

  const result = await applyThemeToTargets({ force: true });
  return { ...result, restarted: running };
}

async function statusSnapshot() {
  const install = await locateChatGpt();
  const connected = await debugEndpointReady();
  const running = connected || await isChatGptRunning(install);
  return {
    connected,
    running,
    installed: Boolean(install),
    enabled: currentTheme.enabled,
    port: DEBUG_PORT,
  };
}

function createWindow() {
  const iconPath = path.join(__dirname, "renderer", "icon.svg");
  const icon = nativeImage.createFromPath(iconPath);
  const screenshotTarget = process.env.THEME_STUDIO_SCREENSHOT_PATH?.trim();
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 790,
    minWidth: 980,
    minHeight: 680,
    backgroundColor: "#0b0c0d",
    title: "ChatGPT Theme Studio",
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "#0b0c0d",
      symbolColor: "#f2f3eb",
      height: 44,
    },
    show: false,
    icon: icon.isEmpty() ? undefined : icon,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  let revealTimer = null;
  const revealWindow = () => {
    if (screenshotTarget || !mainWindow || mainWindow.isDestroyed()) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  };

  // Register before navigation: packaged builds can load fast enough to emit
  // ready-to-show before a listener added after loadFile is attached.
  mainWindow.once("ready-to-show", revealWindow);
  mainWindow.webContents.once("did-finish-load", revealWindow);
  revealTimer = setTimeout(revealWindow, 1800);
  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));

  if (screenshotTarget) {
    mainWindow.webContents.once("did-finish-load", () => {
      setTimeout(async () => {
        try {
          await mainWindow.webContents.executeJavaScript("document.getAnimations().forEach((animation) => animation.finish())");
          await new Promise((resolve) => setTimeout(resolve, 80));
          const image = await mainWindow.capturePage();
          await fs.writeFile(screenshotTarget, image.toPNG());
          const visualState = await mainWindow.webContents.executeJavaScript(`
            ({
              samples: [[800, 300], [600, 160]].map(([x, y]) => {
                const element = document.elementFromPoint(x, y);
                return { x, y, tag: element?.tagName, className: element?.className };
              }),
              elements: ["h1", ".brand span", ".mock-window", ".mock-chat", ".assistant-message"].map((selector) => {
              const element = document.querySelector(selector);
              if (!element) return { selector, missing: true };
              const style = getComputedStyle(element);
              const rect = element.getBoundingClientRect();
              return {
                selector,
                display: style.display,
                opacity: style.opacity,
                visibility: style.visibility,
                color: style.color,
                background: style.backgroundColor,
                zIndex: style.zIndex,
                rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
              };
              })
            })
          `);
          await fs.writeFile(`${screenshotTarget}.json`, JSON.stringify(visualState, null, 2));
        } finally {
          app.quit();
        }
      }, 1600);
    });
  }
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.on("closed", () => {
    clearTimeout(revealTimer);
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  await loadState();
  createWindow();
  startMonitor();
  if (currentTheme.enabled) applyThemeToTargets({ force: true }).catch(() => {});

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  clearInterval(monitorTimer);
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle("theme:get-state", async () => ({ theme: currentTheme }));

ipcMain.handle("theme:get-status", () => statusSnapshot());

ipcMain.handle("theme:save", async (_event, next) => ({
  theme: await saveState(next),
}));

ipcMain.handle("theme:activate", async (_event, next) => {
  await saveState({ ...next, enabled: true });
  return activateTheme();
});

ipcMain.handle("theme:disable", async () => {
  const result = await removeThemeFromTargets();
  await saveState({ enabled: false });
  return result;
});

ipcMain.handle("theme:choose-image", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Choose a background image",
    properties: ["openFile"],
    filters: [
      { name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif"] },
    ],
  });
  if (result.canceled || !result.filePaths[0]) return null;

  const filePath = result.filePaths[0];
  const stat = await fs.stat(filePath);
  if (stat.size > 18 * 1024 * 1024) {
    throw new Error("Choose an image under 18 MB so the saved theme stays quick to load.");
  }
  const extension = path.extname(filePath).slice(1).toLowerCase().replace("jpg", "jpeg");
  const data = await fs.readFile(filePath);
  return {
    dataUrl: `data:image/${extension};base64,${data.toString("base64")}`,
    name: path.basename(filePath),
  };
});
