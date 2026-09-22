const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("themeStudio", {
  getState: () => ipcRenderer.invoke("theme:get-state"),
  getStatus: () => ipcRenderer.invoke("theme:get-status"),
  save: (theme) => ipcRenderer.invoke("theme:save", theme),
  activate: (theme) => ipcRenderer.invoke("theme:activate", theme),
  disable: () => ipcRenderer.invoke("theme:disable"),
  chooseImage: () => ipcRenderer.invoke("theme:choose-image"),
  chooseFont: () => ipcRenderer.invoke("theme:choose-font"),
  chooseSound: () => ipcRenderer.invoke("theme:choose-sound"),
  getProfiles: () => ipcRenderer.invoke("theme:profiles-get"),
  saveProfile: (profile) => ipcRenderer.invoke("theme:profile-save", profile),
  loadProfile: (id) => ipcRenderer.invoke("theme:profile-load", id),
  deleteProfile: (id) => ipcRenderer.invoke("theme:profile-delete", id),
  exportTheme: (theme, name) => ipcRenderer.invoke("theme:export", { theme, name }),
  importTheme: () => ipcRenderer.invoke("theme:import"),
});
