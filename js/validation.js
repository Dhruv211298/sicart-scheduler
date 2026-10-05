/* ==========================================================================
   SICART Scheduling System - Schedule Validation & Conflict Detection
   Analyzes schedules for rule violations, authorizations and capacity limits
   ========================================================================== */

const ValidationEngine = (() => {

    /**
     * Validates an entire schedule or a specific date/cell
     * Returns an array of conflict objects:
     * {
     *   type: 'unauthorized' | 'sunday_violation' | 'holiday_violation' | 'excessive_load' | 'duplicate_activity' | 'qa_qc_single_responsibility' | 'qa_qc_multiple_staff' | 'qc_qa_sequence_violation' | 'orphan_qa_violation',
     *   severity: 'danger' | 'warning',
     *   dateISO: 'YYYY-MM-DD',
     *   dateDisplay: 'DD-MM-YYYY',
     *   employeeId: number,
     *   employeeName: string,
     *   activityId: number,
     *   activityName: string,
     *   message: string
     * }
     */
    function validateSchedule(year, month, schedule) {
        const conflicts = [];
        const days = CalendarEngine.generateMonthDays(year, month, HolidayManager.getAll());
        const employees = EmployeeManager.getActive();
        const settings = StorageManager.get(StorageManager.KEYS.SETTINGS, { maxDailyAssignments: 2 });
        const maxDaily = Number(settings.maxDailyAssignments) || 2;

        const workingDays = [];

        days.forEach(day => {
            const dateISO = day.dateISO;
            const dateDisplay = day.dateDisplay;
            const dayAssignments = schedule[dateISO] || {};

            // Check 1: Sunday violation (Conflict 2)
            if (day.isSunday) {
                employees.forEach(emp => {
                    const cell = dayAssignments[emp.id] || [];
                    const nonHolidayActs = cell.filter(a => !a.isHoliday && a.activityId !== 14);
                    if (nonHolidayActs.length > 0) {
                        conflicts.push({
                            type: 'sunday_violation',
                            severity: 'danger',
                            dateISO,
                            dateDisplay,
                            employeeId: emp.id,
                            employeeName: emp.name,
                            message: `Sunday rule violated: ${emp.name} has assignments on Sunday (${dateDisplay}). Sunday must remain Holiday.`
                        });
                    }
                });
                return; // Skip further checks on Sunday
            }

            // Check 2: Holiday violation (Conflict 3)
            if (day.manualHolidayName) {
                employees.forEach(emp => {
                    const cell = dayAssignments[emp.id] || [];
                    const nonHolidayActs = cell.filter(a => !a.isHoliday && a.activityId !== 14);
                    if (nonHolidayActs.length > 0) {
                        conflicts.push({
                            type: 'holiday_violation',
                            severity: 'danger',
                            dateISO,
                            dateDisplay,
                            employeeId: emp.id,
                            employeeName: emp.name,
                            message: `Holiday rule violated: ${emp.name} has assignments on ${day.manualHolidayName} (${dateDisplay}).`
                        });
                    }
                });
                return; // Skip further checks on Holiday
            }

            // Normal working day
            workingDays.push(day);

            const staffOnQAQC = [];

            employees.forEach(emp => {
                const cell = dayAssignments[emp.id] || [];
                const validActivities = cell.filter(a => !a.isHoliday && a.activityId !== 14);

                // Check 3: Excessive assignments in one day (Conflict 4)
                if (validActivities.length > maxDaily) {
                    conflicts.push({
                        type: 'excessive_load',
                        severity: 'warning',
                        dateISO,
                        dateDisplay,
                        employeeId: emp.id,
                        employeeName: emp.name,
                        message: `${emp.name} has ${validActivities.length} activities on ${dateDisplay} (Limit is ${maxDaily}).`
                    });
                }

                // Check 4: Duplicate activities in same cell (Conflict 5)
                const seenActIds = new Set();
                validActivities.forEach(item => {
                    const actId = Number(item.activityId);
                    if (seenActIds.has(actId)) {
                        const actObj = ActivityManager.getById(actId);
                        const actName = actObj ? actObj.name : `Activity #${actId}`;
                        conflicts.push({
                            type: 'duplicate_activity',
                            severity: 'warning',
                            dateISO,
                            dateDisplay,
                            employeeId: emp.id,
                            employeeName: emp.name,
                            activityId: actId,
                            activityName: actName,
                            message: `${emp.name} has duplicate assignment for "${actName}" on ${dateDisplay}.`
                        });
                    } else {
                        seenActIds.add(actId);
                    }
                });

                // Check 5: Unauthorized instrument/activity (Conflict 1)
                validActivities.forEach(item => {
                    const actId = Number(item.activityId);
                    const isAuth = ActivityManager.isEmployeeAuthorized(emp.id, actId);
                    if (!isAuth) {
                        const actObj = ActivityManager.getById(actId);
                        const actName = actObj ? actObj.name : `Activity #${actId}`;
                        conflicts.push({
                            type: 'unauthorized',
                            severity: 'danger',
                            dateISO,
                            dateDisplay,
                            employeeId: emp.id,
                            employeeName: emp.name,
                            activityId: actId,
                            activityName: actName,
                            message: `⚠ ${emp.name} is not authorized for "${actName}" on ${dateDisplay}.`
                        });
                    }
                });

                // Check 6: QA/QC Single Responsibility Rule ("per person only one responsibility")
                const qaqcActs = validActivities.filter(item => {
                    const actObj = ActivityManager.getById(item.activityId);
                    return (actObj && (actObj.category === 'QA' || actObj.category === 'QC')) ||
                           item.activityId === 12 || item.activityId === 13;
                });

                if (qaqcActs.length > 0) {
                    staffOnQAQC.push(emp);

                    if (validActivities.length > 1) {
                        conflicts.push({
                            type: 'qa_qc_single_responsibility',
                            severity: 'danger',
                            dateISO,
                            dateDisplay,
                            employeeId: emp.id,
                            employeeName: emp.name,
                            message: `Single Responsibility Violated: ${emp.name} is assigned to QA/QC on ${dateDisplay}, but has ${validActivities.length} activities. Staff on QA/QC duty must have only one responsibility.`
                        });
                    }

                    const hasQA = qaqcActs.some(a => {
                        const act = ActivityManager.getById(a.activityId);
                        return (act && act.category === 'QA') || a.activityId === 12;
                    });
                    const hasQC = qaqcActs.some(a => {
                        const act = ActivityManager.getById(a.activityId);
                        return (act && act.category === 'QC') || a.activityId === 13;
                    });
                    if (hasQA && hasQC) {
                        conflicts.push({
                            type: 'qa_qc_single_responsibility',
                            severity: 'danger',
                            dateISO,
                            dateDisplay,
                            employeeId: emp.id,
                            employeeName: emp.name,
                            message: `Conflict: ${emp.name} cannot be assigned both QA and QC activities on the same day (${dateDisplay}).`
                        });
                    }
                }
            });

            // Check 7: QA & QC Laboratory Department Limits
            // Exactly ONE officer on QA and ONE officer on QC per working day
            const staffOnQA = [];
            const staffOnQC = [];

            employees.forEach(emp => {
                const cell = dayAssignments[emp.id] || [];
                const nonHolidayActs = cell.filter(a => !a.isHoliday && a.activityId !== 14);
                nonHolidayActs.forEach(item => {
                    const act = ActivityManager.getById(item.activityId);
                    if ((act && act.category === 'QA') || item.activityId === 12) {
                        staffOnQA.push(emp);
                    }
                    if ((act && act.category === 'QC') || item.activityId === 13) {
                        staffOnQC.push(emp);
                    }
                });
            });

            if (staffOnQA.length > 1) {
                conflicts.push({
                    type: 'qa_multiple_staff',
                    severity: 'danger',
                    dateISO,
                    dateDisplay,
                    message: `Department QA Limit: Only 1 person can have QA active on ${dateDisplay}, but ${staffOnQA.length} staff are assigned (${staffOnQA.map(e => e.name).join(', ')}).`
                });
            }

            if (staffOnQC.length > 1) {
                conflicts.push({
                    type: 'qc_multiple_staff',
                    severity: 'danger',
                    dateISO,
                    dateDisplay,
                    message: `Department QC Limit: Only 1 person can have QC active on ${dateDisplay}, but ${staffOnQC.length} staff are assigned (${staffOnQC.map(e => e.name).join(', ')}).`
                });
            }
        });

        // Check 8: Sequence Check across working days
        // "If today person 1 has QC activity then in next day they must have QA activity"
        for (let i = 0; i < workingDays.length; i++) {
            const currentDay = workingDays[i];
            const nextDay = (i + 1 < workingDays.length) ? workingDays[i + 1] : null;
            const prevDay = (i > 0) ? workingDays[i - 1] : null;

            employees.forEach(emp => {
                const currentCell = (schedule[currentDay.dateISO] && schedule[currentDay.dateISO][emp.id]) || [];
                const hasQC = currentCell.some(a => {
                    const act = ActivityManager.getById(a.activityId);
                    return ((act && act.category === 'QC') || a.activityId === 13) && !a.isHoliday;
                });
                const hasQA = currentCell.some(a => {
                    const act = ActivityManager.getById(a.activityId);
                    return ((act && act.category === 'QA') || a.activityId === 12) && !a.isHoliday;
                });

                // Rule: QC today -> QA on next working day
                if (hasQC && nextDay) {
                    const nextCell = (schedule[nextDay.dateISO] && schedule[nextDay.dateISO][emp.id]) || [];
                    const hasNextQA = nextCell.some(a => {
                        const act = ActivityManager.getById(a.activityId);
                        return ((act && act.category === 'QA') || a.activityId === 12) && !a.isHoliday;
                    });
                    if (!hasNextQA) {
                        conflicts.push({
                            type: 'qc_qa_sequence_violation',
                            severity: 'warning',
                            dateISO: currentDay.dateISO,
                            dateDisplay: currentDay.dateDisplay,
                            employeeId: emp.id,
                            employeeName: emp.name,
                            message: `QC → QA Sequence: ${emp.name} has QC on ${currentDay.dateDisplay}. Standard protocol assigns them QA on next working day (${nextDay.dateDisplay}) unless absentee backup is invoked.`
                        });
                    }
                }

                // Advisory: QA today should follow QC on the previous working day
                if (hasQA && prevDay) {
                    const prevCell = (schedule[prevDay.dateISO] && schedule[prevDay.dateISO][emp.id]) || [];
                    const hadPrevQC = prevCell.some(a => {
                        const act = ActivityManager.getById(a.activityId);
                        return ((act && act.category === 'QC') || a.activityId === 13) && !a.isHoliday;
                    });
                    if (!hadPrevQC) {
                        conflicts.push({
                            type: 'orphan_qa_violation',
                            severity: 'warning',
                            dateISO: currentDay.dateISO,
                            dateDisplay: currentDay.dateDisplay,
                            employeeId: emp.id,
                            employeeName: emp.name,
                            message: `QA Sequence Advisory: ${emp.name} has QA activity on ${currentDay.dateDisplay}, but did not perform QC activity on the preceding working day (${prevDay.dateDisplay}).`
                        });
                    }
                }
            });
        }

        return conflicts;
    }

    /**
     * Quick check for a specific cell
     */
    function validateCell(dateISO, employeeId, assignments) {
        const emp = EmployeeManager.getById(employeeId);
        if (!emp) return [];

        const conflicts = [];
        const isSun = HolidayManager.isSunday(dateISO);
        const holName = HolidayManager.getHolidayName(dateISO);

        if (isSun) {
            const nonHoliday = assignments.filter(a => !a.isHoliday && a.activityId !== 14);
            if (nonHoliday.length > 0) {
                conflicts.push(`Sunday must remain Holiday.`);
            }
            return conflicts;
        }

        if (holName && holName !== 'Sunday') {
            const nonHoliday = assignments.filter(a => !a.isHoliday && a.activityId !== 14);
            if (nonHoliday.length > 0) {
                conflicts.push(`Date is designated as ${holName}.`);
            }
            return conflicts;
        }

        const validActs = assignments.filter(a => !a.isHoliday && a.activityId !== 14);
        if (validActs.length > 2) {
            conflicts.push(`Too many assignments (${validActs.length}) in one day.`);
        }

        validActs.forEach(a => {
            if (!ActivityManager.isEmployeeAuthorized(emp.id, a.activityId)) {
                const actObj = ActivityManager.getById(a.activityId);
                conflicts.push(`${emp.name} is not authorized for ${actObj ? actObj.name : a.activityId}.`);
            }
        });

        // QA/QC Specific Checks
        const qaqcActs = validActs.filter(a => {
            const actObj = ActivityManager.getById(a.activityId);
            return (actObj && (actObj.category === 'QA' || actObj.category === 'QC')) ||
                   a.activityId === 12 || a.activityId === 13;
        });

        if (qaqcActs.length > 0) {
            if (validActs.length > 1) {
                conflicts.push(`Only one responsibility permitted when assigned QA or QC.`);
            }
            const hasQA = qaqcActs.some(a => {
                const act = ActivityManager.getById(a.activityId);
                return (act && act.category === 'QA') || a.activityId === 12;
            });
            const hasQC = qaqcActs.some(a => {
                const act = ActivityManager.getById(a.activityId);
                return (act && act.category === 'QC') || a.activityId === 13;
            });
            if (hasQA && hasQC) {
                conflicts.push(`Cannot assign both QA and QC on the same date.`);
            }

            // Check if another employee already has the SAME QA or QC role on this day
            if (typeof SchedulerEngine !== 'undefined') {
                const schedule = SchedulerEngine.getSchedule();
                if (schedule && schedule[dateISO]) {
                    if (hasQA) {
                        const otherQA = Object.keys(schedule[dateISO]).filter(id => Number(id) !== Number(employeeId)).some(id => {
                            const otherActs = schedule[dateISO][id] || [];
                            return otherActs.some(oa => {
                                const act = ActivityManager.getById(oa.activityId);
                                return (act && act.category === 'QA') || oa.activityId === 12;
                            });
                        });
                        if (otherQA) {
                            conflicts.push(`Another staff member is already assigned to QA on this day.`);
                        }
                    }
                    if (hasQC) {
                        const otherQC = Object.keys(schedule[dateISO]).filter(id => Number(id) !== Number(employeeId)).some(id => {
                            const otherActs = schedule[dateISO][id] || [];
                            return otherActs.some(oa => {
                                const act = ActivityManager.getById(oa.activityId);
                                return (act && act.category === 'QC') || oa.activityId === 13;
                            });
                        });
                        if (otherQC) {
                            conflicts.push(`Another staff member is already assigned to QC on this day.`);
                        }
                    }
                }
            }
        }

        return conflicts;
    }

    return {
        validateSchedule,
        validateCell
    };
})();
