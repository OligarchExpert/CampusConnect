USE campusconnect_db;

-- ============================================================
-- SKILLS CATALOGUE
-- ============================================================
INSERT IGNORE INTO skills (name, category) VALUES
  ('Python',             'Programming'),
  ('JavaScript',         'Programming'),
  ('Java',               'Programming'),
  ('C++',                'Programming'),
  ('TypeScript',         'Programming'),
  ('React',              'Web Development'),
  ('Node.js',            'Web Development'),
  ('HTML/CSS',           'Web Development'),
  ('Vue.js',             'Web Development'),
  ('Angular',            'Web Development'),
  ('Machine Learning',   'Data Science'),
  ('Data Analysis',      'Data Science'),
  ('SQL',                'Data Science'),
  ('Statistics',         'Data Science'),
  ('Deep Learning',      'Data Science'),
  ('AWS',                'Cloud'),
  ('Docker',             'DevOps'),
  ('Git',                'DevOps'),
  ('Linux',              'DevOps'),
  ('Kubernetes',         'DevOps'),
  ('Figma',              'Design'),
  ('UI/UX Design',       'Design'),
  ('Graphic Design',     'Design'),
  ('Technical Writing',  'Communication'),
  ('Public Speaking',    'Communication'),
  ('Project Management', 'Soft Skills'),
  ('Research',           'Academic'),
  ('Mathematics',        'Academic'),
  ('Physics',            'Academic'),
  ('Economics',          'Academic');

-- ============================================================
-- DEMO USERS  (passwords are bcrypt hash of "Demo1234!")
-- ============================================================
INSERT IGNORE INTO users (name, email, password, role, bio, department) VALUES
  ('Admin User',      'admin@campus.edu',   '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin',   'Platform administrator.',                    'Administration'),
  ('Dr. Jane Faculty','faculty@campus.edu', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'faculty', 'Associate Professor, Computer Science.',     'Computer Science'),
  ('Alex Student',    'student@campus.edu', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'student', 'Final year CS student interested in ML.',   'Computer Science'),
  ('Sam Helper',      'sam@campus.edu',     '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'student', 'Third year student, loves helping others.',  'Mathematics'),
  ('Priya Learner',   'priya@campus.edu',   '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'student', 'Second year, exploring data science.',       'Statistics');

-- NOTE: The bcrypt hash above is the well-known test hash for "password" from Laravel.
-- For real seeding, generate hashes with: node -e "const b=require('bcryptjs');b.hash('Demo1234!',10).then(h=>console.log(h))"
-- After running the server once, use the /api/auth/register endpoint or run the seed-passwords.js script.

-- ============================================================
-- USER SKILLS
-- ============================================================
-- Alex Student (id=3)
INSERT IGNORE INTO user_skills (user_id, skill_id, proficiency) VALUES
  (3, 1,  'intermediate'),  -- Python
  (3, 2,  'intermediate'),  -- JavaScript
  (3, 11, 'beginner'),      -- Machine Learning
  (3, 6,  'beginner');      -- React

-- Sam Helper (id=4)
INSERT IGNORE INTO user_skills (user_id, skill_id, proficiency) VALUES
  (4, 28, 'advanced'),  -- Mathematics
  (4, 13, 'advanced'),  -- SQL
  (4, 14, 'intermediate');  -- Statistics

-- Priya Learner (id=5)
INSERT IGNORE INTO user_skills (user_id, skill_id, proficiency) VALUES
  (5, 12, 'beginner'),  -- Data Analysis
  (5, 14, 'beginner'),  -- Statistics
  (5, 1,  'beginner');  -- Python

-- ============================================================
-- DEMO TASKS
-- ============================================================
INSERT IGNORE INTO tasks (faculty_id, title, description, task_type, required_skills, deadline, capacity, credit_reward, status) VALUES
  (2, 'Research Paper Assistant', 'Help Professor with literature review for AI ethics paper. Document findings in structured format.', 'task', 'Research,Technical Writing', DATE_ADD(NOW(), INTERVAL 14 DAY), 2, 15, 'open'),
  (2, 'Campus Clean-up Volunteer', 'Join the campus sustainability drive. Help organize and clean the main quad area.', 'volunteer', 'Project Management', DATE_ADD(NOW(), INTERVAL 7 DAY), 10, 8, 'open'),
  (2, 'Data Analysis Workshop', 'Assist in running a workshop for first-year students on basic data analysis with Python.', 'task', 'Python,Data Analysis,Public Speaking', DATE_ADD(NOW(), INTERVAL 21 DAY), 3, 20, 'open');

-- ============================================================
-- DEMO HELP REQUESTS
-- ============================================================
INSERT IGNORE INTO help_requests (requester_id, title, description, category, skills_needed, status) VALUES
  (3, 'Help with Linear Regression', 'I am struggling with implementing linear regression from scratch in Python. Need someone to walk me through it.', 'Academic', 'Python,Mathematics,Machine Learning', 'open'),
  (5, 'SQL Query Optimization', 'My database queries are very slow. Need help optimizing them for better performance.', 'Technical', 'SQL', 'open'),
  (3, 'React Component Design', 'Need help structuring my React components for a class project. Getting confused with state management.', 'Technical', 'React,JavaScript', 'open');
