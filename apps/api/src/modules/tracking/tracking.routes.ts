import { Router } from "express";
import { TrackingController } from "./tracking.controller";

export const trackingRouter: Router = Router();

// Public tracking routes (No authentication required)
trackingRouter.get("/open/:recipientId", TrackingController.handleOpen);
trackingRouter.get("/click/:recipientId", TrackingController.handleClick);
