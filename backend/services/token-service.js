const jwt = require('jsonwebtoken');
const refreshModel = require('../models/refresh-model');
const accessTokenSecret = process.env.JWT_ACCESS_TOKEN_SECRET;
const refreshTokenSecret = process.env.JWT_REFRESH_TOKEN_SECRET;
class tokenService {
    generateTokens(payload) {
        const accessToken = jwt.sign(payload, accessTokenSecret, {
            expiresIn: '1m'
        });
        const refreshToken = jwt.sign(payload, refreshTokenSecret, {
            expiresIn: '1y'
        });

        return { accessToken, refreshToken }
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

    verifyAccessToken(accessToken) {
        return jwt.verify(accessToken, accessTokenSecret);
    }


    async verifyRefreshToken(refreshToken) {
        return jwt.verify(refreshToken, refreshTokenSecret);
    }

    async findRefreshToken(userId, refreshToken) {
        console.log("userId is ", userId);
        console.log("refreshToken is ", refreshToken);
        try {
            const ans = await refreshModel.findOne({ userId: userId, token: refreshToken });
            console.log("Found refresh token:", ans);
            return ans;
        } catch (err) {
            console.error("Error while finding refresh token:", err);
            throw err;
        }
    }

    async updateRefreshToken(userId, refreshToken) {
        return await refreshModel.updateOne(
            {
                userId: userId,
                token: refreshToken
            }
        );
    }

    async removeToken(refreshToken) {
        return await refreshModel.deleteOne({ token: refreshToken });
    }
};

module.exports = new tokenService();