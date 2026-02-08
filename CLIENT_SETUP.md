# Client Setup - Connect to PackKit

Run these commands on client PCs to use PackKit as the npm registry:

## One-time Setup
```bash
# Replace <SERVER_IP> with the PackKit server's IP address
npm config set registry http://<SERVER_IP>:4873
```

## 1. Find the Server IP
Look at the **PackKit Startup** window on the server (base station). It will show:
```
  NETWORK ACCESS (for other PCs):
    Chat:  http://10.165.212.195:5174  <-- Example IP
```
*Note: This IP might change if the server reconnects to WiFi.*

## 2. Configure Client (Run on other PCs)
```bash
# Replace <SERVER_IP> with the IP shown in the startup window
npm config set registry http://<SERVER_IP>:4873
```

### Example
If the start script says `http://10.165.212.195:4873`:
```bash
npm config set registry http://10.165.212.195:4873
```

### Alternative (Try if IP keeps changing)
You can try using the computer name:
```bash
npm config set registry http://Nilay:4873
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
