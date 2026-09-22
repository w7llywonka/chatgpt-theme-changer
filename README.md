# ChatGPT Theme Studio

A polished, accessible Windows companion that adds custom image backgrounds, glassy panels, and accent colors to the ChatGPT desktop app—without modifying ChatGPT's installed files.

> [!IMPORTANT]
> This is an unofficial runtime customization. ChatGPT does not currently expose a supported background-image setting, so a future desktop-app update may require a compatibility fix.

## Download

Download the portable `.exe` from the repository's [latest release](https://github.com/w7llywonka/chatgpt-theme-changer/releases/latest). No installer is required.

## Use it

1. Open **ChatGPT Theme Studio**.
2. Paste a direct HTTPS image link or choose a local PNG, JPG, WebP, or GIF.
3. Adjust the fit, dimming, blur, vignette, panel tint, opacity, and accent color.
4. Choose **Apply to ChatGPT**.
5. Approve the one-time ChatGPT restart. Any response currently generating will stop, but chats and account data are not changed.

Keep Theme Studio open or minimized so it can reapply the theme to newly opened ChatGPT windows. Choose **Remove theme** to remove the runtime style.

## Accessibility

Theme Studio is designed to work with a keyboard, screen reader, Windows High Contrast Mode, and enlarged interface text.

- Press `Tab` to move through every control and use the arrow keys to adjust sliders.
- Press `Alt+A` from anywhere in the app to open Accessibility settings.
- Choose Default, Large, or Extra large interface text.
- Turn on the app's high-contrast mode or reduced-motion mode. System reduced-motion and forced-color preferences are respected automatically.
- Status changes, validation errors, and success messages are announced to assistive technology.
- The editor reflows and remains scrollable in narrower windows instead of hiding controls.

Accessibility preferences are stored locally and restored the next time Theme Studio opens.

## How it works

Theme Studio restarts ChatGPT with Chromium's debugging endpoint bound only to `127.0.0.1`, then injects one reversible `<style>` element into ChatGPT windows. It does not patch files under `WindowsApps`, change account data, or send theme data to a server.

Because the local debugging endpoint is unauthenticated, do not change its host from `127.0.0.1` and do not expose port `9237` to another device.

## Run from source

Requires Windows, Node.js, and the ChatGPT desktop app.

```powershell
npm install
npm start
```

## Test

Run the unit suite:

```powershell
npm test
```

Run the isolated desktop integration test only while ChatGPT is closed. It creates and removes a temporary profile, confirms a visible window and local debugging endpoint, captures an in-memory screenshot, and verifies style injection/removal:

```powershell
npm run test:e2e
```

The real-profile restart test closes and reopens ChatGPT. Run it from a normal Windows terminal—not ChatGPT's integrated terminal—because the app shutdown can terminate child commands:

```powershell
npm run test:e2e:restart
```

The restart test records its result in `build/e2e-restart-result.json`. If the test fails after closing ChatGPT, it attempts a normal fallback launch.

## Build

```powershell
npm run dist
```

The portable executable is written to `dist/`. Personal builds are unsigned, so Windows may show an unknown-publisher warning.

## Limitations

- Direct HTTPS image URLs are the most reliable; some hosts block image hotlinking.
- Local images are stored as data URLs in Theme Studio's local settings.
- The first application requires a ChatGPT restart.
- ChatGPT updates can change internal surface styles or startup behavior.
