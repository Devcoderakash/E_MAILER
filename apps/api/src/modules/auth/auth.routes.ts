import { Router } from "express";
import { AuthController } from "./auth.controller";
import { requireAuth } from "../../middleware/auth.middleware";

const router = Router();

// All auth module routes require a valid Supabase JWT Bearer token
router.use(requireAuth);

router.get("/me", AuthController.getMe);
router.patch("/profile", AuthController.updateProfile);

export const authRouter: Router = router;
