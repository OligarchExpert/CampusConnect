-- ============================================================
-- CampusConnect: Amrita Demonstration Dataset (Idempotent)
-- For local demonstration & test evaluation only.
-- All passwords: "Demo1234!" (bcrypt hashed: $2a$10$OroX0tBVzIQeaUxGGqXZsOLB77Vo1u90haAi/g2a6mgl50UUNMC8q)
-- ============================================================

USE campusconnect_db;

-- 1. Realistic Demo Accounts
INSERT INTO users (name, email, password, role, bio, department, is_active)
VALUES
  (
    'Radhakrishna',
    'radhakrishna@cb.students.amrita.edu',
    '$2a$10$OroX0tBVzIQeaUxGGqXZsOLB77Vo1u90haAi/g2a6mgl50UUNMC8q',
    'student',
    'Senior CSE undergraduate passionate about full-stack web architectures and cloud systems. Available to pair on React, Express, and distributed backend projects.',
    'Computer Science and Engineering',
    1
  ),
  (
    'Anu',
    'anu.demo@cb.students.amrita.edu',
    '$2a$10$OroX0tBVzIQeaUxGGqXZsOLB77Vo1u90haAi/g2a6mgl50UUNMC8q',
    'student',
    'AI & Data Science student exploring machine learning pipelines, predictive modeling, and campus data analytics. Happy to assist peers in Python and SQL.',
    'Artificial Intelligence & Data Science',
    1
  ),
  (
    'Rahul',
    'rahul.demo@cb.students.amrita.edu',
    '$2a$10$OroX0tBVzIQeaUxGGqXZsOLB77Vo1u90haAi/g2a6mgl50UUNMC8q',
    'student',
    'ECE student focused on systems programming, algorithmic mathematics, and Linux performance tuning.',
    'Electronics and Communication Engineering',
    1
  ),
  (
    'Priya',
    'priya.demo@cb.students.amrita.edu',
    '$2a$10$OroX0tBVzIQeaUxGGqXZsOLB77Vo1u90haAi/g2a6mgl50UUNMC8q',
    'student',
    'Interaction designer creating student-centric design systems, Figma prototypes, and accessible web interfaces.',
    'Computer Science and Engineering',
    1
  ),
  (
    'Arjun',
    'arjun.demo@cb.students.amrita.edu',
    '$2a$10$OroX0tBVzIQeaUxGGqXZsOLB77Vo1u90haAi/g2a6mgl50UUNMC8q',
    'student',
    'Third-year CS student passionate about competitive programming, data structures, and algorithm optimization.',
    'Computer Science and Engineering',
    1
  ),
  (
    'Demo Faculty',
    'faculty.demo@cb.amrita.edu',
    '$2a$10$OroX0tBVzIQeaUxGGqXZsOLB77Vo1u90haAi/g2a6mgl50UUNMC8q',
    'faculty',
    'Faculty Coordinator for Student Innovation & Peer Learning. Supervising academic research tasks, sustainability programs, and peer mentoring.',
    'Computer Science and Engineering',
    1
  ),
  (
    'Dr. Meera Nair',
    'meera.nair@cb.amrita.edu',
    '$2a$10$OroX0tBVzIQeaUxGGqXZsOLB77Vo1u90haAi/g2a6mgl50UUNMC8q',
    'faculty',
    'Associate Professor, Computer Science and Engineering. Specializing in artificial intelligence, neural architectures, and intelligent tutoring systems.',
    'Computer Science and Engineering',
    1
  ),
  (
    'Dr. Arun Kumar',
    'arun.kumar@cb.amrita.edu',
    '$2a$10$OroX0tBVzIQeaUxGGqXZsOLB77Vo1u90haAi/g2a6mgl50UUNMC8q',
    'faculty',
    'Professor, Artificial Intelligence & Data Science. Leading campus data analytics initiatives and supervising distributed systems research.',
    'Artificial Intelligence & Data Science',
    1
  ),
  (
    'Prof. Lakshmi Menon',
    'lakshmi.menon@cb.amrita.edu',
    '$2a$10$OroX0tBVzIQeaUxGGqXZsOLB77Vo1u90haAi/g2a6mgl50UUNMC8q',
    'faculty',
    'Assistant Professor, Electronics and Communication Engineering. Researching embedded hardware, sensor networks, and IoT applications.',
    'Electronics and Communication Engineering',
    1
  ),
  (
    'Prof. Suresh Iyer',
    'suresh.iyer@cb.amrita.edu',
    '$2a$10$OroX0tBVzIQeaUxGGqXZsOLB77Vo1u90haAi/g2a6mgl50UUNMC8q',
    'faculty',
    'Associate Professor, Mechanical Engineering. Coordinating sustainability initiatives, robotics competitions, and campus engineering projects.',
    'Mechanical Engineering',
    1
  ),
  (
    'Dr. Kavitha Rao',
    'kavitha.rao@cb.amrita.edu',
    '$2a$10$OroX0tBVzIQeaUxGGqXZsOLB77Vo1u90haAi/g2a6mgl50UUNMC8q',
    'faculty',
    'Associate Professor, Cyber Security. Guiding student projects in network security, cryptography, and secure software development.',
    'Cyber Security',
    1
  ),
  (
    'Student Welfare Administrator',
    'admin.demo@cb.amrita.edu',
    '$2a$10$OroX0tBVzIQeaUxGGqXZsOLB77Vo1u90haAi/g2a6mgl50UUNMC8q',
    'admin',
    'CampusConnect Student Welfare and platform administrator handling student welfare, governance, audit logs, and verified credit ledger inspection.',
    'Campus Academic Administration',
    1
  )
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  bio = VALUES(bio),
  department = VALUES(department),
  is_active = VALUES(is_active);

