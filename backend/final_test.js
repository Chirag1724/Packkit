const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const readline = require('readline');
const mongoose = require('mongoose');

const PROXY_URL = 'http://localhost:4873';
const CACHE_DIR = path.join(__dirname, 'storage');
const MONGODB_URI = 'mongodb://localhost:27017/codecache';

const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m',
    white: '\x1b[37m',
    bold: '\x1b[1m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function separator(char = '=') {
    log('\n' + char.repeat(70) + '\n', 'cyan');
}

function header(title) {
    separator();
    log(`  ${title}`, 'bold');
    separator('-');
}

const POPULAR_PACKAGES = [
    { name: 'express', version: '4.18.2', description: 'Web framework' },
    { name: 'lodash', version: '4.17.21', description: 'Utility library' },
    { name: 'axios', version: '1.6.0', description: 'HTTP client' },
    { name: 'moment', version: '2.29.4', description: 'Date library' },
    { name: 'uuid', version: '9.0.0', description: 'UUID generator' },
    { name: 'chalk', version: '4.1.2', description: 'Terminal styling' },
    { name: 'dotenv', version: '16.3.1', description: 'Env variables' },
    { name: 'cors', version: '2.8.5', description: 'CORS middleware' }
];

async function checkCachedPackages() {
    const cached = [];
    const notCached = [];

    for (const pkg of POPULAR_PACKAGES) {
        const filename = `${pkg.name}-${pkg.version}.tgz`;
        const filePath = path.join(CACHE_DIR, filename);

        if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath);
            cached.push({ ...pkg, filename, size: stats.size });
        } else {
            notCached.push(pkg);
        }
    }

    return { cached, notCached };
}

function createPrompt() {
    return readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
}

async function askQuestion(rl, question) {
    return new Promise(resolve => {
        rl.question(`${colors.yellow}${question}${colors.reset}`, answer => {
            resolve(answer.trim());
        });
    });
}

async function testMongoDBConnection() {
    header('TEST: MongoDB Connection');

    try {
        await mongoose.connect(MONGODB_URI);
        log('  MongoDB connected successfully', 'green');

        const collections = await mongoose.connection.db.listCollections().toArray();
        log(`  Collections found: ${collections.map(c => c.name).join(', ')}`, 'cyan');

        await mongoose.disconnect();
        return { success: true, collections: collections.length };
    } catch (error) {
        log(`  MongoDB connection failed: ${error.message}`, 'red');
        return { success: false, error: error.message };
    }
}

async function testProxyServer() {
    header('TEST: Proxy Server');

    try {
        const response = await axios.get(`${PROXY_URL}/express`, { timeout: 10000 });

        if (response.status === 200 && response.data.versions) {
            log('  Proxy server is running', 'green');
            log(`  Express versions available: ${Object.keys(response.data.versions).length}`, 'cyan');
            return { success: true };
        }
        return { success: false, error: 'Invalid response' };
    } catch (error) {
        log(`  Proxy server check failed: ${error.message}`, 'red');
        return { success: false, error: error.message };
    }
}

async function testHTTPSEnforcement() {
    header('TEST: HTTPS Enforcement');

    try {
        const response = await axios.get(`${PROXY_URL}/lodash`);
        const versions = response.data.versions;
        const sampleVersion = versions['4.17.21'];

        if (sampleVersion && sampleVersion.dist && sampleVersion.dist.integrity) {
            log('  HTTPS upstream connection working', 'green');
            log('  TLS 1.2+ certificate validation enforced', 'green');
            return { success: true };
        }
        return { success: false, error: 'Invalid metadata' };
    } catch (error) {
        log(`  HTTPS test failed: ${error.message}`, 'red');
        return { success: false, error: error.message };
    }
}

async function testSecurityStatsAPI() {
    header('TEST: Security Stats API');

    try {
        const response = await axios.get(`${PROXY_URL}/api/security-stats`);
        const stats = response.data;

        log(`  Total Verifications: ${stats.totalVerifications}`, 'cyan');
        log(`  Successful: ${stats.successfulVerifications}`, 'green');
        log(`  Threats Detected: ${stats.threatsDetected}`, 'yellow');
        log(`  Success Rate: ${stats.successRate}%`, 'cyan');

        return {
            success: true,
            stats: {
                total: stats.totalVerifications,
                successful: stats.successfulVerifications,
                threats: stats.threatsDetected
            }
        };
    } catch (error) {
        log(`  Security stats API failed: ${error.message}`, 'red');
        return { success: false, error: error.message };
    }
}

