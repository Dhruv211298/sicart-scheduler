/* ==========================================================================
   SICART Scheduling System - Print Engine
   Prepares document for high quality A4 Landscape printing
   ========================================================================== */

const PrintEngine = (() => {

    function prepareAndPrint() {
        // Ensure table is fully rendered in print-friendly mode
        const originalTitle = document.title;
        const year = SchedulerEngine.getYear();
        const month = SchedulerEngine.getMonth();
        const monthName = CalendarEngine.MONTH_NAMES[month - 1];

        document.title = `SICART_Schedule_${monthName}_${year}`;

        // Trigger print dialog
        window.print();

        // Restore title
        setTimeout(() => {
            document.title = originalTitle;
        }, 1000);
    }

    return {
        prepareAndPrint
    };
})();