-- 2. User Skills Assignments (Using dynamic subqueries to preserve foreign key stability)

-- Radhakrishna's Skills
INSERT IGNORE INTO user_skills (user_id, skill_id, proficiency)
SELECT u.id, s.id, 'expert' FROM users u, skills s
WHERE u.email = 'radhakrishna@cb.students.amrita.edu' AND s.name = 'JavaScript';

INSERT IGNORE INTO user_skills (user_id, skill_id, proficiency)
SELECT u.id, s.id, 'advanced' FROM users u, skills s
WHERE u.email = 'radhakrishna@cb.students.amrita.edu' AND s.name = 'React';

INSERT IGNORE INTO user_skills (user_id, skill_id, proficiency)
SELECT u.id, s.id, 'advanced' FROM users u, skills s
WHERE u.email = 'radhakrishna@cb.students.amrita.edu' AND s.name = 'Node.js';

INSERT IGNORE INTO user_skills (user_id, skill_id, proficiency)
SELECT u.id, s.id, 'intermediate' FROM users u, skills s
WHERE u.email = 'radhakrishna@cb.students.amrita.edu' AND s.name = 'Docker';

INSERT IGNORE INTO user_skills (user_id, skill_id, proficiency)
SELECT u.id, s.id, 'advanced' FROM users u, skills s
WHERE u.email = 'radhakrishna@cb.students.amrita.edu' AND s.name = 'Git';

-- Anu's Skills
INSERT IGNORE INTO user_skills (user_id, skill_id, proficiency)
SELECT u.id, s.id, 'expert' FROM users u, skills s
WHERE u.email = 'anu.demo@cb.students.amrita.edu' AND s.name = 'Python';

INSERT IGNORE INTO user_skills (user_id, skill_id, proficiency)
SELECT u.id, s.id, 'advanced' FROM users u, skills s
WHERE u.email = 'anu.demo@cb.students.amrita.edu' AND s.name = 'Data Analysis';

INSERT IGNORE INTO user_skills (user_id, skill_id, proficiency)
SELECT u.id, s.id, 'advanced' FROM users u, skills s
WHERE u.email = 'anu.demo@cb.students.amrita.edu' AND s.name = 'Machine Learning';

