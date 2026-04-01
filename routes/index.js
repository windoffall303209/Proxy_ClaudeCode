const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { optionalAuth } = require('../middleware/auth');

// Import route modules
const authRoutes = require('./authRoutes');
const productRoutes = require('./productRoutes');
const cartRoutes = require('./cartRoutes');
const orderRoutes = require('./orderRoutes');
const adminRoutes = require('./adminRoutes');
const newsletterRoutes = require('./newsletterRoutes');
const chatRoutes = require('./chatRoutes');

// Homepage
router.get('/', optionalAuth, productController.getHomePage);

// Proxy for reverse geocoding (to bypass CSP)
router.get('/api/geocode/reverse', async (req, res) => {
    try {
        const { lat, lon } = req.query;
        if (!lat || !lon) {
            return res.status(400).json({ error: 'Missing lat/lon' });
        }
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1&accept-language=vi`,
            { headers: { 'User-Agent': 'TMDT-Shop/1.0' } }
        );
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Geocode error:', error);
        res.status(500).json({ error: 'Geocoding failed' });
    }
});

// API lấy danh sách tỉnh/thành phố Việt Nam
router.get('/api/provinces', async (req, res) => {
    try {
        const response = await fetch('https://provinces.open-api.vn/api/p/');
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Provinces API error:', error);
        res.status(500).json({ error: 'Failed to fetch provinces' });
    }
});

// API lấy danh sách quận/huyện theo tỉnh
router.get('/api/provinces/:code/districts', async (req, res) => {
    try {
        const { code } = req.params;
        const requestedDepth = Number.parseInt(req.query.depth, 10);
        const depth = requestedDepth === 3 ? 3 : 2;
        const response = await fetch(`https://provinces.open-api.vn/api/p/${code}?depth=${depth}`);
        const data = await response.json();
        res.json(data.districts || []);
    } catch (error) {
        console.error('Districts API error:', error);
        res.status(500).json({ error: 'Failed to fetch districts' });
    }
});

// API lấy danh sách xã/phường theo quận/huyện
router.get('/api/districts/:code/wards', async (req, res) => {
    try {
        const { code } = req.params;
        const response = await fetch(`https://provinces.open-api.vn/api/d/${code}?depth=2`);
        const data = await response.json();
        res.json(data.wards || []);
    } catch (error) {
        console.error('Wards API error:', error);
        res.status(500).json({ error: 'Failed to fetch wards' });
    }
});

// Mount route modules
router.use('/auth', authRoutes);
router.use('/products', productRoutes);
router.use('/cart', cartRoutes);
router.use('/orders', orderRoutes);
router.use('/admin', adminRoutes);
router.use('/newsletter', newsletterRoutes);
router.use('/chat', chatRoutes);

module.exports = router;
