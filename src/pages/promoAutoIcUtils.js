/**
 * Utility functions for Auto-IC Promotion Generation.
 * Strictly ported from the user's VBA code.
 */

import * as XLSX from 'xlsx';

const IC_TEMPLATE_HEADERS = [
  "PromotionCode",
  "PromotionDescription",
  "PromotionType",
  "NationalBudget",
  "TestScheme",
  "BuyBase",
  "GetBase",
  "MultiplicationFactor",
  "StartDate",
  "EndDate",
  "PromotionStatus",
  "PromotionQuotaLevel",
  "PromotionQuotaOn",
  "PromotionClaimable",
  "OPSOID",
  "MaxInvoicesperOutlet",
  "MinBuySKUs",
  "PromotionUOM",
  "AlternatePromotionDescription",
  "UserExpire",
  "PromotionSlab",
  "PromotionSlabDescription",
  "RangeLow",
  "RangeHigh",
  "PromotionReturn",
  "ForEvery",
  "PurchaseLimit",
  "ProductHierarchyLevel",
  "ProductHierarchyCode",
  "Exclude",
  "ConditionGroup",
  "GroupType",
  "MinimumQty",
  "BasketPromotion",
  "CriteriaType",
  "CriteriaValue",
  "CriteriaExclude"
];

/**
 * Process the Monthly IC Promotion source file (CommandButton29_Click).
 * @param {File} file - The uploaded Excel file.
 * @returns {Promise<{icMain: Array, icSku: Array, icMainOut: Array}>}
 */