INSERT IGNORE INTO user_skills (user_id, skill_id, proficiency)
SELECT u.id, s.id, 'advanced' FROM users u, skills s
WHERE u.email = 'anu.demo@cb.students.amrita.edu' AND s.name = 'SQL';

INSERT IGNORE INTO user_skills (user_id, skill_id, proficiency)
SELECT u.id, s.id, 'intermediate' FROM users u, skills s
WHERE u.email = 'anu.demo@cb.students.amrita.edu' AND s.name = 'Statistics';

-- Rahul's Skills
INSERT IGNORE INTO user_skills (user_id, skill_id, proficiency)
SELECT u.id, s.id, 'advanced' FROM users u, skills s
WHERE u.email = 'rahul.demo@cb.students.amrita.edu' AND s.name = 'C++';

INSERT IGNORE INTO user_skills (user_id, skill_id, proficiency)
SELECT u.id, s.id, 'advanced' FROM users u, skills s
WHERE u.email = 'rahul.demo@cb.students.amrita.edu' AND s.name = 'Linux';

INSERT IGNORE INTO user_skills (user_id, skill_id, proficiency)
SELECT u.id, s.id, 'advanced' FROM users u, skills s
WHERE u.email = 'rahul.demo@cb.students.amrita.edu' AND s.name = 'Mathematics';

-- Priya's Skills
INSERT IGNORE INTO user_skills (user_id, skill_id, proficiency)
SELECT u.id, s.id, 'expert' FROM users u, skills s
WHERE u.email = 'priya.demo@cb.students.amrita.edu' AND s.name = 'UI/UX Design';

INSERT IGNORE INTO user_skills (user_id, skill_id, proficiency)
SELECT u.id, s.id, 'expert' FROM users u, skills s
WHERE u.email = 'priya.demo@cb.students.amrita.edu' AND s.name = 'Figma';

INSERT IGNORE INTO user_skills (user_id, skill_id, proficiency)
SELECT u.id, s.id, 'advanced' FROM users u, skills s
WHERE u.email = 'priya.demo@cb.students.amrita.edu' AND s.name = 'Graphic Design';

INSERT IGNORE INTO user_skills (user_id, skill_id, proficiency)
SELECT u.id, s.id, 'advanced' FROM users u, skills s
WHERE u.email = 'priya.demo@cb.students.amrita.edu' AND s.name = 'HTML/CSS';

-- Arjun's Skills
INSERT IGNORE INTO user_skills (user_id, skill_id, proficiency)
SELECT u.id, s.id, 'expert' FROM users u, skills s
WHERE u.email = 'arjun.demo@cb.students.amrita.edu' AND s.name = 'C++';

INSERT IGNORE INTO user_skills (user_id, skill_id, proficiency)
SELECT u.id, s.id, 'expert' FROM users u, skills s
WHERE u.email = 'arjun.demo@cb.students.amrita.edu' AND s.name = 'Python';

INSERT IGNORE INTO user_skills (user_id, skill_id, proficiency)
SELECT u.id, s.id, 'advanced' FROM users u, skills s
WHERE u.email = 'arjun.demo@cb.students.amrita.edu' AND s.name = 'SQL';

INSERT IGNORE INTO user_skills (user_id, skill_id, proficiency)
SELECT u.id, s.id, 'advanced' FROM users u, skills s
WHERE u.email = 'arjun.demo@cb.students.amrita.edu' AND s.name = 'Machine Learning';

-- Academic Affiliation for Arjun
UPDATE users SET
  student_id_num = 'CB.EN.U4CSE23105',
  programme = 'B.Tech CSE',
  academic_year = 3,
  section = 'CSE-A'
WHERE email = 'arjun.demo@cb.students.amrita.edu';

-- 3. Realistic Faculty Tasks (Created by Demo Faculty)
INSERT INTO tasks (faculty_id, title, description, task_type, required_skills, deadline, capacity, credit_reward, status)
SELECT u.id, 'Build a student event webpage',
  'Design and implement an interactive, accessible event registration webpage for the upcoming Amrita TechFest. Requires responsive React components and clean CSS layout.',
  'task', 'React,HTML/CSS,JavaScript', DATE_ADD(NOW(), INTERVAL 14 DAY), 2, 15, 'open'
