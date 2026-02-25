<div align="center">
  <img src="docs/banner.jpg" alt="MeritSpace Banner" width="100%">

  # MeritSpace
  ### *A Modern, Intelligently-Powered Form & Assessment Management System*
  
  [![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
  [![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node-dot-js&logoColor=white)](https://nodejs.org/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
  [![Prisma](https://img.shields.io/badge/Prisma-3982CE?style=for-the-badge&logo=Prisma&logoColor=white)](https://www.prisma.io/)
  [![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
  [![Google Gemini](https://img.shields.io/badge/Google_Gemini-8E75B2?style=for-the-badge&logo=google-gemini&logoColor=white)](https://deepmind.google/technologies/gemini/)
  [![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg?style=for-the-badge)](https://www.gnu.org/licenses/gpl-3.0)

  **MeritSpace** is a sleek, full-stack application designed to streamline the form and assessment process for Lecturers and Students. With real-time monitoring, AI-powered question generation, manual grading, and a premium glassmorphism UI, it offers a sophisticated experience for modern education.

  [Explore Features](#-features) • [Tech Stack](#-tech-stack) • [Installation](#-how-to-run) • [Configuration](#-configuration)
</div>

---

## ✨ Features

### 👤 User Roles & Authentication
- **Google OAuth Integration**: Secure, one-tap login for all users — no password management required.
- **Granular RBAC**: Automated role assignment (Admin / Lecturer / Student) with manual overrides via the Admin Panel.
- **Domain Enforcement**: Restrict access to specific organizational email domains.
- **First-User Admin**: The very first account to log in is automatically promoted to the **ADMIN** role.

### 📝 Assessment & Form Management
- **AI Question Generator**: Generate high-quality multiple-choice or short-answer questions using **Google Gemini** from a text prompt or a **PDF upload**.
- **Bloom's Taxonomy Integration**: Tailor AI-generated questions to specific cognitive levels (Remember, Understand, Apply, Analyze, Evaluate, Create) for better pedagogical alignment.
- **Section-Based Organization**: Structure assessments into sections with titles, descriptions, and ordered questions.
- **Bulk Import/Export**: Import questions from CSV/Excel files with full support for mixed character encoding (Thai/English); export complete assessment data to **JSON** or **XLSX**.
- **Rich Settings**: Shuffle questions/answers, set time limits, schedule start times, toggle instant feedback, and control late submissions.
- **Collection Management**: Organize assessments into logical groups for easier administration.
- **QR Code Sharing**: Instantly share public assessments via auto-generated QR codes.
- **Bulk Operations**: Efficiently manage users, exams, groups, and backups with bulk delete in the Admin Panel.
- **Deploy & Blueprint**: Push live assessments with a single click using the "Deploy Form Blueprint" workflow.
- **Duplicate Assessments**: Clone existing forms with all questions and sections preserved.

### ✏️ Manual Grading & Review
- **Manual Grading Interface**: A dedicated, redesigned UI for lecturers to review and score student submissions question-by-question.
- **Per-Question Score Control**: Increment/decrement scores with visual feedback (color-coded borders for full, partial, or zero marks).
- **Student Navigation**: Quickly switch between students using a selector with prev/next navigation and a dropdown.
- **Question Type Filtering**: Filter the review by question type (multiple choice, checkboxes, short answer, paragraph).
- **Auto vs Manual Indicators**: See at a glance which scores have been manually adjusted versus auto-graded.
- **Section-Grouped Review**: Questions are grouped by section for organized grading.

### 🛡️ Anti-Cheat & Real-time Monitoring
- **Live Monitoring Dashboard**: Lecturers see a real-time participant grid and activity stream powered by **WebSockets (Socket.io)**.
- **Focus Tracking**: Automatically detects and logs when students switch tabs or minimize the browser window.
- **Online Presence**: See which students are currently active in a session at a glance.
- **Live Event Feed**: Instant log of key events — `FOCUS_LOST`, `FOCUS_GAINED`, `CONNECTED`, `SUBMITTED`.
- **WebRTC Peer Connections**: Supports peer-to-peer signaling for advanced real-time communication.
- **Video Proctoring**: Optional video proctoring mode for enhanced exam integrity.
- **Activity Log Export**: Download detailed activity logs as CSV for post-exam analysis.

### 🎨 Personalized Exam Experience
- **In-Exam Appearance Panel**: Students can customize their exam UI on-the-fly via a floating **Appearance Settings** panel.
- **Theme & Color Presets**: Switch between Light/Dark/Jet-Black modes and multiple color accent presets without leaving the exam.
- **Adaptive Layout**: The exam interface responds smoothly to all theme changes using CSS custom properties.
- **Internationalization**: Full localization support with language context for multi-language deployments.

### 📊 Results, Grading & Data
- **Automated Grading**: Instant scoring for multiple-choice and checkbox question types.
- **Review Score Dashboard**: Lecturers can view submitted results and jump directly into a detailed review interface from the dashboard.
- **XLSX Export**: Download results and detailed activity logs as formatted **Excel (.xlsx)** files.
- **Reliable Backups**: Manual and automated (on-close) JSON backups of all assessment data and student submissions, also exportable as XLSX.
- **Prisma ORM**: Robust, type-safe data management and schema migrations.

---

## 🛠 Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| **React 18** + TypeScript | Core UI framework |
| **Vite** | Blazing-fast dev server & bundler |
| **Framer Motion** | Smooth page & component animations |
| **Lucide React** + **FontAwesome** | Icon library |
| **Tailwind CSS** + Custom CSS Variables | Styling & theming |
| **Socket.io Client** | Real-time WebSocket communication |

### Backend
| Technology | Purpose |
|---|---|
| **Node.js** + **Express 5** | HTTP server & REST API |
| **Prisma ORM** | Database access & migrations |
| **PostgreSQL** | Primary relational database |
| **Socket.io** | Real-time event broadcasting |
| **Google Generative AI** (Gemini) | AI-powered question generation with Bloom's Taxonomy support |
| **Multer** | PDF & image file uploads |
| **XLSX** | Excel file generation for exports |
| **iconv-lite** | Thai/multi-encoding CSV parsing |
| **jsonwebtoken** | JWT-based session authentication |
| **google-auth-library** | Google OAuth token verification |

---

## 🏃‍♂️ How to Run

### 1. Prerequisites
- **Node.js** v18 or higher
- **PostgreSQL** — a running PostgreSQL instance
- **Google Cloud Console** — create an OAuth 2.0 Client ID
- **Gemini API Key** — obtain from [Google AI Studio](https://aistudio.google.com/)

### 2. Clone & Install
```bash
git clone https://github.com/Piyk/meritspace.git
cd meritspace

# Install all dependencies (root + client + server)
npm run install-all
```

### 3. Configuration
Create your environment files:

**`server/.env`** (use `server/.env.sample` as a reference):
```env
DATABASE_URL="postgresql://user:password@localhost:5432/exam_flow"
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
JWT_SECRET=your_secret_key
GEMINI_API_KEY=your_gemini_key
ADMIN_EMAIL=your_email@domain.com
ALLOWED_DOMAINS=domain.com,gmail.com
PORT=your_port
FRONTEND_URL=your_frontend_url
GEMINI_MODEL=gemini-2.5-flash
```

**`client/.env`**:
```env
VITE_GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
```

### 4. Database Setup
Initialize the database schema with Prisma:
```bash
cd server
npx prisma db push

# Optional: Run the data migration helper for initial setup
node migrate_db.js
```

### 5. Run the App
Open two terminals from the project root:
```bash
# Terminal 1 — Backend server
npm run server

# Terminal 2 — Frontend dev server
npm run client
```
The client will be available at `http://localhost:5173` and the server at `http://localhost:3000` by default.

---

## 🎨 Theming System
MeritSpace features a dynamic, persistent theming system. Users can switch between **Light**, **Dark**, and **Jet Black** modes, and Admins can configure a global color preset for all users. Students can also adjust their theme live during an exam via the floating Appearance Panel.

**Available Color Presets:**
- 🌊 Ocean Blue
- 🌲 Forest Green
- 🟣 Royal Purple
- 🌹 Rose Gold
- 🌑 Slate
- 🍊 Classic Orange

---

## 🛡️ Security Notes
- The **first user** to authenticate is automatically promoted to **ADMIN**.
- All sessions are secured via **JWT tokens** verified against Google OAuth.
- **CORS** and **domain allow-listing** protect the API for organizational deployments.
- Exam state and answers are persisted server-side to prevent client-side tampering.
- Session grace periods handle disconnections gracefully without losing monitoring state.

---

## 📸 Screenshots

<div align="center">
  <table>
    <tr>
      <td><img src="docs/1.png" alt="Screenshot 1" width="100%"></td>
      <td><img src="docs/2.png" alt="Screenshot 2" width="100%"></td>
    </tr>
    <tr>
      <td><img src="docs/3.png" alt="Screenshot 3" width="100%"></td>
      <td><img src="docs/4.png" alt="Screenshot 4" width="100%"></td>
    </tr>
  </table>
</div>

---

## 📜 License
This project is licensed under the **GNU General Public License v3.0 (GPLv3)**. See the [LICENSE](LICENSE) file for details.

---

<div align="center">
  Built with ❤️ by <a href="https://github.com/Piyk">Piyk</a><br>
  Copyright © 2026 Piyk. Licensed under <a href="LICENSE">GPLv3</a>.
</div>
