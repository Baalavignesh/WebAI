// WebRTC Application with Signaling Server(Socket.io) + Node.js + Express
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { client } from './src/services/redis.js';
import meeting from "./src/routes/meeting_room.js";
import { handleJoinMeeting, handleOffer, handleAnswer, handleIceCandidate } from './src/controllers/signaling_controller.js';

const app = express();
const port = process.env.PORT || 3000;

// Create HTTP server
const httpServer = createServer(app);

// Initialize Socket.IO with the HTTP server
const io = new Server(httpServer, {
  cors: {
    origin: "*", // Be careful with this in production
    methods: ["GET", "POST"]
  }
});

// Enable CORS for all routes
app.use(cors({
  origin: '*', // Be careful with this in production
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Initialize Express app and enable JSON parsing middleware
app.use(express.json());

app.get('/', (req, res) => res.send('Hello World'));
app.use("/api/meeting", meeting)


io.on("connection", (socket) => {
    console.log("🟢 User connected:", socket.id);
    console.log("Active connections:", io.engine.clientsCount);

    socket.on("join-meeting", (meetingID) => {
        console.log(`User ${socket.id} joining meeting: ${meetingID}`);
        socket.join(meetingID);
        console.log(`Rooms for this socket:`, socket.rooms);
    });

    socket.on("disconnect", (reason) => {
        console.log("🔴 User disconnected:", socket.id, "Reason:", reason);
    });

    socket.on("error", (error) => {
        console.error("Socket error:", error);
    });

    socket.on("send-offer", ({ meetingID, offer }) => {
        console.log(`📤 Forwarding offer for meeting ${meetingID}`);
        socket.to(meetingID).emit("receive-offer", { offer });
    });

    socket.on("send-answer", ({ meetingID, answer }) => {
        console.log(`📤 Forwarding answer for meeting ${meetingID}`);
        socket.to(meetingID).emit("receive-answer", { answer });
    }); 

    socket.on("send-ice-candidate", ({ meetingID, candidate }) => {
        console.log(`ICE Candidate received for meeting ${meetingID}`);
        socket.to(meetingID).emit("receive-ice-candidate", { candidate });
    });
 
});


// Modified server startup
const startServer = async () => {
  try {
    await client.connect();
    console.log('Successfully connected to Redis Cloud');
    
    httpServer.listen(port, () => {
      console.log(`Server is running on port ${port}`);
      console.log(`Socket.IO is listening for connections`);
    }).on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`Port ${port} is busy, trying ${port + 1}`);
        httpServer.listen(port + 1);
      } else {
        console.error('Server error:', err);
      }
    });
  } catch (error) {
    console.error('Failed to start server:', error);
  }
};

startServer();