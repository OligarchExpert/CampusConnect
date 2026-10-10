# CampusConnect 🎓

> A campus Skill, Volunteer, and Peer-Help Platform built for university students and faculty to collaborate, showcase capabilities, and earn verified contribution credits.

---

## 🛠 Tech Stack

- **Frontend**: React 18, Vite, React Router 6, Vanilla CSS (Design system)
- **Backend**: Node.js, Express, REST APIs
- **Database**: MySQL with `mysql2/promise` (parameterized queries & transactions)
- **Authentication**: JWT & bcrypt password hashing
- **Version Control**: Git / GitHub (`main` shared stable branch)

---

## 📁 Repository Structure

```
CampusConnect/
├── client/                      # React + Vite Frontend
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── components/          # Reusable UI components
│       │   ├── Navbar.jsx
│       │   ├── ProtectedRoute.jsx
│       │   ├── LoadingSpinner.jsx
│       │   ├── ErrorMessage.jsx
│       │   ├── SkillBadge.jsx
│       │   └── CreditBadge.jsx
│       ├── pages/               # Application pages
│       │   ├── Login.jsx
│       │   ├── Register.jsx
│       │   ├── StudentDashboard.jsx
│       │   ├── FacultyDashboard.jsx
│       │   ├── AdminDashboard.jsx
│       │   ├── Profile.jsx
│       │   ├── Tasks.jsx
│       │   ├── TaskDetail.jsx
│       │   ├── HelpRequests.jsx
│       │   ├── HelpRequestDetail.jsx
│       │   ├── CreditHistory.jsx
│       │   └── SkillDiscovery.jsx # Dedicated AI matching & discovery view
│       ├── context/
│       │   └── AuthContext.jsx
│       ├── services/
│       │   ├── api.js           # Axios instance with JWT interceptor
│       │   ├── authService.js
│       │   ├── taskService.js
│       │   ├── helpService.js
│       │   ├── creditService.js
│       │   ├── profileService.js
│       │   └── matchingService.js # AI matching service integration point
│       └── styles/
│           └── global.css
├── server/                      # Node.js + Express Backend
│   ├── package.json
│   ├── .env.example
│   └── src/
│       ├── index.js             # Express application entry point
│       ├── config/
│       │   └── db.js            # MySQL connection pool
│       ├── middleware/
│       │   ├── auth.js          # JWT authentication
│       │   └── authorize.js     # Role-based authorization
│       ├── routes/
│       │   ├── auth.js
│       │   ├── profile.js
│       │   ├── tasks.js
│       │   ├── helpRequests.js
│       │   ├── credits.js
│       │   ├── admin.js
│       │   └── matching.js      # Mount point for AI feature branch (/api/matching)
│       ├── controllers/
│       │   ├── authController.js
│       │   ├── profileController.js
│       │   ├── taskController.js
│       │   ├── helpController.js
│       │   ├── creditController.js
│       │   └── adminController.js
│       ├── services/
│       │   └── creditService.js # Credit Engine (12 hackathon rules)
│       └── validators/
│           └── index.js
├── database/
│   ├── schema.sql               # MySQL tables, indexes, constraints
│   └── seed.sql                 # Canonical skill catalogue & demo data
├── .gitignore
├── .env.example                 # Root environment template
└── README.md
```

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js**: v18 or later
- **MySQL Server**: 8.0 or later
- **Git**

### 2. Database Setup
Log in to MySQL and load the schema and seed scripts:
```bash
mysql -u root -p < database/schema.sql
mysql -u root -p < database/seed.sql
```

The database `campusconnect_db` includes the following tables:
- `users`: Accounts for students, faculty, and admins.
- `skills`: Canonical skill catalogue with stable integer IDs.
- `user_skills`: M:N junction mapping users to skills with proficiency levels.
- `tasks`: Faculty-created tasks and volunteering opportunities.
- `applications`: Student applications to faculty tasks.
- `help_requests`: Student-to-student peer assistance requests.
- `help_completions`: Verified peer-help completion history.
- `help_pairs`: Directional pair tracking for first-time bonuses.
- `credit_transactions`: Immutable double-entry style credit ledger.
- `reports`: Admin audit and suspicious activity flags.

### 3. Server Setup
```bash
cd server
cp .env.example .env
# Edit .env with your MySQL credentials and JWT secret
npm install
npm run dev
# Server listens on http://localhost:5000
```

### 4. Client Setup
```bash
cd client
npm install
npm run dev
# Frontend runs on http://localhost:5173
```

---

## 👥 Demo Accounts

Password for all pre-seeded accounts is `Demo1234!`:
- **Student**: `student@campus.edu`
- **Faculty**: `faculty@campus.edu`
- **Admin**: `admin@campus.edu`

---

## 🤖 AI Skill-Matching Integration Contract

A secondary developer is implementing the AI Skill Matching & Discovery feature on a dedicated branch. The system has been architected for seamless integration:

1. **Database Foundation**:
   - Canonical `skills` table with stable IDs and categories.
   - `user_skills` table linking students to skills and proficiencies (`beginner`, `intermediate`, `advanced`, `expert`).
2. **Mount Point**:
   - Router located at `server/src/routes/matching.js` mounted at `/api/matching`.
3. **Endpoints Contract**:
   - `GET /api/matching/recommendations` (Auth: JWT Student)
     - Expected output: `{ "success": true, "available": true, "recommendations": [{ "userId": 4, "name": "...", "department": "...", "matchScore": 0.85, "sharedSkills": [...] }] }`
   - `GET /api/matching/skills/discover` (Auth: JWT Student)
     - Expected output: `{ "success": true, "available": true, "suggestions": [{ "skillId": 11, "skillName": "...", "category": "...", "reason": "..." }] }`
4. **Client-side Service & UI**:
   - `client/src/services/matchingService.js` is pre-configured to query `/api/matching`.
   - `client/src/pages/SkillDiscovery.jsx` handles response rendering with a graceful fallback state when AI matching is undergoing development.

---

## ⚖️ Credit Engine Rules

1. **Directional First-Time Reward**: When Student A helps Student B for the first verified time, A earns **10 credits**.
2. **Subsequent Reward**: Subsequent verified help by A to B earns **3 credits** each.
3. **Independent Direction**: B helping A is a separate directional relationship with its own first-time reward.
4. **24-Hour Rolling Cap**: A helper may earn at most **20 peer-help credits** in a rolling 24-hour period.
5. **Partial Awards**: If only part of an award fits under the remaining 24h cap, only the remaining amount is awarded. If exhausted, 0 credits are awarded.
6. **Completion Persistence**: Even if the credit award is reduced or capped at 0, the completion and pair history remain recorded.
7. **Faculty Task Rewards**: Faculty task rewards are exempt from the peer-help cap and require authorized faculty approval.
8. **Server-Enforced Rewards**: Reward amounts are strictly read from the database task record, never from client requests.
9. **Self-Help Prevention**: Users cannot apply to their own tasks or accept their own help requests.
10. **Immutable Ledger**: Every award and reversal is saved as a new record in `credit_transactions`; original records are never erased.
11. **Concurrency Protection**: Database transactions (`BEGIN` / `COMMIT`) and locking prevent race conditions and duplicate awards.
12. **Audit Trails**: Reciprocal exchanges and administrative reversals generate reports for admin review without automatic punishment.
