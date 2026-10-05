/* ==========================================================================
   SICART Scheduling System - Export / Import & Backup Engine
   Handles full JSON backup/restore and current-month CSV table export
   ========================================================================== */

const ExportEngine = (() => {

    /**
     * Download text/blob as file in browser
     */
    function triggerDownload(content, filename, contentType = 'application/json') {
        const blob = new Blob([content], { type: contentType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 2000);
    }

    /**
     * Export all data as JSON
     */
    function exportBackupJSON() {
        const data = StorageManager.exportAllData();
        const jsonStr = JSON.stringify(data, null, 2);
        const todayStr = new Date().toISOString().split('T')[0];
        const filename = `SICART_Schedule_Backup_${todayStr}.json`;
        triggerDownload(jsonStr, filename, 'application/json');
    }

    /**
     * Import full data from JSON file
     */
    function importBackupJSON(file) {
        return new Promise((resolve, reject) => {
            if (!file) {
                return reject(new Error('No file provided.'));
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const parsed = JSON.parse(e.target.result);
                    StorageManager.importAllData(parsed);
                    resolve(true);
                } catch (err) {
                    reject(new Error('Failed to parse backup file: ' + err.message));
                }
            };
            reader.onerror = () => reject(new Error('File reading error'));
            reader.readAsText(file);
        });
    }

    /**
     * Exports the active month's schedule as CSV
     */
    function exportMonthScheduleCSV(year, month) {
        const days = CalendarEngine.generateMonthDays(year, month, HolidayManager.getAll());
        const employees = EmployeeManager.getActive();
        const schedule = SchedulerEngine.getSchedule();
        const monthName = CalendarEngine.MONTH_NAMES[month - 1];

        // Headers
        const headers = ['Date', 'Day', ...employees.map(e => `"${e.name.replace(/"/g, '""')}"`)];
        const rows = [headers.join(',')];

        // Rows
        days.forEach(d => {
            const dateISO = d.dateISO;
            const dateDisplay = d.dateDisplay;
            const dayName = d.dayName;
            const rowCols = [dateDisplay, dayName];

            employees.forEach(emp => {
                const cell = (schedule[dateISO] && schedule[dateISO][emp.id]) || [];
                if (d.isSunday || d.manualHolidayName) {
                    rowCols.push('"Holiday"');
                } else if (cell.length === 0) {
                    rowCols.push('""');
                } else {
                    const formattedActs = cell.map(item => {
                        if (item.isHoliday) return 'Holiday';
                        const act = ActivityManager.getById(item.activityId);
                        const actName = act ? act.name : `Act#${item.activityId}`;
                        return `${actName}${item.symbol || ''}`;
                    });
                    rowCols.push(`"${formattedActs.join(' / ').replace(/"/g, '""')}"`);
                }
            });

            rows.push(rowCols.join(','));
        });

        const csvContent = rows.join('\r\n');
        const filename = `SICART_Work_Distribution_${monthName}_${year}.csv`;
        triggerDownload(csvContent, filename, 'text/csv;charset=utf-8;');
    }

    return {
        exportBackupJSON,
        importBackupJSON,
        exportMonthScheduleCSV
    };
})();
