# 🍁 Maples Tech Club (MTC) — Digital Entrance Examination System

**Institution:** Maples Academy, Khatauli (District Muzaffarnagar, U.P. – 251201)  
**Club Motto:** *"Learn it. Build it. Ship it."*  
**Patron:** The Principal, Maples Academy • **Supervision:** Faculty Advisor & School Coordinator  

A child-friendly, mobile-first, role-isolated digital entrance quiz platform built with **Next.js 14 (App Router)**, **TypeScript**, **Tailwind CSS**, and **PostgreSQL / Supabase** (with an automatic schema-driven local DB fallback for instant Live Preview).

---

## 📚 Class Quiz Schema & 100+ Non-Syllabus Practical Quiz Banks (`756` MCQs)

Every class (`Class 6` through `Class 12`) has its own standalone **Class Quiz Schema file** containing **108 everyday practical computer MCQs** (`>= 100` minimum strictly enforced by JSON Schema), with **25 questions chosen randomly** during each student's test:

### 1. JSON Schema & Per-Class Quiz DB Files (`database/`)
- `database/schemas/class-quiz.schema.json` — Formal JSON Schema (`2020-12`) enforcing `minItems: 100` per class, random per-attempt selection policy, section eligibility, and the 6 non-syllabus practical categories.
- `database/quizzes/class-06.json` — **108 MCQs** (Sections `A`, `B`)
- `database/quizzes/class-07.json` — **108 MCQs** (Sections `A`, `B`)
- `database/quizzes/class-08.json` — **108 MCQs** (Sections `A`, `B`)
- `database/quizzes/class-09.json` — **108 MCQs** (Sections `A`, `B`)
- `database/quizzes/class-10.json` — **108 MCQs** (Sections `A`, `B`)
- `database/quizzes/class-11.json` — **108 MCQs** (Streams `Maths`, `Bio`, `Commerce`, `Humanities`)
- `database/quizzes/class-12.json` — **108 MCQs** (Streams `Maths`, `Bio`, `Commerce`, `Humanities`)

### 2. Six Practical Everyday Topics (Zero School Syllabus / Zero Coding Required)
1. **Keyboard Shortcuts** (`Ctrl+C`, `Ctrl+V`, `Ctrl+Z`, `Alt+Tab`, `F5`, `Win+L`, `Ctrl+Shift+T`, etc.)
2. **Computer Hardware** (Mouse, Keyboard, Monitor, CPU, RAM vs SSD, Pendrive, UPS, HDMI, Printer vs Scanner, etc.)
3. **Application Software & OS** (Folders, Recycle Bin, `.jpg`/`.mp3`/`.mp4`/`.pdf`/`.zip`, Word/Docs, Excel/Sheets, Slides/Canva, VLC, Task Manager, etc.)
4. **Web Browsing & Internet** (Chrome/Edge/Firefox vs Search Engines, Tabs, Bookmarks, History, `https://`, Incognito, Google Drive, Email `CC`/`BCC`, QR codes, etc.)
5. **Basic Networking & Connectivity** (Wi-Fi, Bluetooth, Hotspot, Airplane Mode, Ethernet/LAN, Router vs Modem, Download vs Upload, `Mbps`, etc.)
6. **Social Ethics & Cyber Safety** (OTP & UPI PIN safety, Strong Passwords & 2FA, Netiquette, Cyberbullying, Asking Photo Permission, Fact-Checking Forwards, Honest AI Use, etc.)

### 3. PostgreSQL / Supabase SQL Files (`supabase/`)
- `supabase/schema.sql` — Full PostgreSQL schema including `exam_config.show_results_to_students` + RLS policies.
- `supabase/quizzes/class_06_quiz.sql` ... `supabase/quizzes/class_12_quiz.sql` — Per-class SQL quiz files (`108` MCQs each).
- `supabase/seed.sql` — Consolidated master SQL seed (**756 total questions**).

---

## 👁️ Admin-Controlled Question-Wise Student Results

- By default during an ongoing exam (`show_results_to_students = false`), **zero scores or answers** are sent to student endpoints.
- In **Admin → Exam Settings (`/admin/settings`)**, the coordinator can toggle **"Student Question-Wise Result"** per class (or click **Release Results (All)**).
- Once enabled for a class, students can open **`/student/result/[attemptId]`** from their Dashboard or Submitted screen to view their **Score, Percentage, and full Question-by-Question Review** (`Your Answer` vs `Correct Answer`).

---

## 🔑 Test Credentials

- **Admin Panel (`/admin/login` — hidden from public/student pages):** `admin` / `Maples@2026`
- **Sample Students (`/student/login` — Password: `student123`):**
  - Ready to take quiz: Roll `601` (`6-A`), Roll `802` (`8-B`), Roll `1101` (`11-Maths`)
  - Sample completed attempts (test Question-Wise Result view after toggling ON in Admin Settings!): Roll `602` (`6-B`), Roll `801` (`8-A`), Roll `13` (`12-Maths`, Harsh), Roll `14` (`12-Maths`, Vidhan)
# mtc-test