FROM users u WHERE u.email = 'faculty.demo@cb.amrita.edu'
AND NOT EXISTS (SELECT 1 FROM tasks t WHERE t.faculty_id = u.id AND t.title = 'Build a student event webpage');

INSERT INTO tasks (faculty_id, title, description, task_type, required_skills, deadline, capacity, credit_reward, status)
SELECT u.id, 'Analyze a sample campus dataset',
  'Process and generate statistical summaries of anonymized campus facility usage patterns. Identify peak traffic hours and visualize trends using Python and SQL.',
  'task', 'Python,Data Analysis,SQL,Statistics', DATE_ADD(NOW(), INTERVAL 21 DAY), 2, 20, 'open'
FROM users u WHERE u.email = 'faculty.demo@cb.amrita.edu'
AND NOT EXISTS (SELECT 1 FROM tasks t WHERE t.faculty_id = u.id AND t.title = 'Analyze a sample campus dataset');

INSERT INTO tasks (faculty_id, title, description, task_type, required_skills, deadline, capacity, credit_reward, status)
SELECT u.id, 'Help organize a technical workshop',
  'Assist faculty facilitators during the 2-day Machine Learning Hands-on Bootcamp. Help students with environment setup and document troubleshooting FAQs.',
  'volunteer', 'Machine Learning,Technical Writing,Public Speaking', DATE_ADD(NOW(), INTERVAL 10 DAY), 3, 12, 'open'
FROM users u WHERE u.email = 'faculty.demo@cb.amrita.edu'
AND NOT EXISTS (SELECT 1 FROM tasks t WHERE t.faculty_id = u.id AND t.title = 'Help organize a technical workshop');

INSERT INTO tasks (faculty_id, title, description, task_type, required_skills, deadline, capacity, credit_reward, status)
SELECT u.id, 'Create a campus sustainability poster',
  'Create creative, high-impact digital and print posters encouraging paper recycling and energy conservation across university labs and hostels.',
  'task', 'Figma,UI/UX Design,Graphic Design', DATE_ADD(NOW(), INTERVAL 7 DAY), 2, 10, 'open'
FROM users u WHERE u.email = 'faculty.demo@cb.amrita.edu'
AND NOT EXISTS (SELECT 1 FROM tasks t WHERE t.faculty_id = u.id AND t.title = 'Create a campus sustainability poster');

INSERT INTO tasks (faculty_id, title, description, task_type, required_skills, deadline, capacity, credit_reward, status)
SELECT u.id, 'Assist with a student club event',
  'Coordinate student registrations, volunteer logistics, and scheduling for the university coding club hackathon kickoff.',
  'volunteer', 'Project Management,Public Speaking', DATE_ADD(NOW(), INTERVAL 5 DAY), 4, 10, 'open'
FROM users u WHERE u.email = 'faculty.demo@cb.amrita.edu'
AND NOT EXISTS (SELECT 1 FROM tasks t WHERE t.faculty_id = u.id AND t.title = 'Assist with a student club event');

-- Tasks by Dr. Meera Nair
INSERT INTO tasks (faculty_id, title, description, task_type, required_skills, deadline, capacity, credit_reward, status)
SELECT u.id, 'NLP Dataset Annotation for Indian Languages',
  'Annotate and curate conversational dataset for low-resource Indian languages. Assist research lab in preprocessing text corpora and evaluating tokenizers.',
  'task', 'Python,Machine Learning,Data Analysis', DATE_ADD(NOW(), INTERVAL 18 DAY), 3, 18, 'open'
FROM users u WHERE u.email = 'meera.nair@cb.amrita.edu'
AND NOT EXISTS (SELECT 1 FROM tasks t WHERE t.faculty_id = u.id AND t.title = 'NLP Dataset Annotation for Indian Languages');

