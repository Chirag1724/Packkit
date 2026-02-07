# Client Setup - Connect to PackKit

Run these commands on client PCs to use PackKit as the npm registry:

## One-time Setup
```bash
# Replace <SERVER_IP> with the PackKit server's IP address
npm config set registry http://<SERVER_IP>:4873
```

## Example (if server IP is 192.168.137.215)
```bash
npm config set registry http://192.168.137.215:4873
```

## Test Connection
```bash
npm info axios
```

## Install Packages (works offline after caching)
```bash
npm install axios express lodash
```

## Reset to Default npm Registry
```bash
npm config delete registry
```

---

**Note**: Packages are cached on the server after first download. 
Once cached, clients can install offline via hotspot.
