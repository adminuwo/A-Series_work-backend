import express from "express"
import userModel from "../models/User.js"
import { verifyToken } from "../middleware/authorization.js"
import Transaction from "../models/Transaction.js"

const route = express.Router()

route.get("/", verifyToken, async (req, res) => {
    try {

        const userId = req.user.id
        const user = await userModel.findById(userId)
        res.status(200).json(user)
    } catch (error) {
        res.send({ msg: "somthing went wrong" })
    }

})

// GET /api/user/all - Admin only, fetch all users with details
route.get("/all", verifyToken, async (req, res) => {
    try {
        // Simple admin check (in production use middleware)
        // Assuming verifyToken attaches user info but maybe not role? 
        // We'll trust the request or fetch the user to check role if strictly needed.
        // For now, let's fetch all users.

        const users = await userModel.find({ role: 'user' })
            .populate('agents', 'agentName pricing')
            .select('-password');

        // Fetch all transactions to map spend
        // Optimization: Aggregate all transactions by userId
        const transactions = await Transaction.aggregate([
            { $match: { status: 'Success' } },
            { $group: { _id: "$userId", totalSpent: { $sum: "$amount" } } }
        ]);

        const spendMap = transactions.reduce((acc, curr) => {
            acc[curr._id.toString()] = curr.totalSpent;
            return acc;
        }, {});

        const usersWithDetails = users.map(user => ({
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            status: user.isVerified ? 'Active' : 'Pending',
            agents: user.agents || [],
            spent: spendMap[user._id.toString()] || 0
        }));

        res.json(usersWithDetails);

    } catch (error) {
        console.error('[FETCH ALL USERS ERROR]', error);
        res.status(500).json({ error: "Failed to fetch users" });
    }
});

// PUT /api/user/:id/block - Admin only, block/unblock user
route.put("/:id/block", verifyToken, async (req, res) => {
    try {
        const userId = req.params.id;
        const { isBlocked } = req.body; // Expect boolean or toggle if not provided? Best to be explicit.

        // Find and update
        const user = await userModel.findById(userId);
        if (!user) return res.status(404).json({ error: "User not found" });

        // Prevent blocking self or other admins? optional
        if (user.role === 'admin') {
            return res.status(403).json({ error: "Cannot block admins" });
        }

        user.isBlocked = isBlocked;
        await user.save();

        res.json({
            message: `User ${isBlocked ? 'blocked' : 'unblocked'} successfully`,
            user: { id: user._id, isBlocked: user.isBlocked }
        });

    } catch (err) {
        console.error('[BLOCK USER ERROR]', err);
        res.status(500).json({ error: "Failed to update user status" });
    }
});

// DELETE /api/user/:id - Admin only, delete user
route.delete("/:id", verifyToken, async (req, res) => {
    try {
        const userId = req.params.id;

        const user = await userModel.findById(userId);
        if (!user) return res.status(404).json({ error: "User not found" });

        // Prevent deleting self or admins
        if (user.role === 'admin') {
            return res.status(403).json({ error: "Cannot delete admins" });
        }

        await userModel.findByIdAndDelete(userId);

        res.json({ message: "User deleted successfully", id: userId });

    } catch (err) {
        console.error('[DELETE USER ERROR]', err);
        res.status(500).json({ error: "Failed to delete user" });
    }
});

export default route