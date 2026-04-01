const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyToken } = require('../middleware/auth');

// Show forms
router.get('/register', authController.showRegister);
router.get('/login', authController.showLogin);

// Authentication actions
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/logout', authController.logout);

// Protected routes - Profile
router.get('/profile', verifyToken, authController.getProfile);
router.post('/profile', verifyToken, authController.updateProfile);
router.post('/profile/update', verifyToken, authController.updateFullProfile);
router.post('/profile/avatar', verifyToken, authController.handleAvatarUpload);
router.post('/change-password', verifyToken, authController.changePassword);

// Address management
router.post('/address', verifyToken, authController.createAddress);
router.put('/address/:id', verifyToken, authController.updateAddress);
router.delete('/address/:id', verifyToken, authController.deleteAddress);

// Email verification
router.get('/verify-email', verifyToken, authController.showVerifyEmail);
router.post('/send-verification', verifyToken, authController.sendVerificationCode);
router.post('/verify-email', verifyToken, authController.verifyEmailCode);

// Forgot password (public routes - no login required)
router.get('/forgot-password', authController.showForgotPassword);
router.post('/forgot-password/send-code', authController.sendResetCode);
router.post('/forgot-password/verify-code', authController.verifyResetCode);
router.post('/forgot-password/reset', authController.resetPassword);

module.exports = router;
