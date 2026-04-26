const db = require("./db.service");
const { decrypt } = require("./crypto.service");
const mc = require("./minecraft.service");

const CLEANUP_INTERVAL_MS = 60 * 1000; // каждую минуту
const RETRY_INTERVAL_MS = 2 * 60 * 1000; // каждые 2 минуты

async function cancelExpiredTransactions() {
  const [result] = await db.query(
    `UPDATE transactions
     SET status = 'cancelled', updated_at = NOW()
     WHERE status = 'pending' AND expires_at < NOW()`
  );
  if (result.affectedRows > 0) {
    console.log(
      `[Cleanup] Отменено просроченных транзакций: ${result.affectedRows}`
    );
  }
}

async function retryPaidTransactions() {
  const mcData = mc.getData();
  if (!mcData.isOnline) return;

  const [rows] = await db.query(
    `SELECT * FROM transactions WHERE status = 'paid' ORDER BY created_at ASC`
  );
  if (rows.length === 0) return;

  console.log(
    `[Cleanup] Попытка выдачи доступа для ${rows.length} paid-транзакций...`
  );

  for (const tx of rows) {
    try {
      const password = decrypt(tx.encrypted_password);
      await mc.addToWhitelist(tx.nickname);
      await mc.registerPlayer(tx.nickname, password);

      await db.query(
        `UPDATE transactions
         SET status = 'completed', encrypted_password = NULL, completed_at = NOW()
         WHERE id = ?`,
        [tx.id]
      );
      await db.query(
        `INSERT IGNORE INTO players (nickname, discord, transaction_id, added_at)
         VALUES (?, ?, ?, NOW())`,
        [tx.nickname, tx.discord ?? null, tx.id]
      );

      console.log(`[Cleanup] ✓ Выдан доступ: ${tx.nickname} (tx #${tx.id})`);
    } catch (err) {
      console.error(
        `[Cleanup] ✗ Не удалось выдать доступ для ${tx.nickname}:`,
        err.message
      );
    }
  }
}

function start() {
  console.log("[Cleanup] Фоновые задачи запущены.");

  (async function loopCleanup() {
    try {
      await cancelExpiredTransactions();
    } catch (e) {
      console.error("[Cleanup] cancelExpired:", e.message);
    }
    setTimeout(loopCleanup, CLEANUP_INTERVAL_MS);
  })();

  (async function loopRetry() {
    try {
      await retryPaidTransactions();
    } catch (e) {
      console.error("[Cleanup] retryPaid:", e.message);
    }
    setTimeout(loopRetry, RETRY_INTERVAL_MS);
  })();
}

module.exports = { start };
