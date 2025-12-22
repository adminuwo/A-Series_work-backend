import express from "express"
import userModel from "../models/User.js"
import { verifyToken } from "../middleware/Authorization.js"
const route = express.Router()

route.get("/", verifyToken, async (req, res) => {
    res.send("this is user route")
    console.log(req.user.id);

    // const user = await userModel.findById()
})

export default route