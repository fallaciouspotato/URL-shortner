const express = require('express');
const router = express.Router();
const { shortenUrl, redirectToLongUrl, getStats } = require('../controllers/url.controller');

router.post('/shorten', shortenUrl);
router.get('/:shortCode/stats', getStats);
router.get('/:shortCode', redirectToLongUrl);

module.exports = router;