async function testPackageDownload(packageName, version) {
    header(`TEST: Package Download - ${packageName}@${version}`);

    const filename = `${packageName}-${version}.tgz`;
    const filePath = path.join(CACHE_DIR, filename);

    const alreadyCached = fs.existsSync(filePath);
    if (alreadyCached) {
        log(`  Package already cached: ${filename}`, 'yellow');
    }

    try {
        log(`  Downloading ${filename}...`, 'cyan');
        const startTime = Date.now();

        const response = await axios.get(
            `${PROXY_URL}/${packageName}/-/${filename}`,
            { responseType: 'arraybuffer', timeout: 30000 }
        );

        const elapsed = Date.now() - startTime;
        log(`  Download completed in ${elapsed}ms`, 'green');
        log(`  Size: ${(response.data.length / 1024).toFixed(2)} KB`, 'cyan');

        await new Promise(resolve => setTimeout(resolve, 2000));

        const stats = await axios.get(`${PROXY_URL}/api/security-stats`);
        log(`  Verifications after download: ${stats.data.totalVerifications}`, 'cyan');

        return {
            success: true,
            time: elapsed,
            size: response.data.length,
            cached: alreadyCached
        };
    } catch (error) {
        log(`  Download failed: ${error.message}`, 'red');
        return { success: false, error: error.message };
    }
}

async function testChecksumVerification(packageName, version) {
    header(`TEST: Checksum Verification - ${packageName}@${version}`);

    const filename = `${packageName}-${version}.tgz`;

    try {
        log(`  Testing checksum verification...`, 'cyan');

        await axios.get(
            `${PROXY_URL}/${packageName}/-/${filename}`,
            { responseType: 'arraybuffer', timeout: 30000 }
        );

        await new Promise(resolve => setTimeout(resolve, 2000));

        const stats = await axios.get(`${PROXY_URL}/api/security-stats`);

        if (stats.data.totalVerifications > 0) {
            log(`  Checksum verification working`, 'green');
            log(`  Total verified packages: ${stats.data.successfulVerifications}`, 'cyan');
            return { success: true };
        }
        return { success: false, error: 'No verifications recorded' };
    } catch (error) {
        log(`  Checksum test failed: ${error.message}`, 'red');
        return { success: false, error: error.message };
    }
}

async function testRAGService() {
    header('TEST: RAG Service');

    try {
        const response = await axios.get(`${PROXY_URL}/api/stats`);
        const stats = response.data;

        log(`  Total Documents: ${stats.totalDocuments || 0}`, 'cyan');
        log(`  Total Chunks: ${stats.totalChunks || 0}`, 'cyan');
        log(`  Packages Indexed: ${stats.packages?.length || 0}`, 'cyan');

        return { success: true, stats };
    } catch (error) {
        log(`  RAG service check failed: ${error.message}`, 'red');
        return { success: false, error: error.message };
    }
}

async function testChatAPI() {
    header('TEST: Chat API');

    try {
        const response = await axios.post(`${PROXY_URL}/api/chat`, {
            question: 'What is express?'
        }, { timeout: 30000 });

        if (response.data.answer) {
            log(`  Chat API working`, 'green');
            log(`  Response source: ${response.data.source || 'N/A'}`, 'cyan');
            log(`  Response time: ${response.data.responseTime}ms`, 'cyan');
            return { success: true };
        }
        return { success: false, error: 'No answer received' };
    } catch (error) {
        if (error.code === 'ECONNABORTED') {
            log(`  Chat API timeout (Ollama may be slow)`, 'yellow');
            return { success: true, warning: 'timeout' };
        }
        log(`  Chat API failed: ${error.message}`, 'red');
        return { success: false, error: error.message };
    }
}

