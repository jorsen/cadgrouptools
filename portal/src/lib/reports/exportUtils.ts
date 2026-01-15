/**
 * Export utilities for financial reports
 * Supports PDF, CSV, and Excel exports
 */

import { message } from 'antd';
import dayjs from 'dayjs';

/**
 * Convert data to CSV format and trigger download
 */
export function exportToCSV(data: any[], filename: string, headers?: string[]) {
  try {
    if (!data || data.length === 0) {
      message.warning('No data to export');
      return;
    }

    // Get headers from first object if not provided
    const csvHeaders = headers || Object.keys(data[0]);
    
    // Create CSV content
    let csv = csvHeaders.join(',') + '\n';
    
    data.forEach(row => {
      const values = csvHeaders.map(header => {
        const value = row[header];
        // Handle values that might contain commas
        if (value === null || value === undefined) return '';
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      });
      csv += values.join(',') + '\n';
    });

    // Create blob and download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
    
    message.success('CSV exported successfully');
  } catch (error) {
    console.error('Error exporting CSV:', error);
    message.error('Failed to export CSV');
  }
}

/**
 * Convert nested report data to flat CSV format
 */
export function exportReportToCSV(reportData: any, reportType: string, companyName: string, period: string) {
  try {
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `${reportType}_${companyName.replace(/\s+/g, '_')}_${timestamp}`;

    switch (reportType) {
      case 'pl':
        exportPLToCSV(reportData, filename, period);
        break;
      case 'cashflow':
        exportCashFlowToCSV(reportData, filename, period);
        break;
      case 'expenses':
        exportExpensesToCSV(reportData, filename, period);
        break;
      case 'revenue':
        exportRevenueToCSV(reportData, filename, period);
        break;
      case 'transactions':
        exportTransactionsToCSV(reportData, filename);
        break;
      case 'checks':
        exportChecksToCSV(reportData, filename, period);
        break;
      default:
        message.warning('Export not implemented for this report type');
    }
  } catch (error) {
    console.error('Error exporting report:', error);
    message.error('Failed to export report');
  }
}

function exportPLToCSV(reportData: any, filename: string, period: string) {
  const rows: any[] = [];
  
  // Header rows
  rows.push({ section: 'Company', value: reportData.company.name });
  rows.push({ section: 'Period', value: period });
  rows.push({ section: '', value: '' });
  
  // Revenue section
  rows.push({ section: 'REVENUE', value: '' });
  reportData.revenue.categories.forEach((cat: any) => {
    rows.push({ 
      section: cat.name, 
      value: cat.amount.toFixed(2) 
    });
  });
  rows.push({ section: 'Total Revenue', value: reportData.revenue.total.toFixed(2) });
  rows.push({ section: '', value: '' });
  
  // Expenses section
  rows.push({ section: 'EXPENSES', value: '' });
  reportData.expenses.categories.forEach((cat: any) => {
    rows.push({ 
      section: cat.name, 
      value: cat.amount.toFixed(2) 
    });
  });
  rows.push({ section: 'Total Expenses', value: reportData.expenses.total.toFixed(2) });
  rows.push({ section: '', value: '' });
  
  // Net income
  rows.push({ section: 'Net Income', value: reportData.netIncome.toFixed(2) });
  rows.push({ section: 'Profit Margin', value: reportData.profitMargin.toFixed(2) + '%' });

  exportToCSV(rows, filename, ['Category', 'Amount']);
}

function exportCashFlowToCSV(reportData: any, filename: string, period: string) {
  const rows: any[] = [];
  
  rows.push({ section: 'Company', value: reportData.company.name });
  rows.push({ section: 'Period', value: period });
  rows.push({ section: '', value: '' });
  rows.push({ section: 'Beginning Cash', value: reportData.beginningCash.toFixed(2) });
  rows.push({ section: 'Ending Cash', value: reportData.endingCash.toFixed(2) });
  rows.push({ section: 'Net Change', value: reportData.netChange.toFixed(2) });
  rows.push({ section: '', value: '' });
  rows.push({ section: 'INFLOWS', value: '' });
  
  reportData.operatingActivities.inflows.forEach((txn: any) => {
    rows.push({
      date: dayjs(txn.date).format('YYYY-MM-DD'),
      description: txn.description,
      category: txn.category,
      amount: txn.amount.toFixed(2),
    });
  });
  
  rows.push({ section: '', value: '' });
  rows.push({ section: 'OUTFLOWS', value: '' });
  
  reportData.operatingActivities.outflows.forEach((txn: any) => {
    rows.push({
      date: dayjs(txn.date).format('YYYY-MM-DD'),
      description: txn.description,
      category: txn.category,
      amount: txn.amount.toFixed(2),
    });
  });

  exportToCSV(rows, filename);
}

function exportExpensesToCSV(reportData: any, filename: string, period: string) {
  const rows: any[] = [];
  
  reportData.categories.forEach((cat: any) => {
    rows.push({
      category: cat.name,
      amount: cat.amount.toFixed(2),
      percentage: cat.percentage.toFixed(2) + '%',
      transactions: cat.transactionCount,
    });
    
    // Add vendor breakdown
    if (cat.topVendors && cat.topVendors.length > 0) {
      cat.topVendors.forEach((vendor: any) => {
        rows.push({
          category: `  → ${vendor.vendor}`,
          amount: vendor.amount.toFixed(2),
          percentage: '',
          transactions: vendor.count,
        });
      });
    }
  });

  exportToCSV(rows, filename, ['Category', 'Amount', 'Percentage', 'Transactions']);
}

