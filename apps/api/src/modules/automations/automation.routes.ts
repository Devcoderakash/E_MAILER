import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { AutomationController } from "./automation.controller";

export const automationRouter: Router = Router();

// Protect all automation endpoints
automationRouter.use(requireAuth);

automationRouter.get("/", AutomationController.list);
automationRouter.post("/", AutomationController.create);
automationRouter.get("/:id", AutomationController.getById);
automationRouter.patch("/:id", AutomationController.update);
automationRouter.delete("/:id", AutomationController.delete);

automationRouter.post("/:id/validate", AutomationController.validate);
automationRouter.post("/:id/activate", AutomationController.activate);
automationRouter.post("/:id/pause", AutomationController.pause);

automationRouter.get("/:id/executions", AutomationController.getExecutions);
automationRouter.get("/:id/executions/:executionId", AutomationController.getExecutionDetail);
