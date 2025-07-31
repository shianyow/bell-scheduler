// 主 API 處理函式：提供前端 JSON 課程排程
function handleCourseRequest() {
  try {
    const data = exportBellScheduleJSON();
    return createJsonResponse(data);
  } catch (error) {
    return createJsonResponse({
      error: '資料載入失敗',
      message: error.toString(),
      CourseSchedule: [],
      CourseTypes: {},
      DailyPatterns: {},
      BellConfig: {}
    });
  }
}

// 工具函式：建立 JSON 回應
function createJsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// 匯出課程排程 JSON
function exportBellScheduleJSON() {
  updateStatusEvent('LastGetCourseSchedule');
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // === 1. 課程清單 CourseSchedule ===
  let courseSchedule = [];
  const scheduleSheet = ss.getSheetByName("CourseSchedule");
  if (scheduleSheet && scheduleSheet.getLastRow() > 1) {
    const scheduleData = scheduleSheet.getRange(2, 1, scheduleSheet.getLastRow() - 1, 2).getValues();
    courseSchedule = scheduleData
      .filter(row => row[0] && row[1])
      .map(row => ({
        startDate: formatDate(row[0]),
        courseType: row[1]
      }));
  }

  // === 2. 各課程類型對應 daily pattern（CourseTypes）===
  const courseTypes = {};
  const sheetNames = ss.getSheets().map(s => s.getName());

  sheetNames.forEach(name => {
    if (name.startsWith("CourseType_")) {
      const key = name.replace("CourseType_", "");
      const sheet = ss.getSheetByName(name);
      if (sheet && sheet.getLastRow() > 1) {
        const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
        courseTypes[key] = values
          .filter(row => row[0] !== "")
          .map(row => ({ day: row[0], dailyPattern: row[1] }));
      }
    }
  });

  // === 3. 每種模式對應的鐘聲時間清單（DailyPatterns） ===
  const dailyPatterns = {};

  sheetNames.forEach(name => {
    if (name.startsWith("DailyPattern_")) {
      const key = name.replace("DailyPattern_", "");
      const sheet = ss.getSheetByName(name);
      if (sheet && sheet.getLastRow() > 1) {
        const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
        dailyPatterns[key] = values
          .filter(row => row[0])
          .map(row => ({
            time: formatTime(row[0]),
            bellType: row[1]
          }));
      }
    }
  });

  // === 4. 鐘聲配置 BellConfig ===
  const bellConfig = {};
  const bellConfigSheet = ss.getSheetByName("BellConfig");
  if (bellConfigSheet && bellConfigSheet.getLastRow() > 1) {
    const bellConfigData = bellConfigSheet.getRange(2, 1, bellConfigSheet.getLastRow() - 1, 2).getValues();
    bellConfigData
      .filter(row => row[0] && row[1])
      .forEach(row => {
        bellConfig[row[0]] = row[1]; // BellType -> AudioURL
      });
  }

  return {
    CourseSchedule: courseSchedule,
    CourseTypes: courseTypes,
    DailyPatterns: dailyPatterns,
    BellConfig: bellConfig
  };
}

function handleKeepAlive() {
  try {
    const data = getKeepAliveData();
    return createJsonResponse(data);
  } catch (error) {
    return createJsonResponse({
      status: "ERROR",
      message: error.toString(),
      systemConfig: {}
    });
  }
}

// 獲取 Keep-Alive 資料的純函式（供 Google Apps Script 內建 API 使用）
function getKeepAliveData() {
  updateStatusEvent('LastKeepAlive');
  const configKeys = ['KeepAliveInterval'];
  const systemConfig = {};
  for (let key of configKeys) {
    const value = getConfigValue(key);
    systemConfig[key] = value ? Number(value) : 0;
  }
  const lastDataChange = getStatusEventTimestamp("LastDataChange");
  return {
    status: "OK",
    systemConfig: systemConfig,
    lastDataChange: lastDataChange
  };
}
