import { Router } from "express";
import {
  createKit,
  getMyKits,
  getKitById,
  updateKit,
  deleteKit,
  startKitGeneration,
  regenerateKitSection,
} from "../controllers/KitController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = Router();

router.get("/", protect, getMyKits);
router.get("/:id", protect, getKitById);
router.post("/", protect, createKit);
router.put("/:id", protect, updateKit);
router.delete("/:id", protect, deleteKit);
router.post("/:id/generate", protect, startKitGeneration);
router.post("/:id/regenerate", protect, regenerateKitSection);

export default router;
