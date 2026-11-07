import { Router } from "express";
import { ScheduleController } from "./schedule.controller";
import { requireAuth } from "../../middleware/auth.middleware";

const scheduleRouter: Router = Router();
scheduleRouter.use(requireAuth);

// Schedule listings & calendar
scheduleRouter.get("/", ScheduleController.list);
scheduleRouter.get("/calendar", ScheduleController.calendar);
scheduleRouter.get("/:id", ScheduleController.getById);

// Operations on schedules
scheduleRouter.post("/:id/schedule", ScheduleController.schedule);
scheduleRouter.patch("/:id/reschedule", ScheduleController.reschedule);
scheduleRouter.post("/:id/reschedule", ScheduleController.reschedule);
scheduleRouter.post("/:id/unschedule", ScheduleController.unschedule);

export { scheduleRouter };

