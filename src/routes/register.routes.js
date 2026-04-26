const express = require("express");
const router = express.Router();
const txService = require("../services/transaction.service");
const { getProvider } = require("../services/payment/payment.service");
const paypal = require("../services/payment/paypal.provider");

const PRICE = 0.65; // USD
const WEAK_PASSWORDS = new Set([
  "123456",
  "password",
  "qwerty",
  "12345",
  "54321",
  "123456789",
  "help",
]);

function validateForm({ nickname, password, confirmPassword, paymentMethod }) {
  if (!/^[A-Za-z0-9_]{3,16}$/.test(nickname)) {
    throw new Error(
      "Никнейм должен быть от 3 до 16 символов (латиница, цифры, _)."
    );
  }
  if (!password || password.length < 5 || password.length > 16) {
    throw new Error("Пароль должен быть от 5 до 16 символов.");
  }
  if (
    WEAK_PASSWORDS.has(
      password.toLowerCase() || password.toLowerCase() == nickname.toLowerCase()
    )
  ) {
    throw new Error("Пароль слишком простой. Придумайте другой.");
  }
  if (password !== confirmPassword) {
    throw new Error("Пароли не совпадают.");
  }
  if (nickname == password) {
    throw new Error("Нельзя использовать свой никнейм в пароле.");
  }
  if (!["paypal", "yookassa"].includes(paymentMethod)) {
    throw new Error("Выберите корректный способ оплаты.");
  }
}

router.post("/", async (req, res) => {
  const { nickname, password, confirm_password, discord, payment_method } =
    req.body;

  try {
    validateForm({
      nickname,
      password,
      confirmPassword: confirm_password,
      paymentMethod: payment_method,
    });

    await txService.assertNicknameAvailable(nickname);

    const provider = getProvider(payment_method);
    const { paymentId, approvalUrl } = await provider.createPayment(PRICE);

    await txService.createTransaction({
      nickname,
      discord,
      paymentMethod: payment_method,
      password,
      paymentId,
      amount: PRICE,
    });

    return res.redirect(approvalUrl);
  } catch (err) {
    console.error("[Register] Ошибка оформления:", err.message);
    return res.redirect(`/?error=${encodeURIComponent(err.message)}#register`);
  }
});

router.get("/success", async (req, res) => {
  const { token: orderId } = req.query;

  if (!orderId) {
    return res.render("register_result", {
      page: "register",
      success: false,
      cancelled: false,
      error: "Отсутствует идентификатор платежа.",
    });
  }

  try {
    await paypal.capturePayment(orderId);

    const tx = await txService.completeTransaction(orderId);

    return res.render("register_result", {
      page: "register",
      success: true,
      cancelled: false,
      nickname: tx.nickname,
    });
  } catch (err) {
    console.error("[Register] Ошибка завершения транзакции:", err.message);
    return res.render("register_result", {
      page: "register",
      success: false,
      cancelled: false,
      error: {
        message: `Оплата прошла, но возникла ошибка при выдаче доступа.`,
        orderId,
      },
    });
  }
});

router.get("/cancel", async (req, res) => {
  const { token: orderId } = req.query;

  if (orderId) {
    try {
      await txService.cancelTransaction(orderId);
    } catch (err) {
      console.error("[Register] Ошибка отмены транзакции:", err.message);
    }
  }

  return res.render("register_result", {
    page: "register",
    success: false,
    cancelled: true,
  });
});

module.exports = router;
