const db = require("./db.service");
const { encrypt, decrypt } = require("./crypto.service");
const mc = require("./minecraft.service");

const BLOCKING_STATUSES = ["pending", "paid", "completed"];
const PENDING_TTL_MINUTES = 60;

async function assertNicknameAvailable(nickname) {
  const mcData = mc.getData();
  const inWhitelist = mcData.whitelisted.some(
    (n) => n.toLowerCase() === nickname.toLowerCase(),
  );
  if (inWhitelist)
    throw new Error("Этот никнейм уже есть в вайтлисте сервера.");

  const [playerRows] = await db.query(
    `SELECT id FROM players WHERE nickname = ? LIMIT 1`,
    [nickname],
  );
  if (playerRows.length > 0)
    throw new Error("Этот никнейм уже зарегистрирован.");

  const placeholders = BLOCKING_STATUSES.map(() => "?").join(",");
  const [txRows] = await db.query(
    `SELECT id FROM transactions WHERE nickname = ? AND status IN (${placeholders}) LIMIT 1`,
    [nickname, ...BLOCKING_STATUSES],
  );
  if (txRows.length > 0) {
    throw new Error(
      "Для этого никнейма уже есть активная транзакция. Подождите или используйте другой ник.",
    );
  }
}

async function createTransaction({
  nickname,
  discord,
  paymentMethod,
  password,
  paymentId,
  amount,
  ref,
}) {
  const encryptedPassword = encrypt(password);
  const [result] = await db.query(
    `INSERT INTO transactions
       (nickname, discord, payment_method, encrypted_password, payment_id, amount, ref, status, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', NOW(), DATE_ADD(NOW(), INTERVAL ? MINUTE))`,
    [
      nickname,
      discord || null,
      paymentMethod,
      encryptedPassword,
      paymentId,
      amount,
      ref ?? null,
      PENDING_TTL_MINUTES,
    ],
  );
  return result.insertId;
}

async function completeTransaction(paymentId) {
  const [rows] = await db.query(
    `SELECT * FROM transactions WHERE payment_id = ? AND (status = 'pending' OR status = 'cancelled') LIMIT 1`,
    [paymentId],
  );
  if (rows.length === 0)
    throw new Error("Транзакция не найдена или уже была обработана.");
  const tx = rows[0];

  await db.query(
    `UPDATE transactions SET status = 'paid', updated_at = NOW() WHERE id = ?`,
    [tx.id],
  );

  const password = decrypt(tx.encrypted_password);
  await mc.addToWhitelist(tx.nickname);
  await mc.registerPlayer(tx.nickname, password);

  await db.query(
    `UPDATE transactions
     SET status = 'completed', encrypted_password = NULL, completed_at = NOW()
     WHERE id = ?`,
    [tx.id],
  );
  await db.query(
    `INSERT IGNORE INTO players (nickname, discord, transaction_id, added_at)
     VALUES (?, ?, ?, NOW())`,
    [tx.nickname, tx.discord ?? null, tx.id],
  );

  return tx;
}

async function cancelTransaction(paymentId) {
  await db.query(
    `UPDATE transactions
     SET status = 'cancelled', updated_at = NOW()
     WHERE payment_id = ? AND status = 'pending'`,
    [paymentId],
  );
}

async function getTransactionByPaymentId(paymentId) {
  const [rows] = await db.query(
    `SELECT * FROM transactions WHERE payment_id = ? LIMIT 1`,
    [paymentId],
  );
  if (rows.length === 0)
    throw new Error(`Транзакция с payment_id="${paymentId}" не найдена.`);
  return rows[0];
}

async function getTransactionByRef(ref) {
  const [rows] = await db.query(
    `SELECT * FROM transactions WHERE ref = ? LIMIT 1`,
    [ref],
  );
  if (rows.length === 0)
    throw new Error(`Транзакция с ref="${ref}" не найдена.`);
  return rows[0];
}

module.exports = {
  assertNicknameAvailable,
  createTransaction,
  completeTransaction,
  cancelTransaction,
  getTransactionByPaymentId,
  getTransactionByRef,
};
