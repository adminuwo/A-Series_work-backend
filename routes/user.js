import express from "express"
import userModel from "../models/User.js"
import { verifyToken } from "../middleware/authorization.js"
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
        const { name } = req.body;

        if (!name) {
            return res.status(400).json({ msg: "Name is required" });
        }

        const updatedUser = await userModel.findByIdAndUpdate(
            userId,
            { name },
            { new: true } // Return the updated document
        );

        res.status(200).json(updatedUser);
    } catch (error) {
        console.error("Error updating user:", error);
        res.status(500).json({ msg: "Something went wrong" });
    }
})

export default route