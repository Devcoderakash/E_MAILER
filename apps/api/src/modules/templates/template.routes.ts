import { Router } from "express";
import { TemplateController } from "./template.controller";
import { requireAuth } from "../../middleware/auth.middleware";

const templateRouter: Router = Router();
templateRouter.use(requireAuth);

// Template CRUD routes
templateRouter.get("/", TemplateController.list);
templateRouter.post("/", TemplateController.create);
templateRouter.get("/:id", TemplateController.getById);
templateRouter.patch("/:id", TemplateController.update);
templateRouter.delete("/:id", TemplateController.delete);

// Duplicate route
templateRouter.post("/:id/duplicate", TemplateController.duplicate);

export { templateRouter };
