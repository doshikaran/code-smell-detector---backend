const express = require("express");
const User = require("../models/user");
const bcrypt = require("bcrypt");
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

router.post("/register", async (request, response) => {
  console.log(request.body);
  try {
    const { fullname, username, password } = request.body;
    let user = await User.findOne({ username });
    if (user) {
      return response.status(400).json({ msg: "User already exists" });
    }
    const userId = uuidv4();
    user = new User({ userId, fullname, username, password });
    await user.save();
    response.status(201).json({ msg: "User registered successfully", userId });
  } catch (err) {
    console.error(err);
    response.status(500).json({ msg: "Server error" });
  }
});

router.post("/login", async (request, response) => {
  try {
    const { username, password } = request.body;
    const user = await User.findOne({ username });
    if (!user) {
      return response.status(400).json({ msg: "Invalid credentials" });
    }
    const userId = user.userId;
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return response.status(400).json({ msg: "Invalid credentials" });
    }
    response.json({ msg: "Login successful", userId });
  } catch (err) {
    console.error(err);
    response.status(500).json({ msg: "Server error" });
  }
});

router.get("/user/:username", async (request, response) => {
  try {
    const username = request.params.username;
    const user = await User.findOne({ username }).select(
      "username fullname password"
    );
    if (!user) {
      return response.status(404).json({ msg: "User not found" });
    }
    response.json({
      username: user.username,
      fullname: user.fullname,
      password: user.password,
    });
  } catch (err) {
    console.error(err);
    response.status(500).json({ msg: "Server error" });
  }
});


router.get("/user-exists/:username", async (request, response) => {
    try {
      const username = request.params.username;
      const userExists = await User.exists({ username });
      response.json({ exists: !!userExists });
    } catch (err) {
      console.error(err);
      response.status(500).json({ msg: "Server error" });
    }
  });
  

module.exports = router;
