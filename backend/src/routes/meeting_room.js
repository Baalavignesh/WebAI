import express from 'express';
import { CreateMeetingRoom, CheckMeetingRoom } from "../controllers/meeting_controller.js";

const router = express.Router();

router.post("/createmeetingroom", CreateMeetingRoom);
router.get("/checkmeetingroom/:meetingId", CheckMeetingRoom);

export default router;