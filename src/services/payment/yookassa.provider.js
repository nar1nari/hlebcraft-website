async function createPayment(_amount) {
  throw new Error(
    "Оплата через ЮKassa временно недоступна. Пожалуйста, выберите PayPal."
  );
}

module.exports = { createPayment };
