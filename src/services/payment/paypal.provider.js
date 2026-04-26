const BASE =
  process.env.PAYPAL_ENV === "production"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

async function _getToken() {
  const creds = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString("base64");

  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${creds}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  const data = await res.json();
  if (!data.access_token) throw new Error("PayPal: не удалось получить токен.");
  return data.access_token;
}

async function createPayment(amount) {
  const token = await _getToken();

  const res = await fetch(`${BASE}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: { currency_code: "USD", value: amount.toFixed(2) },
          description: "Проходка на Хлебкрафт",
        },
      ],
      application_context: {
        brand_name: "Хлебкрафт",
        locale: "ru-RU",
        user_action: "PAY_NOW",
        landing_page: "BILLING",
        shipping_preference: "NO_SHIPPING",
        return_url: `${process.env.BASE_URL}/register/success`,
        cancel_url: `${process.env.BASE_URL}/register/cancel`,
      },
    }),
  });

  const order = await res.json();
  if (!order.id)
    throw new Error(`PayPal createOrder: ${JSON.stringify(order)}`);

  const approvalUrl = order.links.find((l) => l.rel === "approve")?.href;
  if (!approvalUrl) throw new Error("PayPal: не найдена ссылка для оплаты.");

  return { paymentId: order.id, approvalUrl };
}

async function capturePayment(orderId) {
  const token = await _getToken();

  const res = await fetch(`${BASE}/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  const data = await res.json();

  if (data.status !== "COMPLETED") {
    throw new Error(`PayPal capture: статус ${data.status ?? "неизвестен"}.`);
  }
  return data;
}

module.exports = { createPayment, capturePayment };
