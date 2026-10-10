-- CampusConnect Database Schema
-- Run this file first, then seed.sql

CREATE DATABASE IF NOT EXISTS campusconnect_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE campusconnect_db;

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  email       VARCHAR(191) NOT NULL,
  password    VARCHAR(255) NOT NULL,
  role        ENUM('student','faculty','admin') NOT NULL DEFAULT 'student',
  bio         TEXT,
  avatar_url  VARCHAR(500),
  department  VARCHAR(100),
  is_active   TINYINT(1) NOT NULL DEFAULT 1,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_email (email)
) ENGINE=InnoDB;

-- ============================================================
-- SKILLS (canonical catalogue with stable IDs)
-- ============================================================
CREATE TABLE IF NOT EXISTS skills (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  category    VARCHAR(100),
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_skill_name (name)
) ENGINE=InnoDB;

-- ============================================================
-- USER_SKILLS (M:N)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_skills (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id      INT UNSIGNED NOT NULL,
  skill_id     INT UNSIGNED NOT NULL,
  proficiency  ENUM('beginner','intermediate','advanced','expert') NOT NULL DEFAULT 'beginner',
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_skill (user_id, skill_id),
  CONSTRAINT fk_us_user  FOREIGN KEY (user_id)  REFERENCES users(id)  ON DELETE CASCADE,
  CONSTRAINT fk_us_skill FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- TASKS (faculty-created)
-- ============================================================
CREATE TABLE IF NOT EXISTS tasks (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  faculty_id      INT UNSIGNED NOT NULL,
  title           VARCHAR(200) NOT NULL,
  description     TEXT NOT NULL,
  task_type       ENUM('task','volunteer') NOT NULL DEFAULT 'task',
  required_skills TEXT,
  deadline        DATETIME,
  capacity        INT UNSIGNED NOT NULL DEFAULT 1,
  credit_reward   INT UNSIGNED NOT NULL DEFAULT 0,
  status          ENUM('open','closed','cancelled') NOT NULL DEFAULT 'open',
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_task_faculty (faculty_id),
  INDEX idx_task_status  (status),
  CONSTRAINT fk_task_faculty FOREIGN KEY (faculty_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- APPLICATIONS (student → task)
-- ============================================================
CREATE TABLE IF NOT EXISTS applications (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  task_id      INT UNSIGNED NOT NULL,
  student_id   INT UNSIGNED NOT NULL,
  status       ENUM('pending','assigned','rejected','submitted','approved','credited') NOT NULL DEFAULT 'pending',
  note         TEXT,
  submitted_at DATETIME,
  approved_at  DATETIME,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_app (task_id, student_id),
  INDEX idx_app_student (student_id),
  CONSTRAINT fk_app_task    FOREIGN KEY (task_id)    REFERENCES tasks(id) ON DELETE CASCADE,
  CONSTRAINT fk_app_student FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- HELP_REQUESTS (peer-help)
-- ============================================================
CREATE TABLE IF NOT EXISTS help_requests (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  requester_id INT UNSIGNED NOT NULL,
  helper_id    INT UNSIGNED,
  title        VARCHAR(200) NOT NULL,
  description  TEXT NOT NULL,
  category     VARCHAR(100),
  skills_needed TEXT,
  deadline     DATETIME,
  status       ENUM('open','accepted','submitted','confirmed','cancelled') NOT NULL DEFAULT 'open',
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_hr_requester (requester_id),
  INDEX idx_hr_helper    (helper_id),
  INDEX idx_hr_status    (status),
  CONSTRAINT fk_hr_requester FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_hr_helper    FOREIGN KEY (helper_id)    REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================
-- HELP_COMPLETIONS (directional pair history + dedup)
-- ============================================================
CREATE TABLE IF NOT EXISTS help_completions (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  request_id   INT UNSIGNED NOT NULL,
  helper_id    INT UNSIGNED NOT NULL,
  requester_id INT UNSIGNED NOT NULL,
  first_time   TINYINT(1) NOT NULL DEFAULT 0,
  credits_awarded INT NOT NULL DEFAULT 0,
  cap_applied  TINYINT(1) NOT NULL DEFAULT 0,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_completion_request (request_id),
  INDEX idx_hc_helper    (helper_id),
  INDEX idx_hc_requester (requester_id),
  CONSTRAINT fk_hc_request   FOREIGN KEY (request_id)   REFERENCES help_requests(id) ON DELETE CASCADE,
  CONSTRAINT fk_hc_helper    FOREIGN KEY (helper_id)    REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_hc_requester FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- DIRECTIONAL PAIR TRACKING (first-time help detection)
-- ============================================================
CREATE TABLE IF NOT EXISTS help_pairs (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  helper_id    INT UNSIGNED NOT NULL,
  requester_id INT UNSIGNED NOT NULL,
  pair_count   INT UNSIGNED NOT NULL DEFAULT 1,
  first_helped_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_pair (helper_id, requester_id),
  CONSTRAINT fk_pair_helper    FOREIGN KEY (helper_id)    REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_pair_requester FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- CREDIT_TRANSACTIONS (immutable ledger)
-- ============================================================
CREATE TABLE IF NOT EXISTS credit_transactions (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id       INT UNSIGNED NOT NULL,
  amount        INT NOT NULL,
  type          ENUM('peer_help','task_reward','admin_adjustment','reversal') NOT NULL,
  source_id     INT UNSIGNED,
  source_type   ENUM('help_request','task_application','admin') DEFAULT NULL,
  description   VARCHAR(500),
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ct_user (user_id),
  CONSTRAINT fk_ct_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- REPORTS (admin-flagged suspicious activity)
-- ============================================================
CREATE TABLE IF NOT EXISTS reports (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  reporter_id  INT UNSIGNED,
  subject_id   INT UNSIGNED NOT NULL,
  reason       VARCHAR(500) NOT NULL,
  context_type ENUM('help_request','task','user','credit') DEFAULT NULL,
  context_id   INT UNSIGNED,
  status       ENUM('open','reviewed','dismissed') NOT NULL DEFAULT 'open',
  admin_note   TEXT,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_report_subject (subject_id),
  INDEX idx_report_status  (status)
) ENGINE=InnoDB;
