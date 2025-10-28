const jwt = require('jsonwebtoken');
const refreshModel = require('../models/refresh-model');
const accessTokenSecret = process.env.JWT_ACCESS_TOKEN_SECRET;
const refreshTokenSecret = process.env.JWT_REFRESH_TOKEN_SECRET;

class tokenService {
    generateTokens(payload) {  
        const accessToken =  jwt.sign(payload , accessTokenSecret, {
            expiresIn: '1h'
        });
        const refreshToken =  jwt.sign(payload , refreshTokenSecret, {
            expiresIn: '1h'
        });

        return {accessToken, refreshToken}
    }

    async storeRefreshToken(token, userId) {
        try {
            await refreshModel.create({
                token,
                userId,
            });
        } catch (err) {
            console.log(err.message);
        }
    }

    verifyAccessToken(token) {
        return jwt.verify(token, accessTokenSecret);
    }
};

module.exports = new tokenService();