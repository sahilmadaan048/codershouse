const UserModel = require('../models/user-model');

class userService {
    async findUser(filter) {
        const user = await UserModel.findOne(filter);
        return user;
    }
    
    async createUser(data) {
        const user = await UserModel.create(data);
        console.log("user saved in the database");
        return user;
    }
};

module.exports = new userService();
