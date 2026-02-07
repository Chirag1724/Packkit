const { scrapeDocs } = require('./services/scraper');

async function testScraper() {
    const packageName = 'react';
    console.log(`Testing scraper for package: ${packageName}`);
    try {
        const content = await scrapeDocs(packageName);
        if (content) {
            console.log('Success! Content length:', content.length);
            console.log('Preview:', content.substring(0, 100));
        } else {
            console.log('Failed: Scraper returned null');
        }
    } catch (error) {
        console.error('Error during test:', error);
    }
}

testScraper();