export async function processMonthlyIcPromotion(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        // Keep Excel dates as raw serial values so browser timezone does not
        // shift the calendar day before we format it.
        const workbook = XLSX.read(data, { type: 'array', cellDates: false, cellNF: false });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert to array of arrays (VBA-style rows)
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });

        if (rows.length === 0) throw new Error("Source workbook is empty.");

        // --- VBA: lastRow calculation (max of col D and col N) ---
        const getLastUsedRow = (data, colIdx) => {
          for (let i = data.length - 1; i >= 0; i--) {
            if (data[i][colIdx] !== null && data[i][colIdx] !== undefined && data[i][colIdx] !== "") return i + 1;
          }
          return 0;
        };
        const lastRowD = getLastUsedRow(rows, 3); // D (index 3)
        const lastRowN = getLastUsedRow(rows, 13); // N (index 13)
        const lastRow = Math.max(lastRowD, lastRowN);
        if (lastRow === 0) throw new Error("No data found in rows D or N.");

        // Truncate to used range
        const sourceData = rows.slice(0, lastRow);

        // ==================================================
        // ===============    IC MAIN (VBA)   ===============
        // ==================================================
        // VBA copy logic:
        // targetWs.Range("A1").Resize(lastRow, 13).Value2 = .Range("A1").Resize(lastRow, 13).Value2
        // targetWs.Range("N1").Resize(lastRow, lastCol - 2).Value2 = .Range("P1").Resize(lastRow, lastCol).Value2
        // This drops original columns 13 (N) and 14 (O).
        let icMain = sourceData.map(row => {
          const part1 = row.slice(0, 13); // 0-12 (A-M)
          const part2 = row.slice(15);    // 15 onwards (P...)
          // In the new icMain, P maps to index 13, Q to 14, etc.
          return [...part1, ...part2];
        });

        // VBA: For i = lastRow To 5 Step -1 (Delete if D(i) and D(i-1) are blank)
        // VBA rows are 1-based. Row 5 is index 4.
        for (let i = icMain.length - 1; i >= 4; i--) {
          if (icMain[i][3] === "" && icMain[i - 1][3] === "") {
            icMain.splice(i, 1);
          }
        }

        // VBA: Numbering promo (For j = 5 To lastRow)
        // VBA checks O column for group breaks. O is index 14 in icMain.
        // Original Q was index 16. After dropping 13, 14: 
        // 0..12 -> 0..12
        // 13(N) dropped
        // 14(O) dropped
        // 15(P) -> 13
        // 16(Q) -> 14
        // So targetWs.Range("O") maps to original Q. Matches VBA's "O" in targetWs.
        let k_seq = 1, l_grp = 1;
        const colO = 14; 
        const colP = 15; // Seq column
        const colQ = 16; // Group column

        for (let i = 4; i < icMain.length; i++) {
          if (icMain[i][colO] === "") {
            k_seq = 1;
            l_grp++;
          } else {
            if (!icMain[i]) icMain[i] = [];
            icMain[i][colQ] = l_grp;
            icMain[i][colP] = k_seq;
            k_seq++;
          }
        }

        // VBA: For m = lastRow To 1 Step -1 (Delete if D is blank)
        for (let i = icMain.length - 1; i >= 0; i--) {
          if (icMain[i][3] === "") {
            icMain.splice(i, 1);
          }
        }

        // VBA: Fill down A,B,C if B is blank but D is not
        // The source workbooks also leave L/M blank on continuation rows,
        // so we carry those dates forward within the same promo block.
        for (let n = 1; n < icMain.length; n++) {
          const needsHeaderFill = isBlank(icMain[n][1]) && !isBlank(icMain[n][3]);
          if (needsHeaderFill) {
            icMain[n][0] = icMain[n - 1][0]; // A
            icMain[n][1] = icMain[n - 1][1]; // B
            icMain[n][2] = icMain[n - 1][2]; // C
          }

          const samePromotionBlock =
            !isBlank(icMain[n][1]) &&
            icMain[n][1] === icMain[n - 1][1];

          if (!isBlank(icMain[n][3]) && (needsHeaderFill || samePromotionBlock)) {
            if (isBlank(icMain[n][11])) {
              icMain[n][11] = icMain[n - 1][11]; // L
            }
            if (isBlank(icMain[n][12])) {
              icMain[n][12] = icMain[n - 1][12]; // M
            }
          }
        }

        // ==================================================
        // ===============    IC SKU (VBA)    ===============
        // ==================================================
        // VBA: targetSKU.Range("A1").Resize(lastRow, 2).Value2 = source.Range("N1").Resize(lastRow, 2)
        // This takes original N and O.
        let icSku = sourceData.map(row => [row[13] || "", row[14] || ""]); // Index 13, 14

        // VBA: Delete if A(i) and A(i-1) blank
        for (let a = icSku.length - 1; a >= 4; a--) {
          if (icSku[a][0] === "" && icSku[a - 1][0] === "") {
            icSku.splice(a, 1);
          }
        }

        // VBA: Numbering SKU groups (For b = 5 To lastRow)
        let c_sku_seq = 1, d_sku_grp = 1;
        for (let b = 4; b < icSku.length; b++) {
          if (icSku[b][0] === "") {
            c_sku_seq = 1;
            d_sku_grp++;
          } else {
            icSku[b][2] = c_sku_seq; // Col C
            icSku[b][3] = d_sku_grp; // Col D
            c_sku_seq++;
          }
        }

        // VBA: Delete if A is blank
        for (let e = icSku.length - 1; e >= 0; e--) {
          if (icSku[e][0] === "") {
            icSku.splice(e, 1);
          }
        }

        // ==================================================
        // =============== REPETITION COUNTS ================
        // ==================================================
        // VBA: R(X) = CountIf(SKU_D, Main_Q)
        // VBA: S(X) = R(X-1) + S(X-1), First S=2
        const sku_d_counts = {};
        icSku.forEach(row => {
          const grp = row[3];
          if (grp) sku_d_counts[grp] = (sku_d_counts[grp] || 0) + 1;
        });

        for (let x = 1; x < icMain.length; x++) {
          const qVal = icMain[x][colQ];
          icMain[x][17] = sku_d_counts[qVal] || 0; // Col R (index 17)

          if (x === 1) { // Row 2 in Excel
            icMain[x][18] = 2; // Col S (index 18)
          } else {
            const prevR = icMain[x - 1][17] || 0;
            const prevS = icMain[x - 1][18] || 0;
            icMain[x][18] = prevR + prevS;
          }
        }

        // ==================================================
        // =============== SKU ROW NO (XLOOKUP) =============
        // ==================================================
        // VBA: E(Y) = XLookup(SKU_D, Main_Q, Main_S)
        const main_q_s_lookup = {};
        icMain.forEach(row => {
          const groupId = row[colQ];
          if (
            !isBlank(groupId) &&
            !Object.prototype.hasOwnProperty.call(main_q_s_lookup, groupId)
          ) {
            main_q_s_lookup[groupId] = row[18];
          }
        });

        for (let y = 1; y < icSku.length; y++) {
          const skuGrp = icSku[y][3];
          icSku[y][4] = Object.prototype.hasOwnProperty.call(main_q_s_lookup, skuGrp)
            ? main_q_s_lookup[skuGrp]
            : "Not Found"; // Col E (Index 4)

          if (y > 1 && icSku[y][3] === icSku[y - 1][3]) {
            const previousRowNo = toFiniteNumber(icSku[y - 1][4]);
            icSku[y][4] = previousRowNo === null ? "Not Found" : previousRowNo + 1;
          }
        }

        // ==================================================
        // ===============    SUMMARY (U:Z)   ===============
        // ==================================================
        const icMainOut = [];
        let numb = 1;
        // VBA: For steps = 2 To lastRow
        for (let steps = 1; steps < icMain.length; steps++) {
          if (icMain[steps][1] === "" || icMain[steps][1] === "SchemePromotionNo") continue;
          icMainOut.push({
            No: numb++,
            SchemeID: icMain[steps][5],      // F
            SchemePromotionNumber: icMain[steps][1], // B
            SchemeDescription: icMain[steps][3],     // D
            PeriodFrom: formatDateStrict(icMain[steps][11]),    // L
            PeriodTo: formatDateStrict(icMain[steps][12]),      // M
          });
        }

        resolve({ icMain, icSku, icMainOut });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Build IC Template for Export (CommandButton31_Click).
 * @param {Array} icMain 
 * @param {Array} icSku 
 * @returns {Array} - Array of objects representing rows.
 */
