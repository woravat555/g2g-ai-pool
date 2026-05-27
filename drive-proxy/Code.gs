// G2G Drive Proxy — Apps Script Web App
// Deploy as: Execute as ME, Access: Anyone
// This script writes to Drive on behalf of the script owner (woravat.a@gmail.com)

const SHARED_SECRET = 'g2g-drive-2026' // Simple auth

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents)

    // Auth check
    if (data.secret !== SHARED_SECRET) {
      return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'unauthorized' }))
        .setMimeType(ContentService.MimeType.JSON)
    }

    const action = data.action

    if (action === 'save') {
      // Save JSON to a specific folder
      const folderId = data.folderId
      const fileName = data.fileName
      const content = JSON.stringify(data.content)

      const folder = DriveApp.getFolderById(folderId)

      // Check if file exists
      const files = folder.getFilesByName(fileName)
      if (files.hasNext()) {
        // Update existing
        const file = files.next()
        file.setContent(content)
        return ContentService.createTextOutput(JSON.stringify({ ok: true, fileId: file.getId(), action: 'updated' }))
          .setMimeType(ContentService.MimeType.JSON)
      } else {
        // Create new
        const file = folder.createFile(fileName, content, 'application/json')
        return ContentService.createTextOutput(JSON.stringify({ ok: true, fileId: file.getId(), action: 'created' }))
          .setMimeType(ContentService.MimeType.JSON)
      }
    }

    if (action === 'load') {
      const folderId = data.folderId
      const fileName = data.fileName
      const folder = DriveApp.getFolderById(folderId)
      const files = folder.getFilesByName(fileName)
      if (files.hasNext()) {
        const file = files.next()
        const content = file.getBlob().getDataAsString()
        return ContentService.createTextOutput(JSON.stringify({ ok: true, content: JSON.parse(content) }))
          .setMimeType(ContentService.MimeType.JSON)
      }
      return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'not_found' }))
        .setMimeType(ContentService.MimeType.JSON)
    }

    if (action === 'ping') {
      return ContentService.createTextOutput(JSON.stringify({ ok: true, service: 'G2G Drive Proxy' }))
        .setMimeType(ContentService.MimeType.JSON)
    }

    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'unknown_action' }))
      .setMimeType(ContentService.MimeType.JSON)

  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON)
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({ ok: true, service: 'G2G Drive Proxy', version: '1.0' }))
    .setMimeType(ContentService.MimeType.JSON)
}
