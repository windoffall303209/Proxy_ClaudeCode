/**
 * Script reset tài khoản Admin
 * Chạy: node scripts/reset-admin.js
 */

const bcrypt = require('bcryptjs');
const pool = require('../config/database');

async function resetAdmin() {
    try {
        const email = 'admin@fashionstore.vn';
        const password = 'admin123';

        // Generate bcrypt hash
        const password_hash = await bcrypt.hash(password, 10);

        console.log('Generated hash:', password_hash);

        // Delete existing admin
        await pool.execute('DELETE FROM users WHERE email = ?', [email]);

        // Create new admin
        await pool.execute(
            `INSERT INTO users (email, password_hash, full_name, phone, role, email_verified, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [email, password_hash, 'Admin', '0123456789', 'admin', true, true]
        );

        console.log('');
        console.log('=================================');
        console.log('Admin account reset successfully!');
        console.log('=================================');
        console.log('Email:', email);
        console.log('Password:', password);
        console.log('=================================');

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

resetAdmin();
