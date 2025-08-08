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

// 匯出 v2 課程排程（純物件），供 google.script.run 直接呼叫
function exportBellScheduleJSONV2() {
  try {
    updateStatusEvent('LastGetCourseSchedule');
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // 1) CourseSchedule
    let courseSchedule = [];
    const scheduleSheet = ss.getSheetByName("CourseSchedule");
    if (scheduleSheet && scheduleSheet.getLastRow() > 1) {
      const scheduleData = scheduleSheet.getRange(2, 1, scheduleSheet.getLastRow() - 1, 2).getValues();
      courseSchedule = scheduleData
        .filter(row => row[0] && row[1])
        .map(row => ({ startDate: formatDate(row[0]), courseType: String(row[1]).trim() }));
    }

    // 2) CourseType -> courseTypeDaysMap
    const nctSheet = ss.getSheetByName('CourseType');
    const courseTypeDaysMap = {};
    if (nctSheet && nctSheet.getLastRow() > 1 && nctSheet.getLastColumn() > 1) {
      const rows = nctSheet.getRange(1, 1, nctSheet.getLastRow(), nctSheet.getLastColumn()).getValues();
      const header = rows[0];
      const courseTypes = header.slice(1).map(h => String(h).trim()).filter(h => h);
      courseTypes.forEach(ct => courseTypeDaysMap[ct] = []);
      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        for (let c = 1; c < header.length; c++) {
          const ct = String(header[c]).trim();
          if (!ct) continue;
          const patternKey = String(row[c] || '').trim();
          if (patternKey !== '') courseTypeDaysMap[ct].push(patternKey);
        }
      }
    }

    // 3) DailyPatternBell_<ct> -> bellsByCourseType
    const bellsByCourseType = {};
    Object.keys(courseTypeDaysMap).forEach(ct => {
      const sheetName = `DailyPatternBell_${ct}`;
      const sheet = ss.getSheetByName(sheetName);
      const map = {};
      if (sheet && sheet.getLastRow() > 1 && sheet.getLastColumn() > 1) {
        const values = sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn()).getValues();
        const header = values[0];
        const patternKeys = header.slice(1).map(h => String(h).trim()).filter(h => h);
        patternKeys.forEach(pk => map[pk] = []);
        for (let r = 1; r < values.length; r++) {
          const row = values[r];
          const time = row[0] ? formatTime(row[0]) : '';
          if (!time) continue;
          for (let c = 1; c < header.length; c++) {
            const pk = String(header[c]).trim();
            if (!pk) continue;
            const val = row[c];
            if (val !== '' && val !== null && val !== undefined) {
              const num = Number(val);
              if ((typeof val === 'number' && !isNaN(num) && num > 0) || (typeof val !== 'number' && String(val).trim() !== '' && String(val).trim() !== '0')) {
                map[pk].push({ time: time, bellType: String(val).trim() });
              }
            }
          }
        }
        Object.keys(map).forEach(pk => { map[pk].sort((a,b)=> a.time.localeCompare(b.time)); });
      }
      bellsByCourseType[ct] = map;
    });

    // 4) BellConfig -> 次數
    const bellConfig = {};
    const bellConfigSheet = ss.getSheetByName('BellConfig');
    if (bellConfigSheet && bellConfigSheet.getLastRow() > 1) {
      const rows = bellConfigSheet.getRange(2, 1, bellConfigSheet.getLastRow() - 1, Math.max(2, bellConfigSheet.getLastColumn())).getValues();
      rows.forEach(r => {
        const key = String(r[0] || '').trim();
        if (!key) return;
        const maybeNum = Number(r[1]);
        if (!isNaN(maybeNum) && maybeNum > 0) bellConfig[key] = maybeNum;
      });
    }

    // 5) 回傳結構
    return {
      CourseSchedule: courseSchedule,
      CourseTypeDays: courseTypeDaysMap,
      DailyPatternBells: bellsByCourseType,
      BellConfig: bellConfig,
      generatedAt: formatDateTime(new Date())
    };
  } catch (error) {
    return { error: '資料載入失敗 (v2)', message: error.toString(), CourseSchedule: [], CourseTypeDays: {}, DailyPatternBells: {}, BellConfig: {}, generatedAt: formatDateTime(new Date()) };
  }
}

