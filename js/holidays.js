/* ==========================================================================
   SICART Scheduling System - Holiday Manager
   Handles automatic Sundays and manual public/institutional holidays
   ========================================================================== */

const HolidayManager = (() => {
    let holidays = {}; // Map: 'YYYY-MM-DD' => 'Holiday Name'

    function load() {
        holidays = StorageManager.get(StorageManager.KEYS.HOLIDAYS, {});
        return holidays;
    }

    function save() {
        StorageManager.set(StorageManager.KEYS.HOLIDAYS, holidays);
    }

    function getAll() {
        if (!holidays || Object.keys(holidays).length === 0) load();
        return { ...holidays };
    }

    /**
     * Get all holidays for a specific month and year
     * @param {number} year 
     * @param {number} month (1-12)
     */
    function getHolidaysForMonth(year, month) {
        const all = getAll();
        const prefix = `${year}-${String(month).padStart(2, '0')}`;
        const monthHolidays = [];

        Object.keys(all).forEach(dateISO => {
            if (dateISO.startsWith(prefix)) {
                monthHolidays.push({
                    dateISO,
                    name: all[dateISO]
                });
            }
        });

        // Sort by date
        monthHolidays.sort((a, b) => a.dateISO.localeCompare(b.dateISO));
        return monthHolidays;
    }

    /**
     * Checks if a date is Sunday
     * @param {string} dateISO 'YYYY-MM-DD'
     */
    function isSunday(dateISO) {
        if (!dateISO) return false;
        const [y, m, d] = dateISO.split('-').map(Number);
        const dt = new Date(y, m - 1, d);
        return dt.getDay() === 0;
    }

    /**
     * Checks if a date is a holiday (Sunday OR manually configured)
     */
    function isHoliday(dateISO) {
        if (isSunday(dateISO)) return true;
        const all = getAll();
        return Boolean(all[dateISO]);
    }

    /**
     * Returns the name/label of the holiday, or null
     */
    function getHolidayName(dateISO) {
        if (isSunday(dateISO)) return 'Sunday';
        const all = getAll();
        return all[dateISO] || null;
    }

    /**
     * Add or update a manual holiday
     */
    function setHoliday(dateISO, name) {
        if (!dateISO) return false;
        if (isSunday(dateISO)) {
            // Already a Sunday holiday
            return false;
        }
        holidays[dateISO] = (name || 'Public Holiday').trim();
        save();
        return true;
    }

    /**
     * Remove a manual holiday
     */
    function removeHoliday(dateISO) {
        if (holidays[dateISO]) {
            delete holidays[dateISO];
            save();
            return true;
        }
        return false;
    }

    return {
        load,
        getAll,
        getHolidaysForMonth,
        isSunday,
        isHoliday,
        getHolidayName,
        setHoliday,
        removeHoliday
    };
})();
