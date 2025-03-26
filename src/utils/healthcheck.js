// src/utils/healthcheck.js
const http = require('http');
const fs = require('fs');
const path = require('path');

// Check if the application is running
async function checkHealth() {
  return new Promise((resolve, reject) => {
    const options = {
      host: 'localhost',
      port: process.env.PORT || 3000,
      path: '/health',
      timeout: 2000
    };

    const req = http.get(options, (res) => {
      if (res.statusCode === 200) {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed.status === 'ok');
          } catch (e) {
            reject(new Error('Invalid health check response'));
          }
        });
      } else {
        reject(new Error(`Health check returned ${res.statusCode}`));
      }
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.end();
  });
}

// Check if the process is running by checking the PID file
function checkPidFile() {
  try {
    const pidPath = path.join(__dirname, '../../.pid');
    
    if (!fs.existsSync(pidPath)) {
      return false;
    }
    
    const pid = fs.readFileSync(pidPath, 'utf8').trim();
    
    // Check if the process is running
    process.kill(parseInt(pid, 10), 0);
    
    return true;
  } catch (err) {
    // Process doesn't exist
    return false;
  }
}

// Main health check function
async function runHealthCheck() {
  try {
    // First check if the PID file exists and process is running
    if (!checkPidFile()) {
      console.error('Process not running (PID file check failed)');
      process.exit(1);
    }
    
    // Then check if the HTTP endpoint is responding
    const isHealthy = await checkHealth();
    
    if (!isHealthy) {
      console.error('Health check endpoint returned unhealthy status');
      process.exit(1);
    }
    
    console.log('Health check passed');
    process.exit(0);
  } catch (err) {
    console.error('Health check failed:', err.message);
    process.exit(1);
  }
}

// Run the health check when this script is executed directly
if (require.main === module) {
  runHealthCheck();
}

module.exports = { checkHealth, checkPidFile, runHealthCheck };