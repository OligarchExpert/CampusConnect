const pool = require('../config/db');

const listTasks = async (req, res) => {
  try {
    const { type, status = 'open' } = req.query;
    let query = `
      SELECT t.*, u.name AS faculty_name, u.department
      FROM tasks t
      JOIN users u ON u.id = t.faculty_id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += ' AND t.status = ?';
      params.push(status);
    }
    if (type) {
      query += ' AND t.task_type = ?';
      params.push(type);
    }

    query += ' ORDER BY t.created_at DESC';

    const [tasks] = await pool.execute(query, params);
    res.json({ success: true, tasks });
  } catch (err) {
    console.error('[Task listTasks error]', err);
    res.status(500).json({ success: false, message: 'Failed to list tasks' });
  }
};

const createTask = async (req, res) => {
  const { title, description, task_type, required_skills, deadline, capacity, credit_reward } = req.body;

  try {
    const [result] = await pool.execute(
      `INSERT INTO tasks
         (faculty_id, title, description, task_type, required_skills, deadline, capacity, credit_reward, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open')`,
      [
        req.user.id,
        title,
        description,
        task_type || 'task',
        required_skills || null,
        deadline || null,
        parseInt(capacity, 10) || 1,
        parseInt(credit_reward, 10) || 0
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Task created successfully',
      taskId: result.insertId
    });
  } catch (err) {
    console.error('[Task createTask error]', err);
    res.status(500).json({ success: false, message: 'Failed to create task' });
  }
};

const getTask = async (req, res) => {
  const taskId = parseInt(req.params.id, 10);
  try {
    const [rows] = await pool.execute(
      `SELECT t.*, u.name AS faculty_name, u.department
       FROM tasks t
       JOIN users u ON u.id = t.faculty_id
       WHERE t.id = ?`,
      [taskId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    res.json({ success: true, task: rows[0] });
  } catch (err) {
    console.error('[Task getTask error]', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve task' });
  }
};

const updateTask = async (req, res) => {
  const taskId = parseInt(req.params.id, 10);
  const { title, description, required_skills, deadline, capacity, credit_reward, status } = req.body;

  try {
    const [rows] = await pool.execute('SELECT faculty_id FROM tasks WHERE id = ?', [taskId]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    // Faculty can only manage their own tasks unless admin
    if (rows[0].faculty_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'You can only edit your own tasks' });
    }

    await pool.execute(
      `UPDATE tasks
       SET title = COALESCE(?, title),
           description = COALESCE(?, description),
           required_skills = COALESCE(?, required_skills),
           deadline = COALESCE(?, deadline),
           capacity = COALESCE(?, capacity),
           credit_reward = COALESCE(?, credit_reward),
           status = COALESCE(?, status)
       WHERE id = ?`,
      [
        title || null,
        description || null,
        required_skills || null,
        deadline || null,
        capacity ? parseInt(capacity, 10) : null,
        credit_reward !== undefined ? parseInt(credit_reward, 10) : null,
        status || null,
        taskId
      ]
    );

    res.json({ success: true, message: 'Task updated successfully' });
  } catch (err) {
    console.error('[Task updateTask error]', err);
    res.status(500).json({ success: false, message: 'Failed to update task' });
  }
};

const applyToTask = async (req, res) => {
  const taskId = parseInt(req.params.id, 10);
  const studentId = req.user.id;

  try {
    const [tasks] = await pool.execute(
      'SELECT id, faculty_id, status FROM tasks WHERE id = ?',
      [taskId]
    );

    if (tasks.length === 0) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    if (tasks[0].status !== 'open') {
      return res.status(400).json({ success: false, message: 'This task is not open for applications' });
    }

    // Prevent faculty from applying to own tasks
    if (tasks[0].faculty_id === studentId) {
      return res.status(400).json({ success: false, message: 'Faculty cannot apply to their own task' });
    }

    // Check duplicate application
    const [existing] = await pool.execute(
      'SELECT id FROM applications WHERE task_id = ? AND student_id = ?',
      [taskId, studentId]
    );

    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'You have already applied to this task' });
    }

    await pool.execute(
      'INSERT INTO applications (task_id, student_id, note, status) VALUES (?, ?, ?, "pending")',
      [taskId, studentId, req.body.note || null]
    );

    res.status(201).json({ success: true, message: 'Application submitted successfully' });
  } catch (err) {
    console.error('[Task applyToTask error]', err);
    res.status(500).json({ success: false, message: 'Failed to apply to task' });
  }
};

