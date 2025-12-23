import express from "express"
import userModel from "../models/User.js"
import { welcomeEmail } from "../utils/Email.js"
import generateTokenAndSetCookies from "../utils/generateTokenAndSetCookies.js"
const router = express.Router()


router.post("/", async (req, res) => {
    const { code, email } = req.body
    const user = await userModel.findOne({ email })
    if (user.verificationCode == code) {
        user.isVerified = true
        user.verificationCode = undefined
        const token = generateTokenAndSetCookies(res,user._id,email,user.name)
        res.status(201).json({
            id: user._id,
            name: user.name,
            email: user.email,
            msg: "successfully regestor",
            token,
        })
        welcomeEmail(user.name, user.email)

    } else {
        res.status(401).json({ msg: "incorrect credentials " })
    }
    await user.save()
})
export default router