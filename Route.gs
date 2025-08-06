function doGet(e) {
  const path = e.parameter.path;
  let response;

  switch (path) {
    case 'course':
      response = handleCourseRequest();
      break;
    case 'keepalive':
      response = handleKeepAlive();
      break;
    case 'test':
      // 測試介面
      return HtmlService.createHtmlOutputFromFile('test');
    case undefined:
      // 若無 path，預設回傳管理介面
      return HtmlService.createTemplateFromFile('index').evaluate();
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
