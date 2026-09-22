require('dotenv').config({ path: __dirname + '/../.env' });
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');



const SPREADSHEET_ID = '1GqgD9YdJsACnfLj_yAXlYLDXi_KfaL42t_vg0er5Doo';
const EXPORT_DIR = path.join(__dirname, '..', 'scratch', 'stock_export');

async function extractSheets() {
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: path.resolve(__dirname, '..', 'service-account.json'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    
    // Get spreadsheet metadata to find all sheets
    const metadata = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });
    
    const metadataInfo = metadata.data.sheets.map(s => ({
      title: s.properties.title,
      sheetId: s.properties.sheetId
    }));
    
    console.log('Found sheets:', metadataInfo);
    
    fs.writeFileSync(
      path.join(EXPORT_DIR, '_metadata.json'), 
      JSON.stringify(metadataInfo, null, 2)
    );

    // Fetch data for each sheet
    for (const sheet of metadataInfo) {
      console.log(`Extracting ${sheet.title}...`);
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `'${sheet.title}'`,
      });
      
      const sheetData = {
        sheet: sheet.title,
        gid: sheet.sheetId,
        rows: response.data.values || []
      };
      
      fs.writeFileSync(
        path.join(EXPORT_DIR, `${sheet.title.replace(/[\/\\]/g, '_')}.json`), 
        JSON.stringify(sheetData, null, 2)
      );
      
      console.log(`Saved ${sheetData.rows.length} rows for ${sheet.title}`);
    }
    
    console.log('Done!');
  } catch (error) {
    console.error('Error:', error);
  }
}

extractSheets();
