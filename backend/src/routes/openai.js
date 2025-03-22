import express from 'express';
import { CreateEphermeralToken } from '../controllers/openai_controller.js';

const router = express.Router();

router.get("/session", CreateEphermeralToken);

export default router;  