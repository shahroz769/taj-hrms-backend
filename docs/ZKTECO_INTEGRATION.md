# ZKTeco ADMS Push Integration

This HRMS integrates with ZKTeco Smart Terminals using the **ADMS PUSH protocol**. Devices send HTTP requests to the backend — no SDK or TCP pull on port 4370.

## Architecture

```
Employee → ZKTeco Device (local match) → POST /iclock/cdata → Backend
                                              ↓
                                    ZktecoAttendanceLog (raw)
                                              ↓
                                    saveDevicePunchToAttendance()
                                              ↓
                                    Attendance (source: "device")
                                              ↓
                                    MonthlyAttendanceSummary refresh
```

Admin portal routes: `GET/POST/PUT/DELETE /api/zkteco/*` (JWT + Admin role).

Device routes: `/iclock/*` (public, secured by serial allow-list in DB).

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ZK_ALLOWED_SERIALS` | (empty) | Comma-separated serial override. Empty = DB-driven |
| `ZK_AUTO_REGISTER_DEVICES` | `true` | Set `false` in production to require pre-registration |
| `ZK_ONLINE_THRESHOLD_SECONDS` | `120` | Device considered online if last seen within this window |
| `ZK_REQUEST_ATTLOG_ON_RECONNECT` | `true` | Queue `DATA QUERY ATTLOG` when device reconnects after offline |
| `MONGO_DNS_SERVERS` | — | Optional DNS servers if Atlas SRV lookup fails |

## Offline Mode (Device Buffer Sync)

ZKTeco devices store punches locally when the server is unreachable. This backend implements the ADMS **stamp + command** flow so buffered logs upload when connectivity returns:

1. **ATTLOGStamp** — per device, the server stores the timestamp of the last acknowledged punch (`YYYY-MM-DDThh:mm:ss` PKT). Returned in the handshake so the device only sends newer records.
2. **Reconnect detection** — when a device contacts the server after being offline (> `ZK_ONLINE_THRESHOLD_SECONDS`), the server queues `DATA QUERY ATTLOG`.
3. **GET /iclock/getrequest** — returns queued commands (e.g. `C:1:DATA QUERY ATTLOG`) for the device to upload buffered logs.
4. **POST /iclock/devicecmd** — device acknowledges command execution; server clears the queue entry.
5. **Duplicate-safe batch processing** — re-uploaded offline punches are deduplicated and still advance the stamp.
6. **Admin manual sync** — `POST /api/zkteco/devices/:id/request-attlog-sync` queues an ATTLOG pull from the UI (**Sync Offline Logs** button on device detail).


## Device Setup

1. On terminal: **Menu → Comm → Cloud Server Setting (ADMS)**
2. **Server Address:** your API domain (e.g. `api.yourdomain.com`) or LAN IP for local test
3. **Server Port:** `80` (production behind reverse proxy) or `3000` (local)
4. Enable ADMS / Cloud Server, save, reboot
5. Path `/iclock/cdata` is built by firmware — do not configure manually
6. Test: `GET http://your-api/iclock/ping` → returns `OK`
7. Add users on device with **User ID** = employee **Employee ID** (e.g. `00001`)
8. Enroll fingerprint/face for each user

## Admin Workflow

1. Register device serial in **Admin → Biometric Devices** (or allow auto-register)
2. Configure each device user with **User ID** = employee **Employee ID** from HRMS
3. Punches appear in **Punch Logs** and **Attendance Records** within ~1–2 minutes
4. Fix unmatched PINs via **Unmatched PINs** page

## API Endpoints

### Device-facing (no auth)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/iclock/ping` | Health check |
| GET | `/iclock/cdata?SN=...&options=all` | Handshake |
| POST | `/iclock/cdata?SN=...&table=ATTLOG` | Receive punches |
| GET | `/iclock/getrequest?SN=...&INFO=...` | Device poll; may receive `DATA QUERY ATTLOG` |
| POST | `/iclock/devicecmd?SN=...` | Device command acknowledgment |

### Admin (JWT + Admin)

Base: `/api/zkteco`

See controller `zktecoDeviceController.js` for full list.

## Production Notes

- Set `app.set("trust proxy", true)` for correct `req.ip` behind Coolify/nginx
- Reverse proxy must forward `/iclock/*` without stripping POST body
- Most ZKTeco firmware uses **HTTP port 80** (not HTTPS to custom servers)
- Set `ZK_AUTO_REGISTER_DEVICES=false` in production
- Timezone: all attendance day boundaries use **Asia/Karachi (PKT)**

## Testing Locally

Simulate a punch:

```bash
curl -X POST "http://localhost:3000/iclock/cdata?SN=AJP3254900187&table=ATTLOG" \
  -H "Content-Type: text/plain" \
  -d "10112\t2026-06-30 19:34:47\t0\t1\t0"
```

Ensure an employee exists with `employeeID` = `10112` (same value configured as User ID on the device).
