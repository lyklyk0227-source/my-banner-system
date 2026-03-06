const SHEET_ID = '1sIXJ6MEMoM4pPjoiq_Pf8gJ5rar8hPoDwnm71Avb7P4';
const SHEET_NAME = 'banners';

// Date 객체 → 'YYYY-MM-DDTHH:MM' 문자열로 변환
function formatDateToString(value) {
  if (!value) return '';
  // 이미 문자열이면 그대로 반환
  if (typeof value === 'string') return value;
  // Date 객체이면 포맷 변환
  if (value instanceof Date) {
    const y = value.getFullYear();
    const mo = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    const h = String(value.getHours()).padStart(2, '0');
    const mi = String(value.getMinutes()).padStart(2, '0');
    return `${y}-${mo}-${d}T${h}:${mi}`;
  }
  return String(value);
}

function doGet() {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const rows = data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => {
      // start, end 컬럼은 항상 문자열로 변환
      if (h === 'start' || h === 'end') {
        obj[h] = formatDateToString(row[i]);
      } else {
        obj[h] = row[i];
      }
    });
    return obj;
  });
  return ContentService.createTextOutput(JSON.stringify(rows))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
  const { action, data } = JSON.parse(e.postData.contents);

  if (action === 'save') {
    sheet.clearContents();
    sheet.appendRow(['id', 'name', 'slot', 'start', 'end', 'dept', 'color', 'memo']);
    data.forEach(b => {
      sheet.appendRow([
        b.id,
        b.name,
        b.slot,
        String(b.start || ''), // 문자열 강제 지정
        String(b.end || ''),   // 문자열 강제 지정
        b.dept,
        b.color,
        b.memo
      ]);
    });

    // start/end 컬럼(D, E열 = 4, 5번째)을 텍스트 형식으로 지정 → 자동변환 방지
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet.getRange(2, 4, lastRow - 1, 1).setNumberFormat('@');
      sheet.getRange(2, 5, lastRow - 1, 1).setNumberFormat('@');
    }
  }

  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
