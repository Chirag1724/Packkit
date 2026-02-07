const axios = require('axios');

async function scrapeDocs(packageName) {
  try {
    const url = `https://registry.npmjs.org/${packageName}`;
    const response = await axios.get(url);
    const readme = response.data.readme || '';
    return readme.substring(0, 5000);
  } catch (error) {
    console.error(`Scrape error for ${packageName}:`, error.message);
    return null;
  }
}

module.exports = { scrapeDocs };