-- Tasks by Dr. Arun Kumar
INSERT INTO tasks (faculty_id, title, description, task_type, required_skills, deadline, capacity, credit_reward, status)
SELECT u.id, 'Real-Time Campus Energy Sensor Pipeline',
  'Develop a data ingestion script to parse IoT telemetry from campus solar meters and stream metrics into PostgreSQL/MySQL dashboards.',
  'task', 'Python,SQL,Docker', DATE_ADD(NOW(), INTERVAL 25 DAY), 2, 20, 'open'
FROM users u WHERE u.email = 'arun.kumar@cb.amrita.edu'
AND NOT EXISTS (SELECT 1 FROM tasks t WHERE t.faculty_id = u.id AND t.title = 'Real-Time Campus Energy Sensor Pipeline');

-- Tasks by Prof. Lakshmi Menon
INSERT INTO tasks (faculty_id, title, description, task_type, required_skills, deadline, capacity, credit_reward, status)
SELECT u.id, 'Smart Campus IoT Beacon Setup',
  'Assist with assembling and testing Bluetooth Low Energy beacons for student lab attendance automation and asset tracking.',
  'volunteer', 'Linux,Git,Project Management', DATE_ADD(NOW(), INTERVAL 14 DAY), 4, 12, 'open'
FROM users u WHERE u.email = 'lakshmi.menon@cb.amrita.edu'
AND NOT EXISTS (SELECT 1 FROM tasks t WHERE t.faculty_id = u.id AND t.title = 'Smart Campus IoT Beacon Setup');

-- Tasks by Prof. Suresh Iyer
INSERT INTO tasks (faculty_id, title, description, task_type, required_skills, deadline, capacity, credit_reward, status)
SELECT u.id, '3D Modeling for Engineering Lab Apparatus',
  'Create clean CAD/Figma diagrams and 3D schematics for student laboratory experiment manuals and technical documentation.',
  'task', 'UI/UX Design,Technical Writing,Research', DATE_ADD(NOW(), INTERVAL 12 DAY), 2, 15, 'open'
FROM users u WHERE u.email = 'suresh.iyer@cb.amrita.edu'
AND NOT EXISTS (SELECT 1 FROM tasks t WHERE t.faculty_id = u.id AND t.title = '3D Modeling for Engineering Lab Apparatus');

-- Tasks by Dr. Kavitha Rao
INSERT INTO tasks (faculty_id, title, description, task_type, required_skills, deadline, capacity, credit_reward, status)
SELECT u.id, 'Vulnerability Assessment of Student Portal Modules',
  'Conduct systematic OWASP testing and code auditing of student submission modules. Report vulnerability reproductions and remediation steps.',
  'task', 'Linux,Python,Technical Writing', DATE_ADD(NOW(), INTERVAL 20 DAY), 2, 25, 'open'
FROM users u WHERE u.email = 'kavitha.rao@cb.amrita.edu'
AND NOT EXISTS (SELECT 1 FROM tasks t WHERE t.faculty_id = u.id AND t.title = 'Vulnerability Assessment of Student Portal Modules');

-- ============================================================
-- 4. CLASS ADVISORS & STUDENT VERIFICATION DATA
-- ============================================================

-- Assign Dr. Meera Nair as Class Advisor for B.Tech CSE, Year 3, Section CSE-A
INSERT INTO class_advisors (faculty_id, department, programme, academic_year, section)
SELECT u.id, 'Computer Science and Engineering', 'B.Tech CSE', 3, 'CSE-A'
FROM users u WHERE u.email = 'meera.nair@cb.amrita.edu'
ON DUPLICATE KEY UPDATE faculty_id = VALUES(faculty_id);

-- Assign Dr. Arun Kumar as Class Advisor for B.Tech AI & DS, Year 3, Section AIE-B
INSERT INTO class_advisors (faculty_id, department, programme, academic_year, section)
SELECT u.id, 'Artificial Intelligence & Data Science', 'B.Tech AI & DS', 3, 'AIE-B'
FROM users u WHERE u.email = 'arun.kumar@cb.amrita.edu'
ON DUPLICATE KEY UPDATE faculty_id = VALUES(faculty_id);

