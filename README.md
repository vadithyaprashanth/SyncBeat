# 🎵 SyncBeat — Real-Time Synchronized Music Platform

> Listen together. Feel it together.

SyncBeat is a full-stack music platform where multiple users can listen to the same song at exactly the same time — in perfect sync — like being in the same room.

---

## Features

- 🔐 Phone number + OTP authentication (via Twilio SMS)
- 🎵 Music library managed by admin
- 🔗 Real-time synchronized listening sessions via Socket.io
- 💬 Live chat during sync sessions
- 🛡️ Admin panel — block, deactivate, delete users, manage songs
- 👤 User profile with account deletion
- 📱 Fully responsive (mobile + laptop)

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 18, React Router v6 |
| Backend | Node.js, Express |
| Real-time | Socket.io |
| Database | MySQL |
| Auth | JWT + bcryptjs + OTP |
| SMS | Twilio |
| File uploads | Multer |

---

## Project Structure

```
syncbeat/
├── backend/
│   ├── config/
│   │   ├── db.js
│   │   ├── schema.sql
│   │   └── schema_update.sql
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── songsController.js
│   │   └── sessionsController.js
│   ├── middleware/
│   │   └── auth.js
│   ├── routes/
│   │   └── index.js
│   ├── socket/
│   │   └── index.js
│   ├── uploads/          ← audio files stored here (git-ignored)
│   ├── server.js
│   ├── package.json
│   └── .env.example      ← copy to .env and fill in your values
└── frontend/
    ├── public/
    └── src/
        ├── components/
        ├── context/
        ├── hooks/
        ├── pages/
        ├── utils/
        ├── App.jsx
        ├── App.css
        └── index.js
```

---

## Local Setup

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/syncbeat.git
cd syncbeat
```

### 2. MySQL Database

Open MySQL Workbench and run:

```
backend/config/schema.sql
```

This creates the `syncbeat` database with all tables and a default admin account.

**Default admin credentials:**
- Phone: `0000000000`
- Password: `password`

> ⚠️ Change the admin password after first login in production.

### 3. Backend Setup

```bash
cd backend
cp .env.example .env
```

Edit `.env` with your values:

```env
PORT=5000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=syncbeat
JWT_SECRET=your_long_random_secret
FRONTEND_URL=http://localhost:3000
TWILIO_SID=your_twilio_sid
TWILIO_TOKEN=your_twilio_token
TWILIO_PHONE=+1234567890
```

Install dependencies and start:

```bash
npm install
npm run dev
```

Backend runs at `http://localhost:5000`

### 4. Frontend Setup

```bash
cd frontend
cp .env.example .env
```

Edit `.env`:

```env
REACT_APP_BACKEND_URL=http://localhost:5000
```

Install and start:

```bash
npm install
npm start
```

Frontend runs at `http://localhost:3000`

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description |
|---|---|
| `PORT` | Server port (default: 5000) |
| `DB_HOST` | MySQL host |
| `DB_USER` | MySQL username |
| `DB_PASSWORD` | MySQL password |
| `DB_NAME` | Database name (`syncbeat`) |
| `JWT_SECRET` | Secret key for JWT tokens |
| `FRONTEND_URL` | Frontend URL for CORS |
| `TWILIO_SID` | Twilio Account SID |
| `TWILIO_TOKEN` | Twilio Auth Token |
| `TWILIO_PHONE` | Twilio phone number |

### Frontend (`frontend/.env`)

| Variable | Description |
|---|---|
| `REACT_APP_BACKEND_URL` | Backend URL for audio files |

---

## API Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/signup` | None | Register — sends OTP |
| POST | `/api/auth/signup/verify` | None | Verify OTP, create account |
| POST | `/api/auth/login` | None | Login — sends OTP |
| POST | `/api/auth/login/verify` | None | Verify OTP, get token |
| POST | `/api/auth/resend-otp` | None | Resend OTP |
| DELETE | `/api/auth/account` | User | Delete own account |
| GET | `/api/songs` | User | List all songs |
| POST | `/api/songs` | Admin | Upload song |
| DELETE | `/api/songs/:id` | Admin | Delete song |
| GET | `/api/sessions` | User | List active sessions |
| POST | `/api/sessions` | User | Create session |
| POST | `/api/sessions/:id/join` | User | Join session |
| GET | `/api/admin/stats` | Admin | Platform stats |
| GET | `/api/admin/users` | Admin | All users |
| PATCH | `/api/admin/users/:id/block` | Admin | Block user |
| PATCH | `/api/admin/users/:id/unblock` | Admin | Unblock user |
| PATCH | `/api/admin/users/:id/deactivate` | Admin | Temporarily deactivate |
| PATCH | `/api/admin/users/:id/reactivate` | Admin | Reactivate early |
| DELETE | `/api/admin/users/:id` | Admin | Permanently delete user |

---

## Socket.io Events

| Event | Direction | Description |
|---|---|---|
| `join_session` | Client → Server | Join a session room |
| `playback_update` | Client → Server | Host broadcasts position |
| `sync_state` | Server → Client | Push state to participants |
| `send_message` | Client → Server | Send chat message |
| `new_message` | Server → Client | Broadcast message |
| `user_joined` | Server → Client | Presence notification |
| `user_left` | Server → Client | Presence notification |
| `end_session` | Client → Server | Host ends session |
| `session_ended` | Server → Client | Notify all participants |

---

## Important Notes

- Audio files in `backend/uploads/` are **not stored in Git** (git-ignored)
- Never commit your `.env` files — use `.env.example` as a template
- On Twilio free trial, SMS can only be sent to verified phone numbers
- Admin accounts cannot be deleted or blocked through the UI

---

## License

MIT
