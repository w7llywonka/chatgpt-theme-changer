const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("themeStudio", {
  getState: () => ipcRenderer.invoke("theme:get-state"),
  getStatus: () => ipcRenderer.invoke("theme:get-status"),
  listFonts: () => ipcRenderer.invoke("theme:list-fonts"),
  save: (theme) => ipcRenderer.invoke("theme:save", theme),
  activate: (theme) => ipcRenderer.invoke("theme:activate", theme),
  disable: () => ipcRenderer.invoke("theme:disable"),
  chooseImage: () => ipcRenderer.invoke("theme:choose-image"),
});
