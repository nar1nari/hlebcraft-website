const express = require("express");
const path = require("path");
require("dotenv").config();
const mc = require("./src/services/minecraft.service");
const minecraftRoutes = require("./src/routes/minecraft.routes");
const registerRoutes = require("./src/routes/register.routes");
const cleanupService = require("./src/services/cleanup.service");

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.static(path.join(__dirname, "public")));

const gallery = [
  {
    title: "Коллегия Магов (nar1nari, AkrobatMaster) — 1 сезон",
    image: "/images/screenshot_1.webp",
  },
  {
    title: "Башня Куро (kuro) — 2 сезон",
    image: "/images/screenshot_2.webp",
  },
  {
    title: "Мегумин — 2 сезон",
    image: "/images/screenshot_3.webp",
  },
  {
    title: "Куруми (romahive) — 2 сезон",
    image: "/images/screenshot_4.webp",
  },
];

app.use("/api", minecraftRoutes);
app.use("/register", registerRoutes);

app.get("/", (req, res) => {
  const serverData = mc.getData();
  const error = req.query.error || null;

  res.render("index", { page: "about", gallery, mc: serverData, error });
});
app.get("/rules", (req, res) => {
  res.render("rules", { page: "rules" });
});
app.get("/news", (req, res) => {
  res.render("news", { page: "news" });
});

cleanupService.start();

const PORT = 3000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
