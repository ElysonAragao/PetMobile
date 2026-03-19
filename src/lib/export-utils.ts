import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Cross-browser file download.
 * Uses the modern File System Access API (showSaveFilePicker) on Chrome for
 * reliable filename and folder control. Falls back to blob URL for other browsers.
 */
export async function downloadFile(content: string | Blob, filename: string, mimeType: string) {
    const blob = typeof content === 'string' ? new Blob([content], { type: mimeType }) : content;

    // Modern Chrome: use File System Access API for reliable save dialog
    if ('showSaveFilePicker' in window) {
        try {
            const ext = '.' + (filename.split('.').pop() || 'txt');
            const handle = await (window as any).showSaveFilePicker({
                suggestedName: filename,
                types: [{
                    description: filename,
                    accept: { [mimeType.split(';')[0]]: [ext] }
                }]
            });
            const writable = await handle.createWritable();
            await writable.write(blob);
            await writable.close();
            return;
        } catch (e: any) {
            // User cancelled the dialog
            if (e.name === 'AbortError') return;
            // If API failed for other reasons, fall through to legacy method
            console.warn('showSaveFilePicker failed, using fallback:', e);
        }
    }

    // Fallback for browsers that don't support showSaveFilePicker
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 10000);
}

export async function exportToCSV(filename: string, rows: object[]) {
    if (!rows || !rows.length) return;
    const separator = ';';
    const keys = Object.keys(rows[0]);

    let csvContent = '\uFEFF';
    csvContent += keys.join(separator) + '\r\n';

    for (const row of rows) {
        const values = keys.map(k => {
            let cell = (row as any)[k] === null || (row as any)[k] === undefined ? '' : String((row as any)[k]);
            cell = cell.replace(/"/g, '""');
            if (cell.search(/("|,|\n)/g) >= 0 || cell.includes(separator)) {
                cell = `"${cell}"`;
            }
            return cell;
        });
        csvContent += values.join(separator) + '\r\n';
    }

    await downloadFile(csvContent, `${filename}.csv`, 'text/csv');
}

export async function exportToJSON(filename: string, rows: object[]) {
    if (!rows || !rows.length) return;
    const content = JSON.stringify(rows, null, 2);
    await downloadFile(content, `${filename}.json`, 'application/json');
}

export async function exportToTXT(filename: string, rows: object[]) {
    if (!rows || !rows.length) return;
    const keys = Object.keys(rows[0]);

    let txt = `=== ${filename.toUpperCase().replace(/_/g, ' ')} ===\n\n`;

    rows.forEach((row, index) => {
        txt += `--- REGISTRO ${index + 1} ---\n`;
        keys.forEach(k => {
            txt += `${k}: ${(row as any)[k] || '-'}\n`;
        });
        txt += '\n';
    });

    await downloadFile(txt, `${filename}.txt`, 'text/plain');
}

export async function exportToXML(filename: string, rows: object[]) {
    if (!rows || !rows.length) return;
    const keys = Object.keys(rows[0]);

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<relatorio>\n';

    rows.forEach(row => {
        xml += '  <registro>\n';
        keys.forEach(k => {
            const safeKey = k.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
            const val = (row as any)[k] || '';
            const safeVal = String(val)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&apos;');
            xml += `    <${safeKey || 'col'}>${safeVal}</${safeKey || 'col'}>\n`;
        });
        xml += '  </registro>\n';
    });

    xml += '</relatorio>\n';
    await downloadFile(xml, `${filename}.xml`, 'application/xml');
}

export async function exportToPDF(filename: string, title: string, rows: object[]) {
    if (!rows || !rows.length) return;
    const doc = new jsPDF('landscape');

    doc.setFontSize(16);
    doc.text(title, 14, 20);
    doc.setFontSize(10);
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 28);

    const keys = Object.keys(rows[0]);
    const body = rows.map(r => keys.map(k => String((r as any)[k] || '-')));

    autoTable(doc, {
        head: [keys],
        body: body,
        startY: 35,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [41, 128, 185] },
    });

    // jsPDF save uses its own blob mechanism, but let's use our reliable method
    const pdfBlob = doc.output('blob');
    await downloadFile(pdfBlob, `${filename}.pdf`, 'application/pdf');
}
