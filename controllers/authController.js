const User = require("../models/User")
const bcrypt = require("bcrypt")
const jwt = require("jsonwebtoken")
const asyncHandler = require("express-async-handler")

// @desc Login
// @route POST /auth
// @access Public
const login = asyncHandler(async (req, res) => {
  const { username, password } = req.body

  if (!username || !password) {
    return res
      .status(400)
      .json({ message: "You need to provide a password and a username" })
  }

  const foundUser = await User.findOne({ username }).exec()

  if (!foundUser || !foundUser.active) {
    // return res.status(401).json({ message: "Unautorized - User not found or user inactive"})
    return res.status(401).json({ message: "Unautorized" })
  }

  const match = await bcrypt.compare(password, foundUser.password)

  // if (!match) return res.status(401).json({message: "Unauthorized - Password doesn't match"})
  if (!match) return res.status(401).json({ message: "Unauthorized" })

  const accessToken = jwt.sign(
    {
      UserInfo: {
        username: foundUser.username,
        roles: foundUser.roles,
      },
    },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: "10s" }
    // { expiresIn: "15m" }
  )

  const refreshToken = jwt.sign(
    {
      UserInfo: {
        username: foundUser.username,
      },
    },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: "1d" }
    // { expiresIn: "7d" }
  )

  // Create secure cookie with refresh token
  res.cookie("jwt", refreshToken, {
    httpOnly: true, // accessible only by webserver
    secure: true, // https
    sameSite: "None", // cross-site cookie
    maxAge: 7 * 24 * 60 * 60 * 1000, // cookie expires after 1 week
  })

  // Send the accessToken containing usernale and roles
  res.json({ accessToken })
})

// @desc Refresh
// @route GET /auth/refresh
// @access Public - access token has expired
const refresh = (req, res) => {
  const cookies = req.cookies

  if (!cookies?.jwt) return res.status(401).json({ message: "Unauthorized" })

  const refreshToken = cookies.jwt

  jwt.verify(
    refreshToken,
    process.env.REFRESH_TOKEN_SECRET,
    asyncHandler(async (err, decoded) => {
      if (err) return res.status(403).json({ message: "Forbidden" })

      const foundUser = await User.findOne({
        username: decoded.UserInfo.username,
      }).exec()

      if (!foundUser) return res.status(401).json({ message: "Unauthorized" })

      const accessToken = jwt.sign(
        {
          UserInfo: {
            username: foundUser.username,
            roles: foundUser.roles,
          },
        },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: "10s" }
        // { expiresIn: "15m" }
      )

      res.json({ accessToken })
    })
  )
}

// @desc Logout
// @route POST /auth/logout
// @access Public - clear cookies if they exist
const logout = (req, res) => {
  const cookies = req.cookies
  if (!cookies.jwt) return res.sendStatus(204) //No content
  res.clearCookie("jwt", { httpOnly: true, secure: true, sameSite: "None" })
  res.json({ message: "Cookie cleared" })
}

module.exports = { login, refresh, logout }
