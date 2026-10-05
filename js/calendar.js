/* ==========================================================================
   SICART Scheduling System - Calendar & Date Engine
   Handles dynamic calendar dates, leap years, weekdays, Sundays
   ========================================================================== */

const CalendarEngine = (() => {
    const MONTH_NAMES = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const DAY_NAMES = [
        'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
    ];

    const SHORT_DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    /**
     * Determines whether a given year is a leap year
     * @param {number} year 
     * @returns {boolean}
     */
    function isLeapYear(year) {
        return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
    }

    /**
     * Returns total days in a month for a specific year
     * @param {number} year 
     * @param {number} month (1-12)
     * @returns {number}
     */
    function getDaysInMonth(year, month) {
        // month is 1-indexed here, Date(year, month, 0) gives last day of month
        return new Date(year, month, 0).getDate();
    }

    /**
     * Formats a date into YYYY-MM-DD
     */
    function formatDateISO(year, month, day) {
        const y = String(year);
        const m = String(month).padStart(2, '0');
        const d = String(day).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    /**
     * Formats a date into DD-MM-YYYY (SICART display standard)
     */
    function formatDateDisplay(year, month, day) {
        const y = String(year);
        const m = String(month).padStart(2, '0');
        const d = String(day).padStart(2, '0');
        return `${d}-${m}-${y}`;
    }

    /**
     * Parses YYYY-MM-DD to display string DD-MM-YYYY
     */
    function isoToDisplay(isoStr) {
        if (!isoStr) return '';
        const parts = isoStr.split('-');
        if (parts.length === 3) {
            return `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
        return isoStr;
    }

    /**
     * Generates all days of the month with metadata:
     * dateISO, dateDisplay, day, dayName, isSunday, isManualHoliday, holidayName
     * @param {number} year 
     * @param {number} month (1-12)
     * @param {Object} manualHolidays map of 'YYYY-MM-DD' => holiday name
     */
    function generateMonthDays(year, month, manualHolidays = {}) {
        const totalDays = getDaysInMonth(year, month);
        const days = [];

        for (let d = 1; d <= totalDays; d++) {
            const dateObj = new Date(year, month - 1, d);
            const dayOfWeek = dateObj.getDay(); // 0 is Sunday
            const dayName = DAY_NAMES[dayOfWeek];
            const dateISO = formatDateISO(year, month, d);
            const dateDisplay = formatDateDisplay(year, month, d);
            const isSunday = (dayOfWeek === 0);
            const manualHolidayName = manualHolidays[dateISO] || null;
            const isHoliday = isSunday || Boolean(manualHolidayName);

            days.push({
                day: d,
                dateObj: dateObj,
                dateISO: dateISO,
                dateDisplay: dateDisplay,
                dayOfWeek: dayOfWeek,
                dayName: dayName,
                shortDayName: SHORT_DAY_NAMES[dayOfWeek],
                isSunday: isSunday,
                manualHolidayName: manualHolidayName,
                isHoliday: isHoliday,
                holidayLabel: isSunday ? 'Holiday' : (manualHolidayName || '')
            });
        }

        return days;
    }

    /**
     * Quick summary statistics for a given month
     */
    function getMonthStats(year, month, manualHolidays = {}) {
        const days = generateMonthDays(year, month, manualHolidays);
        let sundays = 0;
        let otherHolidays = 0;
        let workingDays = 0;

        days.forEach(d => {
            if (d.isSunday) {
                sundays++;
            } else if (d.manualHolidayName) {
                otherHolidays++;
            } else {
                workingDays++;
            }
        });

        return {
            totalDays: days.length,
            sundays,
            otherHolidays,
            totalHolidays: sundays + otherHolidays,
            workingDays
        };
    }

    return {
        MONTH_NAMES,
        DAY_NAMES,
        SHORT_DAY_NAMES,
        isLeapYear,
        getDaysInMonth,
        formatDateISO,
        formatDateDisplay,
        isoToDisplay,
        generateMonthDays,
        getMonthStats
    };
})();
