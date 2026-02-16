// import PersonalTask from '../models/PersonalTask.js';

export const getTasks = async (req, res) => {
    try {
        res.json([]); // Lean Architecture: Model deleted
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const createTask = async (req, res) => {
    res.status(410).json({ message: 'Personal Task logic disabled (Lean Architecture: Model deleted)' });
};

export const updateTask = async (req, res) => {
    res.status(410).json({ message: 'Personal Task logic disabled (Lean Architecture: Model deleted)' });
};

export const deleteTask = async (req, res) => {
    res.status(410).json({ message: 'Personal Task logic disabled (Lean Architecture: Model deleted)' });
};