export function buildIcTemplate(icMain, icSku) {
  const rows = [];
  
  // Outer loop: For i = 2 To ic_main.lastRow
  for (let i = 1; i < icMain.length; i++) {
    const repeatCount = parseInt(icMain[i][17] || 0); // Col R
    if (repeatCount <= 0) continue;

    for (let j = 0; j < repeatCount; j++) {
      rows.push({
        "PromotionCode": icMain[i][1], // B
        "PromotionDescription": icMain[i][3], // D
        "PromotionType": "T",
        "NationalBudget": "999999",
        "TestScheme": "1",
        "BuyBase": "3",
        "GetBase": "5",
        "MultiplicationFactor": "1",
        "StartDate": formatDateStrict(icMain[i][11]), // L
        "EndDate": formatDateStrict(icMain[i][12]),   // M
        "PromotionStatus": "1",
        "PromotionQuotaLevel": "SR",
        "PromotionQuotaOn": "D",
        "PromotionClaimable": "1",
        "OPSOID": icMain[i][5], // F
        "MaxInvoicesperOutlet": "99999",
        "MinBuySKUs": "0",
        "PromotionUOM": icMain[i][8], // I
        "AlternatePromotionDescription": "AlternatePromotionDescription",
        "UserExpire": "0",
        "PromotionSlab": "1",
        "PromotionSlabDescription": "PromotionSlab",
        "RangeLow": icMain[i][9], // J
        "RangeHigh": "999999",
        "PromotionReturn": icMain[i][10], // K
        "ForEvery": icMain[i][9], // J (VBA maps Z to J)
        "PurchaseLimit": "0",
        "ProductHierarchyLevel": "S",
        "ProductHierarchyCode": null, // Col AC filled later
        "Exclude": "0",
        "ConditionGroup": "1",
        "GroupType": "Q",
        "MinimumQty": "0",
        "BasketPromotion": "1",
        "CriteriaType": icMain[i][13], // N (Shaped from P original)
        "CriteriaValue": icMain[i][14], // O (Shaped from Q original)
        "CriteriaExclude": "0"
      });
    }
  }

  // Second Pass (SKU Mapping): For k = 2 To ic_sku.lastRow
  const qGrpIdxMain = 16; // Col Q
  const dGrpIdxSku = 3;  // Col D
  const eRowIdxSku = 4;  // Col E

  // VBA CountIf(Main Q, SKU D)
  const mainGrpCounts = {};
  icMain.forEach(row => {
    const qGrp = row[qGrpIdxMain];
    if (qGrp) mainGrpCounts[qGrp] = (mainGrpCounts[qGrp] || 0) + 1;
  });

  icSku.forEach(skuRow => {
    const skuCode = skuRow[0]; // A
    const skuGrp = skuRow[dGrpIdxSku]; // D
    const targetRowBase = toFiniteNumber(skuRow[eRowIdxSku]); // E

    if (!skuGrp || targetRowBase === null) return;

    // VBA logic: For l = 1 To CountIf(Main Q, SKU D)
    const repetitions = mainGrpCounts[skuGrp] || 0;
    // VBA: totalSKU = CountIf(SKU D, SKU D)
    const totalSkuInGrp = icSku.filter(r => r[dGrpIdxSku] === skuGrp).length;

    for (let l = 1; l <= repetitions; l++) {
        // VBA: Range("AC" & lastrow2 + (totalSKU * (l - 1)))
        const targetIdx = (targetRowBase + (totalSkuInGrp * (l - 1))) - 2;
        if (targetIdx >= 0 && targetIdx < rows.length) {
          rows[targetIdx]["ProductHierarchyCode"] = skuCode;
        }
    }
  });

  return rows;
}

