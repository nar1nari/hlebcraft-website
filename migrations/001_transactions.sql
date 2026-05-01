CREATE TABLE IF NOT EXISTS transactions (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  nickname        VARCHAR(16)  NOT NULL,
  discord         VARCHAR(64),
  payment_method  ENUM('paypal','yookassa') NOT NULL,
  encrypted_password TEXT,
  payment_id      VARCHAR(128) NOT NULL UNIQUE,
  amount          DECIMAL(10,2) NOT NULL,
  status          ENUM('pending','paid','completed','cancelled') NOT NULL DEFAULT 'pending',
  created_at      DATETIME NOT NULL,
  expires_at      DATETIME NOT NULL,
  completed_at    DATETIME,
  updated_at      DATETIME,

  INDEX idx_nickname_status (nickname, status),
  INDEX idx_payment_id      (payment_id)
);

CREATE TABLE IF NOT EXISTS players (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  nickname       VARCHAR(16)  NOT NULL UNIQUE,
  discord        VARCHAR(64),
  transaction_id INT,
  added_at       DATETIME     NOT NULL,

  CONSTRAINT fk_player_transaction
    FOREIGN KEY (transaction_id) REFERENCES transactions(id)
    ON DELETE SET NULL
);