function exportRevenueToCSV(reportData: any, filename: string, period: string) {
  const rows: any[] = [];
  
  reportData.sources.forEach((source: any) => {
    rows.push({
      source: source.name,
      amount: source.amount.toFixed(2),
      percentage: source.percentage.toFixed(2) + '%',
      transactions: source.transactionCount,
    });
  });

  exportToCSV(rows, filename, ['Source', 'Amount', 'Percentage', 'Transactions']);
}

function exportTransactionsToCSV(reportData: any, filename: string) {
  const rows = reportData.transactions.map((txn: any) => ({
    date: dayjs(txn.date).format('YYYY-MM-DD'),
    description: txn.description,
    vendor: txn.vendor || '',
    category: txn.category?.name || '',
    subcategory: txn.subcategory?.name || '',
    amount: txn.amount.toFixed(2),
    direction: txn.direction,
    account: txn.account,
    status: txn.status,
    reconciled: txn.reconciled ? 'Yes' : 'No',
  }));

  exportToCSV(rows, filename);
}

function exportChecksToCSV(reportData: any, filename: string, period: string) {
  const rows: any[] = [];
  
  // Header rows
  rows.push({ col1: 'COMPANY:', col2: reportData.company?.name || 'Unknown' });
  rows.push({ col1: 'PERIOD:', col2: period });
  rows.push({ col1: '', col2: '' });
  
  // Column headers
  rows.push({
    checkNo: 'Check #',
    date: 'Date',
    payee: 'Payee',
    purpose: 'Purpose',
    amount: 'Amount',
  });
  
  // Check data
  if (reportData.checks) {
    reportData.checks.forEach((check: any) => {
      rows.push({
        checkNo: check.checkNo,
        date: dayjs(check.date).format('MM/DD/YYYY'),
        payee: check.vendor,
        purpose: check.purpose,
        amount: check.amount.toFixed(2),
      });
    });
    
    // Total row
    rows.push({
      checkNo: '',
      date: '',
      payee: '',
      purpose: 'TOTAL',
      amount: reportData.summary.totalAmount.toFixed(2),
    });
  }

  exportToCSV(rows, filename, ['Check #', 'Date', 'Payee', 'Purpose', 'Amount']);
}

/**
 * Export check register to Excel with bookkeeper-friendly formatting
 */
export async function exportChecksToExcel(checkData: any, companyName: string, monthName: string, year: string) {
  try {
    const XLSX = await import('xlsx');
    
    // Prepare data for Excel
    const data: any[] = [];
    
    // Header rows
    data.push(['COMPANY:', companyName]);
    data.push(['PERIOD:', `${monthName} ${year}`]);
    data.push([]); // Empty row
    
    // Column headers
    data.push(['Check #', 'Date', 'Payee', 'Purpose', 'Amount']);
    
    // Check rows
    checkData.checks.forEach((check: any) => {
      data.push([
        check.checkNo,
        dayjs(check.date).format('MM/DD/YYYY'),
        check.vendor,
        check.purpose,
        parseFloat(check.amount.toFixed(2)),
      ]);
    });
    
    // Total row
    data.push([
      '',
      '',
      '',
      'TOTAL',
      parseFloat(checkData.summary.totalAmount.toFixed(2)),
    ]);
    
    // Create worksheet
    const worksheet = XLSX.utils.aoa_to_sheet(data);
    
    // Set column widths
    worksheet['!cols'] = [
      { wch: 10 }, // Check #
      { wch: 12 }, // Date
      { wch: 25 }, // Payee
      { wch: 30 }, // Purpose
      { wch: 12 }, // Amount
    ];
    
    // Format amount column as currency (column E, starting from row 5)
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:E1');
    for (let R = 4; R <= range.e.r; R++) { // Start from data rows (after header)
      const cellAddress = XLSX.utils.encode_cell({ r: R, c: 4 }); // Column E (Amount)
      if (worksheet[cellAddress] && typeof worksheet[cellAddress].v === 'number') {
        worksheet[cellAddress].z = '$#,##0.00';
      }
    }
    
    // Create workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Check Register');
    
    // Generate filename
    const filename = `Check_Register_${companyName.replace(/\s+/g, '_')}_${monthName}_${year}.xlsx`;
    
    // Write file
    XLSX.writeFile(workbook, filename);
    message.success('Excel file exported successfully');
  } catch (error) {
    console.error('Error exporting checks to Excel:', error);
    message.error('Failed to export Excel file');
  }
}

/**
 * Export to Excel format (XLSX)
 * Requires: npm install xlsx
 */
export async function exportToExcel(data: any, filename: string, sheetName: string = 'Report') {
  try {
    // Dynamic import to avoid bundle bloat
    const XLSX = await import('xlsx');
    
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    
    XLSX.writeFile(workbook, `${filename}.xlsx`);
    message.success('Excel file exported successfully');
  } catch (error) {
    console.error('Error exporting Excel:', error);
    message.error('Failed to export Excel file. Make sure xlsx package is installed.');
  }
}

/**
 * Export report to PDF
 * Uses browser print dialog for now
 * Future: Implement jsPDF for custom PDF generation
 */
export function exportToPDF(elementId: string = 'report-content', filename: string) {
  try {
    // For now, use browser print dialog
    // The print CSS should be configured in globals.css
    window.print();
    message.info('Use your browser\'s print dialog to save as PDF');
  } catch (error) {
    console.error('Error exporting PDF:', error);
    message.error('Failed to export PDF');
  }
}

/**
 * Format currency for exports
 */
export function formatCurrencyForExport(value: number, currency: string = 'PHP'): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: currency,
  }).format(value);
}

/**
 * Format date for exports
 */
export function formatDateForExport(date: string | Date, format: string = 'YYYY-MM-DD'): string {
  return dayjs(date).format(format);
}


