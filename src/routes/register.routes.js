const express = require("express");
const router = express.Router();
const txService = require("../services/transaction.service");
const { getProvider } = require("../services/payment/payment.service");
const paypal = require("../services/payment/paypal.provider");
const {
  PaymentNotCompletedError,
} = require("../services/payment/yookassa.provider");

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
      "Никнейм должен быть от 3 до 16 символов (латиница, цифры, _).",
    );
  }
  if (!password || password.length < 5 || password.length > 16) {
    throw new Error("Пароль должен быть от 5 до 16 символов.");
  }
  if (
    WEAK_PASSWORDS.has(
      password.toLowerCase() ||
        password.toLowerCase() == nickname.toLowerCase(),
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
    const ref = crypto.randomUUID();
    const { paymentId, approvalUrl } = await provider.createPayment(PRICE, ref);

    await txService.createTransaction({
      nickname,
      discord,
      paymentMethod: payment_method,
      password,
      paymentId,
      amount: PRICE,
      ref,
    });

    return res.redirect(approvalUrl);
  } catch (err) {
    console.error("[Register] Ошибка оформления:", err.message);
    return res.redirect(`/?error=${encodeURIComponent(err.message)}#register`);
  }
});

router.get("/success", async (req, res) => {
  const paypalToken = req.query.token;
  const yookassaRef = req.query.ref;

  if (!paypalToken && !yookassaRef) {
    return res.render("register_result", {
      page: "register",
      success: false,
      cancelled: false,
      error: "Отсутствует идентификатор платежа.",
    });
  }

  let tx;
  try {
    tx = yookassaRef
      ? await txService.getTransactionByRef(yookassaRef)
      : await txService.getTransactionByPaymentId(paypalToken);

    const provider = getProvider(tx.payment_method);
    await provider.capturePayment(tx.payment_id);
    const completedTx = await txService.completeTransaction(tx.payment_id);
    return res.render("register_result", {
      page: "register",
      success: true,
      cancelled: false,
      nickname: completedTx.nickname,
    });
  } catch (err) {
    if (err instanceof PaymentNotCompletedError) {
      if (tx) await txService.cancelTransaction(tx.payment_id).catch(() => {});
      return res.render("register_result", {
        page: "register",
        success: false,
        cancelled: true,
      });
    }

    console.error("[Register] Ошибка завершения транзакции:", err.message);
    return res.render("register_result", {
      page: "register",
      success: false,
      cancelled: false,
      error: {
        message: "Оплата прошла, но возникла ошибка при выдаче доступа.",
        orderId: tx?.payment_id ?? paypalToken,
      },
    });
  }
});

router.get("/cancel", async (req, res) => {
  const paypalToken = req.query.token;
  const yookassaRef = req.query.ref;
  try {
    if (yookassaRef) {
      const tx = await txService.getTransactionByRef(yookassaRef);
      await txService.cancelTransaction(tx.payment_id);
    } else if (paypalToken) {
      await txService.cancelTransaction(paypalToken);
    }
  } catch (err) {
    console.error("[Register] Ошибка отмены транзакции:", err.message);
  }
  return res.render("register_result", {
    page: "register",
    success: false,
    cancelled: true,
  });
});

module.exports = router;
