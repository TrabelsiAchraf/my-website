// scripts/lib/sales-parser.mjs
// Parses Apple Sales & Trends TSV reports (reportType SALES, subType SUMMARY).
// Columns are resolved by header name — real reports have ~25 columns.

const DOWNLOAD_TYPES = new Set(["1", "1F", "1T", "F1"]);
const REDOWNLOAD_TYPES = new Set(["3", "3F"]);
const UPDATE_TYPES = new Set(["7", "7F", "7T", "F7"]);

export function classifyProductType(productType) {
    if (DOWNLOAD_TYPES.has(productType)) return "download";
    if (REDOWNLOAD_TYPES.has(productType)) return "redownload";
    if (UPDATE_TYPES.has(productType)) return "update";
    return "other";
}

// "05/13/2026" -> "2026-05-13"
function isoDate(usDate) {
    const [mm, dd, yyyy] = usDate.split("/");
    return `${yyyy}-${mm}-${dd}`;
}

export function parseSalesReport(tsv) {
    const lines = tsv.split("\n").filter((line) => line.trim() !== "");
    if (lines.length < 2) return [];
    const headers = lines[0].split("\t");
    const iAppleId = headers.indexOf("Apple Identifier");
    const iTitle = headers.indexOf("Title");
    const iType = headers.indexOf("Product Type Identifier");
    const iUnits = headers.indexOf("Units");
    const iBegin = headers.indexOf("Begin Date");
    const iDevice = headers.indexOf("Device");
    const iCountry = headers.indexOf("Country Code");
    return lines.slice(1).map((line) => {
        const cells = line.split("\t");
        return {
            appleId: cells[iAppleId],
            title: cells[iTitle],
            productType: cells[iType],
            units: Number(cells[iUnits]),
            date: isoDate(cells[iBegin]),
            device: iDevice >= 0 ? cells[iDevice] : null,
            country: iCountry >= 0 ? cells[iCountry] : null,
        };
    });
}
