/* ==========================================================================
   SICART Scheduling System - Employee Manager
   Manages employee CRUD, active toggles, ordering and validation
   ========================================================================== */

const EmployeeManager = (() => {
    let employees = [];

    function load() {
        employees = StorageManager.get(StorageManager.KEYS.EMPLOYEES, []);
        // Ensure sorted by order
        employees.sort((a, b) => (a.order || 0) - (b.order || 0));
        return employees;
    }

    function save() {
        StorageManager.set(StorageManager.KEYS.EMPLOYEES, employees);
    }

    function getAll() {
        if (!employees || employees.length === 0) load();
        return [...employees];
    }

    function getActive() {
        return getAll().filter(e => e.active !== false);
    }

    function getById(id) {
        return getAll().find(e => Number(e.id) === Number(id)) || null;
    }

    function add(empData) {
        const all = getAll();
        const maxId = all.reduce((max, e) => Math.max(max, Number(e.id) || 0), 0);
        const nextOrder = all.length > 0 ? Math.max(...all.map(e => e.order || 0)) + 1 : 1;

        const newEmployee = {
            id: maxId + 1,
            code: (empData.code || `EMP${String(maxId + 1).padStart(3, '0')}`).trim(),
            name: empData.name.trim(),
            designation: (empData.designation || 'Technical Officer').trim(),
            department: (empData.department || 'Analytical Lab').trim(),
            active: empData.active !== false,
            order: nextOrder
        };

        employees.push(newEmployee);
        save();
        return newEmployee;
    }

    function update(id, updatedFields) {
        const emp = getById(id);
        if (!emp) return false;

        if (updatedFields.name !== undefined) emp.name = updatedFields.name.trim();
        if (updatedFields.code !== undefined) emp.code = updatedFields.code.trim();
        if (updatedFields.designation !== undefined) emp.designation = updatedFields.designation.trim();
        if (updatedFields.department !== undefined) emp.department = updatedFields.department.trim();
        if (updatedFields.active !== undefined) emp.active = Boolean(updatedFields.active);

        save();
        return emp;
    }

    function remove(id) {
        const initialLen = employees.length;
        employees = employees.filter(e => Number(e.id) !== Number(id));
        if (employees.length !== initialLen) {
            save();
            // Also clean up mappings
            const mappings = StorageManager.get(StorageManager.KEYS.MAPPINGS, {});
            delete mappings[id];
            StorageManager.set(StorageManager.KEYS.MAPPINGS, mappings);
            return true;
        }
        return false;
    }

    function toggleActive(id) {
        const emp = getById(id);
        if (emp) {
            emp.active = !emp.active;
            save();
            return emp.active;
        }
        return null;
    }

    function moveOrder(id, direction) {
        const index = employees.findIndex(e => Number(e.id) === Number(id));
        if (index === -1) return false;

        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= employees.length) return false;

        // Swap order
        const temp = employees[index];
        employees[index] = employees[targetIndex];
        employees[targetIndex] = temp;

        // Reassign consecutive order numbers
        employees.forEach((e, idx) => {
            e.order = idx + 1;
        });

        save();
        return true;
    }

    return {
        load,
        getAll,
        getActive,
        getById,
        add,
        update,
        remove,
        toggleActive,
        moveOrder
    };
})();
