const express = require("express");
const router = express.Router();
const mc = require("../services/minecraft.service");

const CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

function generatePassword(length = 8) {
  let password = "";
  const array = new Uint32Array(length);
  crypto.getRandomValues(array);
  for (const val of array) {
    password += CHARS[val % CHARS.length];
  }
  return password;
}

router.post("/whitelist", async (req, res) => {
  const { username, token } = req.body;

  if (!token || token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: "Неверный административный токен." });
  }

  if (!username || !/^\w{2,16}$/.test(username)) {
    return res
      .status(400)
      .json({
        error: "Некорректный никнейм (2–16 символов, латиница, цифры, _).",
      });
  }

  const password = generatePassword(8);

  try {
    await mc.addToWhitelist(username);
  } catch (err) {
    console.error("[Admin] Ошибка whitelist:", err.message);
    return res
      .status(502)
      .json({ error: `Не удалось добавить в вайтлист: ${err.message}` });
  }

  try {
    await mc.registerPlayer(username, password);
  } catch (err) {
    console.error("[Admin] Ошибка AuthMe register:", err.message);
    return res
      .status(502)
      .json({
        error: `Игрок добавлен в вайтлист, но не удалось установить пароль: ${err.message}`,
      });
  }

  console.log(
    `[Admin] Игрок ${username} добавлен в вайтлист и зарегистрирован.`,
  );
  return res.status(200).json({ password });
});

module.exports = router;
