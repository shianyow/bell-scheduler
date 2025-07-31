// 工具函式：格式化 yyyy-MM-dd HH:mm:ss
function formatDateTime(date) {
  return Utilities.formatDate(new Date(date), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
}

// 工具函式：格式化日期 yyyy-MM-dd
function formatDate(date) {
  return Utilities.formatDate(new Date(date), Session.getScriptTimeZone(), "yyyy-MM-dd");
}

// 工具函式：格式化時間 HH:mm（24 小時）
function formatTime(time) {
  return Utilities.formatDate(new Date(time), Session.getScriptTimeZone(), "HH:mm");
}

function getConfigValue(key, defaultValue = null) {
  const sheet = SpreadsheetApp.getActive().getSheetByName("SystemConfig");
  const values = sheet.getDataRange().getValues(); // 包含表頭

  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === key) {
      return values[i][1];
    }
  }

  return defaultValue;
}

/**
 * 更新 Status 工作表的指定事件名稱時間戳記
 * @param {string} eventName 事件名稱（如 LastDataChange, LastKeepAlive, LastGetCourseSchedule）
 */
function updateStatusEvent(eventName) {
  var now = new Date();
  var display = formatDateTime(now);
  var sheet = SpreadsheetApp.getActive().getSheetByName('Status');
  Logger.log('[Status] 更新事件: ' + eventName + ' @ ' + display);

  if (!sheet) {
    throw new Error('找不到 Status 工作表');
  }
  var values = sheet.getRange(2, 1, Math.max(sheet.getLastRow() - 1, 0), 1).getValues();
  for (var i = 0; i < values.length; i++) {
    if (values[i][0] === eventName) {
      sheet.getRange(i + 2, 2).setValue(display);
      return;
    }
  }
  var newRow = sheet.getLastRow() + 1;
  sheet.getRange(newRow, 1).setValue(eventName);
  sheet.getRange(newRow, 2).setValue(display);
}

/**
 * 取得 Status 工作表指定事件名稱的時間戳記
 * @param {string} eventName 事件名稱（如 LastDataChange）
 * @return {string} 時間戳記（找不到則回傳空字串）
 */
function getStatusEventTimestamp(eventName) {
  const sheet = SpreadsheetApp.getActive().getSheetByName('Status');
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
  for (let i = 0; i < values.length; i++) {
    if (values[i][0] === eventName) {
      var val = values[i][1];
      if (val instanceof Date) {
        return formatDateTime(val);
      }
      return val;
    }
  }
  return "";
}

/**
 * onEdit 觸發器：只要非 Status 工作表有編輯時，更新 LastDataChange
 */
function onEdit(e) {
  var sheetName = e.range.getSheet().getName();
  if (sheetName === 'Status') return;
  updateStatusEvent('LastDataChange');
}
