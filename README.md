# Smart Authentication & Login Management System

An interactive educational simulation of SSH-based network authentication. All users, requests, sessions, failures, device output, and performance values stay in browser-side application state.

**EDUCATIONAL SIMULATION — NOT A REAL SSH SERVER**

## Run

```sh
npm install
npm run dev
```

Use `npm run build` to create a production build and `npm run lint` to check the source.

## Run with Streamlit

The Streamlit entry point embeds the built React app. Build it before running Streamlit:

```sh
npm install
npm run build
python -m pip install -r requirements.txt
python -m streamlit run app.py
```

The `dist/` build output is included for Streamlit hosting, so Streamlit Cloud does not need Node.js. After changing the React source, run `npm run build` and commit the refreshed `dist/` files along with the source changes.

## Deploy on Streamlit Community Cloud

1. Push this repository to GitHub.
2. In [Streamlit Community Cloud](https://share.streamlit.io/), create an app from the repository's `main` branch.
3. Set the app file path to `app.py` and deploy.

The app is an educational simulation; it does not open real SSH connections or execute device commands.

## Demonstration accounts

These are fictional demonstration credentials only. Never enter real credentials.

| Username | Password | Allowed source | Privilege |
| --- | --- | --- | --- |
| `admin1` | `Admin@123` | `192.168.10.11` | 15 |
| `admin2` | `Admin@123` | `192.168.10.12` | 15 |
| `admin3` | `Admin@123` | `192.168.10.13` | 15 |
| `student` | `Student@123` | `192.168.10.20` | 1 |

When MFA is enabled, the simulated OTP is `123456`.

## Try the simulation

- Use **Authentication** to submit a local login and inspect the workflow stages.
- Use **Concurrent burst** to enqueue multiple simulated requests, then **Request Queue → Process next batch** to dispatch FIFO work to configured workers.
- Use **Failures** to toggle network, SSH, database, session-store, timeout, and load conditions; use **Restore services** to recover.
- Inspect created or terminated sessions in **Sessions**. Simulated idle timeout is five minutes.
- **Optimization** applies the recommended controls and worker configuration. **8-Session Mapping** links DOE sessions to demonstrations.
- **Reports** exports the current simulation summary as TXT or JSON.
- The **SSH Terminal** accepts only the displayed simulated commands; it never runs a shell or Cisco IOS commands.

## Safety and limitations

This application does not make SSH connections, scan networks, execute shell commands, store real credentials, or perform real attack activity. The simulated metrics are educational illustrations, not production benchmarks. Local authentication is not equivalent to centralized AAA, and an ACL is not authentication.