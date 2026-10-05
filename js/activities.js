/* ==========================================================================
   SICART Scheduling System - Activities & Tasks Manager
   Manages Instruments, Laboratory, QA/QC, Admin, Training activities & Mappings
   ========================================================================== */

const ActivityManager = (() => {
    let activities = [];

    const CATEGORIES = [
        'Instrument',
        'Laboratory',
        'QA',
        'QC',
        'Administrative',
        'Training'
    ];

    const PRIORITIES = ['High', 'Medium', 'Low'];

    function load() {
        activities = StorageManager.get(StorageManager.KEYS.ACTIVITIES, []);
        return activities;
    }

    function save() {
        StorageManager.set(StorageManager.KEYS.ACTIVITIES, activities);
    }

    function getAll() {
        if (!activities || activities.length === 0) load();
        return [...activities];
    }

    function getActive() {
        return getAll().filter(a => a.active !== false);
    }

    function getById(id) {
        return getAll().find(a => Number(a.id) === Number(id)) || null;
    }

    function getByName(name) {
        if (!name) return null;
        const normalized = name.trim().toLowerCase();
        return getAll().find(a => a.name.trim().toLowerCase() === normalized) || null;
    }

    function getInstruments() {
        return getAll().filter(a => a.category === 'Instrument' || a.category === 'Laboratory');
    }

    function getQAQCTasks() {
        return getAll().filter(a => a.category === 'QA' || a.category === 'QC' || a.category === 'Training' || a.category === 'Administrative');
    }

    function add(actData) {
        const all = getAll();
        const maxId = all.reduce((max, a) => Math.max(max, Number(a.id) || 0), 0);

        const newActivity = {
            id: maxId + 1,
            code: (actData.code || `ACT${String(maxId + 1).padStart(3, '0')}`).trim(),
            name: actData.name.trim(),
            category: actData.category || 'Instrument',
            priority: actData.priority || 'Medium',
            description: (actData.description || '').trim(),
            active: actData.active !== false
        };

        activities.push(newActivity);
        save();
        return newActivity;
    }

    function update(id, updatedFields) {
        const act = getById(id);
        if (!act) return false;

        if (updatedFields.name !== undefined) act.name = updatedFields.name.trim();
        if (updatedFields.code !== undefined) act.code = updatedFields.code.trim();
        if (updatedFields.category !== undefined) act.category = updatedFields.category;
        if (updatedFields.priority !== undefined) act.priority = updatedFields.priority;
        if (updatedFields.description !== undefined) act.description = updatedFields.description.trim();
        if (updatedFields.active !== undefined) act.active = Boolean(updatedFields.active);

        save();
        return act;
    }

    function remove(id) {
        const initialLen = activities.length;
        activities = activities.filter(a => Number(a.id) !== Number(id));
        if (activities.length !== initialLen) {
            save();
            // Remove from employee mappings
            const mappings = getMappings();
            Object.keys(mappings).forEach(empId => {
                mappings[empId] = (mappings[empId] || []).filter(actId => Number(actId) !== Number(id));
            });
            saveMappings(mappings);

            // Remove from fixed assignments
            const fixed = getFixedAssignments();
            Object.keys(fixed).forEach(empId => {
                if (Number(fixed[empId]) === Number(id)) {
                    delete fixed[empId];
                }
            });
            saveFixedAssignments(fixed);

            return true;
        }
        return false;
    }

    function toggleActive(id) {
        const act = getById(id);
        if (act) {
            act.active = !act.active;
            save();
            return act.active;
        }
        return null;
    }

    // -------------------------------------------------------------
    // Employee <-> Activity Authorization Mappings
    // -------------------------------------------------------------
    function getMappings() {
        return StorageManager.get(StorageManager.KEYS.MAPPINGS, {});
    }

    function saveMappings(mappings) {
        StorageManager.set(StorageManager.KEYS.MAPPINGS, mappings);
    }

    function getEmployeeActivityIds(employeeId) {
        const mappings = getMappings();
        return (mappings[employeeId] || []).map(Number);
    }

    function getEmployeeActivities(employeeId) {
        const ids = getEmployeeActivityIds(employeeId);
        return getAll().filter(a => ids.includes(Number(a.id)));
    }

    function setEmployeeActivities(employeeId, activityIds) {
        const mappings = getMappings();
        mappings[employeeId] = activityIds.map(Number);
        saveMappings(mappings);
    }

    function toggleEmployeeActivity(employeeId, activityId) {
        const mappings = getMappings();
        const empActs = (mappings[employeeId] || []).map(Number);
        const actIdNum = Number(activityId);

        const index = empActs.indexOf(actIdNum);
        if (index > -1) {
            empActs.splice(index, 1);
        } else {
            empActs.push(actIdNum);
        }

        mappings[employeeId] = empActs;
        saveMappings(mappings);
        return empActs.includes(actIdNum);
    }

    function isEmployeeAuthorized(employeeId, activityIdOrName) {
        // Special: Holiday is allowed for everyone
        if (activityIdOrName === 'Holiday' || activityIdOrName === 'ACT014') return true;

        let actId = null;
        if (typeof activityIdOrName === 'number' || !isNaN(Number(activityIdOrName))) {
            actId = Number(activityIdOrName);
        } else {
            const act = getByName(activityIdOrName);
            if (act) actId = Number(act.id);
        }

        if (actId === null) return true; // unknown activity
        const actObj = getById(actId);
        if (actObj && actObj.name === 'Holiday') return true;

        const allowed = getEmployeeActivityIds(employeeId);
        return allowed.includes(actId);
    }

    // -------------------------------------------------------------
    // Fixed Assignments Management
    // -------------------------------------------------------------
    function getFixedAssignments() {
        return StorageManager.get(StorageManager.KEYS.FIXED_ASSIGNMENTS, {});
    }

    function saveFixedAssignments(fixed) {
        StorageManager.set(StorageManager.KEYS.FIXED_ASSIGNMENTS, fixed);
    }

    function setFixedAssignment(employeeId, activityId) {
        const fixed = getFixedAssignments();
        if (activityId) {
            fixed[employeeId] = Number(activityId);
        } else {
            delete fixed[employeeId];
        }
        saveFixedAssignments(fixed);
    }

    function getFixedActivityForEmployee(employeeId) {
        const fixed = getFixedAssignments();
        const actId = fixed[employeeId];
        return actId ? getById(actId) : null;
    }

    return {
        CATEGORIES,
        PRIORITIES,
        load,
        getAll,
        getActive,
        getById,
        getByName,
        getInstruments,
        getQAQCTasks,
        add,
        update,
        remove,
        toggleActive,
        getMappings,
        saveMappings,
        getEmployeeActivityIds,
        getEmployeeActivities,
        setEmployeeActivities,
        toggleEmployeeActivity,
        isEmployeeAuthorized,
        getFixedAssignments,
        saveFixedAssignments,
        setFixedAssignment,
        getFixedActivityForEmployee
    };
})();
