-- ============================================================
-- CampusConnect: Student Welfare & Academic Integrity Seed Data
-- 20 Fictional Students, 8 Fictional Faculty, Class Advisors,
-- Realistic Profiles, Sample Complaints & Investigation Cases
-- Demo Password for all: "Demo1234!"
-- Bcrypt Hash: $2a$10$OroX0tBVzIQeaUxGGqXZsOLB77Vo1u90haAi/g2a6mgl50UUNMC8q
-- All addresses and records are fictional illustrative demonstration data.
-- ============================================================

USE campusconnect_db;

-- 1. Faculty Accounts (8 Faculty + 1 Coordinator)
INSERT INTO users (name, email, password, role, bio, department, is_active)
VALUES
  ('Dr. Anand Kumar',      'faculty01@cb.amrita.edu', '$2a$10$OroX0tBVzIQeaUxGGqXZsOLB77Vo1u90haAi/g2a6mgl50UUNMC8q', 'faculty', 'Professor & Class Advisor (B.Tech CSE Year 3-A). Research in Distributed Systems.', 'Computer Science and Engineering', 1),
  ('Dr. Bhavani S.',       'faculty02@cb.amrita.edu', '$2a$10$OroX0tBVzIQeaUxGGqXZsOLB77Vo1u90haAi/g2a6mgl50UUNMC8q', 'faculty', 'Associate Professor & Class Advisor (B.Tech CSE Year 4-B). Focus on Software Engineering & Cloud.', 'Computer Science and Engineering', 1),
  ('Dr. Chandran M.',      'faculty03@cb.amrita.edu', '$2a$10$OroX0tBVzIQeaUxGGqXZsOLB77Vo1u90haAi/g2a6mgl50UUNMC8q', 'faculty', 'Assistant Professor & Class Advisor (B.Tech AI & DS Year 2-A). Machine Learning & Vision lab.', 'Artificial Intelligence & Data Science', 1),
  ('Dr. Deepa Nair',       'faculty04@cb.amrita.edu', '$2a$10$OroX0tBVzIQeaUxGGqXZsOLB77Vo1u90haAi/g2a6mgl50UUNMC8q', 'faculty', 'Associate Professor & Class Advisor (B.Tech AI & DS Year 3-B). Natural Language Processing.', 'Artificial Intelligence & Data Science', 1),
  ('Dr. Eswaran K.',       'faculty05@cb.amrita.edu', '$2a$10$OroX0tBVzIQeaUxGGqXZsOLB77Vo1u90haAi/g2a6mgl50UUNMC8q', 'faculty', 'Professor & Class Advisor (B.Tech ECE Year 3-A). Embedded Systems and Signal Processing.', 'Electronics and Communication Engineering', 1),
  ('Dr. Fathima R.',       'faculty06@cb.amrita.edu', '$2a$10$OroX0tBVzIQeaUxGGqXZsOLB77Vo1u90haAi/g2a6mgl50UUNMC8q', 'faculty', 'Assistant Professor & Class Advisor (B.Tech ECE Year 4-A). VLSI Design and IoT.', 'Electronics and Communication Engineering', 1),
  ('Dr. Gopal Menon',      'faculty07@cb.amrita.edu', '$2a$10$OroX0tBVzIQeaUxGGqXZsOLB77Vo1u90haAi/g2a6mgl50UUNMC8q', 'faculty', 'Associate Professor & Class Advisor (B.Tech ME Year 2-A). Robotics and Autonomous Systems.', 'Mechanical Engineering', 1),
  ('Dr. Hema Sundaram',    'faculty08@cb.amrita.edu', '$2a$10$OroX0tBVzIQeaUxGGqXZsOLB77Vo1u90haAi/g2a6mgl50UUNMC8q', 'faculty', 'Professor & Class Advisor (B.Tech CYS Year 3-A). Network Security & Cryptography.', 'Cyber Security', 1)
ON DUPLICATE KEY UPDATE name = VALUES(name), department = VALUES(department);

