# 🎮 Fun Button (v0.2.0)

一個充滿樂趣與療癒感的虛擬機械按鍵玩具，支援自定義音效、多玩具管理以及精緻的 3D 視覺效果。

👉 **[立即體驗 Demo](https://truedano.github.io/funButton/)**

---

## ✨ 核心特色

- **🎹 擬真機械手感**：具備 3D 深度感、陰影變化與縮放回饋的鍵帽設計。
- **🔊 自定義音效**：
  - **錄音**：直接透過麥克風錄製您的專屬聲音。
  - **上傳**：支援上傳任何音訊檔案。
  - **合成音效**：內建模擬機械開關的物理 Click 聲。
- **🗃️ 多玩具管理 (v0.2.0 新增)**：
  - 可以建立多組獨立的「玩具」。
  - **全卡片選取**：更直覺的 UX，點擊清單卡片即可快速切換玩具。
- **📤 備份與分享 (v0.2.0 新增)**：
  - **全量備份**：一鍵匯出/匯入所有玩具。
  - **單一玩具分享**：支援匯出單一玩具 JSON 檔案（包含嵌入的 Base64 音訊資料）。
- **🎨 高度自定義**：
  - 支援 7 種鮮豔配色（白、黃、藍、紅、綠、紫、橘）。
  - 可自定義外殼與按鍵顏色。
- **🚀 精緻回饋 (v0.2.0 新增)**：
  - **Toast 通知系統**：使用現代化的磨砂玻璃效果提示，取代傳統彈窗。
- **💾 動態存檔**：所有配置均儲存在本地 `IndexedDB`，重新整理也不會遺失。

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
