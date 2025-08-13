# 🔔 Bell Scheduler - 敲鐘系統

這是一個用 Google Apps Script 和 Google Sheets 製作的敲鐘系統，支援課程排程與 Web 管理介面。

**快速開始：** [複製 Bell Schedule 模板](https://docs.google.com/spreadsheets/d/1as5jedZoFz7Yv8Armu6TaVUxKEx_4V5nBtygqa3Fpls) 建立你的敲鐘系統。

## 功能

### 核心功能
- 課程排程管理：用 Google Sheets 管理課程時間表
- 彈性鐘聲模式：支援多種每日鐘聲模式
- 系統狀態監控：Keep-alive 機制確保系統運作
- 智慧資料同步：前端自動檢查課程資料更新，確保使用最新排程
- 離線播放支援：即使網路斷線，仍可使用已下載的課程資料正常播放鐘聲
- 前端離線通知：自動檢測前端離線狀態並發送 email 通知

## 系統架構

### 檔案結構
```
bell-scheduler/
├── index-v2.html      # 前端（v2，預設）
├── test.html          # 後端測試介面
├── bell3js.html       # 內嵌鐘聲音檔（供 index-v2 include）
├── Route.gs           # 路由處理和 HTTP 請求分發
├── Api.gs             # 主要 API 邏輯和資料處理
├── Utils.gs           # 工具函式（日期時間格式化、配置讀取）
└── README.md          # 專案說明文件
```

### 🗄️ Google Sheets 資料結構（v2）

#### 1. **CourseSchedule** 工作表
| 欄位 | 說明 | 範例 |
|------|------|------|
| 開始日期 | 課程開始日期 | 2025-08-01 |
| 課程類型 | 課程類型名稱 | 正常課程 |

#### 2. **CourseType** 工作表（矩陣）
- 第 1 列為表頭：第 1 欄留白，後續各欄為課程類型名稱（例如：正常課程、密集課程...）。
- 第 1 欄為天數索引（D1、D2、... 或數字），其餘儲存格填入「每日模式鍵（patternKey）」。
- Apps Script 會按列由左至右讀取每個課程類型對應天數的 patternKey。

#### 3. **DailyPatternBell_<課程類型>** 工作表
- 第 1 列為表頭：第 1 欄為 `Time`，後續各欄為「每日模式鍵（patternKey）」。
- 第 1 欄填 24 小時制時間（例如 08:00）；各 patternKey 欄位填入「BellType（字串或數字）」或留白/0 表示無鐘聲。
- 由 Apps Script 匯出為 `DailyPatternBells[課程類型][patternKey] = [{ time, bellType }]`，時間會自動排序。

#### 4. **SystemConfig** 工作表
| Key              | Value                      | Note                                   |
|------------------|---------------------------|----------------------------------------|
| KeepAliveInterval| 5                         | keep-alive interval in minutes         |
| NotifyEnabled    | TRUE                      | 設為 TRUE 啟用離線通知                 |
| NotifyEmail      | admin@example.com, ...   | 一或多個 email，以逗號分隔             |

- **KeepAliveInterval**：前端 keep-alive 檢查的間隔（單位：分鐘）。
- **NotifyEnabled**：設為 TRUE 時啟用 email 離線通知。
- **NotifyEmail**：通知收件人清單，可填一個或多個 email，使用 `,` 分隔。

#### 5. **BellConfig** 工作表
| 欄位      | 說明         | 範例 |
|-----------|--------------|------|
| BellType  | 鐘聲類型     | 1    |
| Repeat    | 重複敲擊次數 | 4    |

- **BellType**：對應 DailyPattern_* 工作表裡的 BellType 欄位，用來區分不同鐘聲類型。
- **Repeat**：每次響鈴時重複敲擊的次數，例如 Repeat=4 代表該鐘聲會連續響 4 下。

## 🚀 部署指南

### 1. 建立 Google Sheets 和 Apps Script
1. 點擊上方連結開啟模板
2. 點擊「檔案」→「建立副本」
3. 命名你的副本（例如：「我的敲鐘系統」）
4. 在你的 Google Sheets 中，點擊「擴充功能」→「Apps Script」
5. 在開啟的 Apps Script 編輯器中，複製上述程式碼檔案

### 2. 部署為 Web 應用程式
1. 點擊「部署」→「新增部署」
2. 類型選擇「Web 應用程式」
3. 設定如下：
   - **說明**：Bell Scheduler v1.0
   - **執行身分**：我（你的帳戶）
   - **存取權限**：任何人
4. 點擊「部署」並複製 Web 應用程式 URL

## 📚 使用說明

### 🌐 Web 介面訪問

| URL | 介面 | 用途 |
|-----|------|------|
| `你的網址` | `index-v2.html` | 🏠 **前端（v2，預設）** - 顯示課表與自動敲鐘 |
| `你的網址?path=test` | `test.html` | 🔧 **後端測試介面** - API 測試與除錯 |

### 🔧 測試介面功能

訪問 `你的網址?path=test` 可以使用測試介面，包含以下功能：

#### 💓 系統狀態檢查
- 檢查系統是否正常運作

### 📧 離線通知設定

#### 1. 設定收件人與通知開關
在 **SystemConfig** 工作表中設定：

| Key           | Value                       | Note                           |
|---------------|----------------------------|--------------------------------|
| NotifyEnabled | TRUE                       | 設為 TRUE 啟用離線通知         |
| NotifyEmail   | admin@example.com, ... | 多個 email 以逗號分隔         |

- **NotifyEnabled** 設為 TRUE 時才會發送 email 通知。
- **NotifyEmail** 可填一個或多個收件人，請用英文逗號 `,` 分隔。


#### 2. 設定觸發器
1. 在 Google Apps Script 編輯器中，點擊左側「觸發器」
2. 點擊「新增觸發器」
3. 設定如下：
   - **函式**：`checkOfflineAndNotify`
   - **活動來源**：`時間驅動`
   - **時間間隔**：`每 5 分鐘`
4. 點擊「儲存」

#### 3. 通知邏輯
- **離線檢測**：超過 15 分鐘無 keep-alive 記錄時發送離線通知
- **恢復檢測**：小於 5 分鐘有 keep-alive 記錄時發送恢復通知
- **避免重複**：狀態改變時才發送通知
- 顯示 Keep-Alive 間隔和更新間隔設定
- 顯示檢查時間戳記

#### 📥 載入課程資料
- 從 Google Sheets 載入最新的課程排程
- 顯示課程排程、課程類型和每日鐘聲模式
- 自動格式化日期和時間

### 🔌 API 端點

#### `GET /?path=v2/course`
取得 v2 compact 課表資料（前端自行展開）。

結構說明：
- `CourseSchedule`: `[{ startDate: 'YYYY-MM-DD', courseType: string }]`
- `CourseTypeDays`: `{ [courseType: string]: string[] }` 第 N 天對應的每日模式鍵（patternKey）。
- `DailyPatternBells`: `{ [courseType: string]: { [patternKey: string]: [{ time: 'HH:MM', bellType?: string, count?: number }] } }`
- `BellConfig`: `{ [bellType: string]: number }` 定義各 bellType 的重複敲擊次數。

回應範例：
```json
{
  "CourseSchedule": [
    { "startDate": "2025-08-01", "courseType": "正常課程" }
  ],
  "CourseTypeDays": {
    "正常課程": ["D1", "D2"]
  },
  "DailyPatternBells": {
    "正常課程": {
      "D1": [ { "time": "08:00", "bellType": "A" }, { "time": "08:10", "count": 2 } ],
      "D2": [ { "time": "09:00", "bellType": "B" } ]
    }
  },
  "BellConfig": { "A": 4, "B": 2 },
  "generatedAt": "2025-08-01 12:00:00"
}
```

#### `GET /?path=keepalive`
檢查系統狀態和配置

**回應格式：**
```json
{
  "status": "OK",
  "systemConfig": {
    "KeepAliveInterval": 5
  },
  "lastDataChange": "2025-08-02 12:39:52"
}
```

## 狀態追蹤（Status Sheet）

Status 工作表會記錄系統關鍵事件的最後異動時間，例如：

| Event                  | Timestamp              |
|------------------------|-----------------------|
| LastDataChange         | 2025-08-02 12:39:52   |
| LastGetCourseSchedule  | 2025-08-02 12:25:22   |
| LastKeepAlive          | 2025-08-02 12:38:51   |

- **LastDataChange**：任何主資料（課表、設定、類型等）異動時自動更新。
- **LastGetCourseSchedule**：每次課表 API 被呼叫時自動更新。
- **LastKeepAlive**：每次系統活性檢查 API 被呼叫時自動更新。

#### keepalive API 回傳範例

```json
{
  "status": "OK",
  "systemConfig": {
    "KeepAliveInterval": 5
  },
  "lastDataChange": "2025-08-02 12:39:52"
}
```
- 前端可比對 `lastDataChange` 判斷是否需要重新下載課程資料。

### 前端（index-v2.html）行為補充
- Keepalive 間隔可由後端 `SystemConfig.KeepAliveInterval` 下發，前端支援動態重排程（會取消舊計時器並套用新間隔）。
- 每日 00:00 自動清理過去日期並刷新 UI（`deletePastAlarms` → `sortAlarms` → `renderAlarms`）。
- 提供除錯紀錄顯示/隱藏切換，並記錄自動敲鐘判斷與 API 呼叫結果。
- 在 GAS 環境下優先使用 `google.script.run.exportBellScheduleJSONV2()` 以避免 fetch 因部署/權限導致回傳 HTML（非 JSON）。

## 開發說明

### 技術棧
- **後端**：Google Apps Script (JavaScript)
- **前端**：HTML5 + CSS3 + Vanilla JavaScript
- **資料庫**：Google Sheets
- **部署**：Google Apps Script Web App

## 疑難排解

### 常見問題

**Q: 資料載入失敗？**
A: 檢查 Google Sheets 的工作表名稱是否正確，以及是否有足夠的權限存取。

## 更新日誌

### v1.0.0 (2025-08-04)
- 初始版本發布

## 授權

此專案採用 MIT 授權條款。

## 貢獻

歡迎提交 Issue 和 Pull Request 來改善這個專案！

---
