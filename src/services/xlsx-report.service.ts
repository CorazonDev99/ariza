import ExcelJS from 'exceljs';
import type { PaymentExportRow, StatsPeriod } from '../repositories/admin.repository';
import type { Locale } from '../i18n';
import { t } from '../i18n';

export interface PaymentReportResult {
  buffer: Buffer;
  filename: string;
  rowCount: number;
  paidSum: number;
}

/**
 * Builds an .xlsx workbook for a given period's payments. Columns are
 * fixed and labelled in the admin's locale; the sheet has freeze-panes
 * on the header row and reasonable auto-widths.
 */
export class XlsxReportService {
  async buildPaymentsReport(
    rows: PaymentExportRow[],
    period: StatsPeriod,
    locale: Locale,
  ): Promise<PaymentReportResult> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'raport-bot';
    wb.created = new Date();

    const sheet = wb.addWorksheet(t(locale, `admin.period.${period}`), {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    sheet.columns = [
      { header: '#', key: 'id', width: 8 },
      { header: t(locale, 'xlsx.col.createdAt'), key: 'createdAt', width: 20 },
      { header: t(locale, 'xlsx.col.paidAt'), key: 'paidAt', width: 20 },
      { header: t(locale, 'xlsx.col.status'), key: 'status', width: 14 },
      { header: t(locale, 'xlsx.col.provider'), key: 'provider', width: 10 },
      { header: t(locale, 'xlsx.col.amount'), key: 'amount', width: 14 },
      { header: t(locale, 'xlsx.col.merchantTransId'), key: 'merchantTransId', width: 32 },
      { header: t(locale, 'xlsx.col.providerTransId'), key: 'providerTransId', width: 22 },
      { header: t(locale, 'xlsx.col.userId'), key: 'userId', width: 10 },
      { header: t(locale, 'xlsx.col.telegramId'), key: 'telegramId', width: 16 },
      { header: t(locale, 'xlsx.col.username'), key: 'username', width: 18 },
      { header: t(locale, 'xlsx.col.firstName'), key: 'firstName', width: 18 },
      { header: t(locale, 'xlsx.col.lastName'), key: 'lastName', width: 18 },
    ];

    // Bold header row + grey background.
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFEEEEEE' },
    };

    let paidSum = 0;
    for (const r of rows) {
      if (r.status === 'paid') paidSum += r.amount;
      sheet.addRow({
        id: r.id,
        createdAt: r.createdAt,
        paidAt: r.paidAt,
        status: t(locale, `xlsx.status.${r.status}`) || r.status,
        provider: r.provider,
        amount: r.amount,
        merchantTransId: r.merchantTransId,
        providerTransId: r.providerTransId ?? '',
        userId: r.userId,
        telegramId: r.telegramId.toString(),
        username: r.username ?? '',
        firstName: r.firstName ?? '',
        lastName: r.lastName ?? '',
      });
    }

    // Date cells use a human-readable format. Telegram BigInt is stored as
    // string above so Excel doesn't truncate the precision.
    sheet.getColumn('createdAt').numFmt = 'yyyy-mm-dd hh:mm:ss';
    sheet.getColumn('paidAt').numFmt = 'yyyy-mm-dd hh:mm:ss';
    sheet.getColumn('amount').numFmt = '#,##0';

    // Auto filter on the header row for quick sorting/filtering.
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: sheet.columns.length },
    };

    const arrayBuffer = await wb.xlsx.writeBuffer();
    const buffer = Buffer.from(arrayBuffer as ArrayBuffer);

    const now = new Date();
    const ts = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
    const filename = `payments_${period}_${ts}.xlsx`;

    return {
      buffer,
      filename,
      rowCount: rows.length,
      paidSum,
    };
  }
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}
