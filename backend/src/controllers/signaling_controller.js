import { redisGetMeetingRoom } from "../services/redis.js";

// Create Offer
const CreateOffer = async (req, res) => {
    const { meetingId } = req.body;
    const offer = await redisGetMeetingRoom(meetingId);
    res.json({ offer });
}

// Create Answer
const CreateAnswer = async (req, res) => {
    const { meetingId } = req.body;
    const answer = await redisGetMeetingRoom(meetingId);
    res.json({ answer });
}

const handleJoinMeeting = async (socket, meetingId) => {
    try {
        const meetingRoom = await redisGetMeetingRoom(meetingId);
        if (!meetingRoom) {
            socket.emit('meeting-error', { message: 'Meeting not found' });
            return;
        }

        // Join the socket room
        socket.join(meetingId);
        console.log(`👋 User ${socket.id} joined meeting ${meetingId}`);
        
        // Notify others in the room
        socket.to(meetingId).emit('user-joined', { userId: socket.id });
    } catch (error) {
        console.error('Error joining meeting:', error);
        socket.emit('meeting-error', { message: 'Failed to join meeting' });
    }
};

const handleOffer = (socket, { meetingId, offer }) => {
    console.log(`📤 Sending offer in meeting ${meetingId} from ${socket.id}`);
    socket.to(meetingId).emit('receive-offer', { offer, from: socket.id });
};

const handleAnswer = (socket, { meetingId, answer }) => {
    console.log(`📤 Sending answer in meeting ${meetingId} from ${socket.id}`);
    socket.to(meetingId).emit('receive-answer', { answer, from: socket.id });
};

const handleIceCandidate = (socket, { meetingId, candidate }) => {
    console.log(`📤 Sending ICE candidate in meeting ${meetingId}`);
    socket.to(meetingId).emit('ice-candidate', { candidate, from: socket.id });
};

export { CreateOffer, CreateAnswer, handleJoinMeeting, handleOffer, handleAnswer, handleIceCandidate };