/* ==========================================================================
   SICART Scheduling System - Rule-Based Scheduling Engine
   Generates, validates, balances, and manages monthly work distributions
   ========================================================================== */

const SchedulerEngine = (() => {
    let currentYear = 2026;
    let currentMonth = 10; // Default: October 2026 (matching official SICART reference schedule)
    let currentSchedule = {}; // { 'YYYY-MM-DD': { 'empId': [ { activityId, symbol, isHoliday } ] } }
    let isModified = false;

    // Authentic October 2026 Institutional Schedule from SICART Reference DOCX
    const OCTOBER_2026_SCHEDULE = {"2026-10-01":{"1":[{"activityId":12,"symbol":"✓✓","isHoliday":false}],"2":[{"activityId":13,"symbol":"✓","isHoliday":false}],"3":[{"activityId":5,"symbol":"","isHoliday":false}],"4":[{"activityId":3,"symbol":"","isHoliday":false}],"5":[{"activityId":4,"symbol":"","isHoliday":false}],"6":[{"activityId":6,"symbol":"","isHoliday":false}]},"2026-10-02":{"1":[{"activityId":14,"isHoliday":true,"symbol":""}],"2":[{"activityId":14,"isHoliday":true,"symbol":""}],"3":[{"activityId":14,"isHoliday":true,"symbol":""}],"4":[{"activityId":14,"isHoliday":true,"symbol":""}],"5":[{"activityId":14,"isHoliday":true,"symbol":""}],"6":[{"activityId":14,"isHoliday":true,"symbol":""}]},"2026-10-03":{"1":[{"activityId":1,"symbol":"*","isHoliday":false}],"2":[{"activityId":12,"symbol":"✓✓","isHoliday":false}],"3":[{"activityId":13,"symbol":"✓","isHoliday":false}],"4":[{"activityId":3,"symbol":"","isHoliday":false}],"5":[{"activityId":4,"symbol":"","isHoliday":false}],"6":[{"activityId":6,"symbol":"","isHoliday":false}]},"2026-10-04":{"1":[{"activityId":14,"isHoliday":true,"symbol":""}],"2":[{"activityId":14,"isHoliday":true,"symbol":""}],"3":[{"activityId":14,"isHoliday":true,"symbol":""}],"4":[{"activityId":14,"isHoliday":true,"symbol":""}],"5":[{"activityId":14,"isHoliday":true,"symbol":""}],"6":[{"activityId":14,"isHoliday":true,"symbol":""}]},"2026-10-05":{"1":[{"activityId":1,"symbol":"*","isHoliday":false}],"2":[{"activityId":2,"symbol":"","isHoliday":false}],"3":[{"activityId":12,"symbol":"✓✓","isHoliday":false}],"4":[{"activityId":13,"symbol":"✓","isHoliday":false}],"5":[{"activityId":4,"symbol":"","isHoliday":false}],"6":[{"activityId":6,"symbol":"","isHoliday":false}]},"2026-10-06":{"1":[{"activityId":13,"symbol":"✓","isHoliday":false}],"2":[{"activityId":2,"symbol":"","isHoliday":false}],"3":[{"activityId":5,"symbol":"","isHoliday":false}],"4":[{"activityId":12,"symbol":"✓✓","isHoliday":false}],"5":[{"activityId":4,"symbol":"","isHoliday":false}],"6":[{"activityId":6,"symbol":"","isHoliday":false}]},"2026-10-07":{"1":[{"activityId":12,"symbol":"✓✓","isHoliday":false}],"2":[{"activityId":13,"symbol":"✓","isHoliday":false}],"3":[{"activityId":5,"symbol":"","isHoliday":false}],"4":[{"activityId":3,"symbol":"","isHoliday":false}],"5":[{"activityId":4,"symbol":"","isHoliday":false}],"6":[{"activityId":7,"symbol":"","isHoliday":false}]},"2026-10-08":{"1":[{"activityId":1,"symbol":"*","isHoliday":false}],"2":[{"activityId":12,"symbol":"✓✓","isHoliday":false}],"3":[{"activityId":13,"symbol":"✓","isHoliday":false}],"4":[{"activityId":3,"symbol":"","isHoliday":false}],"5":[{"activityId":4,"symbol":"","isHoliday":false}],"6":[{"activityId":7,"symbol":"","isHoliday":false}]},"2026-10-09":{"1":[{"activityId":1,"symbol":"*","isHoliday":false}],"2":[{"activityId":2,"symbol":"","isHoliday":false}],"3":[{"activityId":12,"symbol":"✓✓","isHoliday":false}],"4":[{"activityId":13,"symbol":"✓","isHoliday":false}],"5":[{"activityId":4,"symbol":"","isHoliday":false}],"6":[{"activityId":7,"symbol":"","isHoliday":false}]},"2026-10-10":{"1":[{"activityId":13,"symbol":"✓","isHoliday":false}],"2":[{"activityId":2,"symbol":"","isHoliday":false}],"3":[{"activityId":5,"symbol":"","isHoliday":false}],"4":[{"activityId":12,"symbol":"✓✓","isHoliday":false}],"5":[{"activityId":4,"symbol":"","isHoliday":false}],"6":[{"activityId":7,"symbol":"","isHoliday":false}]},"2026-10-11":{"1":[{"activityId":14,"isHoliday":true,"symbol":""}],"2":[{"activityId":14,"isHoliday":true,"symbol":""}],"3":[{"activityId":14,"isHoliday":true,"symbol":""}],"4":[{"activityId":14,"isHoliday":true,"symbol":""}],"5":[{"activityId":14,"isHoliday":true,"symbol":""}],"6":[{"activityId":14,"isHoliday":true,"symbol":""}]},"2026-10-12":{"1":[{"activityId":13,"symbol":"✓","isHoliday":false}],"2":[{"activityId":2,"symbol":"","isHoliday":false}],"3":[{"activityId":5,"symbol":"","isHoliday":false}],"4":[{"activityId":3,"symbol":"","isHoliday":false}],"5":[{"activityId":4,"symbol":"","isHoliday":false}],"6":[{"activityId":12,"symbol":"✓✓","isHoliday":false}]},"2026-10-13":{"1":[{"activityId":12,"symbol":"✓✓","isHoliday":false}],"2":[{"activityId":13,"symbol":"✓","isHoliday":false}],"3":[{"activityId":5,"symbol":"","isHoliday":false}],"4":[{"activityId":3,"symbol":"","isHoliday":false}],"5":[{"activityId":4,"symbol":"","isHoliday":false}],"6":[{"activityId":8,"symbol":"","isHoliday":false}]},"2026-10-14":{"1":[{"activityId":1,"symbol":"*","isHoliday":false}],"2":[{"activityId":12,"symbol":"✓✓","isHoliday":false}],"3":[{"activityId":13,"symbol":"✓","isHoliday":false}],"4":[{"activityId":3,"symbol":"","isHoliday":false}],"5":[{"activityId":4,"symbol":"","isHoliday":false}],"6":[{"activityId":8,"symbol":"","isHoliday":false}]},"2026-10-15":{"1":[{"activityId":1,"symbol":"*","isHoliday":false}],"2":[{"activityId":2,"symbol":"","isHoliday":false}],"3":[{"activityId":12,"symbol":"✓✓","isHoliday":false}],"4":[{"activityId":13,"symbol":"✓","isHoliday":false}],"5":[{"activityId":4,"symbol":"","isHoliday":false}],"6":[{"activityId":8,"symbol":"","isHoliday":false}]},"2026-10-16":{"1":[{"activityId":1,"symbol":"*","isHoliday":false}],"2":[{"activityId":2,"symbol":"","isHoliday":false}],"3":[{"activityId":5,"symbol":"","isHoliday":false}],"4":[{"activityId":12,"symbol":"✓✓","isHoliday":false}],"5":[{"activityId":13,"symbol":"✓","isHoliday":false}],"6":[{"activityId":8,"symbol":"","isHoliday":false}]},"2026-10-17":{"1":[{"activityId":1,"symbol":"*","isHoliday":false}],"2":[{"activityId":2,"symbol":"","isHoliday":false}],"3":[{"activityId":5,"symbol":"","isHoliday":false}],"4":[{"activityId":3,"symbol":"","isHoliday":false}],"5":[{"activityId":12,"symbol":"✓✓","isHoliday":false}],"6":[{"activityId":13,"symbol":"✓","isHoliday":false}]},"2026-10-18":{"1":[{"activityId":14,"isHoliday":true,"symbol":""}],"2":[{"activityId":14,"isHoliday":true,"symbol":""}],"3":[{"activityId":14,"isHoliday":true,"symbol":""}],"4":[{"activityId":14,"isHoliday":true,"symbol":""}],"5":[{"activityId":14,"isHoliday":true,"symbol":""}],"6":[{"activityId":14,"isHoliday":true,"symbol":""}]},"2026-10-19":{"1":[{"activityId":13,"symbol":"✓","isHoliday":false}],"2":[{"activityId":2,"symbol":"","isHoliday":false}],"3":[{"activityId":5,"symbol":"","isHoliday":false}],"4":[{"activityId":3,"symbol":"","isHoliday":false}],"5":[{"activityId":4,"symbol":"","isHoliday":false}],"6":[{"activityId":12,"symbol":"✓✓","isHoliday":false}]},"2026-10-20":{"1":[{"activityId":14,"isHoliday":true,"symbol":""}],"2":[{"activityId":14,"isHoliday":true,"symbol":""}],"3":[{"activityId":14,"isHoliday":true,"symbol":""}],"4":[{"activityId":14,"isHoliday":true,"symbol":""}],"5":[{"activityId":14,"isHoliday":true,"symbol":""}],"6":[{"activityId":14,"isHoliday":true,"symbol":""}]},"2026-10-21":{"1":[{"activityId":1,"symbol":"*","isHoliday":false}],"2":[{"activityId":2,"symbol":"","isHoliday":false}],"3":[{"activityId":5,"symbol":"","isHoliday":false}],"4":[{"activityId":3,"symbol":"","isHoliday":false}],"5":[{"activityId":12,"symbol":"✓✓","isHoliday":false}],"6":[{"activityId":13,"symbol":"✓","isHoliday":false}]},"2026-10-22":{"1":[{"activityId":12,"symbol":"✓✓","isHoliday":false}],"2":[{"activityId":13,"symbol":"✓","isHoliday":false}],"3":[{"activityId":5,"symbol":"","isHoliday":false}],"4":[{"activityId":3,"symbol":"","isHoliday":false}],"5":[{"activityId":4,"symbol":"","isHoliday":false}],"6":[{"activityId":8,"symbol":"","isHoliday":false}]},"2026-10-23":{"1":[{"activityId":1,"symbol":"*","isHoliday":false}],"2":[{"activityId":2,"symbol":"","isHoliday":false}],"3":[{"activityId":5,"symbol":"","isHoliday":false}],"4":[{"activityId":3,"symbol":"","isHoliday":false}],"5":[{"activityId":13,"symbol":"✓","isHoliday":false}],"6":[{"activityId":12,"symbol":"✓✓","isHoliday":false}]},"2026-10-24":{"1":[{"activityId":14,"isHoliday":true,"symbol":""}],"2":[{"activityId":14,"isHoliday":true,"symbol":""}],"3":[{"activityId":14,"isHoliday":true,"symbol":""}],"4":[{"activityId":14,"isHoliday":true,"symbol":""}],"5":[{"activityId":14,"isHoliday":true,"symbol":""}],"6":[{"activityId":14,"isHoliday":true,"symbol":""}]},"2026-10-25":{"1":[{"activityId":14,"isHoliday":true,"symbol":""}],"2":[{"activityId":14,"isHoliday":true,"symbol":""}],"3":[{"activityId":14,"isHoliday":true,"symbol":""}],"4":[{"activityId":14,"isHoliday":true,"symbol":""}],"5":[{"activityId":14,"isHoliday":true,"symbol":""}],"6":[{"activityId":14,"isHoliday":true,"symbol":""}]},"2026-10-26":{"1":[{"activityId":1,"symbol":"*","isHoliday":false}],"2":[{"activityId":12,"symbol":"✓✓","isHoliday":false}],"3":[{"activityId":13,"symbol":"✓","isHoliday":false}],"4":[{"activityId":3,"symbol":"","isHoliday":false}],"5":[{"activityId":4,"symbol":"","isHoliday":false}],"6":[{"activityId":8,"symbol":"","isHoliday":false}]},"2026-10-27":{"1":[{"activityId":1,"symbol":"*","isHoliday":false}],"2":[{"activityId":2,"symbol":"","isHoliday":false}],"3":[{"activityId":12,"symbol":"✓✓","isHoliday":false}],"4":[{"activityId":13,"symbol":"✓","isHoliday":false}],"5":[{"activityId":4,"symbol":"","isHoliday":false}],"6":[{"activityId":8,"symbol":"","isHoliday":false}]},"2026-10-28":{"1":[{"activityId":1,"symbol":"*","isHoliday":false}],"2":[{"activityId":2,"symbol":"","isHoliday":false}],"3":[{"activityId":5,"symbol":"","isHoliday":false}],"4":[{"activityId":12,"symbol":"✓✓","isHoliday":false}],"5":[{"activityId":13,"symbol":"✓","isHoliday":false}],"6":[{"activityId":8,"symbol":"","isHoliday":false}]},"2026-10-29":{"1":[{"activityId":1,"symbol":"*","isHoliday":false}],"2":[{"activityId":2,"symbol":"","isHoliday":false}],"3":[{"activityId":5,"symbol":"","isHoliday":false}],"4":[{"activityId":3,"symbol":"","isHoliday":false}],"5":[{"activityId":13,"symbol":"✓","isHoliday":false}],"6":[{"activityId":12,"symbol":"✓✓","isHoliday":false}]},"2026-10-30":{"1":[{"activityId":1,"symbol":"*","isHoliday":false}],"2":[{"activityId":2,"symbol":"","isHoliday":false}],"3":[{"activityId":5,"symbol":"","isHoliday":false}],"4":[{"activityId":3,"symbol":"","isHoliday":false}],"5":[{"activityId":12,"symbol":"✓✓","isHoliday":false}],"6":[{"activityId":13,"symbol":"✓","isHoliday":false}]},"2026-10-31":{"1":[{"activityId":14,"isHoliday":true,"symbol":""}],"2":[{"activityId":14,"isHoliday":true,"symbol":""}],"3":[{"activityId":14,"isHoliday":true,"symbol":""}],"4":[{"activityId":14,"isHoliday":true,"symbol":""}],"5":[{"activityId":14,"isHoliday":true,"symbol":""}],"6":[{"activityId":14,"isHoliday":true,"symbol":""}]}};

    /**
     * Initializes the scheduler engine for a given year & month
     */
    function init(year, month) {
        currentYear = Number(year);
        currentMonth = Number(month);
        loadCurrentMonthSchedule();
    }

    function getYear() { return currentYear; }
    function getMonth() { return currentMonth; }
    function getSchedule() { return currentSchedule; }
    function isScheduleModified() { return isModified; }
    function setModified(val = true) { isModified = val; }

    /**
     * Loads schedule from localStorage. If none exists or October 2026 unseeded, loads authentic schedule.
     */
    function loadCurrentMonthSchedule() {
        const saved = StorageManager.loadSchedule(currentYear, currentMonth);
        if (saved && Object.keys(saved).length > 0) {
            currentSchedule = normalizeSchedule(saved);
            // Verify if October 2026 has all 31 days loaded and authentic assignments
            if (currentYear === 2026 && currentMonth === 10) {
                const dayCount = Object.keys(currentSchedule).length;
                const sampleCell = currentSchedule['2026-10-26']?.[6] || [];
                const hasStaleDraft = sampleCell.some(a => a.activityId === 3);
                if (dayCount < 28 || hasStaleDraft) {
                    currentSchedule = JSON.parse(JSON.stringify(OCTOBER_2026_SCHEDULE));
                    StorageManager.saveSchedule(2026, 10, currentSchedule);
                }
            }
            isModified = false;
        } else {
            if (currentYear === 2026 && currentMonth === 10) {
                currentSchedule = JSON.parse(JSON.stringify(OCTOBER_2026_SCHEDULE));
                StorageManager.saveSchedule(2026, 10, currentSchedule);
            } else {
                currentSchedule = createEmptyScheduleStructure(currentYear, currentMonth);
            }
            isModified = false;
        }
        return currentSchedule;
    }

    /**
     * Normalizes schedule entries so that every assignment has { activityId, symbol, isHoliday }
     */
    function normalizeSchedule(rawSchedule) {
        const normalized = {};
        const days = CalendarEngine.generateMonthDays(currentYear, currentMonth, HolidayManager.getAll());

        days.forEach(d => {
            const dateISO = d.dateISO;
            normalized[dateISO] = {};
            const rawDay = rawSchedule[dateISO] || {};

            // If Sunday or manual holiday, enforce Holiday for all
            if (d.isHoliday) {
                const employees = EmployeeManager.getActive();
                employees.forEach(emp => {
                    normalized[dateISO][emp.id] = [{ isHoliday: true, activityId: 14, name: 'Holiday', symbol: '' }];
                });
                return;
            }

            // Normal working day
            Object.keys(rawDay).forEach(empId => {
                const cellAssignments = rawDay[empId];
                if (Array.isArray(cellAssignments)) {
                    normalized[dateISO][empId] = cellAssignments.map(item => {
                        if (typeof item === 'object' && item !== null) {
                            return {
                                activityId: Number(item.activityId || item.id || 0),
                                symbol: item.symbol || '',
                                isHoliday: Boolean(item.isHoliday)
                            };
                        } else {
                            return {
                                activityId: Number(item),
                                symbol: '',
                                isHoliday: false
                            };
                        }
                    });
                } else if (cellAssignments) {
                    normalized[dateISO][empId] = [{
                        activityId: Number(cellAssignments),
                        symbol: '',
                        isHoliday: false
                    }];
                } else {
                    normalized[dateISO][empId] = [];
                }
            });
        });

        return normalized;
    }

    /**
     * Creates an empty schedule with Sundays and Holidays pre-filled
     */
    function createEmptyScheduleStructure(year, month) {
        const days = CalendarEngine.generateMonthDays(year, month, HolidayManager.getAll());
        const employees = EmployeeManager.getActive();
        const schedule = {};

        days.forEach(d => {
            schedule[d.dateISO] = {};
            employees.forEach(emp => {
                if (d.isHoliday) {
                    schedule[d.dateISO][emp.id] = [{ isHoliday: true, activityId: 14, name: 'Holiday', symbol: '' }];
                } else {
                    schedule[d.dateISO][emp.id] = [];
                }
            });
        });

        return schedule;
    }

    /**
     * Rule-Based Smart Auto Generation Engine
     * Follows SICART Specifications with Strict QA/QC Rules & Workload Balancing:
     * 1. Every Sunday = Holiday for everyone.
     * 2. Configured manual holidays = Holiday for everyone.
     * 3. QA & QC Single Active Officer Rule: Exactly ONE person on QC (âœ“) and ONE person on QA (âœ“âœ“) per working day.
     * 4. Single Responsibility Rule: The officer assigned to QA or QC has ONLY that single responsibility on that day.
     * 5. QC -> QA Consecutive Cycle: If an officer is assigned QC (âœ“) on day T, they MUST be assigned QA (âœ“âœ“) on next working day T+1.
     * 6. Fair 2-person rolling relay among all authorized QA/QC personnel:
     *    Day T: [Emp A = QA, Emp B = QC] -> Day T+1: [Emp B = QA, Emp C = QC] ...
     * 7. Primary allocation gives designated/authorized instrument or laboratory task to remaining staff.
     */
    function autoGenerateSchedule() {
        const days = CalendarEngine.generateMonthDays(currentYear, currentMonth, HolidayManager.getAll());
        const employees = EmployeeManager.getActive();
        const activities = ActivityManager.getActive();
        const fixedAssignments = ActivityManager.getFixedAssignments();

        const newSchedule = {};
        const workloadCounter = {};

        employees.forEach(emp => {
            workloadCounter[emp.id] = 0;
        });

        // Collect all working days
        const workingDays = [];
        days.forEach(d => {
            const dateISO = d.dateISO;
            newSchedule[dateISO] = {};

            if (d.isHoliday) {
                employees.forEach(emp => {
                    newSchedule[dateISO][emp.id] = [{
                        isHoliday: true,
                        activityId: 14,
                        name: 'Holiday',
                        symbol: ''
                    }];
                });
            } else {
                workingDays.push(d);
                employees.forEach(emp => {
                    newSchedule[dateISO][emp.id] = [];
                });
            }
        });

        // Step 1: Identify eligible QA/QC personnel (authorized for QA and QC)
        const qaqcEmployees = employees.filter(emp => {
            const authIds = ActivityManager.getEmployeeActivityIds(emp.id);
            const hasQA = activities.some(a => authIds.includes(a.id) && (a.category === 'QA' || a.id === 12));
            const hasQC = activities.some(a => authIds.includes(a.id) && (a.category === 'QC' || a.id === 13));
            return hasQA && hasQC;
        });

        const qaAct = activities.find(a => a.category === 'QA' || a.id === 12) || { id: 12 };
        const qcAct = activities.find(a => a.category === 'QC' || a.id === 13) || { id: 13 };

        // Track employee on QA/QC duty on each dateISO: dateISO -> Set of empIds
        const qaqcAssignedOnDay = {};

        // Step 2: Assign continuous 2-person rolling chain:
        // Day 0: Emp 0 is QA, Emp 1 is QC
        // Day 1: Emp 1 is QA (was QC on Day 0!), Emp 2 is QC
        // Day 2: Emp 2 is QA (was QC on Day 1!), Emp 3 is QC ...
        if (qaqcEmployees.length >= 2) {
            let rotationIdx = 0;
            for (let i = 0; i < workingDays.length; i++) {
                const day = workingDays[i];
                qaqcAssignedOnDay[day.dateISO] = new Set();

                const qaEmp = qaqcEmployees[rotationIdx % qaqcEmployees.length];
                const qcEmp = qaqcEmployees[(rotationIdx + 1) % qaqcEmployees.length];

                // Assign QA (âœ“âœ“) to qaEmp
                newSchedule[day.dateISO][qaEmp.id].push({
                    activityId: qaAct.id,
                    symbol: 'âœ“âœ“',
                    isHoliday: false
                });
                workloadCounter[qaEmp.id]++;
                qaqcAssignedOnDay[day.dateISO].add(qaEmp.id);

                // Assign QC (âœ“) to qcEmp
                newSchedule[day.dateISO][qcEmp.id].push({
                    activityId: qcAct.id,
                    symbol: 'âœ“',
                    isHoliday: false
                });
                workloadCounter[qcEmp.id]++;
                qaqcAssignedOnDay[day.dateISO].add(qcEmp.id);

                // Advance relay so qcEmp becomes qaEmp tomorrow!
                rotationIdx++;
            }
        }

        // Step 3: Phase 1 - Assign primary instrument / lab activity to remaining employees on each working day
        workingDays.forEach((dayMeta, dayIndex) => {
            const dateISO = dayMeta.dateISO;
            const staffOnDuty = qaqcAssignedOnDay[dateISO] || new Set();

            employees.forEach(emp => {
                // If this employee is on QA/QC duty today, they have ONLY that single responsibility!
                if (staffOnDuty.has(emp.id)) {
                    return;
                }

                const authorizedActIds = ActivityManager.getEmployeeActivityIds(emp.id);
                const authorizedActivities = activities.filter(a =>
                    authorizedActIds.includes(a.id) &&
                    a.name !== 'Holiday' &&
                    a.category !== 'QA' &&
                    a.category !== 'QC' &&
                    a.id !== 12 &&
                    a.id !== 13 &&
                    a.id !== 14
                );

                if (authorizedActivities.length === 0) return;

                let primaryAct = null;
                const fixedActId = fixedAssignments[emp.id];
                if (fixedActId) {
                    const fixedAct = ActivityManager.getById(fixedActId);
                    if (fixedAct && fixedAct.active) {
                        primaryAct = fixedAct;
                    }
                }

                if (!primaryAct) {
                    const instrumentActs = authorizedActivities.filter(a => a.category === 'Instrument');
                    const nonInstrumentActs = authorizedActivities.filter(a => a.category !== 'Instrument');
                    const pool = instrumentActs.length > 0 ? instrumentActs : nonInstrumentActs;

                    const pOrder = { 'High': 1, 'Medium': 2, 'Low': 3 };
                    const sorted = [...pool].sort((a, b) => (pOrder[a.priority] || 2) - (pOrder[b.priority] || 2));
                    const pickIdx = dayIndex % sorted.length;
                    primaryAct = sorted[pickIdx];
                }

                if (primaryAct) {
                    newSchedule[dateISO][emp.id].push({
                        activityId: primaryAct.id,
                        symbol: primaryAct.symbol || '',
                        isHoliday: false
                    });
                    workloadCounter[emp.id]++;
                }
            });
        });

        currentSchedule = newSchedule;
        isModified = true;
        return currentSchedule;
    }

    /**
     * Seeds the initial sample schedule for October 2026 matching the SICART reference DOCX
     */
    function generateInitialSampleSchedule() {
        currentYear = 2026;
        currentMonth = 10;
        currentSchedule = JSON.parse(JSON.stringify(OCTOBER_2026_SCHEDULE));
        StorageManager.saveSchedule(2026, 10, currentSchedule);
        isModified = false;
        return currentSchedule;
    }

    /**
     * Gets assignments for a specific cell
     */
    function getCellAssignments(dateISO, employeeId) {
        if (!currentSchedule[dateISO]) return [];
        return currentSchedule[dateISO][employeeId] || [];
    }

    /**
     * Updates assignments for a specific cell
     */
    function updateCellAssignments(dateISO, employeeId, assignments) {
        if (HolidayManager.isSunday(dateISO)) {
            // Cannot modify Sunday
            return false;
        }

        if (!currentSchedule[dateISO]) {
            currentSchedule[dateISO] = {};
        }

        currentSchedule[dateISO][employeeId] = assignments;
        isModified = true;
        return true;
    }

    /**
     * Clears or resets assignments for the month
     */
    function resetMonthSchedule() {
        if (currentYear === 2026 && currentMonth === 10) {
            currentSchedule = JSON.parse(JSON.stringify(OCTOBER_2026_SCHEDULE));
        } else {
            currentSchedule = createEmptyScheduleStructure(currentYear, currentMonth);
        }
        isModified = true;
        return currentSchedule;
    }

    /**
     * Saves current schedule to storage
     */
    function saveCurrentSchedule() {
        const success = StorageManager.saveSchedule(currentYear, currentMonth, currentSchedule);
        if (success) {
            isModified = false;
        }
        return success;
    }

    /**
     * Computes statistics for current schedule:
     * working days, sundays, holidays, total assignments, employee breakdown
     */
    function getScheduleStats() {
        const days = CalendarEngine.generateMonthDays(currentYear, currentMonth, HolidayManager.getAll());
        const employees = EmployeeManager.getActive();
        const stats = {
            totalDays: days.length,
            workingDays: 0,
            sundays: 0,
            otherHolidays: 0,
            totalEmployees: employees.length,
            totalAssignments: 0,
            employeeWorkloads: {}
        };

        employees.forEach(e => {
            stats.employeeWorkloads[e.id] = {
                employee: e,
                count: 0
            };
        });

        days.forEach(d => {
            if (d.isSunday) {
                stats.sundays++;
            } else if (d.manualHolidayName) {
                stats.otherHolidays++;
            } else {
                stats.workingDays++;
                const dayAssignments = currentSchedule[d.dateISO] || {};
                employees.forEach(emp => {
                    const cell = dayAssignments[emp.id] || [];
                    const activeActs = cell.filter(item => !item.isHoliday && item.activityId !== 14);
                    stats.employeeWorkloads[emp.id].count += activeActs.length;
                    stats.totalAssignments += activeActs.length;
                });
            }
        });

        return stats;
    }

    return {
        init,
        getYear,
        getMonth,
        getSchedule,
        isScheduleModified,
        setModified,
        loadCurrentMonthSchedule,
        autoGenerateSchedule,
        generateInitialSampleSchedule,
        getCellAssignments,
        updateCellAssignments,
        resetMonthSchedule,
        saveCurrentSchedule,
        getScheduleStats
    };
})();