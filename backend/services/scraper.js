const axios = require('axios');


// This function fetches the package metadata from the NPM Registry (avoiding 403s on the website)
async function scrapeDocs(packageName) {
  console.log(`🕷️ Fetching docs for: ${packageName} from Registry...`);

  try {
    // 1. Fetch the NPM Registry JSON
    const url = `https://registry.npmjs.org/${packageName}`;
    const { data } = await axios.get(url);

    // 2. Extract the README
    let content = data.readme || '';

    // 3. Clean it up: Cut to 5000 chars (so AI doesn't choke)
    // If it's empty, try description
    if (!content) {
      content = data.description || '';
    }

    content = content.substring(0, 5000);

    if (!content) {
      console.log('⚠️ No README found in registry.');
      return null;
    }

    console.log(`✅ Retrieved ${content.length} characters.`);
    return content;
  } catch (error) {
    console.log(`❌ Fetch failed: ${error.message}`);
    return null;
  }
}

module.exports = { scrapeDocs };