// v2 API：基於 CourseType + DailyPatternBell_* 的新資料結構
// 回傳格式：
// {
//   schedules: [
//     {
//       startDate: "yyyy-MM-dd",
//       courseType: "10day",
//       days: [ { day: 0, patternKey: "10day_opening", bells: [ { time: "04:00", count: 1 }, ... ] } ]
//     }
//   ],
//   generatedAt: "yyyy-MM-dd HH:mm:ss"
// }
function handleCourseRequestV2() {
  try {
    updateStatusEvent('LastGetCourseSchedule');
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // 1) CourseSchedule（沿用舊表）
    let courseSchedule = [];
    const scheduleSheet = ss.getSheetByName("CourseSchedule");
    if (scheduleSheet && scheduleSheet.getLastRow() > 1) {
      const scheduleData = scheduleSheet.getRange(2, 1, scheduleSheet.getLastRow() - 1, 2).getValues();
      courseSchedule = scheduleData
        .filter(row => row[0] && row[1])
        .map(row => ({ startDate: formatDate(row[0]), courseType: String(row[1]).trim() }));
    }

    // 2) 讀取 CourseType：建立 courseType -> [patternKey by dayIndex]
    const nctSheet = ss.getSheetByName('CourseType');
    const courseTypeDaysMap = {}; // { courseType: [patternKey ...] }
    if (nctSheet && nctSheet.getLastRow() > 1 && nctSheet.getLastColumn() > 1) {
      const rows = nctSheet.getRange(1, 1, nctSheet.getLastRow(), nctSheet.getLastColumn()).getValues();
      // 第一列為表頭：A=Day, B..=courseType 名
      const header = rows[0];
      const courseTypes = header.slice(1).map(h => String(h).trim()).filter(h => h);
      // 初始化
      courseTypes.forEach(ct => courseTypeDaysMap[ct] = []);
      // 從第2列開始：逐日讀取
      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        // day = row[0]
        for (let c = 1; c < header.length; c++) {
          const ct = String(header[c]).trim();
          if (!ct) continue;
          const patternKey = String(row[c] || '').trim();
          if (patternKey !== '') {
            courseTypeDaysMap[ct].push(patternKey);
          }
        }
      }
    }

    // 3) 讀取 DailyPatternBell_<courseType>：建立 patternKey -> bells[]
    //    bells[] = [{ time: "HH:mm", bellType: string }]
    const bellsByCourseType = {}; // { ct: { patternKey: bells[] } }
    Object.keys(courseTypeDaysMap).forEach(ct => {
      const sheetName = `DailyPatternBell_${ct}`;
      const sheet = ss.getSheetByName(sheetName);
      const map = {};
      if (sheet && sheet.getLastRow() > 1 && sheet.getLastColumn() > 1) {
        const values = sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn()).getValues();
        const header = values[0]; // A=Time, B..=patternKey
        const patternKeys = header.slice(1).map(h => String(h).trim()).filter(h => h);
        // 建立空陣列
        patternKeys.forEach(pk => map[pk] = []);
        for (let r = 1; r < values.length; r++) {
          const row = values[r];
          const time = row[0] ? formatTime(row[0]) : '';
          if (!time) continue;
          for (let c = 1; c < header.length; c++) {
            const pk = String(header[c]).trim();
            if (!pk) continue;
            const val = row[c];
            // 允許數字或字串，皆視為 bellType；空白或 0 視為無
            if (val !== '' && val !== null && val !== undefined) {
              const num = Number(val);
              if ((typeof val === 'number' && !isNaN(num) && num > 0) || (typeof val !== 'number' && String(val).trim() !== '' && String(val).trim() !== '0')) {
                map[pk].push({ time: time, bellType: String(val).trim() });
              }
            }
          }
        }
        // 依時間排序
        Object.keys(map).forEach(pk => {
          map[pk].sort((a, b) => a.time.localeCompare(b.time));
        });
      }
      bellsByCourseType[ct] = map;
    });

    // 4) 讀取 BellConfig
    const bellConfig = {};
    const bellConfigSheet = ss.getSheetByName('BellConfig');
    if (bellConfigSheet && bellConfigSheet.getLastRow() > 1) {
      const rows = bellConfigSheet.getRange(2, 1, bellConfigSheet.getLastRow() - 1, Math.max(2, bellConfigSheet.getLastColumn())).getValues();
      rows.forEach(r => {
        const key = String(r[0] || '').trim();
        if (!key) return;
        const maybeNum = Number(r[1]);
        if (!isNaN(maybeNum) && maybeNum > 0) {
          bellConfig[key] = maybeNum;
        }
      });
    }

    // 5) 回傳結構
    return createJsonResponse({
      CourseSchedule: courseSchedule,
      CourseTypeDays: courseTypeDaysMap,
      DailyPatternBells: bellsByCourseType,
      BellConfig: bellConfig,
      generatedAt: formatDateTime(new Date())
    });
  } catch (error) {
    return createJsonResponse({
      error: '資料載入失敗 (v2)',
      message: error.toString(),
      CourseSchedule: [],
      CourseTypeDays: {},
      DailyPatternBells: {},
      BellConfig: {},
      generatedAt: formatDateTime(new Date())
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
