const { body, validationResult } = require('express-validator');

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(e => ({ field: e.path, message: e.msg }))
    });
  }
  next();
};

const registerValidators = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }).withMessage('Name cannot exceed 100 characters'),
  body('email')
    .trim()
    .isEmail()
    .withMessage('Valid email address is required (e.g. name@cb.students.amrita.edu, name@cb.amrita.edu, or user@campus.edu)')
    .normalizeEmail({ gmail_remove_dots: false, all_lowercase: true }),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
  body('role').isIn(['student', 'faculty']).withMessage('Role must be either student or faculty')
];

const loginValidators = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required')
];

const taskValidators = [
  body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 200 }),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('task_type').optional().isIn(['task', 'volunteer']).withMessage('Type must be task or volunteer'),
  body('credit_reward').optional().isInt({ min: 0 }).withMessage('Credit reward must be a non-negative integer'),
  body('capacity').optional().isInt({ min: 1 }).withMessage('Capacity must be at least 1')
];

const helpRequestValidators = [
  body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 200 }),
  body('description').trim().notEmpty().withMessage('Description is required')
];

module.exports = {
  handleValidation,
  registerValidators,
  loginValidators,
  taskValidators,
  helpRequestValidators
};
