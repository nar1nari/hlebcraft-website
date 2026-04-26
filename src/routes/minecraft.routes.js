const express = require("express");
const router = express.Router();
const mc = require("../services/minecraft.service");

router.get("/status", (req, res) => {
  res.json(mc.getData());
});

router.get("/players/online", (req, res) => {
  const data = mc.getData();
  res.json({
    players: data.online,
    count: data.onlineCount,
    serverStatus: data.isOnline,
  });
});

router.get("/players/all", (req, res) => {
  const data = mc.getData();
  res.json({
    players: data.whitelisted,
    count: data.whitelistCount,
  });
});

router.get("/plugins", (req, res) => {
  const data = mc.getData();
  res.json({
    plugins: data.plugins,
    count: data.pluginsCount,
  });
});

module.exports = router;
