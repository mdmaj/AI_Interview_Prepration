import { Router } from "express";
import {
  createKit,
  getMyKits,
  getKitById,
  updateKit,
  deleteKit,
} from "../controllers/KitController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = Router();

router.get("/", protect, getMyKits);
router.get("/:id", protect, getKitById);
router.post("/", protect, createKit);
router.put("/:id", protect, updateKit);
router.delete("/:id", protect, deleteKit);

export default router;
