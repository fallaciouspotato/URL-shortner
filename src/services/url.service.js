const prisma = require('../config/db');
const { generateShortCode } = require('../utils/codeGenerator');

const MAX_RETRIES = 5;
const PRISMA_UNQIUE_CONSTRAINT_ERROR = 'P2002';

    async function createShortUrl(longUrl){
        for(let attempt = 0; attempt < MAX_RETRIES; attempt++){
            const shortCode = generateShortCode();
            try{
                const url = await prisma.url.create({
                    data: { shortCode , longUrl },
                });
                return url;
            } catch (err){
                if(err.code === PRISMA_UNQIUE_CONSTRAINT_ERROR){
                    continue;
                }
                throw err;
            }
        }
        throw new Error('Could not generate a unique short code, please try again');
    }

async function getUrlByCode(shortCode){
    return prisma.url.findUnique({where: { shortCode } });
}

async function incrementClicks(shortCode){
    return prisma.url.update({
        where: { shortCode },
        data: { clicks: { increment: 1 } },
    });
}


module.exports = { createShortUrl, getUrlByCode, incrementClicks };