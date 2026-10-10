# CampusConnect: Trust, Academic Integrity, Student Welfare & Testing Guide

## 1. Overview & Institutional Architecture
CampusConnect includes a comprehensive **Trust, Academic Integrity, Student Welfare, and Reputation System**.
- **Role Rebranding**: The administrative interface and navigation are rebranded to **Student Welfare** across the frontend while maintaining RBAC stability.
- **Academic Profiles**: Students have structured academic attributes (Student ID, Department, Programme, Academic Year, Section, Class Advisor).
- **Class Advisor Approved Badge**: Confirms student enrollment and class affiliation issued exclusively by authorized advisors or Student Welfare. Note: Distinguishes identity verification from technical subject competence.
- **Complaint Management System**: Handles student-to-student and student-to-faculty cases with status lifecycle (`Submitted` -> `Under Review` -> `Awaiting Evidence` -> `Awaiting Response` -> `Substantiated` / `Unsubstantiated` -> `Closed`).
- **Academic Integrity Category**: Dedicated category for *"Academic Integrity / Suspected Misuse of Student Work"* by faculty with original work and commit history verification.
- **Faculty Accountability / Red Review Flags**: Configurable threshold (default: 3 substantiated complaints) generates a confidential **"Requires Student Welfare Review"** indicator in Student Welfare Dashboard (never public).
- **Compensating Credit Reversals**: Substantiated credit fraud triggers compensating ledger rows (original transaction is never deleted; negative balances prevented).
- **Progressive False-Complaint Policy**: Unsubstantiated complaints are never penalized. Only substantiated findings of malicious/fabricated complaints trigger progressive warnings (Level 1 warning, Level 2 warning, Level 3 review for 10-credit deduction with approval).

---

## 2. Development Demo Credentials
All demonstration passwords are: `Demo1234!`
Password hash: `$2a$10$OroX0tBVzIQeaUxGGqXZsOLB77Vo1u90haAi/g2a6mgl50UUNMC8q`

### 2.1 Student Welfare Administrator
| Name | Email | Password | Role | Department |
|---|---|---|---|---|
| Student Welfare Administrator | `admin.demo@cb.amrita.edu` | `Demo1234!` | admin | Office of Student Welfare |

### 2.2 Class Advisors & Faculty Members (8 Faculty)
| Name | Email | Department | Programme & Section Scope |
|---|---|---|---|
| Dr. Anand Kumar | `faculty01@cb.amrita.edu` | Computer Science & Engineering | B.Tech CSE, Year 3, Section A |
| Dr. Bhavani S. | `faculty02@cb.amrita.edu` | Computer Science & Engineering | B.Tech CSE, Year 4, Section B |
| Dr. Chandran M. | `faculty03@cb.amrita.edu` | Artificial Intelligence & Data Science | B.Tech AI & DS, Year 2, Section A |
| Dr. Deepa Nair | `faculty04@cb.amrita.edu` | Artificial Intelligence & Data Science | B.Tech AI & DS, Year 3, Section B |
| Dr. Eswaran K. | `faculty05@cb.amrita.edu` | Electronics & Communication Eng. | B.Tech ECE, Year 3, Section A |
| Dr. Fathima R. | `faculty06@cb.amrita.edu` | Electronics & Communication Eng. | B.Tech ECE, Year 4, Section A |
| Dr. Gopal Menon | `faculty07@cb.amrita.edu` | Mechanical Engineering | B.Tech ME, Year 2, Section A |
| Dr. Hema Sundaram | `faculty08@cb.amrita.edu` | Cyber Security | B.Tech CYS, Year 3, Section A |

