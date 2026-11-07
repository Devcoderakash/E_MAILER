import { Router } from "express";
import { ContactController } from "./contact.controller";
import { requireAuth } from "../../middleware/auth.middleware";

// ==========================================
// Contacts Router: /api/contacts
// ==========================================
const contactRouter: Router = Router();
contactRouter.use(requireAuth);

// Static routes first (to prevent :id match)
contactRouter.get("/stats", ContactController.stats);
contactRouter.post("/bulk-delete", ContactController.bulkDelete);
contactRouter.post("/import", ContactController.importCsv);
contactRouter.get("/import-jobs", ContactController.listImportJobs);

// Root contact routes
contactRouter.get("/", ContactController.list);
contactRouter.post("/", ContactController.create);

// Parameterized contact routes
contactRouter.get("/:id", ContactController.getById);
contactRouter.patch("/:id", ContactController.update);
contactRouter.delete("/:id", ContactController.delete);

// Contact Tag assignment routes
contactRouter.post("/:id/tags/:tagId", ContactController.assignTag);
contactRouter.delete("/:id/tags/:tagId", ContactController.removeTag);

// ==========================================
// Contact Lists Router: /api/contact-lists
// ==========================================
const contactListRouter: Router = Router();
contactListRouter.use(requireAuth);

contactListRouter.get("/", ContactController.listLists);
contactListRouter.post("/", ContactController.createList);
contactListRouter.patch("/:id", ContactController.updateList);
contactListRouter.delete("/:id", ContactController.deleteList);
contactListRouter.post("/:id/members", ContactController.addMembers);
contactListRouter.delete("/:id/members/:contactId", ContactController.removeMember);

// ==========================================
// Contact Tags Router: /api/contact-tags
// ==========================================
const contactTagRouter: Router = Router();
contactTagRouter.use(requireAuth);

contactTagRouter.get("/", ContactController.listTags);
contactTagRouter.post("/", ContactController.createTag);
contactTagRouter.patch("/:id", ContactController.updateTag);
contactTagRouter.delete("/:id", ContactController.deleteTag);

export { contactRouter, contactListRouter, contactTagRouter };
