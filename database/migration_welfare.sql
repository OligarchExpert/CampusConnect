-- CampusConnect: Student Welfare & Academic Integrity Schema Migration
USE campusconnect_db;

-- 2. CLASS_ADVISORS (Faculty linked to department, programme, year, section)
CREATE TABLE IF NOT EXISTS class_advisors (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  faculty_id      INT UNSIGNED NOT NULL,
  department      VARCHAR(100) NOT NULL,
  programme       VARCHAR(100) NOT NULL,
  academic_year   INT UNSIGNED NOT NULL,
  section         VARCHAR(20) NOT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_advisor_section (department, programme, academic_year, section),
  INDEX idx_ca_faculty (faculty_id),
  CONSTRAINT fk_ca_faculty FOREIGN KEY (faculty_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 3. ADVISOR_VERIFICATIONS (Audit of verification awards and revocations)
CREATE TABLE IF NOT EXISTS advisor_verifications (
  id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id          INT UNSIGNED NOT NULL,
  advisor_id          INT UNSIGNED NOT NULL,
  verified_by_user_id INT UNSIGNED NOT NULL,
  status              ENUM('approved', 'revoked') NOT NULL DEFAULT 'approved',
  reason              TEXT,
  verified_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at          DATETIME DEFAULT NULL,
  INDEX idx_av_student (student_id),
  INDEX idx_av_advisor (advisor_id),
  CONSTRAINT fk_av_student  FOREIGN KEY (student_id)          REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_av_advisor  FOREIGN KEY (advisor_id)          REFERENCES class_advisors(id) ON DELETE CASCADE,
  CONSTRAINT fk_av_verifier FOREIGN KEY (verified_by_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 4. COMPLAINTS (Comprehensive case management)
CREATE TABLE IF NOT EXISTS complaints (
  id                     INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  complaint_ref          VARCHAR(50) NOT NULL,
  complainant_id         INT UNSIGNED NOT NULL,
  reported_user_id       INT UNSIGNED NOT NULL,
  category               ENUM(
                           'peer_help_misrepresentation',
                           'credit_fraud',
                           'academic_integrity_faculty',
                           'academic_integrity_student',
                           'harassment_conduct',
                           'task_dispute',
                           'other'
                         ) NOT NULL,
  context_type           ENUM('help_request', 'task', 'submission', 'user', 'credit') DEFAULT NULL,
  context_id             INT UNSIGNED DEFAULT NULL,
  description            TEXT NOT NULL,
  original_work_details  TEXT DEFAULT NULL,
  original_work_date     DATE DEFAULT NULL,
  status                 ENUM(
                           'submitted',
                           'under_review',
                           'awaiting_evidence',
                           'awaiting_response',
                           'substantiated',
                           'partially_substantiated',
                           'unsubstantiated',
                           'closed'
                         ) NOT NULL DEFAULT 'submitted',
  assigned_reviewer_id   INT UNSIGNED DEFAULT NULL,
  investigation_notes    TEXT DEFAULT NULL,
  decision               ENUM('none', 'substantiated', 'partially_substantiated', 'unsubstantiated', 'malicious_complaint', 'dismissed') NOT NULL DEFAULT 'none',
  decision_reason        TEXT DEFAULT NULL,
  decision_by            INT UNSIGNED DEFAULT NULL,
  decision_at            DATETIME DEFAULT NULL,
  created_at             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_complaint_ref (complaint_ref),
  INDEX idx_comp_complainant (complainant_id),
  INDEX idx_comp_reported   (reported_user_id),
  INDEX idx_comp_status     (status),
  INDEX idx_comp_cat        (category),
  CONSTRAINT fk_comp_complainant FOREIGN KEY (complainant_id)   REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_comp_reported    FOREIGN KEY (reported_user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_comp_reviewer    FOREIGN KEY (assigned_reviewer_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_comp_decision_by FOREIGN KEY (decision_by)          REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 5. COMPLAINT_EVIDENCE (Secure attachment metadata)
CREATE TABLE IF NOT EXISTS complaint_evidence (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  complaint_id  INT UNSIGNED NOT NULL,
  uploaded_by   INT UNSIGNED NOT NULL,
  file_name     VARCHAR(255) NOT NULL,
  file_path     VARCHAR(500) NOT NULL,
  file_size     INT UNSIGNED NOT NULL,
  mime_type     VARCHAR(100) NOT NULL,
  description   TEXT DEFAULT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ce_complaint (complaint_id),
  CONSTRAINT fk_ce_complaint FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE,
  CONSTRAINT fk_ce_uploader  FOREIGN KEY (uploaded_by)  REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 6. COMPLAINT_STATUS_HISTORY (Audit trail for case lifecycle)
CREATE TABLE IF NOT EXISTS complaint_status_history (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  complaint_id  INT UNSIGNED NOT NULL,
  from_status   VARCHAR(50) NOT NULL,
  to_status     VARCHAR(50) NOT NULL,
  changed_by    INT UNSIGNED NOT NULL,
  notes         TEXT DEFAULT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_csh_complaint (complaint_id),
  CONSTRAINT fk_csh_complaint FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE,
  CONSTRAINT fk_csh_user      FOREIGN KEY (changed_by)   REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 7. USER_WARNINGS (Progressive warning policy for substantiated malicious complaints)
CREATE TABLE IF NOT EXISTS user_warnings (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id           INT UNSIGNED NOT NULL,
  complaint_id      INT UNSIGNED DEFAULT NULL,
  warning_level     INT UNSIGNED NOT NULL DEFAULT 1,
  deduction_applied INT UNSIGNED NOT NULL DEFAULT 0,
  reason            TEXT NOT NULL,
  issued_by         INT UNSIGNED NOT NULL,
  status            ENUM('active', 'appealed', 'reversed') NOT NULL DEFAULT 'active',
  reversal_reason   TEXT DEFAULT NULL,
  reversed_by       INT UNSIGNED DEFAULT NULL,
  reversed_at       DATETIME DEFAULT NULL,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_uw_user (user_id),
  CONSTRAINT fk_uw_user        FOREIGN KEY (user_id)     REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_uw_complaint   FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE SET NULL,
  CONSTRAINT fk_uw_issued_by   FOREIGN KEY (issued_by)   REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_uw_reversed_by FOREIGN KEY (reversed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 8. WELFARE_AUDIT_LOGS (Consequential action audit log)
CREATE TABLE IF NOT EXISTS welfare_audit_logs (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  admin_id      INT UNSIGNED NOT NULL,
  action_type   VARCHAR(100) NOT NULL,
  target_type   VARCHAR(50) NOT NULL,
  target_id     INT UNSIGNED DEFAULT NULL,
  details       JSON DEFAULT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_wal_admin (admin_id),
  CONSTRAINT fk_wal_admin FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
