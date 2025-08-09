function doGet(e) {
  const path = e.parameter.path;
  let response;

  switch (path) {
    case 'course':
      response = handleCourseRequest();
      break;
    case 'v2/course':
      response = handleCourseRequestV2();
      break;
    case 'keepalive':
      response = handleKeepAlive();
      break;
    case 'deviceStatus':
      // 裝置狀態回報（支援 GET）。POST 版本見 doPost。
      response = handleDeviceStatus({ parameter: e.parameter });
      break;
    case 'test':
      // 測試介面
      return HtmlService.createHtmlOutputFromFile('test');
    case 'v1':
      // 舊版前端入口
      return HtmlService.createTemplateFromFile('index').evaluate();
    case 'v2':
      // 新版前端入口
      return HtmlService.createTemplateFromFile('index-v2').evaluate();
    case undefined:
      // 若無 path，預設回傳管理介面
      return HtmlService.createTemplateFromFile('index-v2').evaluate();
    default:
      response = ContentService.createTextOutput(
        JSON.stringify({ error: "Unknown path" })
      ).setMimeType(ContentService.MimeType.JSON);
      break;
  }

  return response;
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename)
      .getContent();
}

// 支援 POST(JSON) 路由：可由 iOS 捷徑以 JSON 回報裝置狀態
function doPost(e) {
  try {
    const body = e && e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
    const path = (body.path || '').toString().toLowerCase();
    if (path === 'devicestatus') {
      return handleDeviceStatus({ parameter: body });
    }
  } catch (err) {
    return jsonResponse({ ok: false, error: 'invalid json', detail: String(err) });
  }
  return jsonResponse({ ok: false, error: 'unknown route' });
}

// /deviceStatus 處理器：接受 GET 或 POST(JSON)
// 參數：device, battery(0-100), charging(0/1), ts(optional ISO), token(optional)
function handleDeviceStatus(req) {
  const p = req && req.parameter ? req.parameter : {};
  const device = (p.device || 'unknown').toString();
  const batteryProvided = (p.battery !== undefined);
  const batteryNum = Number(p.battery);
  const chargingProvided = (p.charging !== undefined);
  const charging = p.charging;
  const ts = p.ts ? new Date(p.ts) : new Date();
  const token = (p.token || '').toString();

  if (!validateDeviceStatusToken(token)) {
    return jsonResponse({ ok: false, error: 'invalid token' });
  }

  // 追加原始紀錄表
  try { appendDeviceStatusLog(ts, device, Number.isNaN(batteryNum) ? '' : batteryNum, chargingProvided ? charging : ''); } catch (e) {}

  return jsonResponse({
    ok: true,
    device: device,
    battery: batteryProvided ? (Number.isNaN(batteryNum) ? null : batteryNum) : null,
    charging: chargingProvided ? charging : null
  });
}
