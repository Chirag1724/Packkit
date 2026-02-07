const crypto = require('crypto');
const fs = require('fs-extra');
const axios = require('axios');
const mongoose = require('mongoose');
const https = require('https');

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
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(`${algorithm}-${hash.digest('base64')}`));
    stream.on('error', reject);
  });
}

async function getOfficialChecksum(packageName, version) {
  const response = await axios.get(`https://registry.npmjs.org/${packageName}`, {
    timeout: 10000,
    httpsAgent: new https.Agent({ rejectUnauthorized: true, minVersion: 'TLSv1.2' })
  });
  const versionData = response.data.versions[version];
  if (!versionData?.dist?.integrity) {
    throw new Error(`No integrity hash found for ${packageName}@${version}`);
  }
  return versionData.dist.integrity;
}

async function handleVerificationFailure(packageName, version, filePath, expected, actual) {
  console.error(`SECURITY THREAT: ${packageName}@${version} - checksum mismatch`);
  try {
    if (fs.existsSync(filePath)) await fs.remove(filePath);
  } catch (err) { }
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
    const officialChecksum = await getOfficialChecksum(packageName, version);
    const actualChecksum = await calculateChecksum(tarballPath);
    const elapsed = Date.now() - startTime;

    if (officialChecksum === actualChecksum) {
      await SecurityLog.create({
        packageName,
        version,
        eventType: 'success',
        checksum: actualChecksum,
        expectedChecksum: officialChecksum,
        details: 'Package integrity verified'
      });
      return { verified: true, checksum: actualChecksum, verificationTime: elapsed };
    } else {
      await handleVerificationFailure(packageName, version, tarballPath, officialChecksum, actualChecksum);
      return { verified: false, threat: true, verificationTime: elapsed };
    }
  } catch (error) {
    await SecurityLog.create({
      packageName,
      version,
      eventType: 'failure',
      details: error.message
    });
    return { verified: false, error: error.message };
  }
}

async function getSecurityStats() {
  const [totalVerifications, successfulVerifications, threatsDetected, failures, recentEvents] = await Promise.all([
    SecurityLog.countDocuments(),
    SecurityLog.countDocuments({ eventType: 'success' }),
    SecurityLog.countDocuments({ eventType: 'threat_detected' }),
    SecurityLog.countDocuments({ eventType: 'failure' }),
    SecurityLog.find().sort({ timestamp: -1 }).limit(10).lean()
  ]);

  return {
    totalVerifications,
    successfulVerifications,
    threatsDetected,
    failures,
    successRate: totalVerifications > 0 ? ((successfulVerifications / totalVerifications) * 100).toFixed(2) : 0,
    recentEvents
  };
}

module.exports = { verifyPackageIntegrity, calculateChecksum, getOfficialChecksum, getSecurityStats, SecurityLog };
