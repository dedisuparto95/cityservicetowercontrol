const { google } = require('googleapis');
require('dotenv').config();

// Memanggil dan membaca file JSON secara utuh dari Vercel
// Pastikan variabel GOOGLE_CREDS_JSON sudah ada di Vercel dan berisi SELURUH teks JSON
const creds = JSON.parse(process.env.GOOGLE_CREDS_JSON);

const auth = new google.auth.GoogleAuth({
    credentials: {
        client_email: creds.client_email,
        private_key: creds.private_key
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
});

const sheets = google.sheets({ version: 'v4', auth });
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

const googleSheetsService = {
    // 1. FUNGSI MEMBACA DATA
    async getRows(sheetName) {
        try {
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: sheetName,
            });
            const rows = response.data.values;
            if (!rows || rows.length === 0) return [];

            let headerIndex = 0;
            if (rows[0].length <= 1 || (rows[1] && rows[1].includes('project_id'))) {
                headerIndex = 1;
            }
            const headers = rows[headerIndex];
            
            const data = rows.slice(headerIndex + 1).map(row => {
                const rowData = {};
                headers.forEach((header, index) => {
                    if (header && header.trim() !== '') {
                        rowData[header.trim()] = row[index] || null;
                    }
                });
                return rowData;
            });
            return data;
        } catch (error) {
            console.error(`Error reading sheet ${sheetName}:`, error);
            throw error;
        }
    },

    // 2. FUNGSI MENULIS/MENAMBAH BARIS BARU
    async appendRow(sheetName, rowData) {
        try {
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: `${sheetName}!A1:Z2`,
            });
            const rows = response.data.values;
            let headerIndex = 0;
            if (rows[0].length <= 1 || (rows[1] && rows[1].includes('project_id'))) headerIndex = 1;
            const headers = rows[headerIndex];

            const values = headers.map(header => {
                const key = header.trim();
                return rowData[key] !== undefined ? rowData[key] : "";
            });

            await sheets.spreadsheets.values.append({
                spreadsheetId: SPREADSHEET_ID,
                range: sheetName,
                valueInputOption: 'USER_ENTERED',
                resource: { values: [values] }
            });
            return true;
        } catch (error) {
            console.error("Error append row:", error);
            throw error;
        }
    },

    // 3. FUNGSI UPDATE/EDIT DATA
    async updateRow(sheetName, idColumnName, idValue, rowData) {
        try {
            // 1. Tarik semua data untuk mencari baris mana yang mau diedit
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: `${sheetName}!A1:Z`,
            });
            const rows = response.data.values;
            if (!rows || rows.length === 0) throw new Error("Sheet kosong");

            let headerIndex = 0;
            if (rows[0].length <= 1 || (rows[1] && rows[1].includes(idColumnName))) {
                headerIndex = 1;
            }
            const headers = rows[headerIndex].map(h => h.trim());
            const idColIndex = headers.indexOf(idColumnName);

            if (idColIndex === -1) throw new Error(`Kolom ${idColumnName} tidak ditemukan`);

            // 2. Cari index barisnya
            let rowIndexToUpdate = -1;
            for (let i = headerIndex + 1; i < rows.length; i++) {
                if (rows[i] && rows[i][idColIndex] === idValue) {
                    rowIndexToUpdate = i;
                    break;
                }
            }

            if (rowIndexToUpdate === -1) throw new Error(`Data dengan ID ${idValue} tidak ditemukan`);

            // 3. Siapkan data baru (Timpa yang lama, biarkan yang tidak diubah)
            const updatedValues = headers.map((header, index) => {
                const key = header;
                if (rowData[key] !== undefined) return rowData[key];
                return rows[rowIndexToUpdate][index] || "";
            });

            // 4. Update langsung ke baris tersebut (index array + 1 = baris di GSheets)
            const sheetRowNumber = rowIndexToUpdate + 1;
            await sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range: `${sheetName}!A${sheetRowNumber}:Z${sheetRowNumber}`,
                valueInputOption: 'USER_ENTERED',
                resource: { values: [updatedValues] }
            });
            return true;
        } catch (error) {
            console.error("Error update row:", error);
            throw error;
        }
    },

    // 4. GENERATOR ID UNIK
    generateUniqueId(prefix) {
        const d = new Date();
        const yearMonth = `${d.getFullYear()}${(d.getMonth()+1).toString().padStart(2, '0')}`;
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        return `${prefix}-${yearMonth}-${random}`;
    }
};

module.exports = googleSheetsService;