import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Sale } from '../types/pos';
import { formatRupiah, formatDateTime } from './formatters';

export interface ExportPdfOptions {
  startDate?: string;
  endDate?: string;
  searchQuery?: string;
  generatedBy?: string;
}

export function exportTransactionsToPdf(sales: Sale[], options: ExportPdfOptions = {}) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();

  // 1. Header Banner
  doc.setFillColor(30, 41, 59); // Slate-800
  doc.rect(0, 0, pageWidth, 28, 'F');

  // Accent Line
  doc.setFillColor(245, 158, 11); // Amber-500
  doc.rect(0, 27, pageWidth, 2, 'F');

  // Title & Subtitle in Header
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('MOTOPOS - BENGKEL & SPAREPART MOTOR', 14, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225); // Slate-300
  doc.text('Laporan Riwayat Transaksi & Nota Penjualan Kasir', 14, 18);

  // Date Generated on Right Header
  const printDateStr = new Date().toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  doc.setFontSize(8);
  doc.setTextColor(226, 232, 240);
  doc.text(`Waktu Unduh: ${printDateStr}`, pageWidth - 14, 12, { align: 'right' });
  if (options.generatedBy) {
    doc.text(`Dicetak Oleh: ${options.generatedBy}`, pageWidth - 14, 18, { align: 'right' });
  }

  // 2. Filter & Summary Metadata Section
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('PARAMETER FILTER & RINGKASAN:', 14, 37);

  // Periode text
  let periodeText = 'Semua Transaksi';
  if (options.startDate && options.endDate) {
    if (options.startDate === options.endDate) {
      periodeText = `Tanggal: ${options.startDate}`;
    } else {
      periodeText = `${options.startDate} s/d ${options.endDate}`;
    }
  } else if (options.startDate) {
    periodeText = `Mulai ${options.startDate}`;
  } else if (options.endDate) {
    periodeText = `Sampai ${options.endDate}`;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Periode: `, 14, 43);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(periodeText, 30, 43);

  if (options.searchQuery) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`Kata Kunci: `, 14, 48);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`"${options.searchQuery}"`, 33, 48);
  }

  // Summary Metrics Box
  const totalSalesCount = sales.length;
  const totalAmount = sales.reduce((acc, curr) => acc + (curr.total_amount || 0), 0);
  const cashCount = sales.filter((s) => (s.payment_method || '').toUpperCase() === 'CASH').length;
  const nonCashCount = totalSalesCount - cashCount;

  const boxY = options.searchQuery ? 52 : 47;
  const boxWidth = pageWidth - 28;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, boxY, boxWidth, 14, 2, 2, 'FD');

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  doc.text('Total Transaksi', 20, boxY + 5);
  doc.text('Total Nominal (Omzet)', 70, boxY + 5);
  doc.text('Metode Pembayaran', 140, boxY + 5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`${totalSalesCount} Nota`, 20, boxY + 10.5);

  doc.setTextColor(217, 119, 6); // Amber-600
  doc.text(formatRupiah(totalAmount), 70, boxY + 10.5);

  doc.setTextColor(51, 65, 85);
  doc.setFontSize(8.5);
  doc.text(`Tunai: ${cashCount} | Non-Tunai: ${nonCashCount}`, 140, boxY + 10.5);

  // 3. Table Rows
  const tableStartY = boxY + 18;

  const tableBody = sales.map((s, index) => {
    const vehicleInfo = s.plate_number
      ? `${s.plate_number} (${s.brand_model || '-'})`
      : 'Umum (Tanpa Motor)';
    return [
      (index + 1).toString(),
      s.invoice_number,
      formatDateTime(s.sale_date),
      vehicleInfo,
      s.mechanic_name || '-',
      (s.payment_method || 'CASH').toUpperCase(),
      formatRupiah(s.total_amount),
    ];
  });

  autoTable(doc, {
    startY: tableStartY,
    margin: { left: 14, right: 14 },
    head: [['No', 'No. Nota', 'Waktu Transaksi', 'Kendaraan / Pelanggan', 'Mekanik', 'Metode', 'Total']],
    body: tableBody,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [71, 85, 105],
      fontStyle: 'bold',
      fontSize: 8,
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 32, fontStyle: 'bold' },
      2: { cellWidth: 32 },
      3: { cellWidth: 42 },
      4: { cellWidth: 26 },
      5: { cellWidth: 18, halign: 'center' },
      6: { cellWidth: 24, halign: 'right', fontStyle: 'bold' },
    },
    alternateRowStyles: {
      fillColor: [255, 255, 255],
    },
    foot: [
      [
        { content: 'TOTAL KESELURUHAN', colSpan: 6, styles: { halign: 'right', fontStyle: 'bold' } },
        { content: formatRupiah(totalAmount), styles: { halign: 'right', fontStyle: 'bold', textColor: [217, 119, 6] } },
      ],
    ],
    footStyles: {
      fillColor: [248, 250, 252],
      textColor: [15, 23, 42],
    },
    didDrawPage: (data) => {
      // Footer page numbering
      const str = `Halaman ${data.pageNumber}`;
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(str, pageWidth / 2, doc.internal.pageSize.getHeight() - 8, { align: 'center' });
      doc.text('MotoPOS Bengkel & Kasir Otomotif', 14, doc.internal.pageSize.getHeight() - 8);
    },
  });

  // Save / Trigger Download
  const filenameDate = (options.startDate || new Date().toISOString().slice(0, 10)).replace(/-/g, '');
  const fileName = `Laporan_Transaksi_MotoPOS_${filenameDate}.pdf`;
  doc.save(fileName);
}
