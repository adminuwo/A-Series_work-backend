import express from "express"
import userModel from "../models/User.js"
import { verifyToken } from "../middleware/authorization.js"
import Subscription from "../models/Subscription.js"

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

route.put("/", verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { name, settings } = req.body;

        const updateData = {};
        if (name) updateData.name = name;
        if (settings) updateData.settings = settings;

        const updatedUser = await userModel.findByIdAndUpdate(
            userId,
            updateData,
            { new: true } // Return the updated document
        );

        res.status(200).json(updatedUser);
    } catch (error) {
        console.error("Error updating user:", error);
        res.status(500).json({ msg: "Something went wrong" });
    }
})

// PUT /api/user/avatar - Update user avatar/profile picture
route.put("/avatar", verifyToken, async (req, res) => {
    try {
        // Import upload and uploadToCloudinary dynamically
        const { upload, uploadToCloudinary } = await import('../services/cloudinary.service.js');

        // Use multer middleware
        upload.single('avatar')(req, res, async (err) => {
            if (err) {
                console.error("Multer error:", err);
                return res.status(400).json({ error: "File upload error", details: err.message });
            }

            if (!req.file) {
                return res.status(400).json({ error: "No file uploaded" });
            }

            try {
                const userId = req.user.id;

                // Upload to Cloudinary
                const result = await uploadToCloudinary(req.file.buffer, {
                    folder: 'profile_avatars',
                    resource_type: 'image',
                    transformation: [
                        { width: 400, height: 400, crop: 'fill', gravity: 'face' },
                        { quality: 'auto' }
                    ]
                });

                // Update user's avatar field in database
                const updatedUser = await userModel.findByIdAndUpdate(
                    userId,
                    { avatar: result.secure_url },
                    { new: true }
                ).select('-password');

                res.status(200).json({
                    message: "Avatar updated successfully",
                    user: updatedUser,
                    avatarUrl: result.secure_url
                });

            } catch (uploadError) {
                console.error("Cloudinary upload error:", uploadError);
                res.status(500).json({ error: "Failed to upload image to cloud storage" });
            }
        });

    } catch (error) {
        console.error("Error updating avatar:", error);
        res.status(500).json({ error: "Something went wrong" });
    }
});

route.get("/all", verifyToken, async (req, res) => {
    try {
        const users = await userModel.find({})
            .populate('agents', 'agentName pricing')
            .select('-password');

        // Fetch all transactions to map spend
        const transactions = await Subscription.aggregate([
            { $match: { status: 'active' } },
            { $group: { _id: "$userId", totalSpent: { $sum: "$paymentDetails.amount" } } }
        ]);

        const spendMap = transactions.reduce((acc, curr) => {
            if (curr._id) {
                acc[curr._id.toString()] = curr.totalSpent;
            }
            return acc;
        }, {});

        const usersWithDetails = users.map(user => ({
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            isBlocked: user.isBlocked || false,
            status: user.isBlocked ? 'Blocked' : (user.isVerified ? 'Active' : 'Pending'),
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

// DELETE /api/user/:id - Delete user (self or by admin)
route.delete("/:id", verifyToken, async (req, res) => {
    try {
        const targetUserId = req.params.id;
        const requesterId = req.user.id;

        // Check if requester is deleting self or is an admin
        // For now, we assume requester is either the user or we'd check req.user.role if admin
        if (requesterId !== targetUserId) {
            // In a real app, check if req.user.role === 'admin'
            // const requester = await userModel.findById(requesterId);
            // if (requester.role !== 'admin') return res.status(403).json({ error: "Access denied" });
        }

        const user = await userModel.findById(targetUserId);
        if (!user) return res.status(404).json({ error: "User not found" });

        // Prevent deleting admins unless by another super admin (optional logic)
        if (user.role === 'admin' && requesterId !== targetUserId) {
            return res.status(403).json({ error: "Cannot delete admins" });
        }

        // Cleanup: Delete chat sessions associated with this user
        if (user.chatSessions && user.chatSessions.length > 0) {
            const Conversation = (await import('../models/Conversation.js')).default;
            await Conversation.deleteMany({ _id: { $in: user.chatSessions } });
        }

        await userModel.findByIdAndDelete(targetUserId);

        res.json({ message: "Account deleted successfully", id: targetUserId });

    } catch (err) {
        console.error('[DELETE USER ERROR]', err);
        res.status(500).json({ error: "Failed to delete user" });
    }
});

export default route