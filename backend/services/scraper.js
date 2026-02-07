const axios = require('axios');
async function scrapeDocs(packageName) {
  console.log(`fetching docs for: ${packageName} from Registry...`);

  try {
    const url = `https://registry.npmjs.org/${packageName}`;
    const { data } = await axios.get(url);
    let content = data.readme || '';
    if (!content) {
      content = data.description || '';
    }
    content = content.substring(0, 5000);
    if (!content) {
      console.log('no README found in registry.');
      return null;
    }
    console.log(`retrieved ${content.length} characters.`);
    return content;
  } catch (error) {
    console.log(`fetch failed: ${error.message}`);
    return null;
  }
}
module.exports = { scrapeDocs };