-- Student Welfare Administrator
INSERT INTO users (name, email, password, role, bio, department, is_active)
VALUES
  ('Student Welfare Administrator', 'admin.demo@cb.amrita.edu', '$2a$10$OroX0tBVzIQeaUxGGqXZsOLB77Vo1u90haAi/g2a6mgl50UUNMC8q', 'admin', 'Official Student Welfare & Academic Integrity Office. Oversees fair hearings, trust badges, and integrity appeals.', 'Office of Student Welfare', 1)
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- 2. 20 Fictional Students
INSERT INTO users (name, email, password, role, student_id_num, department, programme, academic_year, section, bio, is_active)
VALUES
  ('Aadhavan Raman',       'student01@cb.students.amrita.edu', '$2a$10$OroX0tBVzIQeaUxGGqXZsOLB77Vo1u90haAi/g2a6mgl50UUNMC8q', 'student', 'CB.EN.U4CSE23001', 'Computer Science and Engineering', 'B.Tech CSE', 3, 'CSE-A', 'Full-stack developer interested in React and microservices.', 1),
  ('Bhavya Krishna',       'student02@cb.students.amrita.edu', '$2a$10$OroX0tBVzIQeaUxGGqXZsOLB77Vo1u90haAi/g2a6mgl50UUNMC8q', 'student', 'CB.EN.U4CSE23002', 'Computer Science and Engineering', 'B.Tech CSE', 3, 'CSE-A', 'Database enthusiast focusing on SQL tuning and distributed storage.', 1),
  ('Charan Teja',          'student03@cb.students.amrita.edu', '$2a$10$OroX0tBVzIQeaUxGGqXZsOLB77Vo1u90haAi/g2a6mgl50UUNMC8q', 'student', 'CB.EN.U4CSE23003', 'Computer Science and Engineering', 'B.Tech CSE', 3, 'CSE-A', 'Competitive programmer working on graph algorithms and dynamic programming.', 1),
  ('Divya Sree',           'student04@cb.students.amrita.edu', '$2a$10$OroX0tBVzIQeaUxGGqXZsOLB77Vo1u90haAi/g2a6mgl50UUNMC8q', 'student', 'CB.EN.U4CSE23004', 'Computer Science and Engineering', 'B.Tech CSE', 4, 'CSE-B', 'Senior student focusing on DevOps, Docker, and Kubernetes deployment pipelines.', 1),
  ('Eashwar Pranav',       'student05@cb.students.amrita.edu', '$2a$10$OroX0tBVzIQeaUxGGqXZsOLB77Vo1u90haAi/g2a6mgl50UUNMC8q', 'student', 'CB.EN.U4CSE23005', 'Computer Science and Engineering', 'B.Tech CSE', 4, 'CSE-B', 'Frontend specialist experienced with TypeScript, Tailwind CSS, and UX research.', 1),
  ('Farhan Ahmed',         'student06@cb.students.amrita.edu', '$2a$10$OroX0tBVzIQeaUxGGqXZsOLB77Vo1u90haAi/g2a6mgl50UUNMC8q', 'student', 'CB.EN.U4AIE24001', 'Artificial Intelligence & Data Science', 'B.Tech AI & DS', 2, 'AIE-A', 'Sophomore working on computer vision and PyTorch models for assistive robotics.', 1),
  ('Gayathri Devi',        'student07@cb.students.amrita.edu', '$2a$10$OroX0tBVzIQeaUxGGqXZsOLB77Vo1u90haAi/g2a6mgl50UUNMC8q', 'student', 'CB.EN.U4AIE24002', 'Artificial Intelligence & Data Science', 'B.Tech AI & DS', 2, 'AIE-A', 'Data science learner passionate about statistical inference and Pandas analytics.', 1),
  ('Harish Raghav',        'student08@cb.students.amrita.edu', '$2a$10$OroX0tBVzIQeaUxGGqXZsOLB77Vo1u90haAi/g2a6mgl50UUNMC8q', 'student', 'CB.EN.U4AIE23001', 'Artificial Intelligence & Data Science', 'B.Tech AI & DS', 3, 'AIE-B', 'Junior student building NLP recommendation engines and LLM agents.', 1),
  ('Ishwarya Lakshmi',     'student09@cb.students.amrita.edu', '$2a$10$OroX0tBVzIQeaUxGGqXZsOLB77Vo1u90haAi/g2a6mgl50UUNMC8q', 'student', 'CB.EN.U4AIE23002', 'Artificial Intelligence & Data Science', 'B.Tech AI & DS', 3, 'AIE-B', 'Exploring ethical AI, prompt evaluation, and bias mitigation algorithms.', 1),
  ('Jayanth Varma',        'student10@cb.students.amrita.edu', '$2a$10$OroX0tBVzIQeaUxGGqXZsOLB77Vo1u90haAi/g2a6mgl50UUNMC8q', 'student', 'CB.EN.U4ECE23001', 'Electronics and Communication Engineering', 'B.Tech ECE', 3, 'ECE-A', 'Embedded C programmer working on ARM Cortex microcontrollers and sensor networks.', 1),
  ('Kavya Madhavan',       'student11@cb.students.amrita.edu', '$2a$10$OroX0tBVzIQeaUxGGqXZsOLB77Vo1u90haAi/g2a6mgl50UUNMC8q', 'student', 'CB.EN.U4ECE23002', 'Electronics and Communication Engineering', 'B.Tech ECE', 3, 'ECE-A', 'Digital signal processing and MATLAB simulation enthusiast.', 1),
  ('Lokesh Kumar',         'student12@cb.students.amrita.edu', '$2a$10$OroX0tBVzIQeaUxGGqXZsOLB77Vo1u90haAi/g2a6mgl50UUNMC8q', 'student', 'CB.EN.U4ECE22001', 'Electronics and Communication Engineering', 'B.Tech ECE', 4, 'ECE-A', 'FPGA and Verilog HDL developer interested in high-speed hardware architecture.', 1),
  ('Meera Nambiar',        'student13@cb.students.amrita.edu', '$2a$10$OroX0tBVzIQeaUxGGqXZsOLB77Vo1u90haAi/g2a6mgl50UUNMC8q', 'student', 'CB.EN.U4ECE22002', 'Electronics and Communication Engineering', 'B.Tech ECE', 4, 'ECE-A', 'IoT hardware researcher working on low-power LoRaWAN sensor systems.', 1),
  ('Naveen Prakash',       'student14@cb.students.amrita.edu', '$2a$10$OroX0tBVzIQeaUxGGqXZsOLB77Vo1u90haAi/g2a6mgl50UUNMC8q', 'student', 'CB.EN.U4ME24001',  'Mechanical Engineering', 'B.Tech ME', 2, 'ME-A', 'CAD modeling, SolidWorks design, and finite element stress analysis.', 1),
  ('Oviya Subramanian',    'student15@cb.students.amrita.edu', '$2a$10$OroX0tBVzIQeaUxGGqXZsOLB77Vo1u90haAi/g2a6mgl50UUNMC8q', 'student', 'CB.EN.U4ME24002',  'Mechanical Engineering', 'B.Tech ME', 2, 'ME-A', 'Thermodynamics and CFD simulation using ANSYS Fluent.', 1),
  ('Pranav Karthik',       'student16@cb.students.amrita.edu', '$2a$10$OroX0tBVzIQeaUxGGqXZsOLB77Vo1u90haAi/g2a6mgl50UUNMC8q', 'student', 'CB.EN.U4CYS23001', 'Cyber Security', 'B.Tech CYS', 3, 'CYS-A', 'Ethical hacker and CTF player focused on web penetration testing and OWASP vulnerabilities.', 1),
  ('Qasim Bilal',          'student17@cb.students.amrita.edu', '$2a$10$OroX0tBVzIQeaUxGGqXZsOLB77Vo1u90haAi/g2a6mgl50UUNMC8q', 'student', 'CB.EN.U4CYS23002', 'Cyber Security', 'B.Tech CYS', 3, 'CYS-A', 'Network forensics, Wireshark packet analysis, and SIEM monitoring.', 1),
  ('Rohit Sen',            'student18@cb.students.amrita.edu', '$2a$10$OroX0tBVzIQeaUxGGqXZsOLB77Vo1u90haAi/g2a6mgl50UUNMC8q', 'student', 'CB.EN.U4CSE23006', 'Computer Science and Engineering', 'B.Tech CSE', 3, 'CSE-A', 'Mobile app developer utilizing Flutter and Firebase for campus utility apps.', 1),
  ('Swathi Ranganathan',   'student19@cb.students.amrita.edu', '$2a$10$OroX0tBVzIQeaUxGGqXZsOLB77Vo1u90haAi/g2a6mgl50UUNMC8q', 'student', 'CB.EN.U4CSE23007', 'Computer Science and Engineering', 'B.Tech CSE', 3, 'CSE-A', 'Technical writer and open source documentation contributor.', 1),
  ('Tarun Reddy',          'student20@cb.students.amrita.edu', '$2a$10$OroX0tBVzIQeaUxGGqXZsOLB77Vo1u90haAi/g2a6mgl50UUNMC8q', 'student', 'CB.EN.U4AIE23003', 'Artificial Intelligence & Data Science', 'B.Tech AI & DS', 3, 'AIE-B', 'Deep learning researcher building reinforcement learning agents for game environments.', 1)
ON DUPLICATE KEY UPDATE
  student_id_num = VALUES(student_id_num),
  department = VALUES(department),
  programme = VALUES(programme),
  academic_year = VALUES(academic_year),
  section = VALUES(section);

-- Also update existing core demo students with realistic academic profiles
UPDATE users SET
  student_id_num = 'CB.EN.U4CSE23099',
  programme = 'B.Tech CSE',
  academic_year = 4,
  section = 'CSE-B'
WHERE email = 'radhakrishna@cb.students.amrita.edu';

UPDATE users SET
  student_id_num = 'CB.EN.U4AIE23088',
  programme = 'B.Tech AI & DS',
  academic_year = 3,
  section = 'AIE-B'
WHERE email = 'anu.demo@cb.students.amrita.edu';

UPDATE users SET
  student_id_num = 'CB.EN.U4ECE23077',
  programme = 'B.Tech ECE',
  academic_year = 3,
  section = 'ECE-A'
WHERE email = 'rahul.demo@cb.students.amrita.edu';

UPDATE users SET
  student_id_num = 'CB.EN.U4CSE23066',
  programme = 'B.Tech CSE',
  academic_year = 3,
  section = 'CSE-A'
WHERE email = 'priya.demo@cb.students.amrita.edu';
