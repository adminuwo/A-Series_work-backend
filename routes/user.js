import express from "express"
import userModel from "../models/User.js"
import { verifyToken } from "../middleware/authorization.js"
const route = express.Router()

route.get("/", verifyToken, async (req, res) => {
    try {

        console.log(req.user.id);
        const userId = req.user.id

        const user = await userModel.findById(userId)
        res.status(200).json(user)
    } catch (error) {
        res.send({ msg: "somthing went wrong" })
    }

})

export default route