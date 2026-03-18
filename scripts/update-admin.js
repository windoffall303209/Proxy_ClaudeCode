// Script to create/update admin user with correct password
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function updateAdminPassword() {
    try {
        // Create database connection
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        });

        console.log('✅ Connected to database');

        // Hash password
        const password = 'admin123';
        const passwordHash = await bcrypt.hash(password, 10);
        
        console.log('Password hash:', passwordHash);

        // Update or insert admin user
        await connection.execute(`
            INSERT INTO users (email, password_hash, full_name, phone, role, email_verified)
            VALUES ('admin@fashionstore.vn', ?, 'Admin', '0123456789', 'admin', TRUE)
            ON DUPLICATE KEY UPDATE 
                password_hash = ?,
                role = 'admin',
                email_verified = TRUE
        `, [passwordHash, passwordHash]);

        console.log('✅ Admin password updated successfully!');
        console.log('Email: admin@fashionstore.vn');
        console.log('Password: admin123');

        // Verify
        const [rows] = await connection.execute(
            'SELECT email, role, email_verified FROM users WHERE email = ?',
            ['admin@fashionstore.vn']
        );
        
        console.log('\nAdmin user:', rows[0]);

        await connection.end();
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

updateAdminPassword();
