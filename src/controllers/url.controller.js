const urlService = require('../service/url.service');

async function shortenUrl(req, res, next){
    try{
        const { longUrl } = req.body;

        if(!longUrl || typeof longUrl !== 'string'){
            return res.status(400).json({ error: 'longUrl is required' });
        }

        const url = await urlService.createShortUrl(longUrl);
        const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;

        res.status(201).json({
            shortUrl: `${baseUrl}/${url.shortCode}`,
            shortCode: url.shortCode,
            longUrl: url.longUrl,
        });
    } catch(err){
        next(err);
    }
}

async function redirectToLongUrl(req, res, next) {
    try {
        const { shortCode } = req.params;
        const url = await urlService.getUrlByCode(shortCode);

        if(!url){
            return res.status(404).json({error: 'Short Url not found' });
        }
        await urlService.incrementClicks(shortCode);
        res.redirect(302, url.longUrl);
    } catch(err){
        next(err);
    }
}

async function getStats(req, res, next){
    try{
        const { shortCode } = req.params;
        const url = await urlService.getUrlByCode(shortCode);

        if(!url) {
            return res.status(404).json({error: 'Short URL not found'});
        }

        res.json({
            shortCode: url.shortCode,
            longUrl: url.longUrl,
            clicks: url.clicks,
            createdAt: url.createdAt,
        });
    } catch(err){
        next(err);
    }
}

module.exports = { shortenUrl, redirectToLongUrl, getStats };