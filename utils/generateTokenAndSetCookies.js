import jwt from "jsonwebtoken";

export default function generateTokenAndSetCookies(res, data) {
    const sceret = process.env.SECRET 
    const tokenEx= process.env.TOKEN_EX 
    const token = jwt.sign({ email: data }, sceret, { expiresIn: tokenEx })
  res.cookie("token", token, {
    httpOnly: true,  
    secure: false,       
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
   
}






