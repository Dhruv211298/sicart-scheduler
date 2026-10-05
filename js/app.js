/* ==========================================================================
   SICART Scheduling System - Main Application Controller
   Coordinates UI events, table rendering, modals, filters and navigation
   ========================================================================== */

const App = (() => {
    // Current UI State
    let state = {
        currentYear: 2026,
        currentMonth: 10, // October (10) - matching official SICART reference schedule
        activeTab: 'schedule',
        searchQuery: '',
        filterActivityId: '',
        employeeSearchQuery: '',
        editingCell: null, // { dateISO, employeeId }
        conflicts: []
    };

    /**
     * DOM Element Cache
     */
    let dom = {};

    function init() {
        // Initialize storage & default seed data
        StorageManager.init();
        EmployeeManager.load();
        ActivityManager.load();
        HolidayManager.load();

        // Initialize scheduler engine
        SchedulerEngine.init(state.currentYear, state.currentMonth);

        // Cache elements
        cacheDom();

        // Populate Month & Year selectors
        populateMonthYearPickers();

        // Bind events
        bindEvents();

        // Initial render
        renderCurrentView();

        // Update statistics and conflict alerts
        updateHeaderAndStats();

        // Initialize signature titles from settings
        applySettingsToUI();
    }

    function applySettingsToUI() {
        const settings = StorageManager.get(StorageManager.KEYS.SETTINGS, {});
        if (!settings.preparedBy || settings.preparedBy === 'Scientific Officer' || settings.preparedBy.includes('Scientific Officer')) {
            settings.preparedBy = 'Q.C. Manager';
            StorageManager.set(StorageManager.KEYS.SETTINGS, settings);
        }
        const prep = settings.preparedBy || 'Q.C. Manager';
        const apprv = settings.approvedBy || 'Director, SICART';

        if (document.getElementById('sigPreparedTitle')) {
            document.getElementById('sigPreparedTitle').textContent = prep;
        }
        if (document.getElementById('schedulePreparedBy')) {
            document.getElementById('schedulePreparedBy').textContent = prep;
        }
        if (document.getElementById('sigApprovedTitle')) {
            document.getElementById('sigApprovedTitle').textContent = apprv;
        }
        if (document.getElementById('scheduleApprovedBy')) {
            document.getElementById('scheduleApprovedBy').textContent = apprv;
        }
        if (settings.checkedBy && document.getElementById('sigCheckedTitle')) {
            document.getElementById('sigCheckedTitle').textContent = settings.checkedBy;
        }
    }

    function cacheDom() {
        dom.navTabs = document.querySelectorAll('.nav-tab');
        dom.tabPanes = document.querySelectorAll('.tab-pane');
        dom.monthSelect = document.getElementById('monthSelect');
        dom.yearSelect = document.getElementById('yearSelect');
        dom.scheduleTableHead = document.getElementById('scheduleTableHead');
        dom.scheduleTableBody = document.getElementById('scheduleTableBody');
        dom.statsContainer = document.getElementById('scheduleStats');
        dom.conflictAlert = document.getElementById('conflictAlert');
        dom.conflictCount = document.getElementById('conflictCount');
        dom.filterActivity = document.getElementById('filterActivitySelect');
        dom.searchEmployee = document.getElementById('searchEmployeeInput');
        dom.versionSelect = document.getElementById('versionSelect');
        dom.finalBadge = document.getElementById('finalBadge');

        // Modals
        dom.cellModal = document.getElementById('cellEditModal');
        dom.employeeModal = document.getElementById('employeeModal');
        dom.activityModal = document.getElementById('activityModal');
        dom.conflictModal = document.getElementById('conflictModal');
        dom.versionModal = document.getElementById('versionModal');
        dom.toast = document.getElementById('appToast');
    }

    function populateMonthYearPickers() {
        if (!dom.monthSelect || !dom.yearSelect) return;

        dom.monthSelect.innerHTML = '';
        CalendarEngine.MONTH_NAMES.forEach((name, idx) => {
            const opt = document.createElement('option');
            opt.value = idx + 1;
            opt.textContent = name;
            if (idx + 1 === state.currentMonth) opt.selected = true;
            dom.monthSelect.appendChild(opt);
        });

        dom.yearSelect.innerHTML = '';
        const years = [2024, 2025, 2026, 2027, 2028, 2029, 2030];
        years.forEach(yr => {
            const opt = document.createElement('option');
            opt.value = yr;
            opt.textContent = yr;
            if (yr === state.currentYear) opt.selected = true;
            dom.yearSelect.appendChild(opt);
        });

        populateActivityFilterDropdown();
        populateVersionSelect();
    }

    function populateActivityFilterDropdown() {
        if (!dom.filterActivity) return;
        dom.filterActivity.innerHTML = '<option value="">All Activities (No Filter)</option>';
        const acts = ActivityManager.getActive();
        acts.forEach(a => {
            if (a.name === 'Holiday') return;
            const opt = document.createElement('option');
            opt.value = a.id;
            opt.textContent = `[${a.category}] ${a.name}`;
            dom.filterActivity.appendChild(opt);
        });
    }

    function populateVersionSelect() {
        if (!dom.versionSelect) return;
        const versions = StorageManager.getVersions(state.currentYear, state.currentMonth);
        dom.versionSelect.innerHTML = '<option value="current">Working Draft</option>';

        let hasFinal = false;
        versions.forEach(v => {
            const opt = document.createElement('option');
            opt.value = v.id;
            opt.textContent = `${v.name}${v.isFinal ? ' ★ (Final)' : ''}`;
            if (v.isFinal) hasFinal = true;
            dom.versionSelect.appendChild(opt);
        });

        if (dom.finalBadge) {
            dom.finalBadge.style.display = hasFinal ? 'inline-flex' : 'none';
        }
    }

    function bindEvents() {
        // Navigation Tabs
        dom.navTabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                const target = tab.dataset.tab;
                switchTab(target);
            });
        });

        // Month & Year selection change
        dom.monthSelect.addEventListener('change', () => {
            changeMonthYear(Number(dom.yearSelect.value), Number(dom.monthSelect.value));
        });

        dom.yearSelect.addEventListener('change', () => {
            changeMonthYear(Number(dom.yearSelect.value), Number(dom.monthSelect.value));
        });

        // Toolbar Buttons
        document.getElementById('btnAutoGenerate')?.addEventListener('click', onAutoGenerate);
        document.getElementById('btnSaveSchedule')?.addEventListener('click', onSaveSchedule);
        document.getElementById('btnResetSchedule')?.addEventListener('click', onResetSchedule);
        document.getElementById('btnPrintSchedule')?.addEventListener('click', onPrintSchedule);
        document.getElementById('btnExportCSV')?.addEventListener('click', () => {
            ExportEngine.exportMonthScheduleCSV(state.currentYear, state.currentMonth);
            showToast('Schedule exported to CSV successfully!');
        });
        document.getElementById('btnExportJSON')?.addEventListener('click', () => {
            ExportEngine.exportBackupJSON();
            showToast('Full system backup exported to JSON!');
        });
        document.getElementById('btnImportJSON')?.addEventListener('click', () => {
            document.getElementById('fileImportInput')?.click();
        });
        document.getElementById('fileImportInput')?.addEventListener('change', onImportFileSelected);

        // Versioning buttons
        document.getElementById('btnSaveVersion')?.addEventListener('click', onOpenVersionModal);
        document.getElementById('btnMarkFinal')?.addEventListener('click', onMarkFinal);
        dom.versionSelect?.addEventListener('change', onVersionChanged);

        // Search & Filter
        dom.filterActivity?.addEventListener('change', (e) => {
            state.filterActivityId = e.target.value;
            renderScheduleTable();
        });

        dom.searchEmployee?.addEventListener('input', (e) => {
            state.employeeSearchQuery = e.target.value.toLowerCase().trim();
            renderScheduleTable();
        });

        // Cell Modal Search Input listener
        document.getElementById('cellModalSearch')?.addEventListener('input', (e) => {
            if (!state.editingCell) return;
            const currentAssignments = SchedulerEngine.getCellAssignments(state.editingCell.dateISO, state.editingCell.employeeId);
            renderCellModalActivityList(currentAssignments, state.editingCell.employeeId, e.target.value);
        });

        // Close modals when clicking outside modal container
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    closeModal(overlay);
                }
            });
        });

        // Conflict drawer / alert click
        dom.conflictAlert?.addEventListener('click', showConflictModal);

        // Quick month jump buttons
        document.getElementById('btnPrevMonth')?.addEventListener('click', () => {
            let m = state.currentMonth - 1;
            let y = state.currentYear;
            if (m < 1) { m = 12; y--; }
            changeMonthYear(y, m);
        });

        document.getElementById('btnNextMonth')?.addEventListener('click', () => {
            let m = state.currentMonth + 1;
            let y = state.currentYear;
            if (m > 12) { m = 1; y++; }
            changeMonthYear(y, m);
        });
    }

    function switchTab(tabId) {
        state.activeTab = tabId;
        dom.navTabs.forEach(t => {
            t.classList.toggle('active', t.dataset.tab === tabId);
        });
        dom.tabPanes.forEach(pane => {
            pane.classList.toggle('active', pane.id === `tab-${tabId}`);
        });

        renderCurrentView();
    }

    function renderCurrentView() {
        switch (state.activeTab) {
            case 'schedule':
                renderScheduleTable();
                updateHeaderAndStats();
                break;
            case 'employees':
                renderEmployeeManagement();
                break;
            case 'instruments':
                renderInstrumentManagement();
                break;
            case 'qaqc':
                renderQAQCManagement();
                break;
            case 'mapping':
                renderMappingManagement();
                break;
            case 'holidays':
                renderHolidayManagement();
                break;
            case 'backup':
                renderBackupSettings();
                break;
        }
    }

    function changeMonthYear(year, month) {
        state.currentYear = year;
        state.currentMonth = month;
        dom.yearSelect.value = year;
        dom.monthSelect.value = month;

        SchedulerEngine.init(year, month);
        populateVersionSelect();
        renderScheduleTable();
        updateHeaderAndStats();
        showToast(`Loaded calendar for ${CalendarEngine.MONTH_NAMES[month - 1]} ${year}`);
    }

    // -------------------------------------------------------------
    // Schedule Table Rendering
    // -------------------------------------------------------------
    function renderScheduleTable() {
        if (!dom.scheduleTableHead || !dom.scheduleTableBody) return;

        const days = CalendarEngine.generateMonthDays(state.currentYear, state.currentMonth, HolidayManager.getAll());
        let employees = EmployeeManager.getActive();

        // Apply employee search filter if any
        if (state.employeeSearchQuery) {
            employees = employees.filter(e =>
                e.name.toLowerCase().includes(state.employeeSearchQuery) ||
                (e.code && e.code.toLowerCase().includes(state.employeeSearchQuery)) ||
                (e.department && e.department.toLowerCase().includes(state.employeeSearchQuery))
            );
        }

        const schedule = SchedulerEngine.getSchedule();

        // Render Table Headers
        let headHtml = `
            <tr>
                <th class="col-date sticky-col">Date</th>
                <th class="col-day sticky-col-2">Day</th>
        `;

        employees.forEach(emp => {
            headHtml += `
                <th class="col-emp" data-emp-id="${emp.id}">
                    <div class="emp-head-title">${escapeHtml(emp.name)}</div>
                    <div class="emp-head-sub">${escapeHtml(emp.designation || '')}</div>
                </th>
            `;
        });

        headHtml += `</tr>`;
        dom.scheduleTableHead.innerHTML = headHtml;

        // Render Table Rows
        let bodyHtml = '';

        days.forEach(day => {
            const isSunday = day.isSunday;
            const isManualHoliday = Boolean(day.manualHolidayName);
            const isAnyHoliday = isSunday || isManualHoliday;
            const holidayTitle = isSunday ? 'Sunday (Weekly Off)' : day.manualHolidayName;

            let rowClass = 'schedule-row';
            if (isSunday) rowClass += ' row-sunday';
            else if (isManualHoliday) rowClass += ' row-holiday';

            bodyHtml += `<tr class="${rowClass}" data-date="${day.dateISO}">`;

            // Date Column
            bodyHtml += `
                <td class="col-date sticky-col">
                    <span class="date-badge">${day.dateDisplay}</span>
                </td>
            `;

            // Day Column
            bodyHtml += `
                <td class="col-day sticky-col-2">
                    <span class="day-badge ${isSunday ? 'day-sunday' : ''}">${day.dayName}</span>
                </td>
            `;

            // Employee Columns
            employees.forEach(emp => {
                const cellAssignments = (schedule[day.dateISO] && schedule[day.dateISO][emp.id]) || [];

                if (isAnyHoliday) {
                    bodyHtml += `
                        <td class="cell-holiday" title="${holidayTitle}">
                            <div class="holiday-banner">
                                <span class="holiday-icon">${isSunday ? '☀️' : '🏖️'}</span>
                                <span class="holiday-text">Holiday</span>
                            </div>
                        </td>
                    `;
                } else {
                    // Normal working day cell
                    let cellClasses = ['cell-editable'];
                    let hasHighlight = false;
                    let hasConflict = false;

                    // Check conflict for this cell
                    const cellConflicts = ValidationEngine.validateCell(day.dateISO, emp.id, cellAssignments);
                    if (cellConflicts.length > 0) {
                        cellClasses.push('cell-has-conflict');
                        hasConflict = true;
                    }

                    // Render activities
                    let actBadges = '';
                    if (cellAssignments.length === 0) {
                        actBadges = `<div class="cell-empty-placeholder">+ Assign</div>`;
                    } else {
                        cellAssignments.forEach(item => {
                            if (item.isHoliday) {
                                actBadges += `<div class="act-tag tag-holiday">Holiday</div>`;
                                return;
                            }

                            const actObj = ActivityManager.getById(item.activityId);
                            const actName = actObj ? actObj.name : `Act#${item.activityId}`;
                            const isAuthorized = ActivityManager.isEmployeeAuthorized(emp.id, item.activityId);

                            // Check filter match
                            let isMatch = false;
                            if (state.filterActivityId && Number(state.filterActivityId) === Number(item.activityId)) {
                                isMatch = true;
                                hasHighlight = true;
                            }

                            const isQA = (actObj && actObj.category === 'QA') || item.activityId === 12;
                            const isQC = (actObj && actObj.category === 'QC') || item.activityId === 13;
                            const unauthWarning = !isAuthorized ? `<span class="unauth-flag" title="Unauthorized Activity!">⚠</span>` : '';
                            const tagCategory = actObj ? actObj.category.toLowerCase() : 'instrument';

                            if (isQA) {
                                actBadges += `
                                    <div class="act-tag cat-qa ${isMatch ? 'tag-filtered' : ''} ${!isAuthorized ? 'tag-unauth' : ''}" 
                                         title="QA Activity: Test Report Preparation, Sample Retention etc. (1st Priority)">
                                        <span class="act-symbol-primary">✓✓</span>
                                        <span class="act-symbol-sub">QA</span>
                                        ${unauthWarning}
                                    </div>
                                `;
                            } else if (isQC) {
                                actBadges += `
                                    <div class="act-tag cat-qc ${isMatch ? 'tag-filtered' : ''} ${!isAuthorized ? 'tag-unauth' : ''}" 
                                         title="QC (Sample Warden): Test Request Review, Sample Distribution, Tray Preparation for next day (1st Priority)">
                                        <span class="act-symbol-primary">✓</span>
                                        <span class="act-symbol-sub">QC</span>
                                        ${unauthWarning}
                                    </div>
                                `;
                            } else {
                                const symbolHtml = item.symbol ? `<span class="act-symbol">${escapeHtml(item.symbol)}</span>` : '';
                                actBadges += `
                                    <div class="act-tag cat-${tagCategory} ${isMatch ? 'tag-filtered' : ''} ${!isAuthorized ? 'tag-unauth' : ''}">
                                        <span class="act-name">${escapeHtml(actName)}</span>
                                        ${symbolHtml}
                                        ${unauthWarning}
                                    </div>
                                `;
                            }
                        });
                    }

                    if (hasHighlight) cellClasses.push('cell-highlight');

                    bodyHtml += `
                        <td class="${cellClasses.join(' ')}" 
                            data-date="${day.dateISO}" 
                            data-emp-id="${emp.id}" 
                            title="Click to edit activities for ${escapeHtml(emp.name)} on ${day.dateDisplay}">
                            <div class="cell-content">
                                ${actBadges}
                            </div>
                        </td>
                    `;
                }
            });

            bodyHtml += `</tr>`;
        });

        dom.scheduleTableBody.innerHTML = bodyHtml;

        // Attach Cell Click Event Listeners
        dom.scheduleTableBody.querySelectorAll('.cell-editable').forEach(td => {
            td.addEventListener('click', () => {
                const dateISO = td.dataset.date;
                const empId = Number(td.dataset.empId);
                openCellEditModal(dateISO, empId);
            });
        });

        // Run validation & update conflict badges
        runValidationAudit();
    }

    // -------------------------------------------------------------
    // Schedule Statistics & Conflict Audit
    // -------------------------------------------------------------
    function updateHeaderAndStats() {
        const stats = SchedulerEngine.getScheduleStats();
        const monthName = CalendarEngine.MONTH_NAMES[state.currentMonth - 1];

        // Update display titles
        const printSub = document.getElementById('printScheduleSubtitle');
        if (printSub) {
            printSub.textContent = `Work Distribution Schedule, Month: ${monthName}-${state.currentYear}`;
        }

        // Update official institutional sign-off details
        const signDateEl = document.getElementById('scheduleSignDate');
        if (signDateEl) {
            if (state.currentYear === 2026 && state.currentMonth === 10) {
                signDateEl.textContent = '30/09/2026';
            } else {
                const prevLast = new Date(state.currentYear, state.currentMonth - 1, 0);
                const dd = String(prevLast.getDate()).padStart(2, '0');
                const mm = String(prevLast.getMonth() + 1).padStart(2, '0');
                signDateEl.textContent = `${dd}/${mm}/${prevLast.getFullYear()}`;
            }
        }
        const prepEl = document.getElementById('schedulePreparedBy');
        if (prepEl) {
            const settings = StorageManager.get(StorageManager.KEYS.SETTINGS, {});
            let prep = settings.preparedBy || 'Q.C. Manager';
            if (prep === 'Scientific Officer' || prep.includes('Scientific Officer')) {
                prep = 'Q.C. Manager';
                settings.preparedBy = 'Q.C. Manager';
                StorageManager.set(StorageManager.KEYS.SETTINGS, settings);
            }
            prepEl.textContent = prep;
        }
        const apprvEl = document.getElementById('scheduleApprovedBy');
        if (apprvEl) {
            const settings = StorageManager.get(StorageManager.KEYS.SETTINGS, {});
            apprvEl.textContent = settings.approvedBy || 'Director, SICART';
        }

        if (!dom.statsContainer) return;

        let workloadBarsHtml = '';
        Object.keys(stats.employeeWorkloads).forEach(id => {
            const w = stats.employeeWorkloads[id];
            const maxRef = Math.max(1, stats.workingDays * 2);
            const pct = Math.min(100, Math.round((w.count / maxRef) * 100));

            workloadBarsHtml += `
                <div class="stat-workload-item">
                    <div class="stat-workload-header">
                        <span class="stat-emp-name">${escapeHtml(w.employee.name)}</span>
                        <span class="stat-emp-count"><strong>${w.count}</strong> activities</span>
                    </div>
                    <div class="stat-workload-track">
                        <div class="stat-workload-bar" style="width: ${pct}%"></div>
                    </div>
                </div>
            `;
        });

        // Calculate workload balance metrics
        const counts = Object.values(stats.employeeWorkloads).map(w => w.count);
        const minCount = counts.length > 0 ? Math.min(...counts) : 0;
        const maxCount = counts.length > 0 ? Math.max(...counts) : 0;
        const diff = maxCount - minCount;

        let balanceBadge = '';
        if (counts.length > 0) {
            if (diff === 0) {
                balanceBadge = `<span class="badge badge-success" style="font-size: 11px; padding: 4px 10px;">⚖️ 100% Equal Workload (${maxCount} tasks/employee)</span>`;
            } else if (diff === 1) {
                balanceBadge = `<span class="badge badge-success" style="font-size: 11px; padding: 4px 10px;">⚖️ Balanced (Difference ≤ 1 task)</span>`;
            } else {
                balanceBadge = `<span class="badge badge-warning" style="font-size: 11px; padding: 4px 10px;">⚠️ Workload Variance: ${diff} tasks</span>`;
            }
        }

        dom.statsContainer.innerHTML = `
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-icon">📅</div>
                    <div class="stat-info">
                        <span class="stat-label">Working Days</span>
                        <span class="stat-value">${stats.workingDays}</span>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">☀️</div>
                    <div class="stat-info">
                        <span class="stat-label">Sundays</span>
                        <span class="stat-value">${stats.sundays}</span>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">🏖️</div>
                    <div class="stat-info">
                        <span class="stat-label">Other Holidays</span>
                        <span class="stat-value">${stats.otherHolidays}</span>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">👥</div>
                    <div class="stat-info">
                        <span class="stat-label">Total Staff</span>
                        <span class="stat-value">${stats.totalEmployees}</span>
                    </div>
                </div>
                <div class="stat-card stat-card-highlight">
                    <div class="stat-icon">📊</div>
                    <div class="stat-info">
                        <span class="stat-label">Total Assignments</span>
                        <span class="stat-value">${stats.totalAssignments}</span>
                    </div>
                </div>
            </div>
            
            <div class="workload-breakdown-card">
                <div class="workload-title" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                    <span>⚡ Employee Workload Distribution (${monthName} ${state.currentYear})</span>
                    ${balanceBadge}
                </div>
                <div class="workload-list">
                    ${workloadBarsHtml}
                </div>
            </div>
        `;
    }

    function runValidationAudit() {
        const schedule = SchedulerEngine.getSchedule();
        const conflicts = ValidationEngine.validateSchedule(state.currentYear, state.currentMonth, schedule);
        state.conflicts = conflicts;

        if (!dom.conflictAlert || !dom.conflictCount) return;

        const dangerList = conflicts.filter(c => c.severity === 'danger');

        if (dangerList.length > 0) {
            dom.conflictAlert.style.display = 'inline-flex';
            dom.conflictAlert.className = 'conflict-banner warning';
            dom.conflictCount.textContent = `${dangerList.length} Violation${dangerList.length > 1 ? 's' : ''} Detected`;
        } else {
            dom.conflictAlert.style.display = 'inline-flex';
            dom.conflictAlert.className = 'conflict-banner clean';
            dom.conflictCount.textContent = 'All Valid (0 Violations)';
        }
    }

    function showConflictModal() {
        if (!dom.conflictModal) return;
        const body = document.getElementById('conflictModalBody');
        if (!body) return;

        if (state.conflicts.length === 0) {
            body.innerHTML = `
                <div class="clean-state-box">
                    <div class="clean-icon">✅</div>
                    <h4>Schedule is Fully Compliant</h4>
                    <p>No rule violations, unauthorized instrument assignments, or capacity overflows detected.</p>
                </div>
            `;
        } else {
            let listHtml = '<div class="conflict-list">';
            state.conflicts.forEach((c, idx) => {
                const badgeClass = c.severity === 'danger' ? 'badge-danger' : 'badge-warning';
                listHtml += `
                    <div class="conflict-item ${c.severity}">
                        <div class="conflict-item-header">
                            <span class="conflict-type-badge ${badgeClass}">${escapeHtml(c.type.replace('_', ' ').toUpperCase())}</span>
                            <span class="conflict-date">${c.dateDisplay}</span>
                        </div>
                        <div class="conflict-msg">${escapeHtml(c.message)}</div>
                        <div class="conflict-actions">
                            <button class="btn btn-sm btn-outline" onclick="App.jumpToCell('${c.dateISO}', ${c.employeeId})">View & Resolve</button>
                        </div>
                    </div>
                `;
            });
            listHtml += '</div>';
            body.innerHTML = listHtml;
        }

        openModal(dom.conflictModal);
    }

    function jumpToCell(dateISO, employeeId) {
        closeModal(dom.conflictModal);
        openCellEditModal(dateISO, employeeId);
    }

    // -------------------------------------------------------------
    // Cell Edit Modal (Interactive Multi-Select with Symbols)
    // -------------------------------------------------------------
    function openCellEditModal(dateISO, employeeId) {
        if (HolidayManager.isSunday(dateISO)) {
            showToast('Sundays are strictly holidays and cannot be edited.', 'warning');
            return;
        }

        const employee = EmployeeManager.getById(employeeId);
        if (!employee) return;

        state.editingCell = { dateISO, employeeId };

        const [y, m, d] = dateISO.split('-').map(Number);
        const dayMeta = CalendarEngine.generateMonthDays(y, m, HolidayManager.getAll()).find(dItem => dItem.dateISO === dateISO);
        const currentAssignments = SchedulerEngine.getCellAssignments(dateISO, employeeId);

        // Header info
        document.getElementById('cellModalTitle').textContent = `Assign Work — ${employee.name}`;
        document.getElementById('cellModalSubtitle').textContent = `${dayMeta ? dayMeta.dayName : ''}, ${CalendarEngine.isoToDisplay(dateISO)} • ${employee.designation || 'Staff'}`;

        renderCellModalActivityList(currentAssignments, employeeId);
        openModal(dom.cellModal);
    }

    function renderCellModalActivityList(currentAssignments, employeeId, searchFilter = '') {
        const container = document.getElementById('cellModalActivitiesList');
        if (!container) return;

        const allActivities = ActivityManager.getActive();
        const authorizedIds = ActivityManager.getEmployeeActivityIds(employeeId);
        const assignedMap = {};

        currentAssignments.forEach(item => {
            assignedMap[Number(item.activityId)] = item.symbol || '';
        });

        // Filter activities if search query
        let filtered = allActivities.filter(a => a.name !== 'Holiday');
        if (searchFilter) {
            const query = searchFilter.toLowerCase();
            filtered = filtered.filter(a =>
                a.name.toLowerCase().includes(query) ||
                a.category.toLowerCase().includes(query) ||
                (a.description && a.description.toLowerCase().includes(query))
            );
        }

        // Sort: Assigned first, then Authorized first, then alphabetically
        filtered.sort((a, b) => {
            const aAssigned = assignedMap[a.id] !== undefined ? 1 : 0;
            const bAssigned = assignedMap[b.id] !== undefined ? 1 : 0;
            if (aAssigned !== bAssigned) return bAssigned - aAssigned;

            const aAuth = authorizedIds.includes(a.id) ? 1 : 0;
            const bAuth = authorizedIds.includes(b.id) ? 1 : 0;
            if (aAuth !== bAuth) return bAuth - aAuth;

            return a.name.localeCompare(b.name);
        });

        let listHtml = '';
        filtered.forEach(act => {
            const isAssigned = assignedMap[act.id] !== undefined;
            const currentSymbol = assignedMap[act.id] || '';
            const isAuth = authorizedIds.includes(act.id);

            listHtml += `
                <div class="cell-modal-item ${isAssigned ? 'selected' : ''}" data-act-id="${act.id}">
                    <div class="item-left">
                        <label class="custom-checkbox">
                            <input type="checkbox" class="act-checkbox" value="${act.id}" ${isAssigned ? 'checked' : ''}>
                            <span class="checkmark"></span>
                        </label>
                        <div class="act-info">
                            <div class="act-title-row">
                                <span class="act-title">${escapeHtml(act.name)}</span>
                                <span class="badge badge-sm badge-cat cat-${act.category.toLowerCase()}">${act.category}</span>
                                ${isAuth ? '<span class="badge badge-sm badge-auth">Authorized</span>' : '<span class="badge badge-sm badge-unauth">Not Mapped</span>'}
                            </div>
                            ${act.description ? `<div class="act-desc">${escapeHtml(act.description)}</div>` : ''}
                        </div>
                    </div>
                    <div class="item-right">
                        <label class="symbol-label">Indicator:</label>
                        <select class="act-symbol-select" data-act-id="${act.id}">
                            <option value="" ${currentSymbol === '' ? 'selected' : ''}>None (Normal)</option>
                            <option value="*" ${currentSymbol === '*' ? 'selected' : ''}>* (Star Indicator)</option>
                            <option value="✓" ${currentSymbol === '✓' ? 'selected' : ''}>✓ (Single Check)</option>
                            <option value="✓✓" ${currentSymbol === '✓✓' ? 'selected' : ''}>✓✓ (Double Check)</option>
                        </select>
                    </div>
                </div>
            `;
        });

        if (filtered.length === 0) {
            listHtml = `<div class="empty-search-msg">No activities matching "${escapeHtml(searchFilter)}"</div>`;
        }

        container.innerHTML = listHtml;

        // Auto highlight row on checkbox change
        container.querySelectorAll('.act-checkbox').forEach(cb => {
            cb.addEventListener('change', (e) => {
                const parent = e.target.closest('.cell-modal-item');
                parent.classList.toggle('selected', e.target.checked);
            });
        });
    }

    function saveCellModal() {
        if (!state.editingCell) return;
        const { dateISO, employeeId } = state.editingCell;
        const container = document.getElementById('cellModalActivitiesList');
        if (!container) return;

        const newAssignments = [];
        container.querySelectorAll('.cell-modal-item').forEach(item => {
            const cb = item.querySelector('.act-checkbox');
            if (cb && cb.checked) {
                const actId = Number(cb.value);
                const symSelect = item.querySelector('.act-symbol-select');
                const symbol = symSelect ? symSelect.value : '';
                newAssignments.push({
                    activityId: actId,
                    symbol: symbol,
                    isHoliday: false
                });
            }
        });

        SchedulerEngine.updateCellAssignments(dateISO, employeeId, newAssignments);
        closeModal(dom.cellModal);
        renderScheduleTable();
        updateHeaderAndStats();
        showToast('Cell updated successfully!');
    }

    function clearCellModal() {
        if (!state.editingCell) return;
        const { dateISO, employeeId } = state.editingCell;
        SchedulerEngine.updateCellAssignments(dateISO, employeeId, []);
        closeModal(dom.cellModal);
        renderScheduleTable();
        updateHeaderAndStats();
        showToast('Cell assignments cleared!');
    }

    // -------------------------------------------------------------
    // Schedule Actions (Auto-Generate, Save, Reset, Print)
    // -------------------------------------------------------------
    function onAutoGenerate() {
        if (confirm(`Auto-generate rule-based schedule for ${CalendarEngine.MONTH_NAMES[state.currentMonth - 1]} ${state.currentYear}?\n\nThis will balance workloads, respect authorized instruments, and keep Sundays/Holidays off.`)) {
            SchedulerEngine.autoGenerateSchedule();
            renderScheduleTable();
            updateHeaderAndStats();
            showToast('Rule-based schedule successfully generated!');
        }
    }

    function onSaveSchedule() {
        const success = SchedulerEngine.saveCurrentSchedule();
        if (success) {
            showToast(`Schedule for ${CalendarEngine.MONTH_NAMES[state.currentMonth - 1]} ${state.currentYear} saved!`, 'success');
        } else {
            showToast('Failed to save schedule.', 'error');
        }
    }

    function onResetSchedule() {
        if (confirm(`Are you sure you want to clear all working day assignments for ${CalendarEngine.MONTH_NAMES[state.currentMonth - 1]} ${state.currentYear}?\n\nSundays and Holidays will be preserved.`)) {
            SchedulerEngine.resetMonthSchedule();
            renderScheduleTable();
            updateHeaderAndStats();
            showToast('Monthly schedule cleared.');
        }
    }

    function onPrintSchedule() {
        PrintEngine.prepareAndPrint();
    }

    // -------------------------------------------------------------
    // Versioning Handlers
    // -------------------------------------------------------------
    function onOpenVersionModal() {
        const nameInput = document.getElementById('versionNameInput');
        if (nameInput) {
            const versions = StorageManager.getVersions(state.currentYear, state.currentMonth);
            nameInput.value = `Schedule Rev ${versions.length + 1}`;
        }
        openModal(dom.versionModal);
    }

    function saveNewVersion() {
        const nameInput = document.getElementById('versionNameInput');
        const isFinalCheck = document.getElementById('versionIsFinalCheck');
        const name = nameInput ? nameInput.value.trim() : '';
        const isFinal = isFinalCheck ? isFinalCheck.checked : false;

        const schedule = SchedulerEngine.getSchedule();
        StorageManager.saveVersion(state.currentYear, state.currentMonth, name, schedule, isFinal);

        closeModal(dom.versionModal);
        populateVersionSelect();
        showToast(`Saved version: "${name}"`);
    }

    function onMarkFinal() {
        const versions = StorageManager.getVersions(state.currentYear, state.currentMonth);
        if (versions.length === 0) {
            // Save current as final
            StorageManager.saveVersion(state.currentYear, state.currentMonth, 'Final Approved Schedule', SchedulerEngine.getSchedule(), true);
        } else {
            // Pick current active or latest
            const latest = versions[versions.length - 1];
            StorageManager.markVersionFinal(state.currentYear, state.currentMonth, latest.id);
        }
        populateVersionSelect();
        showToast('Schedule marked as FINAL approved version!', 'success');
    }

    function onVersionChanged(e) {
        const verId = e.target.value;
        if (verId === 'current') {
            SchedulerEngine.loadCurrentMonthSchedule();
            renderScheduleTable();
            updateHeaderAndStats();
            return;
        }

        const versions = StorageManager.getVersions(state.currentYear, state.currentMonth);
        const selected = versions.find(v => v.id === verId);
        if (selected && selected.schedule) {
            SchedulerEngine.resetMonthSchedule();
            // Load version schedule
            StorageManager.saveSchedule(state.currentYear, state.currentMonth, selected.schedule);
            SchedulerEngine.loadCurrentMonthSchedule();
            renderScheduleTable();
            updateHeaderAndStats();
            showToast(`Loaded version: ${selected.name}`);
        }
    }

    // -------------------------------------------------------------
    // Employee Management Tab
    // -------------------------------------------------------------
    function renderEmployeeManagement() {
        const container = document.getElementById('employeeListContainer');
        if (!container) return;

        const employees = EmployeeManager.getAll();

        let html = `
            <div class="management-toolbar">
                <div class="search-box">
                    <input type="text" id="empSearchManage" class="form-control" placeholder="Search employees...">
                </div>
                <button class="btn btn-primary" onclick="App.openEmployeeModal()">+ Add New Employee</button>
            </div>
            <div class="table-responsive">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th width="80">Order</th>
                            <th>Code</th>
                            <th>Name</th>
                            <th>Designation</th>
                            <th>Department</th>
                            <th>Status</th>
                            <th width="220">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="empManageTableBody">
        `;

        employees.forEach((emp, idx) => {
            html += `
                <tr class="${!emp.active ? 'row-inactive' : ''}">
                    <td>
                        <div class="order-controls">
                            <button class="btn-icon" onclick="App.moveEmployeeOrder(${emp.id}, 'up')" ${idx === 0 ? 'disabled' : ''} title="Move Up">▲</button>
                            <button class="btn-icon" onclick="App.moveEmployeeOrder(${emp.id}, 'down')" ${idx === employees.length - 1 ? 'disabled' : ''} title="Move Down">▼</button>
                        </div>
                    </td>
                    <td><strong>${escapeHtml(emp.code || '')}</strong></td>
                    <td><strong>${escapeHtml(emp.name)}</strong></td>
                    <td>${escapeHtml(emp.designation || '')}</td>
                    <td>${escapeHtml(emp.department || '')}</td>
                    <td>
                        <span class="badge ${emp.active ? 'badge-active' : 'badge-inactive'}">
                            ${emp.active ? 'Active' : 'Inactive'}
                        </span>
                    </td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn btn-sm btn-outline" onclick="App.openEmployeeModal(${emp.id})">Edit</button>
                            <button class="btn btn-sm ${emp.active ? 'btn-warning-outline' : 'btn-success-outline'}" onclick="App.toggleEmployeeActive(${emp.id})">
                                ${emp.active ? 'Disable' : 'Enable'}
                            </button>
                            <button class="btn btn-sm btn-danger-outline" onclick="App.deleteEmployee(${emp.id})">Delete</button>
                        </div>
                    </td>
                </tr>
            `;
        });

        html += `
                    </tbody>
                </table>
            </div>
        `;

        container.innerHTML = html;

        // Search in list
        document.getElementById('empSearchManage')?.addEventListener('input', (e) => {
            const q = e.target.value.toLowerCase();
            document.querySelectorAll('#empManageTableBody tr').forEach(row => {
                const text = row.textContent.toLowerCase();
                row.style.display = text.includes(q) ? '' : 'none';
            });
        });
    }

    function openEmployeeModal(empId = null) {
        const title = document.getElementById('empModalTitle');
        const idInput = document.getElementById('empIdInput');
        const nameInput = document.getElementById('empNameInput');
        const codeInput = document.getElementById('empCodeInput');
        const desigInput = document.getElementById('empDesignationInput');
        const deptInput = document.getElementById('empDeptInput');
        const activeCheck = document.getElementById('empActiveCheck');

        if (empId) {
            const emp = EmployeeManager.getById(empId);
            if (!emp) return;
            title.textContent = 'Edit Employee';
            idInput.value = emp.id;
            nameInput.value = emp.name;
            codeInput.value = emp.code;
            desigInput.value = emp.designation;
            deptInput.value = emp.department;
            activeCheck.checked = emp.active !== false;
        } else {
            title.textContent = 'Add New Employee';
            idInput.value = '';
            nameInput.value = '';
            codeInput.value = '';
            desigInput.value = 'Scientific Officer';
            deptInput.value = 'Analytical Lab';
            activeCheck.checked = true;
        }

        openModal(dom.employeeModal);
    }

    function saveEmployeeModal() {
        const id = document.getElementById('empIdInput').value;
        const name = document.getElementById('empNameInput').value.trim();
        const code = document.getElementById('empCodeInput').value.trim();
        const designation = document.getElementById('empDesignationInput').value.trim();
        const department = document.getElementById('empDeptInput').value.trim();
        const active = document.getElementById('empActiveCheck').checked;

        if (!name) {
            alert('Employee Name is required.');
            return;
        }

        if (id) {
            EmployeeManager.update(id, { name, code, designation, department, active });
            showToast('Employee updated successfully!');
        } else {
            EmployeeManager.add({ name, code, designation, department, active });
            showToast('New employee added!');
        }

        closeModal(dom.employeeModal);
        renderEmployeeManagement();
        renderScheduleTable();
        updateHeaderAndStats();
    }

    function toggleEmployeeActive(id) {
        EmployeeManager.toggleActive(id);
        renderEmployeeManagement();
        renderScheduleTable();
        updateHeaderAndStats();
    }

    function deleteEmployee(id) {
        const emp = EmployeeManager.getById(id);
        if (!emp) return;

        if (confirm(`Are you sure you want to delete employee "${emp.name}"?\nThis will remove them from the schedule and activity mappings.`)) {
            EmployeeManager.remove(id);
            renderEmployeeManagement();
            renderScheduleTable();
            updateHeaderAndStats();
            showToast(`Deleted employee "${emp.name}"`);
        }
    }

    function moveEmployeeOrder(id, direction) {
        EmployeeManager.moveOrder(id, direction);
        renderEmployeeManagement();
        renderScheduleTable();
    }

    // -------------------------------------------------------------
    // Instruments & QA/QC Activities Management Tabs
    // -------------------------------------------------------------
    function renderInstrumentManagement() {
        renderActivityTableSection('instrumentListContainer', 'Instrument');
    }

    function renderQAQCManagement() {
        renderActivityTableSection('qaqcListContainer', 'QAQC');
    }

    function renderActivityTableSection(containerId, sectionType) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const allActivities = ActivityManager.getAll();
        const activities = (sectionType === 'Instrument')
            ? allActivities.filter(a => a.category === 'Instrument' || a.category === 'Laboratory')
            : allActivities.filter(a => a.category !== 'Instrument' && a.category !== 'Laboratory');

        const title = sectionType === 'Instrument' ? 'Instruments & Laboratories' : 'QA/QC, Training & Administrative Tasks';

        let html = `
            <div class="management-toolbar">
                <div class="search-box">
                    <input type="text" id="actSearch_${sectionType}" class="form-control" placeholder="Search activities...">
                </div>
                <button class="btn btn-primary" onclick="App.openActivityModal(null, '${sectionType}')">+ Add New ${sectionType === 'Instrument' ? 'Instrument' : 'Task'}</button>
            </div>
            <div class="table-responsive">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Code</th>
                            <th>Name</th>
                            <th>Category</th>
                            <th>Priority</th>
                            <th>Description</th>
                            <th>Status</th>
                            <th width="200">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="actBody_${sectionType}">
        `;

        activities.forEach(act => {
            const isProtected = act.name === 'Holiday';
            html += `
                <tr class="${!act.active ? 'row-inactive' : ''}">
                    <td><strong>${escapeHtml(act.code || '')}</strong></td>
                    <td><strong>${escapeHtml(act.name)}</strong></td>
                    <td><span class="badge badge-cat cat-${act.category.toLowerCase()}">${act.category}</span></td>
                    <td><span class="badge badge-priority prio-${act.priority.toLowerCase()}">${act.priority}</span></td>
                    <td>${escapeHtml(act.description || '')}</td>
                    <td>
                        <span class="badge ${act.active ? 'badge-active' : 'badge-inactive'}">
                            ${act.active ? 'Active' : 'Inactive'}
                        </span>
                    </td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn btn-sm btn-outline" onclick="App.openActivityModal(${act.id}, '${sectionType}')">Edit</button>
                            ${!isProtected ? `
                                <button class="btn btn-sm ${act.active ? 'btn-warning-outline' : 'btn-success-outline'}" onclick="App.toggleActivityActive(${act.id}, '${sectionType}')">
                                    ${act.active ? 'Disable' : 'Enable'}
                                </button>
                                <button class="btn btn-sm btn-danger-outline" onclick="App.deleteActivity(${act.id}, '${sectionType}')">Delete</button>
                            ` : '<span class="text-muted text-sm">System Locked</span>'}
                        </div>
                    </td>
                </tr>
            `;
        });

        html += `
                    </tbody>
                </table>
            </div>
        `;

        container.innerHTML = html;

        document.getElementById(`actSearch_${sectionType}`)?.addEventListener('input', (e) => {
            const q = e.target.value.toLowerCase();
            document.querySelectorAll(`#actBody_${sectionType} tr`).forEach(row => {
                row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
            });
        });
    }

    function openActivityModal(actId = null, sectionType = 'Instrument') {
        const title = document.getElementById('actModalTitle');
        const idInput = document.getElementById('actIdInput');
        const nameInput = document.getElementById('actNameInput');
        const codeInput = document.getElementById('actCodeInput');
        const catSelect = document.getElementById('actCategorySelect');
        const prioSelect = document.getElementById('actPrioritySelect');
        const descInput = document.getElementById('actDescInput');
        const activeCheck = document.getElementById('actActiveCheck');

        catSelect.innerHTML = '';
        ActivityManager.CATEGORIES.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat;
            opt.textContent = cat;
            catSelect.appendChild(opt);
        });

        if (actId) {
            const act = ActivityManager.getById(actId);
            if (!act) return;
            title.textContent = 'Edit Activity / Instrument';
            idInput.value = act.id;
            nameInput.value = act.name;
            codeInput.value = act.code;
            catSelect.value = act.category;
            prioSelect.value = act.priority;
            descInput.value = act.description || '';
            activeCheck.checked = act.active !== false;
        } else {
            title.textContent = 'Add New Activity / Instrument';
            idInput.value = '';
            nameInput.value = '';
            codeInput.value = '';
            catSelect.value = (sectionType === 'Instrument') ? 'Instrument' : 'QA';
            prioSelect.value = 'High';
            descInput.value = '';
            activeCheck.checked = true;
        }

        openModal(dom.activityModal);
    }

    function saveActivityModal() {
        const id = document.getElementById('actIdInput').value;
        const name = document.getElementById('actNameInput').value.trim();
        const code = document.getElementById('actCodeInput').value.trim();
        const category = document.getElementById('actCategorySelect').value;
        const priority = document.getElementById('actPrioritySelect').value;
        const description = document.getElementById('actDescInput').value.trim();
        const active = document.getElementById('actActiveCheck').checked;

        if (!name) {
            alert('Activity Name is required.');
            return;
        }

        if (id) {
            ActivityManager.update(id, { name, code, category, priority, description, active });
            showToast('Activity updated successfully!');
        } else {
            ActivityManager.add({ name, code, category, priority, description, active });
            showToast('New activity added!');
        }

        closeModal(dom.activityModal);
        populateActivityFilterDropdown();
        renderInstrumentManagement();
        renderQAQCManagement();
        renderScheduleTable();
    }

    function toggleActivityActive(id, sectionType) {
        ActivityManager.toggleActive(id);
        renderActivityTableSection(sectionType === 'Instrument' ? 'instrumentListContainer' : 'qaqcListContainer', sectionType);
        populateActivityFilterDropdown();
        renderScheduleTable();
    }

    function deleteActivity(id, sectionType) {
        const act = ActivityManager.getById(id);
        if (!act) return;

        if (confirm(`Are you sure you want to delete "${act.name}"?\nThis will remove it from all employee authorizations.`)) {
            ActivityManager.remove(id);
            renderActivityTableSection(sectionType === 'Instrument' ? 'instrumentListContainer' : 'qaqcListContainer', sectionType);
            populateActivityFilterDropdown();
            renderScheduleTable();
            showToast(`Deleted "${act.name}"`);
        }
    }

    // -------------------------------------------------------------
    // Employee <-> Activity Mapping Tab (Section 10)
    // -------------------------------------------------------------
    function renderMappingManagement() {
        const container = document.getElementById('mappingContainer');
        if (!container) return;

        const employees = EmployeeManager.getActive();
        const activities = ActivityManager.getActive().filter(a => a.name !== 'Holiday');
        const mappings = ActivityManager.getMappings();
        const fixedAssignments = ActivityManager.getFixedAssignments();

        let html = `
            <div class="mapping-intro">
                <div class="alert alert-info">
                    <strong>Rule-Based Authorization Matrix:</strong> Check the activities each employee is authorized to perform. 
                    The automatic scheduling engine will strictly assign only authorized instruments to each employee.
                </div>
            </div>
            
            <div class="table-responsive matrix-container">
                <table class="data-table matrix-table">
                    <thead>
                        <tr>
                            <th class="sticky-col-matrix">Employee Name</th>
                            <th width="220">Fixed Assignment</th>
        `;

        activities.forEach(act => {
            html += `
                <th class="matrix-act-th" title="${escapeHtml(act.name)} (${act.category})">
                    <div class="matrix-act-header">
                        <span class="matrix-act-name">${escapeHtml(act.name)}</span>
                        <span class="badge badge-xs cat-${act.category.toLowerCase()}">${act.category}</span>
                    </div>
                </th>
            `;
        });

        html += `
                        </tr>
                    </thead>
                    <tbody>
        `;

        employees.forEach(emp => {
            const empAuthIds = (mappings[emp.id] || []).map(Number);
            const currentFixedId = fixedAssignments[emp.id] || '';

            html += `
                <tr>
                    <td class="sticky-col-matrix">
                        <strong>${escapeHtml(emp.name)}</strong>
                        <div class="text-muted text-xs">${escapeHtml(emp.designation || '')}</div>
                    </td>
                    <td>
                        <select class="form-control form-control-sm fixed-assign-select" onchange="App.setEmployeeFixedAssignment(${emp.id}, this.value)">
                            <option value="">-- None (Dynamic) --</option>
            `;

            activities.forEach(a => {
                const isSelected = Number(currentFixedId) === Number(a.id);
                html += `<option value="${a.id}" ${isSelected ? 'selected' : ''}>${escapeHtml(a.name)}</option>`;
            });

            html += `
                        </select>
                    </td>
            `;

            activities.forEach(act => {
                const isChecked = empAuthIds.includes(Number(act.id));
                html += `
                    <td class="text-center matrix-cell ${isChecked ? 'mapped-checked' : ''}">
                        <label class="custom-checkbox">
                            <input type="checkbox" onchange="App.toggleMappingCheck(${emp.id}, ${act.id}, this.checked)" ${isChecked ? 'checked' : ''}>
                            <span class="checkmark"></span>
                        </label>
                    </td>
                `;
            });

            html += `</tr>`;
        });

        html += `
                    </tbody>
                </table>
            </div>
        `;

        container.innerHTML = html;
    }

    function toggleMappingCheck(employeeId, activityId, isChecked) {
        ActivityManager.toggleEmployeeActivity(employeeId, activityId);
        showToast('Authorization updated');
    }

    function setEmployeeFixedAssignment(employeeId, activityId) {
        ActivityManager.setFixedAssignment(employeeId, activityId);
        showToast('Fixed assignment updated');
    }

    // -------------------------------------------------------------
    // Holiday Management Tab (Section 6)
    // -------------------------------------------------------------
    function renderHolidayManagement() {
        const container = document.getElementById('holidayContainer');
        if (!container) return;

        const monthHolidays = HolidayManager.getHolidaysForMonth(state.currentYear, state.currentMonth);
        const days = CalendarEngine.generateMonthDays(state.currentYear, state.currentMonth, HolidayManager.getAll());
        const sundays = days.filter(d => d.isSunday);

        let html = `
            <div class="row">
                <div class="col-md-6">
                    <div class="panel-card">
                        <div class="panel-header">
                            <h4>Automatic Sunday Rule (Strict)</h4>
                            <span class="badge badge-success">Always Enforced</span>
                        </div>
                        <p class="text-muted text-sm">Every Sunday is automatically and permanently marked as a Holiday for all employees. The system blocks non-holiday assignments on Sundays.</p>
                        <div class="sunday-pills-list">
        `;

        sundays.forEach(sun => {
            html += `
                <div class="sunday-pill">
                    <span class="pill-date">${sun.dateDisplay}</span>
                    <span class="pill-tag">Sunday • Mandatory Holiday</span>
                </div>
            `;
        });

        html += `
                        </div>
                    </div>
                </div>

                <div class="col-md-6">
                    <div class="panel-card">
                        <div class="panel-header">
                            <h4>Manual / Public Holidays (${CalendarEngine.MONTH_NAMES[state.currentMonth - 1]} ${state.currentYear})</h4>
                        </div>
                        <div class="add-holiday-form">
                            <div class="row g-2">
                                <div class="col-sm-5">
                                    <input type="date" id="newHolidayDate" class="form-control" 
                                           min="${CalendarEngine.formatDateISO(state.currentYear, state.currentMonth, 1)}"
                                           max="${CalendarEngine.formatDateISO(state.currentYear, state.currentMonth, CalendarEngine.getDaysInMonth(state.currentYear, state.currentMonth))}">
                                </div>
                                <div class="col-sm-5">
                                    <input type="text" id="newHolidayName" class="form-control" placeholder="e.g. Public Holiday, Festival">
                                </div>
                                <div class="col-sm-2">
                                    <button class="btn btn-primary w-100" onclick="App.addManualHoliday()">+ Add</button>
                                </div>
                            </div>
                        </div>

                        <div class="manual-holiday-list mt-3">
        `;

        if (monthHolidays.length === 0) {
            html += `<div class="empty-state text-muted py-3">No additional holidays configured for this month.</div>`;
        } else {
            monthHolidays.forEach(h => {
                html += `
                    <div class="holiday-row-item">
                        <div class="h-info">
                            <strong>${CalendarEngine.isoToDisplay(h.dateISO)}</strong>
                            <span class="h-name">${escapeHtml(h.name)}</span>
                        </div>
                        <button class="btn btn-sm btn-danger-outline" onclick="App.removeManualHoliday('${h.dateISO}')">Remove</button>
                    </div>
                `;
            });
        }

        html += `
                        </div>
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = html;
    }

    function addManualHoliday() {
        const dateInput = document.getElementById('newHolidayDate');
        const nameInput = document.getElementById('newHolidayName');

        if (!dateInput || !nameInput || !dateInput.value) {
            alert('Please select a valid date for the holiday.');
            return;
        }

        const dateISO = dateInput.value;
        const name = nameInput.value.trim() || 'Public Holiday';

        if (HolidayManager.isSunday(dateISO)) {
            alert('The selected date is already a Sunday (automatic holiday).');
            return;
        }

        HolidayManager.setHoliday(dateISO, name);
        showToast(`Holiday added: ${name}`);
        renderHolidayManagement();
        renderScheduleTable();
        updateHeaderAndStats();
    }

    function removeManualHoliday(dateISO) {
        HolidayManager.removeHoliday(dateISO);
        showToast('Holiday removed');
        renderHolidayManagement();
        renderScheduleTable();
        updateHeaderAndStats();
    }

    // -------------------------------------------------------------
    // System Settings & Backup Tab (Section 17)
    // -------------------------------------------------------------
    function renderBackupSettings() {
        const container = document.getElementById('backupSettingsContainer');
        if (!container) return;

        const settings = StorageManager.get(StorageManager.KEYS.SETTINGS, {});

        let html = `
            <div class="row">
                <div class="col-md-6">
                    <div class="panel-card">
                        <h4>System Backup & Restore (100% Offline)</h4>
                        <p class="text-muted text-sm">Save your complete configuration including all employees, instruments, mappings, holidays, and monthly schedules to a single JSON file.</p>
                        
                        <div class="backup-actions mt-3">
                            <button class="btn btn-primary" onclick="ExportEngine.exportBackupJSON()">
                                📥 Download Full Backup (.JSON)
                            </button>
                            <label class="btn btn-outline" style="cursor: pointer; margin-bottom: 0;">
                                📤 Restore From Backup (.JSON)
                                <input type="file" id="settingsBackupInput" accept=".json" style="display:none" onchange="App.onImportFileSelected(event)">
                            </label>
                        </div>
                        
                        <hr class="my-4">
                        
                        <h4>Reset System</h4>
                        <p class="text-muted text-sm">Reset the application back to its default SICART initial seed data (September 2026 reference configuration).</p>
                        <button class="btn btn-danger-outline" onclick="App.factoryReset()">⚠️ Reset to Default Seed Data</button>
                    </div>
                </div>

                <div class="col-md-6">
                    <div class="panel-card">
                        <h4>Organization & Print Signatures</h4>
                        <div class="mb-3">
                            <label class="form-label">Organization Header:</label>
                            <input type="text" id="settingOrgName" class="form-control" value="${escapeHtml(settings.orgName || 'Sophisticated Instrumentation Center for Applied Research & Testing (SICART)')}">
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Schedule Title:</label>
                            <input type="text" id="settingDeptTitle" class="form-control" value="${escapeHtml(settings.deptTitle || 'Work Distribution Schedule')}">
                        </div>
                        <div class="row g-2 mb-3">
                            <div class="col-md-4">
                                <label class="form-label text-xs">Prepared By Title:</label>
                                <input type="text" id="settingPreparedBy" class="form-control form-control-sm" value="${escapeHtml((settings.preparedBy && !settings.preparedBy.includes('Scientific Officer')) ? settings.preparedBy : 'Q.C. Manager')}">
                            </div>
                            <div class="col-md-4">
                                <label class="form-label text-xs">Checked By Title:</label>
                                <input type="text" id="settingCheckedBy" class="form-control form-control-sm" value="${escapeHtml(settings.checkedBy || 'Head of Department')}">
                            </div>
                            <div class="col-md-4">
                                <label class="form-label text-xs">Approved By Title:</label>
                                <input type="text" id="settingApprovedBy" class="form-control form-control-sm" value="${escapeHtml(settings.approvedBy || 'Director, SICART')}">
                            </div>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Max Allowed Activities Per Employee Per Day:</label>
                            <input type="number" id="settingMaxDaily" class="form-control" min="1" max="5" value="${settings.maxDailyAssignments || 2}">
                        </div>
                        <button class="btn btn-success" onclick="App.saveSettings()">Save Configuration</button>
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = html;
    }

    function saveSettings() {
        const orgName = document.getElementById('settingOrgName')?.value.trim();
        const deptTitle = document.getElementById('settingDeptTitle')?.value.trim();
        const preparedBy = document.getElementById('settingPreparedBy')?.value.trim();
        const checkedBy = document.getElementById('settingCheckedBy')?.value.trim();
        const approvedBy = document.getElementById('settingApprovedBy')?.value.trim();
        const maxDaily = Number(document.getElementById('settingMaxDaily')?.value) || 2;

        const settings = {
            orgName,
            deptTitle,
            preparedBy,
            checkedBy,
            approvedBy,
            maxDailyAssignments: maxDaily
        };

        StorageManager.set(StorageManager.KEYS.SETTINGS, settings);

        // Update print signature titles and schedule signoff
        if (document.getElementById('sigPreparedTitle')) {
            document.getElementById('sigPreparedTitle').textContent = preparedBy;
        }
        if (document.getElementById('schedulePreparedBy')) {
            document.getElementById('schedulePreparedBy').textContent = preparedBy;
        }
        if (document.getElementById('sigCheckedTitle')) {
            document.getElementById('sigCheckedTitle').textContent = checkedBy;
        }
        if (document.getElementById('sigApprovedTitle')) {
            document.getElementById('sigApprovedTitle').textContent = approvedBy;
        }
        if (document.getElementById('scheduleApprovedBy')) {
            document.getElementById('scheduleApprovedBy').textContent = approvedBy;
        }

        showToast('Settings saved successfully!');
    }

    function onImportFileSelected(e) {
        const file = e.target.files[0];
        if (!file) return;

        if (confirm('Importing this backup will overwrite current data. Continue?')) {
            ExportEngine.importBackupJSON(file)
                .then(() => {
                    EmployeeManager.load();
                    ActivityManager.load();
                    HolidayManager.load();
                    SchedulerEngine.init(state.currentYear, state.currentMonth);
                    populateMonthYearPickers();
                    renderCurrentView();
                    updateHeaderAndStats();
                    showToast('Backup restored successfully!', 'success');
                })
                .catch(err => {
                    alert('Error importing backup: ' + err.message);
                });
        }
        e.target.value = '';
    }

    function factoryReset() {
        if (confirm('Are you sure you want to reset all data back to the default SICART initial setup? All custom modifications will be lost.')) {
            StorageManager.resetToFactoryDefaults();
            EmployeeManager.load();
            ActivityManager.load();
            HolidayManager.load();
            SchedulerEngine.init(2026, 9);
            state.currentYear = 2026;
            state.currentMonth = 9;
            populateMonthYearPickers();
            renderCurrentView();
            updateHeaderAndStats();
            showToast('System reset to default seed data!', 'success');
        }
    }

    // -------------------------------------------------------------
    // Generic Modal & Toast Utilities
    // -------------------------------------------------------------
    function openModal(modalEl) {
        if (!modalEl) return;
        modalEl.classList.add('show');
        document.body.classList.add('modal-open');
    }

    function closeModal(modalEl) {
        if (!modalEl) return;
        modalEl.classList.remove('show');
        document.body.classList.remove('modal-open');
    }

    function showToast(message, type = 'info') {
        const toast = dom.toast;
        if (!toast) return;
        toast.textContent = message;
        toast.className = `app-toast toast-${type} show`;
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3200);
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    return {
        init,
        switchTab,
        changeMonthYear,
        renderScheduleTable,
        openCellEditModal,
        renderCellModalActivityList,
        saveCellModal,
        clearCellModal,
        openEmployeeModal,
        saveEmployeeModal,
        toggleEmployeeActive,
        deleteEmployee,
        moveEmployeeOrder,
        openActivityModal,
        saveActivityModal,
        toggleActivityActive,
        deleteActivity,
        toggleMappingCheck,
        setEmployeeFixedAssignment,
        addManualHoliday,
        removeManualHoliday,
        saveNewVersion,
        saveSettings,
        onImportFileSelected,
        factoryReset,
        jumpToCell,
        closeModal,
        showConflictModal
    };
})();

// Bootstrap application immediately or on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        App.init();
    });
} else {
    App.init();
}
