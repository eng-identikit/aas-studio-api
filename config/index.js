module.exports = {
  stage: process.env.NODE_ENV || "development",
  port: process.env.PORT || 9010,
  database: {
    mariadb_host: process.env.MARIADB_HOST || "localhost",
    mariadb_port: process.env.MARIADB_PORT || "3306",
    mariadb_db: process.env.MARIADB_DB || "AASStudio",
    mariadb_user: process.env.MARIADB_USER || "root",
    mariadb_password: process.env.MARIADB_PASS || "SECRET_TOKEN",
  },
  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined
  },
  jwt: {
    auth_secret: process.env.JWT_AUTH_SECRET || "SECRET_TOKEN",
    refresh_secret: process.env.JWT_REFRESH_SECRET || "SECRET_TOKEN",
  },
  github: {
    token: process.env.GITHUB_TOKEN || undefined,
  },
  // LLM provider per l'estrazione AI (Fase 1b). Selezionabile via env:
  //   LLM_PROVIDER=claude  → Anthropic Claude (@anthropic-ai/sdk)
  //   LLM_PROVIDER=openai  → OpenAI (openai)
  // Ogni provider ha la sua chiave e il suo modello di default.
  llm: {
    provider: (process.env.LLM_PROVIDER || 'claude').toLowerCase(),
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY || undefined,
      model: process.env.ANTHROPIC_MODEL || 'claude-opus-4-8',
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY || undefined,
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      // Endpoint compatibile opzionale (Azure OpenAI, gateway/proxy…).
      baseURL: process.env.OPENAI_BASE_URL || undefined,
    },
  },
};