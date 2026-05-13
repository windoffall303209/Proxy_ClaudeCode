// Script to create/update admin user with correct password
const bcrypt = require('bcryptjs');
const pool = require('../config/database');
require('dotenv').config();

// Cập nhật quản trị mật khẩu.
async function updateAdminPassword() {
    try {
        console.log('✅ Connected to database');

        // Hash password
        const password = 'admin123';
        const passwordHash = await bcrypt.hash(password, 10);
        
        console.log('Password hash:', passwordHash);

        // Update or insert admin user
        await pool.execute(`
            INSERT INTO users (email, password_hash, full_name, phone, role, email_verified)
            VALUES ('admin@fashionstore.vn', ?, 'Admin', '0123456789', 'admin', TRUE)
            ON CONFLICT (email) DO UPDATE SET
                password_hash = EXCLUDED.password_hash,
                role = 'admin',
                email_verified = TRUE
        `, [passwordHash]);

        console.log('✅ Admin password updated successfully!');
        console.log('Email: admin@fashionstore.vn');
        console.log('Password: admin123');

        // Verify
        const [rows] = await pool.execute(
            'SELECT email, role, email_verified FROM users WHERE email = ?',
            ['admin@fashionstore.vn']
        );
        
        console.log('\nAdmin user:', rows[0]);

        await pool.end();
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

updateAdminPassword();
