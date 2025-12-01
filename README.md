# Fidget Keypad (Virtual Toy)

這是一個有趣的虛擬按鍵玩具網頁應用程式，讓您可以自訂按鈕、錄製聲音並進行播放。就像一個可自定義的 Soundboard，隨時隨地享受按壓按鈕的樂趣！

## ✨ 主要功能

### 🎮 遊玩模式 (Play Mode)
- **擬真介面**：可愛且具質感的實體按鍵風格設計。
- **即時回饋**：點擊按鈕即可播放對應的音效。
- **動態佈局**：根據按鈕數量自動調整排列方式（支援 2 欄或 3 欄佈局）。

### ⚙️ 編輯模式 (Edit Mode)
點擊右上角的設定圖示即可進入編輯模式，完全自訂您的鍵盤：

- **按鈕管理**：自由新增或刪除按鈕。
- **外觀自訂**：
  - 修改按鈕上的文字。
  - 選擇按鈕顏色（白色、黃色、藍色、紅色）。
- **音效設定**：
  - 🎙️ **錄音**：直接使用麥克風錄製專屬音效。
  - 📤 **上傳**：支援上傳本地音訊檔案。
  - ▶️ **預覽**：即時試聽設定的聲音。
### 💾 資料持久化 (Data Persistence)
- **自動儲存**：所有的按鈕設定、顏色以及**錄製的聲音**都會自動儲存在瀏覽器中。
- **IndexedDB**：使用瀏覽器資料庫技術，確保即使重新整理頁面，您的專屬設定也不會消失。

## 🛠️ 技術堆疊

本專案使用現代前端技術構建：

- **核心框架**: [React](https://react.dev/) (v19)
- **語言**: [TypeScript](https://www.typescriptlang.org/)
- **建置工具**: [Vite](https://vitejs.dev/)
- **樣式**: [Tailwind CSS](https://tailwindcss.com/) (v4, Local Installation)
- **資料庫**: [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) (via `idb-keyval`)
- **圖示**: [Lucide React](https://lucide.dev/)

## 🚀 如何開始

### 安裝依賴

```bash
npm install
```

### 啟動開發伺服器

```bash
npm run dev
```

### 建置生產版本

```bash
npm run build
```

## 📦 部署建議

本專案為純靜態網站 (Static Web App)，非常適合部署於以下免費平台：

- **Vercel** (推薦)
- **Netlify**
- **GitHub Pages**