-- Assign Prof. Lakshmi Menon as Class Advisor for B.Tech ECE, Year 3, Section ECE-A
INSERT INTO class_advisors (faculty_id, department, programme, academic_year, section)
SELECT u.id, 'Electronics and Communication Engineering', 'B.Tech ECE', 3, 'ECE-A'
FROM users u WHERE u.email = 'lakshmi.menon@cb.amrita.edu'
ON DUPLICATE KEY UPDATE faculty_id = VALUES(faculty_id);

-- Link students to their class advisors
UPDATE users u
JOIN class_advisors ca ON ca.programme = u.programme AND ca.academic_year = u.academic_year AND ca.section = u.section
SET u.advisor_id = ca.id
WHERE u.role = 'student';

-- Ensure Priya is marked verified with a real advisor_verifications record
UPDATE users u
JOIN class_advisors ca ON ca.id = u.advisor_id
SET u.is_advisor_approved = 1, u.advisor_approved_at = DATE_SUB(NOW(), INTERVAL 14 DAY)
WHERE u.email = 'priya.demo@cb.students.amrita.edu';

INSERT INTO advisor_verifications (student_id, advisor_id, verified_by_user_id, status, reason, verified_at)
SELECT u.id, ca.id, ca.faculty_id, 'approved', 'Class identity and affiliation confirmed during semester registration.', DATE_SUB(NOW(), INTERVAL 14 DAY)
FROM users u
JOIN class_advisors ca ON ca.id = u.advisor_id
WHERE u.email = 'priya.demo@cb.students.amrita.edu'
AND NOT EXISTS (
  SELECT 1 FROM advisor_verifications av WHERE av.student_id = u.id AND av.status = 'approved'
);

UPDATE advisor_verifications av
JOIN users u ON u.id = av.student_id
JOIN class_advisors ca ON ca.id = u.advisor_id
SET av.verified_by_user_id = ca.faculty_id, av.advisor_id = ca.id
WHERE u.email = 'priya.demo@cb.students.amrita.edu' AND av.status = 'approved';

-- Ensure Anu is marked verified with a real advisor_verifications record
UPDATE users u
JOIN class_advisors ca ON ca.id = u.advisor_id
SET u.is_advisor_approved = 1, u.advisor_approved_at = DATE_SUB(NOW(), INTERVAL 7 DAY)
WHERE u.email = 'anu.demo@cb.students.amrita.edu';

INSERT INTO advisor_verifications (student_id, advisor_id, verified_by_user_id, status, reason, verified_at)
SELECT u.id, ca.id, ca.faculty_id, 'approved', 'Class identity and affiliation confirmed during semester registration.', DATE_SUB(NOW(), INTERVAL 7 DAY)
FROM users u
JOIN class_advisors ca ON ca.id = u.advisor_id
WHERE u.email = 'anu.demo@cb.students.amrita.edu'
AND NOT EXISTS (
  SELECT 1 FROM advisor_verifications av WHERE av.student_id = u.id AND av.status = 'approved'
);

UPDATE advisor_verifications av
JOIN users u ON u.id = av.student_id
JOIN class_advisors ca ON ca.id = u.advisor_id
SET av.verified_by_user_id = ca.faculty_id, av.advisor_id = ca.id
WHERE u.email = 'anu.demo@cb.students.amrita.edu' AND av.status = 'approved';

-- Ensure Arjun and Rahul start as unverified (0) so they can be verified during testing/demo
UPDATE users SET is_advisor_approved = 0, advisor_approved_at = NULL
WHERE email IN ('arjun.demo@cb.students.amrita.edu', 'rahul.demo@cb.students.amrita.edu');
DELETE av FROM advisor_verifications av
JOIN users u ON u.id = av.student_id
WHERE u.email IN ('arjun.demo@cb.students.amrita.edu', 'rahul.demo@cb.students.amrita.edu');