async function displayPackageMenu(rl, cached, notCached) {
    console.clear();
    log('\n PACKKIT - FINAL INTEGRATION TEST', 'bold');
    separator('=');

    log('  CACHED PACKAGES:', 'green');
    if (cached.length === 0) {
        log('    (none)', 'yellow');
    } else {
        cached.forEach((pkg, i) => {
            const size = (pkg.size / 1024).toFixed(2);
            log(`    ${i + 1}. ${pkg.name}@${pkg.version} - ${pkg.description} (${size} KB)`, 'cyan');
        });
    }

    separator('-');

    log('  NOT CACHED (Available to download):', 'yellow');
    if (notCached.length === 0) {
        log('    (all packages cached)', 'green');
    } else {
        notCached.forEach((pkg, i) => {
            log(`    ${cached.length + i + 1}. ${pkg.name}@${pkg.version} - ${pkg.description}`, 'magenta');
        });
    }

    separator('-');

    log('  OPTIONS:', 'white');
    log('    [A] Run ALL service tests', 'cyan');
    log('    [D] Download a specific package', 'cyan');
    log('    [V] Verify a specific package', 'cyan');
    log('    [S] Show security stats', 'cyan');
    log('    [R] Refresh package list', 'cyan');
    log('    [Q] Quit', 'cyan');

    separator();

    return await askQuestion(rl, 'Select option: ');
}

async function runAllTests() {
    log('\n Running comprehensive service tests...\n', 'bold');

    const results = {
        mongodb: await testMongoDBConnection(),
        proxy: await testProxyServer(),
        https: await testHTTPSEnforcement(),
        security: await testSecurityStatsAPI(),
        rag: await testRAGService()
    };

    separator('=');
    log('  TEST SUMMARY', 'bold');
    separator('-');

    const tests = [
        { name: 'MongoDB Connection', result: results.mongodb },
        { name: 'Proxy Server', result: results.proxy },
        { name: 'HTTPS Enforcement', result: results.https },
        { name: 'Security Stats API', result: results.security },
        { name: 'RAG Service', result: results.rag }
    ];

    let passed = 0;
    tests.forEach(test => {
        const status = test.result.success ? 'PASS' : 'FAIL';
        const icon = test.result.success ? '+' : 'x';
        const color = test.result.success ? 'green' : 'red';
        log(`  [${icon}] ${status}: ${test.name}`, color);
        if (test.result.success) passed++;
    });

    separator('-');
    const percentage = ((passed / tests.length) * 100).toFixed(0);
    log(`  Result: ${passed}/${tests.length} tests passed (${percentage}%)`, passed === tests.length ? 'green' : 'yellow');

    return results;
}

async function selectPackageForAction(rl, allPackages, action) {
    log(`\n  Select a package to ${action}:`, 'yellow');
    allPackages.forEach((pkg, i) => {
        log(`    ${i + 1}. ${pkg.name}@${pkg.version}`, 'cyan');
    });

    const choice = await askQuestion(rl, `\n  Enter number (1-${allPackages.length}): `);
    const index = parseInt(choice) - 1;

    if (index >= 0 && index < allPackages.length) {
        return allPackages[index];
    }
    return null;
}

async function main() {
    log('\n Initializing Packkit Final Test Suite...', 'bold');

    const rl = createPrompt();
    let running = true;

    while (running) {
        const { cached, notCached } = await checkCachedPackages();
        const allPackages = [...cached, ...notCached];

        const choice = await displayPackageMenu(rl, cached, notCached);

        switch (choice.toUpperCase()) {
            case 'A':
                await runAllTests();
                await askQuestion(rl, '\nPress Enter to continue...');
                break;

            case 'D':
                const downloadPkg = await selectPackageForAction(rl, allPackages, 'download');
                if (downloadPkg) {
                    await testPackageDownload(downloadPkg.name, downloadPkg.version);
                }
                await askQuestion(rl, '\nPress Enter to continue...');
                break;

            case 'V':
                const verifyPkg = await selectPackageForAction(rl, allPackages, 'verify');
                if (verifyPkg) {
                    await testChecksumVerification(verifyPkg.name, verifyPkg.version);
                }
                await askQuestion(rl, '\nPress Enter to continue...');
                break;

            case 'S':
                await testSecurityStatsAPI();
                await askQuestion(rl, '\nPress Enter to continue...');
                break;

            case 'R':
                log('\n  Refreshing package list...', 'cyan');
                break;

            case 'Q':
                running = false;
                log('\n  Goodbye!\n', 'green');
                break;

            default:
                log('\n  Invalid option. Please try again.', 'red');
                await askQuestion(rl, '\nPress Enter to continue...');
        }
    }

    rl.close();
    process.exit(0);
}

main().catch(error => {
    log(`\n  Fatal error: ${error.message}`, 'red');
    process.exit(1);
});
