import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { requireAuth } from '@/lib/auth.js';
import path from 'path';
import fs from 'fs';

/**
 * File-level mutex to prevent concurrent read-modify-write on the Excel file.
 */
let _lock = Promise.resolve();
function withExcelLock(fn) {
  const prev = _lock;
  let resolve;
  _lock = new Promise(r => { resolve = r; });
  return prev.then(fn).finally(resolve);
}

/**
 * Get the path to the working Excel file.
 * On cold start, copies template to /tmp (writable in serverless).
 */
function getWorkingPath(conversationId) {
  const tmpDir = '/tmp';
  const fileName = `unit_economics_${conversationId || 'default'}.xlsx`;
  return path.join(tmpDir, fileName);
}

/**
 * POST /api/excel-fill
 * Accepts { patches: [{sheet, cell, value}, ...], conversationId? }
 * Applies patches to the working Excel file.
 */
export async function POST(request) {
  try {
    await requireAuth();
    const { patches, conversationId } = await request.json();

    if (!patches || !Array.isArray(patches) || patches.length === 0) {
      return NextResponse.json({ error: 'patches array is required' }, { status: 400 });
    }

    const result = await withExcelLock(async () => {
      const filePath = getWorkingPath(conversationId);
      let wb;

      // Load existing or create new
      if (fs.existsSync(filePath)) {
        wb = new ExcelJS.Workbook();
        await wb.xlsx.readFile(filePath);
      } else {
        // No existing file; patches will be queued but can't apply without template
        return { error: 'No workbook found. Generate the model first.', patchedCount: 0 };
      }

      let patchedCount = 0;
      const errors = [];

      for (const patch of patches) {
        try {
          const { sheet, cell, value, forceOverrideFormula } = patch;
          const ws = wb.getWorksheet(sheet);
          if (!ws) {
            errors.push(`Sheet "${sheet}" not found`);
            continue;
          }

          const targetCell = ws.getCell(cell);

          // Protect formula cells unless force override
          if (targetCell.formula && !forceOverrideFormula) {
            errors.push(`Cell ${sheet}!${cell} contains a formula \u2014 skipped`);
            continue;
          }

          targetCell.value = value;
          patchedCount++;
        } catch (e) {
          errors.push(`Error patching ${patch.sheet}!${patch.cell}: ${e.message}`);
        }
      }

      // Force recalculation on open
      wb.calcProperties = { fullCalcOnLoad: true };

      await wb.xlsx.writeFile(filePath);

      return { patchedCount, errors, total: patches.length };
    });

    return NextResponse.json(result);

  } catch (err) {
    if (err instanceof Response) return err;
    console.error('Excel fill error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
