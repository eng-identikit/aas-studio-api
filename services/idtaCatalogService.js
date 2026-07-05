const Redis = require('ioredis');
const https = require('https');
const config = require('../config');

// v2: il payload include anche i path delle immagini (cover dei template)
const CACHE_KEY = 'AASStudio:idta:catalog:v2';
const CACHE_TTL = 24 * 60 * 60; // 24 ore

const GITHUB_TREE_URL =
  'https://api.github.com/repos/admin-shell-io/submodel-templates/git/trees/main?recursive=1';

const redis = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  retryStrategy: (times) => Math.min(times * 50, 2000),
});

function fetchGitHubTree() {
  return new Promise((resolve, reject) => {
    const url = new URL(GITHUB_TREE_URL);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      headers: {
        'User-Agent': 'AASStudio',
        'Accept': 'application/vnd.github+json',
        ...(config.github?.token && { Authorization: `Bearer ${config.github.token}` }),
      },
    };

    https.get(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        if (res.statusCode !== 200) {
          return reject(new Error(`GitHub API ${res.statusCode}: ${body}`));
        }
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error('GitHub API: risposta non valida'));
        }
      });
    }).on('error', reject);
  });
}

module.exports = {
  /**
   * Restituisce i path dei file JSON pubblicati e delle immagini di
   * documentazione (per le cover dei template): { paths, images }.
   * Cache Redis con TTL 24h; in caso di miss, fetcha GitHub API.
   */
  getCatalogPaths: async function () {
    const cached = await redis.get(CACHE_KEY);
    if (cached) return JSON.parse(cached);

    const data = await fetchGitHubTree();
    const published = data.tree.filter(
      (item) => item.type === 'blob' && item.path.startsWith('published/')
    );
    const paths = published
      .filter((item) => item.path.endsWith('.json') && !item.path.includes('/docs/'))
      .map((item) => item.path);
    const images = published
      .filter((item) => /\/docs\/modules\/ROOT\/images\/[^/]+\.(png|svg|jpe?g)$/i.test(item.path))
      .map((item) => item.path);

    const payload = { paths, images };
    await redis.setex(CACHE_KEY, CACHE_TTL, JSON.stringify(payload));
    return payload;
  },

  /**
   * Invalida la cache (utile per test o forzare un refresh).
   */
  invalidateCache: async function () {
    await redis.del(CACHE_KEY);
  },
};
