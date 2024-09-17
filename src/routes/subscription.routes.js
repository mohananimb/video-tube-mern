import { Router } from "express";
import { subscribeChannel, unsubscribeChannel } from "../controllers/subscription.controller.js";
import { verifyJwt } from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/subscribe/:subscribeTo").post(verifyJwt, subscribeChannel);
router.route("/unsubscribe/:unsubscribeTo").post(verifyJwt, unsubscribeChannel);


export default router;
