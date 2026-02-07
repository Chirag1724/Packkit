/*
===+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++==
	This is the scrapper module of the program. This works by being triggered when a cache misses.
	function scrapeDocs fecteches the package metadata from the NPM Registry
===+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++===
*/
const axios = require('axios');

async function scrapeDocs(packageName) {
  console.log(` Fetching docs for: ${packageName} from Registry...`);

  try {
    const url = `https://registry.npmjs.org/${packageName}`;
    const { data } = await axios.get(url);

    let content = data.readme || '';
  } catch (error) {
    console.error(`Error fetching docs for ${packageName}:`, error.message);
  }
}

module.exports = { scrapeDocs };
