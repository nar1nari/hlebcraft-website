const { Rcon } = require("rcon-client");

class MinecraftService {
  constructor() {
    this.rcon = null;
    this.options = {
      host: process.env.RCON_HOST || "127.0.0.1",
      port: parseInt(process.env.RCON_PORT, 10) || 25575,
      password: process.env.RCON_PASSWORD,
    };

    this.cache = {
      online: [],
      whitelisted: [],
      plugins: [],
      lastUpdate: null,
      isOnline: false,
    };

    this.pollInterval = 30000;
    this.startPolling();
  }

  async _connect() {
    if (this.rcon && this.rcon.socket && !this.rcon.socket.destroyed) {
      return this.rcon;
    }
    this.rcon = await Rcon.connect(this.options);
    return this.rcon;
  }

  async addToWhitelist(username) {
    if (!/^\w{2,16}$/.test(username)) {
      throw new Error("Некорректный никнейм игрока.");
    }

    try {
      const client = await this._connect();
      const response = await client.send(`whitelist add ${username}`);
      console.log(`[RCON] Whitelist updated for ${username}: ${response}`);
      return response;
    } catch (err) {
      console.error("[RCON] Ошибка при добавлении в вайтлист:", err.message);
      throw err;
    }
  }

  async registerPlayer(username, password) {
    if (!/^\w{2,16}$/.test(username)) {
      throw new Error("Некорректный никнейм.");
    }

    if (
      !password ||
      password.length < 4 ||
      password.includes(" ") ||
      [
        "123456",
        "password",
        "qwerty",
        "12345",
        "54321",
        "123456789",
        "help",
      ].includes(password.toLowerCase())
    ) {
      throw new Error(
        "Пароль слишком короткий или содержит недопустимые символы."
      );
    }

    try {
      const client = await this._connect();
      const response = await client.send(
        `authme register ${username} ${password}`
      );
      console.log(`[RCON] AuthMe registration for ${username}: ${response}`);
      return response;
    } catch (err) {
      console.error("[RCON] Ошибка при регистрации через AuthMe:", err.message);
      throw err;
    }
  }

  async startPolling() {
    console.log("[RCON] Background polling started.");

    const update = async () => {
      try {
        const client = await this._connect();

        const [rawOnline, rawWhite, rawPl] = await Promise.all([
          client.send("list"),
          client.send("whitelist list"),
          client.send("pl"),
        ]);

        this.cache.online = this._parseList(rawOnline);
        this.cache.whitelisted = this._parseList(rawWhite);
        this.cache.plugins = this._parsePlugins(rawPl);
        this.cache.lastUpdate = new Date();
        this.cache.isOnline = true;
      } catch (err) {
        console.error("[RCON] Polling error (Server offline?):", err.message);
        this.cache.isOnline = false;
        this.rcon = null;
      } finally {
        setTimeout(update, this.pollInterval);
      }
    };

    update();
  }

  _parseList(res) {
    if (!res || !res.includes(":")) return [];
    const raw = res.split(":")[1].trim();
    return raw
      ? raw
          .replace(/§[0-9a-fk-or]/gi, "")
          .split(", ")
          .filter(Boolean)
      : [];
  }

  _parsePlugins(res) {
    if (!res) return [];
    const clean = res
      .replace(/§[0-9a-fk-or]/gi, "")
      .replace(/§x[0-9a-f]{6}/gi, "");
    const matches = clean.match(/^\s*-\s+(.+)$/gm);
    if (matches) return matches.map((l) => l.replace(/^\s*-\s+/, "").trim());
    return this._parseList(res);
  }

  getData() {
    return {
      ...this.cache,
      onlineCount: this.cache.online.length,
      whitelistCount: this.cache.whitelisted.length,
      pluginsCount: this.cache.plugins.length,
    };
  }
}

module.exports = new MinecraftService();
