const paypal = require("./paypal.provider");
const yookassa = require("./yookassa.provider");

const PROVIDERS = { paypal, yookassa };

function getProvider(method) {
  const provider = PROVIDERS[method];
  if (!provider) throw new Error(`Неизвестный способ оплаты: "${method}".`);
  return provider;
}

module.exports = { getProvider };
