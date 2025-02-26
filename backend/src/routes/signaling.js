import express from 'express';
import { CreateOffer, CreateAnswer } from "../src/controllers/signaling_controller.js";

const router = express.Router();

router.post("/createoffer", CreateOffer);
router.post("/createanswer", CreateAnswer);

export default router;