# 🎮 Fun Button (v0.1.0)

一個充滿樂趣與療癒感的虛擬機械按鍵玩具，支援自定義音效、多玩具管理以及精緻的 3D 視覺效果。

👉 **[立即體驗 Demo](https://truedano.github.io/funButton/)**

---

## ✨ 核心特色

- **🎹 擬真機械手感**：具備 3D 深度感、陰影變化與縮放回饋的鍵帽設計。
- **🔊 自定義音效**：
  - **錄音**：直接透過麥克風錄製您的專屬聲音。
  - **上傳**：支援上傳任何音訊檔案。
  - **合成音效**：內建模擬機械開關的物理 Click 聲。
- **🗃️ 多玩具管理**：可以建立多組獨立的「玩具」，每組都有自己的按鈕配置與外殼配色。
- **🎨 高度自定義**：
  - 支援 7 種鮮豔配色（白、黃、藍、紅、綠、紫、橘）。
  - 可自定義外殼與按鍵顏色。
- **🚀 極致效能**：
  - 使用 Web Audio API & AudioBuffer 達成零延遲播放。
  - 支援音效重疊播放。
- **💾 自動存檔**：所有配置均儲存在本地 `IndexedDB`，重新整理也不會遺失。

---

## 🛠️ 技術棧

- **Core**: React 19 + TypeScript
- **Styling**: TailwindCSS 4 (Modern CSS-first approach)
- **Audio**: Web Audio API (Low latency buffer system)
- **Storage**: idb-keyval (IndexedDB wrapper)
- **Build**: Vite 6
- **Deployment**: GitHub Actions

---

## 🏃 快速啟動

### 本地開發

1. 安裝套件：
   ```bash
   npm install
   ```

2. 啟動開發伺服器：
   ```bash
   npm run dev
   ```

3. 建立生產版本：
   ```bash
   npm run build
   ```

---

## 🛡️ 安全性說明

本專案為純前端應用，所有個人錄音與配置均儲存於您的瀏覽器本地空間，不會上傳至任何雲端伺服器。API Key 等敏感資訊已進行安全過濾與隔離。

---

## 📄 授權

MIT License
