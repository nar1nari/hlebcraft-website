const express = require("express");
const path = require("path");
require("dotenv").config();
const mc = require("./src/services/minecraft.service");
const minecraftRoutes = require("./src/routes/minecraft.routes");
const registerRoutes = require("./src/routes/register.routes");
const adminRoutes = require("./src/routes/admin.routes");
const cleanupService = require("./src/services/cleanup.service");

const app = express();

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(
  express.static(path.join(__dirname, "public"), {
    maxAge: 0, // браузер не кэширует сам, всё через Cloudflare
    setHeaders: (res, filePath) => {
      // Изображения — Cloudflare кэширует 7 дней
      if (/\.(png|webp|jpg|jpeg|gif|svg|ico)$/i.test(filePath)) {
        res.setHeader(
          "Cache-Control",
          "public, max-age=604800, s-maxage=604800",
        );
      }
      // CSS/JS — Cloudflare кэширует 1 день
      else if (/\.(css|js)$/i.test(filePath)) {
        res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=86400");
      }
      // PDF — Cloudflare кэширует 1 час (документ может меняться)
      else if (/\.pdf$/i.test(filePath)) {
        res.setHeader(
          "Cache-Control",
          "public, max-age=3600, s-maxage=3600, must-revalidate",
        );
      }
      // Всё остальное — не кэшировать
      else {
        res.setHeader("Cache-Control", "no-store");
      }
    },
  }),
);

app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  next();
});

const gallery = [
  {
    title: "Коллегия Магов (nar1nari, AkrobatMaster) — 1 сезон",
    image: "/images/screenshot_1.webp",
  },
  { title: "Башня Куро (kuro) — 2 сезон", image: "/images/screenshot_2.webp" },
  { title: "Мегумин — 2 сезон", image: "/images/screenshot_3.webp" },
  { title: "Куруми (romahive) — 2 сезон", image: "/images/screenshot_4.webp" },
];

const news = [
  {
    title: "Открытие 3 сезона",
    body: "Мы рады объявить об успешном открытии третьего сезона Хлебкрафт! Открытие прошло отлично — спасибо всем кто пришёл, было весело. Впереди нас ждёт ещё больше интересных событий, уютных вечеров и новых впечатлений. До встречи на сервере!",
    image: "/images/opening.webp",
    date: "2025-05-25",
    link: null,
  },
];

app.use("/api", minecraftRoutes);
app.use("/api/admin", adminRoutes);
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
  res.render("news", { page: "news", news });
});

cleanupService.start();

const PORT = process.env.PORT || 1336;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
