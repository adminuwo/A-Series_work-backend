import PersonalTask from '../models/PersonalTask.js';

export const getTasks = async (req, res) => {
    try {
        const tasks = await PersonalTask.find({ userId: req.user.id }).sort({ datetime: 1 });
        res.json(tasks);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const createTask = async (req, res) => {
    try {
        const { title, description, category, datetime, recurring, isUrgent } = req.body;
        const task = new PersonalTask({
            userId: req.user.id,
            title,
            description,
            category,
            datetime,
            recurring,
            isUrgent
        });
        const savedTask = await task.save();
        res.status(201).json(savedTask);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

export const updateTask = async (req, res) => {
    try {
        const { id } = req.params;
        const updatedTask = await PersonalTask.findOneAndUpdate(
            { _id: id, userId: req.user.id },
            req.body,
            { new: true }
        );
        if (!updatedTask) return res.status(404).json({ message: 'Task not found' });
        res.json(updatedTask);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

export const deleteTask = async (req, res) => {
    try {
        const { id } = req.params;
        const deletedTask = await PersonalTask.findOneAndDelete({ _id: id, userId: req.user.id });
        if (!deletedTask) return res.status(404).json({ message: 'Task not found' });
        res.json({ message: 'Task deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

