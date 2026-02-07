const crypto = require('crypto');
const fs = require('fs-extra');
const axios = require('axios');
const mongoose = require('mongoose');

const SecurityLogSchema = new mongoose.Schema({
  packageName: String,
  version: String,
  eventType: String,
  checksum: String,
  expectedChecksum: String,
  timestamp: { type: Date, default: Date.now },
  details: String
});

const SecurityLog = mongoose.model('SecurityLog', SecurityLogSchema);


async function calculateChecksum(filePath, algorithm = 'sha512') {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash(algorithm);
    const stream = fs.createReadStream(filePath);

    stream.on('data', (chunk) => {
      hash.update(chunk);
    });

    stream.on('end', () => {
      const checksum = hash.digest('base64');
      resolve(`${algorithm}-${checksum}`);
    });

    stream.on('error', (err) => {
      reject(err);
    });
  });
}


async function getOfficialChecksum(packageName, version) {
  try {
    const url = `https://registry.npmjs.org/${packageName}`;
    const response = await axios.get(url, {
      timeout: 10000,
      httpsAgent: new (require('https').Agent)({
        rejectUnauthorized: true,
        minVersion: 'TLSv1.2'
      })
    });

    const versionData = response.data.versions[version];
    if (!versionData || !versionData.dist || !versionData.dist.integrity) {
      throw new Error(`No integrity hash found for ${packageName}@${version}`);
    }

    return versionData.dist.integrity;
  } catch (error) {
    console.error(` Failed to fetch checksum for ${packageName}@${version}:`, error.message);
    throw error;
  }
}
async function handleVerificationFailure(packageName, version, filePath, expected, actual) {
  console.error(`\n  SECURITY THREAT DETECTED!`);
  console.error(`   Package: ${packageName}@${version}`);
  console.error(`   Expected: ${expected}`);
  console.error(`   Actual:   ${actual}`);
  console.error(`   Action: Deleting compromised file\n`);
  try {
    if (fs.existsSync(filePath)) {
      await fs.remove(filePath);
      console.log(`   ✓ Deleted: ${filePath}`);
    }
  } catch (err) {
    console.error(`   ✗ Failed to delete file: ${err.message}`);
  }
  await SecurityLog.create({
    packageName,
    version,
    eventType: 'threat_detected',
    checksum: actual,
    expectedChecksum: expected,
    details: 'Checksum mismatch - potential package tampering'
  });
}
async function verifyPackageIntegrity(packageName, version, tarballPath) {
  const startTime = Date.now();

  try {
    console.log(`\n Verifying integrity of ${packageName}@${version}...`);

    console.log(`    Fetching official checksum from NPM...`);
    const officialChecksum = await getOfficialChecksum(packageName, version);

    console.log(`    Calculating checksum of downloaded file...`);
    const actualChecksum = await calculateChecksum(tarballPath);

    const elapsed = Date.now() - startTime;

    if (officialChecksum === actualChecksum) {
      console.log(`    MATCH! Package is safe and verified (${elapsed}ms)`);

      await SecurityLog.create({
        packageName,
        version,
        eventType: 'success',
        checksum: actualChecksum,
        expectedChecksum: officialChecksum,
        details: 'Package integrity verified successfully'
      });

      return {
        verified: true,
        checksum: actualChecksum,
        verificationTime: elapsed
      };
    } else {
      console.error(`    MISMATCH! Security threat detected (${elapsed}ms)`);


      await handleVerificationFailure(packageName, version, tarballPath, officialChecksum, actualChecksum);

      return {
        verified: false,
        threat: true,
        expectedChecksum: officialChecksum,
        actualChecksum: actualChecksum,
        verificationTime: elapsed
      };
    }
  } catch (error) {
    console.error(`     Verification error: ${error.message}`);


    await SecurityLog.create({
      packageName,
      version,
      eventType: 'failure',
      details: `Verification failed: ${error.message}`
    });

    return {
      verified: false,
      error: error.message
    };
  }
}
async function getSecurityStats() {
  const totalVerifications = await SecurityLog.countDocuments();
  const successfulVerifications = await SecurityLog.countDocuments({ eventType: 'success' });
  const threatsDetected = await SecurityLog.countDocuments({ eventType: 'threat_detected' });
  const failures = await SecurityLog.countDocuments({ eventType: 'failure' });

  const recentEvents = await SecurityLog.find()
    .sort({ timestamp: -1 })
    .limit(10)
    .lean();

  return {
    totalVerifications,
    successfulVerifications,
    threatsDetected,
    failures,
    successRate: totalVerifications > 0
      ? ((successfulVerifications / totalVerifications) * 100).toFixed(2)
      : 0,
    recentEvents
  };
}

module.exports = {
  verifyPackageIntegrity,
  calculateChecksum,
  getOfficialChecksum,
  getSecurityStats,
  SecurityLog
};
