/**
 * Blueprint ⇄ Google Sheets bridge. Paste into an Apps Script project and deploy as a Web app
 * (Execute as: Me · Who has access: Anyone). The app POSTs {method, path, body}; this forwards it to
 * the Sheets API as you and returns {status, body}. Only SHEET_ID can be touched.
 */
const SHEET_ID = '191S3rvju89awp12yQefr3rECzqYNOz4fnkG9_BS9RYY';
const API = 'https://sheets.googleapis.com/v4/spreadsheets';

function doPost(e) {
  let out;
  try {
    const req = JSON.parse(e.postData.contents);
    if (!new RegExp('^/' + SHEET_ID + '(?:[/?:]|$)').test(req.path)) {
      out = { status: 403, body: JSON.stringify({ error: { message: 'Only the Blueprint spreadsheet can be used.' } }) };
    } else {
      const method = (req.method || 'GET').toLowerCase();
      const opts = { method: method, muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() } };
      if (method !== 'get' && req.body != null) { opts.contentType = 'application/json'; opts.payload = req.body; }
      const r = UrlFetchApp.fetch(API + req.path, opts);
      out = { status: r.getResponseCode(), body: r.getContentText() };
    }
  } catch (err) {
    out = { status: 500, body: JSON.stringify({ error: { message: String(err) } }) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

/** Never called — referencing SpreadsheetApp makes Apps Script request the Google Sheets permission. */
function authorize_() { SpreadsheetApp.openById(SHEET_ID); }
