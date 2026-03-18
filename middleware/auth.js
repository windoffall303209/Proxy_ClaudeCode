const jwt = require('jsonwebtoken');
require('dotenv').config();

// Verify JWT token middleware
const verifyToken = async (req, res, next) => {
    try {
        // Get token from cookie or Authorization header
        let token = req.cookies?.token;

        if (!token) {
            const authHeader = req.headers['authorization'];
            if (authHeader && authHeader.startsWith('Bearer ')) {
                token = authHeader.substring(7);
            }
        }

        if (!token) {
            // Redirect to login for HTML requests
            if (req.accepts('html')) {
                return res.redirect('/auth/login');
            }
            return res.status(401).json({ message: 'Access denied. No token provided.' });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        // Clear invalid token cookie
        res.clearCookie('token');

        // Redirect to login for HTML requests
        if (req.accepts('html')) {
            return res.redirect('/auth/login');
        }

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Token expired' });
        }
        return res.status(401).json({ message: 'Invalid token' });
    }
};

// Check if user is admin
const isAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ message: 'Access denied. Admin only.' });
    }
};

// Optional authentication (for features like guest cart)
const optionalAuth = async (req, res, next) => {
    try {
        let token = req.cookies?.token;
        
        if (!token) {
            const authHeader = req.headers['authorization'];
            if (authHeader && authHeader.startsWith('Bearer ')) {
                token = authHeader.substring(7);
            }
        }

        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = decoded;
        }
    } catch (error) {
        // Token is invalid or expired, but we allow guest access
        req.user = null;
    }
    next();
};

// Generate JWT token
const generateToken = (user) => {
    return jwt.sign(
        {
            id: user.id,
            email: user.email,
            role: user.role || 'customer'
        },
        process.env.JWT_SECRET,
        {
            expiresIn: process.env.JWT_EXPIRE || '1h'
        }
    );
};

module.exports = {
    verifyToken,
    isAdmin,
    optionalAuth,
    generateToken
};
