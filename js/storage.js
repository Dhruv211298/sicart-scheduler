/* ==========================================================================
   SICART Scheduling System - Local Storage Manager
   100% Client-Side Offline Persistence
   ========================================================================== */

const StorageManager = (() => {
    const PREFIX = 'sicart_';

    // Storage Keys
    const KEYS = {
        EMPLOYEES: PREFIX + 'employees',
        ACTIVITIES: PREFIX + 'activities',
        MAPPINGS: PREFIX + 'mappings',
        FIXED_ASSIGNMENTS: PREFIX + 'fixed_assignments',
        HOLIDAYS: PREFIX + 'holidays',
        SCHEDULES: PREFIX + 'schedules',
        VERSIONS: PREFIX + 'versions',
        SETTINGS: PREFIX + 'settings'
    };

    // Initial Default Seed Data (Synchronized with Official SICART Institutional Schedule)
    const DEFAULT_EMPLOYEES = [
        { id: 1, code: 'EMP001', name: 'Ms. Tulsiben', designation: 'Senior Scientific Officer', department: 'Analytical Lab', active: true, order: 1 },
        { id: 2, code: 'EMP002', name: 'Ms. Grishmaben', designation: 'Scientific Officer', department: 'Thermal Analysis', active: true, order: 2 },
        { id: 3, code: 'EMP003', name: 'Ms. Nandita Mahajan', designation: 'Scientific Officer', department: 'Wet Lab & Analytical Testing', active: true, order: 3 },
        { id: 4, code: 'EMP004', name: 'Mr. Himanshu', designation: 'Senior Technical Officer', department: 'Spectroscopy & X-Ray', active: true, order: 4 },
        { id: 5, code: 'EMP005', name: 'Mr. Mihirbhai', designation: 'Technical Officer', department: 'Physical & Wet Lab', active: true, order: 5 },
        { id: 6, code: 'EMP006', name: 'Mr. Raj Thakkar', designation: 'Technical Officer', department: 'Instrumentation & Training', active: true, order: 6 }
    ];

    const DEFAULT_ACTIVITIES = [
        // QA & QC Special Notations
        { id: 12, code: 'ACT012', name: 'QA activity', category: 'QA', symbol: '✓✓', priority: 'High', description: 'QA related activities such as Test Report Preparation, Sample Retention etc. (1st Priority)', active: true },
        { id: 13, code: 'ACT013', name: 'QC activity (Sample Warden)', category: 'QC', symbol: '✓', priority: 'High', description: 'QC (Sample Warden) related activities: Test Request Review, Sample Distribution, Tray Preparation for next day (1st Priority)', active: true },

        // Instruments & Laboratories from Official SICART Schedule
        { id: 1, code: 'ACT001', name: 'UV/FTIR/HPTLC*GC/GCMS*', category: 'Instrument', symbol: '*', priority: 'High', description: 'Spectrophotometry & Gas Chromatography / Mass Spectrometry', active: true },
        { id: 2, code: 'ACT002', name: 'Thermal/CHNSO/HPLC/LC-MS-MS/PSA', category: 'Instrument', symbol: '', priority: 'High', description: 'Thermal Characterization, Elemental, Liquid Chromatography & PSA', active: true },
        { id: 3, code: 'ACT003', name: 'WD-XRF/XRD/WaterPurificationsystem', category: 'Instrument', symbol: '', priority: 'High', description: 'WD-XRF, XRD & Water Purification System Management', active: true },
        { id: 4, code: 'ACT004', name: 'PSA/Wet-Lab/Env. Audit', category: 'Laboratory', symbol: '', priority: 'High', description: 'Particle Size Analyzer, Wet Chemical Lab & Environmental Audit', active: true },
        
        // Training Programs
        { id: 5, code: 'ACT005', name: 'Wet lab Training', category: 'Training', symbol: '', priority: 'Medium', description: 'Standard Wet Laboratory Chemical & Analytical Training', active: true },
        { id: 6, code: 'ACT006', name: 'Induction Training', category: 'Training', symbol: '', priority: 'Medium', description: 'SICART Organizational & Laboratory Induction Program', active: true },
        { id: 7, code: 'ACT007', name: 'Training in QA & QC Section', category: 'Training', symbol: '', priority: 'Medium', description: 'Quality Assurance & Quality Control Procedures & Protocols', active: true },
        { id: 8, code: 'ACT008', name: 'Training on WD-XRF/Waterpurificationsystem/ICP-OES', category: 'Training', symbol: '', priority: 'Medium', description: 'Advanced Spectrometry & Water Purification Training', active: true },

        // Additional / Legacy Instruments for Flexibility
        { id: 9, code: 'ACT009', name: 'Wet-Lab', category: 'Laboratory', symbol: '', priority: 'Medium', description: 'Standard Chemical Wet Laboratory Testing', active: true },
        { id: 10, code: 'ACT010', name: 'Environmental Audit', category: 'Administrative', symbol: '', priority: 'High', description: 'Industrial environmental auditing & compliance', active: true },

        // Administrative / Holiday
        { id: 14, code: 'ACT014', name: 'Holiday', category: 'Administrative', symbol: '', priority: 'High', description: 'Official Holiday / Sunday weekly off', active: true }
    ];

    // Default Employee Authorization Mappings (Employee ID -> Activity IDs)
    const DEFAULT_MAPPINGS = {
        1: [1, 9, 12, 13],               // Ms. Tulsiben: UV/FTIR/HPTLC*GC/GCMS*, Wet-Lab, QA, QC
        2: [2, 9, 12, 13],               // Ms. Grishmaben: Thermal/CHNSO/HPLC/LC-MS-MS/PSA, Wet-Lab, QA, QC
        3: [5, 9, 12, 13],               // Ms. Nandita Mahajan: Wet lab Training, Wet-Lab, QA, QC
        4: [3, 9, 12, 13],               // Mr. Himanshu: WD-XRF/XRD/WaterPurificationsystem, QA, QC
        5: [4, 9, 10, 12, 13],           // Mr. Mihirbhai: PSA/Wet-Lab/Env. Audit, Wet-Lab, Env. Audit, QA, QC
        6: [6, 7, 8, 9, 12, 13]          // Mr. Raj Thakkar: Induction Training, Training QA/QC, Training WD-XRF/ICP-OES, QA, QC
    };

    // Default Fixed Assignments (employeeId -> activityId)
    const DEFAULT_FIXED = {
        1: 1, // Ms. Tulsiben -> UV/FTIR/HPTLC*GC/GCMS*
        2: 2, // Ms. Grishmaben -> Thermal/CHNSO/HPLC/LC-MS-MS/PSA
        3: 5, // Ms. Nandita Mahajan -> Wet lab Training
        4: 3, // Mr. Himanshu -> WD-XRF/XRD/WaterPurificationsystem
        5: 4  // Mr. Mihirbhai -> PSA/Wet-Lab/Env. Audit
    };

    // Official Holidays from SICART October 2026 Schedule & National Calendar
    const DEFAULT_HOLIDAYS = {
        '2026-10-02': 'Gandhi Jayanti',
        '2026-10-20': 'Dussehra / Vijayadashami',
        '2026-10-24': 'Fourth Saturday',
        '2026-10-31': 'Holiday',
        '2026-11-09': 'Diwali'
    };

    // Official Institutional Settings
    const DEFAULT_SETTINGS = {
        orgName: 'Sophisticated Instrumentation Centre for Applied Research & Testing (SICART)',
        deptTitle: 'Work Distribution Schedule',
        maxDailyAssignments: 2,
        preparedBy: 'Q.C. Manager',
        checkedBy: 'Head of Department',
        approvedBy: 'Director, SICART',
        scheduleDate: '30/09/2026'
    };

    // Helper functions
    function get(key, defaultValue = null) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : defaultValue;
        } catch (e) {
            console.error('Storage get error for key: ' + key, e);
            return defaultValue;
        }
    }

    function set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.error('Storage set error for key: ' + key, e);
            return false;
        }
    }

    function remove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (e) {
            console.error('Storage remove error for key: ' + key, e);
            return false;
        }
    }

    // Initialize Default Data if not already present or refresh if outdated roster
    function init() {
        const storedEmps = get(KEYS.EMPLOYEES);
        const needsRosterRefresh = !storedEmps || (Array.isArray(storedEmps) && storedEmps.some(e => e.name === 'Ms. Mohana Priya' || e.name === 'Mr. Adnan Muman' || e.name === 'Mr. Mihrabhai'));
        
        if (needsRosterRefresh) {
            set(KEYS.EMPLOYEES, DEFAULT_EMPLOYEES);
            set(KEYS.ACTIVITIES, DEFAULT_ACTIVITIES);
            set(KEYS.MAPPINGS, DEFAULT_MAPPINGS);
            set(KEYS.FIXED_ASSIGNMENTS, DEFAULT_FIXED);
            set(KEYS.HOLIDAYS, DEFAULT_HOLIDAYS);
            set(KEYS.SETTINGS, DEFAULT_SETTINGS);
        } else {
            if (!get(KEYS.ACTIVITIES)) set(KEYS.ACTIVITIES, DEFAULT_ACTIVITIES);
            if (!get(KEYS.MAPPINGS)) set(KEYS.MAPPINGS, DEFAULT_MAPPINGS);
            if (!get(KEYS.FIXED_ASSIGNMENTS)) set(KEYS.FIXED_ASSIGNMENTS, DEFAULT_FIXED);
            if (!get(KEYS.HOLIDAYS)) set(KEYS.HOLIDAYS, DEFAULT_HOLIDAYS);
            
            let currentSettings = get(KEYS.SETTINGS);
            if (!currentSettings) {
                set(KEYS.SETTINGS, DEFAULT_SETTINGS);
            } else if (!currentSettings.preparedBy || currentSettings.preparedBy === 'Scientific Officer' || currentSettings.preparedBy.includes('Scientific Officer')) {
                currentSettings.preparedBy = 'Q.C. Manager';
                set(KEYS.SETTINGS, currentSettings);
            }
        }
        if (!get(KEYS.VERSIONS)) {
            set(KEYS.VERSIONS, {});
        }
    }

    // Schedule Storage per Month/Year: `schedule_YYYY_MM`
    function getScheduleKey(year, month) {
        const m = String(month).padStart(2, '0');
        return `${PREFIX}schedule_${year}_${m}`;
    }

    function loadSchedule(year, month) {
        return get(getScheduleKey(year, month), null);
    }

    function saveSchedule(year, month, scheduleData) {
        return set(getScheduleKey(year, month), scheduleData);
    }

    function removeSchedule(year, month) {
        return remove(getScheduleKey(year, month));
    }

    // Versioning Management
    function getVersions(year, month) {
        const allVersions = get(KEYS.VERSIONS, {});
        const key = `${year}_${String(month).padStart(2, '0')}`;
        return allVersions[key] || [];
    }

    function saveVersion(year, month, versionName, scheduleData, isFinal = false) {
        const allVersions = get(KEYS.VERSIONS, {});
        const key = `${year}_${String(month).padStart(2, '0')}`;
        if (!allVersions[key]) allVersions[key] = [];

        // If isFinal, remove final flag from previous versions
        if (isFinal) {
            allVersions[key].forEach(v => v.isFinal = false);
        }

        const newVersion = {
            id: 'v_' + Date.now(),
            name: versionName || `Version ${allVersions[key].length + 1}`,
            timestamp: new Date().toISOString(),
            isFinal: isFinal,
            schedule: scheduleData
        };

        allVersions[key].push(newVersion);
        set(KEYS.VERSIONS, allVersions);
        return newVersion;
    }

    function deleteVersion(year, month, versionId) {
        const allVersions = get(KEYS.VERSIONS, {});
        const key = `${year}_${String(month).padStart(2, '0')}`;
        if (allVersions[key]) {
            allVersions[key] = allVersions[key].filter(v => v.id !== versionId);
            set(KEYS.VERSIONS, allVersions);
            return true;
        }
        return false;
    }

    function markVersionFinal(year, month, versionId) {
        const allVersions = get(KEYS.VERSIONS, {});
        const key = `${year}_${String(month).padStart(2, '0')}`;
        if (allVersions[key]) {
            allVersions[key].forEach(v => {
                v.isFinal = (v.id === versionId);
            });
            set(KEYS.VERSIONS, allVersions);
            return true;
        }
        return false;
    }

    // Full Export / Import Data
    function exportAllData() {
        const exportObj = {
            appName: 'SICART Work Distribution Scheduling System',
            version: '1.0',
            exportedAt: new Date().toISOString(),
            data: {
                employees: get(KEYS.EMPLOYEES, []),
                activities: get(KEYS.ACTIVITIES, []),
                mappings: get(KEYS.MAPPINGS, {}),
                fixedAssignments: get(KEYS.FIXED_ASSIGNMENTS, {}),
                holidays: get(KEYS.HOLIDAYS, {}),
                settings: get(KEYS.SETTINGS, DEFAULT_SETTINGS),
                versions: get(KEYS.VERSIONS, {}),
                schedules: {}
            }
        };

        // Collect all schedules in localStorage
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith(`${PREFIX}schedule_`)) {
                exportObj.data.schedules[k] = get(k);
            }
        }

        return exportObj;
    }

    function importAllData(importObj) {
        if (!importObj || !importObj.data) {
            throw new Error('Invalid backup file format.');
        }
        const data = importObj.data;
        if (data.employees) set(KEYS.EMPLOYEES, data.employees);
        if (data.activities) set(KEYS.ACTIVITIES, data.activities);
        if (data.mappings) set(KEYS.MAPPINGS, data.mappings);
        if (data.fixedAssignments) set(KEYS.FIXED_ASSIGNMENTS, data.fixedAssignments);
        if (data.holidays) set(KEYS.HOLIDAYS, data.holidays);
        if (data.settings) set(KEYS.SETTINGS, data.settings);
        if (data.versions) set(KEYS.VERSIONS, data.versions);
        
        if (data.schedules) {
            Object.keys(data.schedules).forEach(k => {
                set(k, data.schedules[k]);
            });
        }
        return true;
    }

    function resetToFactoryDefaults() {
        localStorage.clear();
        init();
        return true;
    }

    return {
        KEYS,
        init,
        get,
        set,
        remove,
        loadSchedule,
        saveSchedule,
        removeSchedule,
        getScheduleKey,
        getVersions,
        saveVersion,
        deleteVersion,
        markVersionFinal,
        exportAllData,
        importAllData,
        resetToFactoryDefaults
    };
})();
