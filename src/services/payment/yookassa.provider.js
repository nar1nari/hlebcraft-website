const { v4: uuidv4 } = require("uuid");

const BASE = "https://api.yookassa.ru/v3";
const YOOKASSA_PRICE_RUB = 50;

function _getAuthHeader() {
  const creds = Buffer.from(
    `${process.env.YOOKASSA_SHOP_ID}:${process.env.YOOKASSA_SECRET_KEY}`,
  ).toString("base64");
  return `Basic ${creds}`;
}

async function createPayment(amount, ref) {
  const res = await fetch(`${BASE}/payments`, {
    method: "POST",
    headers: {
      Authorization: _getAuthHeader(),
      "Content-Type": "application/json",
      "Idempotence-Key": uuidv4(),
    },
    body: JSON.stringify({
      amount: {
        value: YOOKASSA_PRICE_RUB.toFixed(2),
        currency: "RUB",
      },
      confirmation: {
        type: "redirect",
        return_url: `${process.env.BASE_URL}/register/success?ref=${ref}`,
      },
      capture: true,
      description: "Проходка на Хлебкрафт",
      metadata: {
        shop_name: "Хлебкрафт",
      },
    }),
  });

  const payment = await res.json();

  if (!payment.id) {
    throw new Error(`YooKassa createPayment: ${JSON.stringify(payment)}`);
  }

  const approvalUrl = payment.confirmation?.confirmation_url;
  if (!approvalUrl) {
    throw new Error("YooKassa: не найдена ссылка для оплаты.");
  }

  return { paymentId: payment.id, approvalUrl };
}

class PaymentNotCompletedError extends Error {
  constructor() {
    super("YooKassa: платёж не завершён.");
    this.name = "PaymentNotCompletedError";
  }
}

async function capturePayment(paymentId, { retries = 5, delayMs = 1500 } = {}) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const res = await fetch(`${BASE}/payments/${paymentId}`, {
      method: "GET",
      headers: {
        Authorization: _getAuthHeader(),
        "Content-Type": "application/json",
      },
    });
    const data = await res.json();
    if (data.status === "succeeded") return data;
    if (data.status === "canceled") throw new PaymentNotCompletedError();
    if (attempt < retries) await new Promise((r) => setTimeout(r, delayMs));
  }
  throw new PaymentNotCompletedError();
}

module.exports = { createPayment, capturePayment, PaymentNotCompletedError };