/**
 * Export Template to Excel with specific formatting.
 */
export function exportToExcel(rows) {
  const worksheet = XLSX.utils.json_to_sheet(rows, {
    header: IC_TEMPLATE_HEADERS
  });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "IC Template");
  
  // Format numeric columns similar to VBA
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
  for (let R = range.s.r + 1; R <= range.e.r; ++R) {
    [24].forEach(colIdx => { // Y=24
      const cell = worksheet[XLSX.utils.encode_cell({ r: R, c: colIdx })];
      if (cell) {
        cell.t = 'n';
        cell.z = '0.00';
      }
    });
  }

  XLSX.writeFile(workbook, "IC_Promo.xlsx");
}

function formatDateStrict(val) {
  if (val === null || val === undefined || val === "") return "";
  const parts = toDateParts(val);
  if (!parts) return String(val);

  const day = String(parts.day).padStart(2, "0");
  const month = String(parts.month).padStart(2, "0");
  return `${day}/${month}/${parts.year}`;
}

function isBlank(val) {
  return val === null || val === undefined || (typeof val === "string" ? val.trim() === "" : val === "");
}

function toFiniteNumber(val) {
  const parsed = Number(val);
  return Number.isFinite(parsed) ? parsed : null;
}

function toDateParts(val) {
  if (val instanceof Date) {
    if (Number.isNaN(val.getTime())) return null;
    return {
      day: val.getDate(),
      month: val.getMonth() + 1,
      year: val.getFullYear()
    };
  }

  if (typeof val === "number") {
    const parsed = XLSX.SSF?.parse_date_code?.(val);
    if (parsed?.y && parsed?.m && parsed?.d) {
      return {
        day: parsed.d,
        month: parsed.m,
        year: parsed.y
      };
    }

    const d = new Date(Math.round((val - 25569) * 864e5));
    if (Number.isNaN(d.getTime())) return null;
    return {
      day: d.getUTCDate(),
      month: d.getUTCMonth() + 1,
      year: d.getUTCFullYear()
    };
  }

  if (typeof val === "string") {
    const trimmed = val.trim();
    if (!trimmed) return null;

    let match = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (match) {
      return {
        day: Number(match[1]),
        month: Number(match[2]),
        year: Number(match[3])
      };
    }

    match = trimmed.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})(?:[T\s].*)?$/);
    if (match) {
      return {
        day: Number(match[3]),
        month: Number(match[2]),
        year: Number(match[1])
      };
    }

    const d = new Date(trimmed);
    if (Number.isNaN(d.getTime())) return null;
    return {
      day: d.getDate(),
      month: d.getMonth() + 1,
      year: d.getFullYear()
    };
  }

  return null;
}
