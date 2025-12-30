import jwt from "jsonwebtoken";

export default function generateTokenAndSetCookies(res, id, email, name) {
  const sceret = process.env.JWT_SECRET
  const tokenEx = process.env.TOKEN_EX
  const token = jwt.sign({ id, email, name }, sceret, { expiresIn: tokenEx })
  res.cookie("token", token, {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
  return token

}