const getApplications = async (req, res) => {
  const taskId = parseInt(req.params.id, 10);

  try {
    const [tasks] = await pool.execute('SELECT faculty_id FROM tasks WHERE id = ?', [taskId]);
    if (tasks.length === 0) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    if (tasks[0].faculty_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized to view applications' });
    }

    const [apps] = await pool.execute(
      `SELECT a.*, u.name, u.email, u.department
       FROM applications a
       JOIN users u ON u.id = a.student_id
       WHERE a.task_id = ?
       ORDER BY a.created_at DESC`,
      [taskId]
    );

    res.json({ success: true, applications: apps });
  } catch (err) {
    console.error('[Task getApplications error]', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve applications' });
  }
};

const updateApplication = async (req, res) => {
  const taskId = parseInt(req.params.id, 10);
  const appId = parseInt(req.params.appId, 10);
  const { status } = req.body;

  if (!['assigned', 'rejected'].includes(status)) {
    return res.status(422).json({ success: false, message: 'Status must be assigned or rejected' });
  }

  try {
    const [tasks] = await pool.execute('SELECT faculty_id FROM tasks WHERE id = ?', [taskId]);
    if (tasks.length === 0) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    if (tasks[0].faculty_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized to manage applications' });
    }

    await pool.execute(
      'UPDATE applications SET status = ? WHERE id = ? AND task_id = ?',
      [status, appId, taskId]
    );

    res.json({ success: true, message: `Application status updated to ${status}` });
  } catch (err) {
    console.error('[Task updateApplication error]', err);
    res.status(500).json({ success: false, message: 'Failed to update application' });
  }
};

const submitApplication = async (req, res) => {
  const taskId = parseInt(req.params.id, 10);
  const studentId = req.user.id;

  try {
    const [apps] = await pool.execute(
      'SELECT id FROM applications WHERE task_id = ? AND student_id = ? AND status = "assigned"',
      [taskId, studentId]
    );

    if (apps.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No active assigned application found for this task'
      });
    }

    await pool.execute(
      'UPDATE applications SET status = "submitted", submitted_at = NOW() WHERE id = ?',
      [apps[0].id]
    );

    res.json({ success: true, message: 'Task completion submitted for faculty review' });
  } catch (err) {
    console.error('[Task submitApplication error]', err);
    res.status(500).json({ success: false, message: 'Failed to submit task completion' });
  }
};

const approveApplication = async (req, res) => {
  const taskId = parseInt(req.params.id, 10);
  const appId = parseInt(req.params.appId, 10);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [tasks] = await conn.execute(
      'SELECT * FROM tasks WHERE id = ? FOR UPDATE',
      [taskId]
    );

    if (tasks.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    const task = tasks[0];

    // Only the owning faculty or admin can approve
    if (task.faculty_id !== req.user.id && req.user.role !== 'admin') {
      await conn.rollback();
      return res.status(403).json({ success: false, message: 'Unauthorized to approve applications for this task' });
    }

    const [apps] = await conn.execute(
      'SELECT * FROM applications WHERE id = ? AND task_id = ? AND status = "submitted" FOR UPDATE',
      [appId, taskId]
    );

    if (apps.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Submitted application not found' });
    }

    const app = apps[0];

    // Mark application as approved
    await conn.execute(
      'UPDATE applications SET status = "approved", approved_at = NOW() WHERE id = ?',
      [appId]
    );

    // Rule 7 & 8: Award credits strictly from saved task record (exempt from peer cap)
    const rewardAmount = parseInt(task.credit_reward, 10) || 0;

    if (rewardAmount > 0) {
      await conn.execute(
        `INSERT INTO credit_transactions
           (user_id, amount, type, source_id, source_type, description)
         VALUES (?, ?, 'task_reward', ?, 'task_application', ?)`,
        [app.student_id, rewardAmount, appId, `Task completion: ${task.title}`]
      );

      await conn.execute(
        'UPDATE applications SET status = "credited" WHERE id = ?',
        [appId]
      );
    }

    await conn.commit();
    res.json({
      success: true,
      message: 'Application approved successfully',
      creditsAwarded: rewardAmount
    });
  } catch (err) {
    await conn.rollback();
    console.error('[Task approveApplication error]', err);
    res.status(500).json({ success: false, message: 'Failed to approve application' });
  } finally {
    conn.release();
  }
};

const getMyTasks = async (req, res) => {
  try {
    const [tasks] = await pool.execute(
      'SELECT * FROM tasks WHERE faculty_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json({ success: true, tasks });
  } catch (err) {
    console.error('[Task getMyTasks error]', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve tasks' });
  }
};

const getMyApplications = async (req, res) => {
  try {
    const [apps] = await pool.execute(
      `SELECT a.*, t.title, t.task_type, t.credit_reward, u.name AS faculty_name
       FROM applications a
       JOIN tasks t ON t.id = a.task_id
       JOIN users u ON u.id = t.faculty_id
       WHERE a.student_id = ?
       ORDER BY a.created_at DESC`,
      [req.user.id]
    );
    res.json({ success: true, applications: apps });
  } catch (err) {
    console.error('[Task getMyApplications error]', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve applications' });
  }
};

module.exports = {
  listTasks,
  createTask,
  getTask,
  updateTask,
  applyToTask,
  getApplications,
  updateApplication,
  submitApplication,
  approveApplication,
  getMyTasks,
  getMyApplications
};
