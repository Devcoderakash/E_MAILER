import { Router } from "express";
import { WorkspaceController } from "./workspace.controller";
import { requireAuth } from "../../middleware/auth.middleware";

const router = Router();

// All workspace routes require a valid Supabase JWT Bearer token
router.use(requireAuth);

router.get("/", WorkspaceController.list);
router.post("/", WorkspaceController.create);
router.patch("/:id", WorkspaceController.update);
router.post("/:id/switch", WorkspaceController.switch);

export const workspaceRouter: Router = router;

