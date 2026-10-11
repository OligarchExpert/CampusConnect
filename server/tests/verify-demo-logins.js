require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const accounts = [
  { name: 'Radhakrishna', email: 'radhakrishna@cb.students.amrita.edu', role: 'student', expectedRoute: '/dashboard' },
  { name: 'Anu', email: 'anu.demo@cb.students.amrita.edu', role: 'student', expectedRoute: '/dashboard' },
  { name: 'Rahul', email: 'rahul.demo@cb.students.amrita.edu', role: 'student', expectedRoute: '/dashboard' },
  { name: 'Priya', email: 'priya.demo@cb.students.amrita.edu', role: 'student', expectedRoute: '/dashboard' },
  { name: 'Arjun', email: 'arjun.demo@cb.students.amrita.edu', role: 'student', expectedRoute: '/dashboard' },
  { name: 'Dr. Meera Nair', email: 'meera.nair@cb.amrita.edu', role: 'faculty', expectedRoute: '/faculty' },
  { name: 'Dr. Arun Kumar', email: 'arun.kumar@cb.amrita.edu', role: 'faculty', expectedRoute: '/faculty' },
  { name: 'Prof. Lakshmi Menon', email: 'lakshmi.menon@cb.amrita.edu', role: 'faculty', expectedRoute: '/faculty' },
  { name: 'Prof. Suresh Iyer', email: 'suresh.iyer@cb.amrita.edu', role: 'faculty', expectedRoute: '/faculty' },
  { name: 'Dr. Kavitha Rao', email: 'kavitha.rao@cb.amrita.edu', role: 'faculty', expectedRoute: '/faculty' },
  { name: 'Student Welfare', email: 'admin.demo@cb.amrita.edu', role: 'admin', expectedRoute: '/admin' }
];

async function verifyDemoLogins() {
  console.log('Testing authentication & interface routing for all 11 Amrita demo profiles...\n');
  let passCount = 0;

  for (const acc of accounts) {
    // 1. Authenticate via POST /api/auth/login
    const res = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: acc.email, password: 'Demo1234!' })
    });
    const data = await res.json();
    if (res.status !== 200 || !data.token) {
      console.error('FAILED login for:', acc.name, data);
      process.exit(1);
    }

    // 2. Verify token via GET /api/auth/me
    const meRes = await fetch('http://localhost:5000/api/auth/me', {
      headers: { Authorization: 'Bearer ' + data.token }
    });
    const meData = await meRes.json();
    if (!meData.success || meData.user.role !== acc.role) {
      console.error('Role mismatch for:', acc.name, meData);
      process.exit(2);
    }

    // 3. Confirm target interface route in React frontend
    const targetRoute = data.user.role === 'admin' ? '/admin' : data.user.role === 'faculty' ? '/faculty' : '/dashboard';
    if (targetRoute !== acc.expectedRoute) {
      console.error('Route mismatch for:', acc.name, targetRoute, acc.expectedRoute);
      process.exit(3);
    }

    console.log(`  ✓ [${acc.role.toUpperCase()}] ${acc.name.padEnd(24)} | ${acc.email.padEnd(36)} -> Interface: ${targetRoute}`);
    passCount++;
  }

  console.log(`\nSuccessfully verified all ${passCount}/11 accounts against the live authentication system!`);
  return passCount;
}

if (require.main === module) {
  verifyDemoLogins().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { verifyDemoLogins };
