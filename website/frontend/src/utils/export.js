import * as XLSX from 'xlsx';

export function exportData(data, format = 'csv', filename = 'carbonflux_archive') {
  if (!data || !data.length) return;

  const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
  const fullFilename = `${filename}_${dateStr}`;

  if (format === 'csv') {
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(k => {
        let val = row[k] ?? '';
        if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
          val = `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      }).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${fullFilename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } else if (format === 'xlsx') {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sensor Data");
    XLSX.writeFile(workbook, `${fullFilename}.xlsx`);
  }
}
