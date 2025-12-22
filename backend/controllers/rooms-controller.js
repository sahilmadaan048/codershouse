
const RoomDto = require('../dtos/room-dto');
const roomService = require('../services/room-service');

class RoomsController {
    async create(req, res) {
        if (!req.user) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const { topic, roomType } = req.body;

        if (!topic || !roomType) {
            return res.status(400).json({ message: 'All fields are required!' });
        }

        // console.log("user id is: ", req.user.id);
        // console.log("user is: ", req.user);

        const room = await roomService.create({
            topic,
            roomType,
            ownerId: req.user.id,
        });

        console.log("room created: ", room);

        return res.json(new RoomDto(room));
    }

    async index(req, res) {
        const rooms = await roomService.getAllRooms(['open']);
        const allRooms = rooms.map((room) => new RoomDto(room));
        return res.json(allRooms);
    }

    async show(req, res) {
        const room = await roomService.getRoom(req.params.roomId);
        return res.json(room);
    }
}

module.exports = new RoomsController();
