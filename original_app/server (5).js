const express = require("express");
// const cors = require("cors");
const { google } = require("googleapis");
const fs = require("fs");
const multer = require("multer");
const { Readable } = require("stream");

const app = express();
app.use(express.static("public"));
// app.use(cors());
// app.use(express.json());

const SHEET_ID = "1Www2I2wtdxsYyRJTBkaln_Ax5eRECZkBEZ04BXQ9B7I";
const DRIVE_FOLDER_ID = "1Y5L0sDgIQHHS2lZAYjL2z_zX3Imq1t5f";

let groupCount = 0;
function getCounts() {
    try {
        const countPath = "counts.json";
        const counts = JSON.parse(fs.readFileSync(countPath, "utf8"));
        groupCount = counts.groupCount;
    } catch (error) {
        console.error("Error reading counts.json:", error);
    }
}
function saveCounts() {
    try {
        const countPath = "counts.json";
        const counts = { groupCount };
        fs.writeFileSync(countPath, JSON.stringify(counts, null, 2), "utf8");
    } catch (error) {
        console.error("Error writing counts.json:", error);
    }
}
getCounts();

const recentIds = new Map();
const IDEMPOTENCY_TTL = 10_000; // 10 seconds
function remember(id) {
    const now = Date.now();
    recentIds.set(id, now);

    // Schedule auto-delete (no interval, no cleanup loop)
    setTimeout(() => {
        recentIds.delete(id);
    }, IDEMPOTENCY_TTL);
}
function seen(id) {
    return recentIds.has(id);
}

google.options({
    auth: new google.auth.GoogleAuth({
        keyFile: "bintang-homelab-9ed1dd7d4328.json",
        scopes: ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive"]
    })
});

app.get("/init", (req, res) => {
    const sheet = google.sheets("v4");
    sheet.spreadsheets.values.batchGet({
        spreadsheetId: SHEET_ID,
        ranges: ["Reimbursement!A2:O", "Config!A2:D"]
    }, (err, response) => {
        if (err) {
            console.error("The API returned an error: " + err);
            res.status(500).json({ error: "Failed to initialize sheet data" });
            return;
        }
        res.json(response.data);
    });
});

// async function getTableIds(spreadsheetId) {
//   const sheets = google.sheets("v4");

//   const res = await sheets.spreadsheets.get({
//     spreadsheetId: SHEET_ID,
//     includeGridData: false
//   });

//   const tables = [];

//   res.data.sheets.forEach(sheet => {
//     if (sheet.tables) {
//       sheet.tables.forEach(tbl => {
//         tables.push({
//           sheetTitle: sheet.properties.title,
//           sheetId: sheet.properties.sheetId,
//           tableId: tbl.tableId,
//           range: tbl.range
//         });
//       });
//     }
//   });

//   return tables;
// }

// app.get("/getid", async (req, res) => {
//     try {
//         const tables = await getTableIds(SHEET_ID);
//         res.json(tables);
//     } catch (error) {
//         console.error("Error fetching table IDs:", error);
//         res.status(500).json({ error: "Failed to fetch table IDs" });
//     }
// });           