### 2.3 Sample Fictional Students (20 Students + 4 Core Demo)
| Name | Email | Student ID | Programme / Section | Verification Badge |
|---|---|---|---|---|
| Radhakrishna | `radhakrishna@cb.students.amrita.edu` | CB.EN.U4CSE23099 | B.Tech CSE / CSE-B | Advisor Approved |
| Anu | `anu.demo@cb.students.amrita.edu` | CB.EN.U4AIE23088 | B.Tech AI & DS / AIE-B | Advisor Approved |
| Rahul | `rahul.demo@cb.students.amrita.edu` | CB.EN.U4ECE23077 | B.Tech ECE / ECE-A | Advisor Approved |
| Priya | `priya.demo@cb.students.amrita.edu` | CB.EN.U4CSE23066 | B.Tech CSE / CSE-A | Advisor Approved |
| Aadhavan Raman | `student01@cb.students.amrita.edu` | CB.EN.U4CSE23001 | B.Tech CSE / CSE-A | Advisor Approved |
| Bhavya Krishna | `student02@cb.students.amrita.edu` | CB.EN.U4CSE23002 | B.Tech CSE / CSE-A | Advisor Approved |
| Charan Teja | `student03@cb.students.amrita.edu` | CB.EN.U4CSE23003 | B.Tech CSE / CSE-A | Pending Verification |
| Divya Sree | `student04@cb.students.amrita.edu` | CB.EN.U4CSE23004 | B.Tech CSE / CSE-B | Advisor Approved |
| Farhan Ahmed | `student06@cb.students.amrita.edu` | CB.EN.U4AIE24001 | B.Tech AI & DS / AIE-A | Advisor Approved |
| Harish Raghav | `student08@cb.students.amrita.edu` | CB.EN.U4AIE23001 | B.Tech AI & DS / AIE-B | Advisor Approved |
| Jayanth Varma | `student10@cb.students.amrita.edu` | CB.EN.U4ECE23001 | B.Tech ECE / ECE-A | Advisor Approved |
| Pranav Karthik | `student16@cb.students.amrita.edu` | CB.EN.U4CYS23001 | B.Tech CYS / CYS-A | Advisor Approved |

---

## 3. Setup & Execution Commands

### 3.1 Running Database Migrations & Seeds
From `server/`:
```bash
# Apply Student Welfare schema migration
node src/scripts/migrate-welfare.js

# Apply idempotent demo dataset (20 students, 8 faculty, advisors, sample cases)
node src/scripts/seed-welfare.js
```

### 3.2 Executing Automated Tests
```bash
# Run all 50 automated tests (Units, Security, Matching, E2E Scenarios, Welfare Scenarios A-O)
npm test
```

### 3.3 Building & Running Client
From `client/`:
```bash
npm run build
```

---

## 4. Automated Verification Results (Scenarios A through O)
All 15 scenarios specified in the requirements are implemented and verified in `server/tests/welfare.test.js`:
- **Scenario A**: Verified that students cannot self-grant the Class Advisor Approved badge (returns 403 Forbidden).
- **Scenario B**: Verified that an advisor can only verify students within their assigned scope (department, programme, year, section).
- **Scenario C**: Verified complaint submission with attached evidence.
- **Scenario D**: Verified role-based isolation (unrelated students receive 403 when attempting to access private cases).
- **Scenario E**: Verified that submitting a complaint alone produces zero credit deduction and zero false-complaint warnings.
- **Scenario F**: Verified that unsubstantiated findings never generate warnings.
- **Scenario G**: Verified that substantiated malicious complaints create exactly one warning and cannot be duplicated.
- **Scenario H**: Verified progressive warning policy (Level 1, Level 2, Level 3 review with 10-credit deduction upon Student Welfare approval).
- **Scenario I**: Verified credit reversals operate via compensating transactions without deleting original records.
- **Scenario J**: Verified that faculty red review flags trigger only when reaching the configurable threshold (3 substantiated cases).
- **Scenario K**: Verified duplicate reports do not inflate substantiated counts.
- **Scenario L**: Verified conflict of interest prevention (faculty cannot review or decide cases involving themselves).
- **Scenario M**: Verified that confidential investigation notes are stripped from student views and accessible only to Student Welfare.
- **Scenario N**: Verified that existing peer-help rewards (10 credits first time, 3 credits subsequent, rolling 24-hour cap of 20 credits) continue to operate without regression.
- **Scenario O**: Verified that the seed script is completely idempotent and safe to run repeatedly.
