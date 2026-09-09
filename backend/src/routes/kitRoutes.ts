import { Router } from "express";

import {
  createKit,
  getMyKits,
  getKitById,
  updateKit,
  deleteKit,
  startKitGeneration,
  regenerateKitSection,
  getPracticeProgress,
  updateFlashcardPractice,
} from "../controllers/KitController.js";

import { protect } from "../middleware/authMiddleware.js";

const router = Router();

// Get all kits
router.get("/", protect, getMyKits);

// Get single kit
router.get("/:id", protect, getKitById);

// Create kit
router.post("/", protect, createKit);

// Update kit
router.put("/:id", protect, updateKit);

// Delete kit
router.delete("/:id", protect, deleteKit);

// Start AI generation
router.post("/:id/generate", protect, startKitGeneration);

// Regenerate a specific section
router.post("/:id/regenerate", protect, regenerateKitSection);

// Practice progress
router.get("/:id/practice", protect, getPracticeProgress);

// Update flashcard practice
router.patch(
  "/:id/practice/flashcard/:flashcardId",
  protect,
  updateFlashcardPractice,
);

export default router;