function getYYMMDD() {
  // Get Jakarta time as a real Date object
  const jakarta = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" })
  );

  const yy = String(jakarta.getFullYear()).slice(2);
  const mm = String(jakarta.getMonth() + 1).padStart(2, "0");
  const dd = String(jakarta.getDate()).padStart(2, "0");

  return yy + mm + dd;
}
const upload = multer({ storage: multer.memoryStorage() });
function bufferToStream(buffer) {
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);
    return stream;
}
async function uploadParallelGrouped(files) {
    groupCount++;
    const drive = google.drive("v3");

    const finalResults = [];
    const itemUploadGroups = [];

    let lastField;
    let folderPromise = null;
    let uploadPromises = [];
    let itemIndex = 0;

    function startNewItem(fieldname) {
        lastField = fieldname;

        // Start subfolder creation immediately
        folderPromise = drive.files.create({
            supportsAllDrives: true,
            requestBody: {
                name: `${getYYMMDD()}-${groupCount}-${itemIndex}`,
                mimeType: "application/vnd.google-apps.folder",
                parents: [DRIVE_FOLDER_ID],
            },
        });

        // Push folder URL placeholder (keeps order)
        finalResults.push(
            folderPromise.then(r =>
                `https://drive.google.com/drive/folders/${r.data.id}`
            )
        );

        uploadPromises = [];

        // This group's final promise
        itemUploadGroups.push(
            folderPromise.then(() => Promise.all(uploadPromises))
        );

        itemIndex++;
    }

    // Walk files
    for (const file of files) {
        if (file.fieldname !== lastField) startNewItem(file.fieldname);

        const p = folderPromise.then(r =>
            drive.files.create({
                supportsAllDrives: true,
                requestBody: {
                    name: file.originalname,
                    parents: [r.data.id],
                },
                media: {
                    mimeType: file.mimetype,
                    body: bufferToStream(file.buffer),
                },
            })
        );

        uploadPromises.push(p);
    }

    // Wait for ALL items
    await Promise.all(itemUploadGroups);
    saveCounts();
    // Resolve folder URLs
    return Promise.all(finalResults);
}
app.post("/postreimburse", upload.any(), async (req, res) => {
    const { idemKey } = req.body;
    if (seen(idemKey)) return res.json({ status: "duplicate", ignored: true });
    remember(idemKey);
    
    const items = JSON.parse(req.body.items);   // already sorted
    const files = req.files;                    // already sorted
    const sheet = google.sheets("v4");

    try {
        // 1. Upload files → returns [link0, link1, link2, ...]
        const folderLinks = await uploadParallelGrouped(files);

        // safety check
        if (folderLinks.length !== items.length) {
            return res.status(500).json({
                error: "Mismatch between items and folderLinks length",
                items: items.length,
                folderLinks: folderLinks.length
            });
        }

        // 2. Build rows for sheets (1 row per item)
        const nowStr = new Date().toLocaleString("en-GB", {
            timeZone: "Asia/Jakarta",
            hour12: false,
        });
        const rows = items.map((item, i) => {
            const link = folderLinks[i];

            return {
                values: [
                    { userEnteredValue: { stringValue: nowStr } },               // 0
                    { userEnteredValue: { stringValue: req.body.requester } },   // 1
                    { userEnteredValue: { stringValue: item.project } },         // 2
                    { userEnteredValue: { stringValue: item.expenseDate } },     // 3
                    { userEnteredValue: { stringValue: item.description } },     // 4
                    { userEnteredValue: { numberValue: Number(item.amount) } },  // 5

                    // 6 — SMART CHIP
                    // {
                    //     userEnteredValue: { stringValue: "@" },
                    //     chipRuns: [
                    //         {
                    //             startIndex: 0,
                    //             chip: {
                    //                 richLinkProperties: {
                    //                     uri: link,
                    //                     mimeType: "application/vnd.google-apps.folder"
                    //                 }
                    //             }
                    //         }
                    //     ]
                    // },
                    { userEnteredValue: { stringValue: link } },

                    { userEnteredValue: { stringValue: "" } },                   // 7
                    { userEnteredValue: { stringValue: req.body.approver } },        // 8
                    { },                   // 9
                    { },                   // 10
                    { userEnteredValue: { stringValue: "Pending" } },                   // 11
                    { },                    // 12
                    { userEnteredValue: { formulaValue: "=VLOOKUP(INDIRECT(ADDRESS(ROW(), COLUMN() - 12)), Config!$B$2:$C$100, 2, FALSE)" } },
                    { userEnteredValue: { stringValue: "#"+ getYYMMDD() + "-" + groupCount}}
                ]
            };
        });

        // 3. Write all rows in one append
        await sheet.spreadsheets.batchUpdate({
        spreadsheetId: SHEET_ID,
        requestBody: {
            requests: [
                {
                    appendCells: {
                        sheetId: 0,
                        rows: rows,
                        fields: "userEnteredValue,chipRuns",
                        tableId: "754036740"
                    }
                }
            ],
            includeSpreadsheetInResponse: false,
            // "responseRanges": [
            //     string
            // ],
            // "responseIncludeGridData": boolean
        }
    });

        // 4. Done
        res.json({
            status: "OK",
            folderLinks,
        });

    } catch (error) {
        console.error("Error uploading/processing reimbursement:", error);
        res.status(500).json({ error: "Failed to upload or submit reimbursement"});
    }
});


app.listen();
