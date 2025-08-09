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
 * 清除 Status 工作表中的指定事件記錄
 * @param {string} eventName 事件名稱
 */
function clearStatusEvent(eventName) {
  const sheet = SpreadsheetApp.getActive().getSheetByName('Status');
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
  
  for (let i = 0; i < values.length; i++) {
    if (values[i][0] === eventName) {
      // 清除該行的時間戳記
      sheet.getRange(i + 2, 2).clearContent();
      Logger.log(`[Status] 清除事件: ${eventName}`);
      return;
    }
  }
}

// ===== Device Status helpers =====
/**
 * 回傳 JSON 內容（Apps Script 無法真正設置 HTTP 狀態碼，此函式僅統一輸出格式）
 */
function jsonResponse(obj, statusCode) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * 驗證 /deviceStatus 的 token（於 Script Properties 設定 DEVICE_STATUS_TOKEN）
 * 若未設定則不驗證
 */
function validateDeviceStatusToken(token) {
  try {
    const expected = PropertiesService.getScriptProperties().getProperty('DEVICE_STATUS_TOKEN');
    if (!expected) return true;
    return token === expected;
  } catch (e) {
    return true;
  }
}

/**
 * 追加原始裝置狀態紀錄表（DeviceStatusLog）：Timestamp | Device | Battery | Charging
 */
function appendDeviceStatusLog(ts, device, battery, charging) {
  const sh = getOrCreateSheetByName('DeviceStatusLog');
  if (sh.getLastRow() === 0) sh.appendRow(['Timestamp', 'Device', 'Battery', 'Charging']);
  sh.appendRow([ts, device, battery, charging]);
}

function getOrCreateSheetByName(name) {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  return sh;
}

/**
 * onEdit 觸發器：只要非 Status 工作表有編輯時，更新 LastDataChange
 */
function onEdit(e) {
  var sheetName = e.range.getSheet().getName();
  if (sheetName === 'Status') return;
  updateStatusEvent('LastDataChange');
}

// 簡潔的離線通知功能
function checkOfflineAndNotify() {
  const lastKeepAlive = getStatusEventTimestamp("LastKeepAlive");
  const lastOfflineNotification = getStatusEventTimestamp("LastOfflineNotification");
  const notifyEnabled = String(getConfigValue('NotifyEnabled', 'true')).trim().toLowerCase() === 'true';
  const emails = getConfigValue('NotifyEmail', '').split(',').map(e => e.trim()).filter(e => e);
  if (!notifyEnabled || emails.length === 0) return; // 未啟用或未設定 email 則不執行
  
  const now = new Date();
  const keepAliveInterval = Number(getConfigValue('KeepAliveInterval', '5')); // 預設5分鐘
  const offlineThreshold = keepAliveInterval * 3; // 3次沒有keepalive就離線
  const recoveryThreshold = keepAliveInterval; // 恢復閾值
  
  if (!lastKeepAlive) {
    // 無 keep-alive 記錄，發送離線通知
    if (!lastOfflineNotification) {
      sendNotificationEmail('離線', '前端設備已離線');
      updateStatusEvent('LastOfflineNotification');
    }
    return;
  }
  
  const lastTime = new Date(lastKeepAlive);
  const diffMinutes = (now - lastTime) / (1000 * 60);
  
  if (diffMinutes > offlineThreshold && !lastOfflineNotification) {
    // 離線通知：超過閾值且沒有發過離線通知
    emails.forEach(email => sendNotificationEmail('離線', `前端已離線 ${Math.round(diffMinutes)} 分鐘`, email));
    updateStatusEvent('LastOfflineNotification');
  } else if (diffMinutes < recoveryThreshold && lastOfflineNotification) {
    // 恢復通知：小於閾值且有發過離線通知
    emails.forEach(email => sendNotificationEmail('恢復', '前端設備已恢復連線', email));
    clearStatusEvent('LastOfflineNotification'); // 清除離線通知記錄
  }
}

function sendNotificationEmail(status, message, email) {
  if (!email) return;
  
  const subject = `[敲鐘系統] 前端${status}通知`;
  const body = `
<h2>敲鐘系統前端${status}通知</h2>
<p><strong>時間：</strong> ${formatDateTime(new Date())}</p>
<p><strong>狀態：</strong> ${message}</p>
<p><strong>最後活躍：</strong> ${getStatusEventTimestamp("LastKeepAlive") || '無記錄'}</p>
  `;
  
  try {
    GmailApp.sendEmail(email, subject, '', { htmlBody: body });
    Logger.log(`[Email] ${status}通知已發送給 ${email}`);
  } catch (error) {
    Logger.log(`[Email] 發送失敗: ${error.toString()}`);
  }
}
