import { Response } from "express";
import InterviewKit from "../models/InterviewKit.js";
import { AuthRequest } from "../middleware/authMiddleware.js";
import { generateInterviewKit } from "../services/pipeline/generateInterviewKit.js";

export const createKit = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const {
      company,
      company_url,
      role,
      location = "",
      jd,
      days_available,
    } = req.body;

    if (!company || !company_url || !role || !jd || !days_available) {
      res.status(400).json({
        success: false,
        message:
          "company, company_url, role, jd and days_available are required",
      });
      return;
    }

    if (days_available < 1 || days_available > 60) {
      res.status(400).json({
        success: false,
        message: "days_available must be between 1 and 60",
      });
      return;
    }

    const kit = await InterviewKit.create({
      user_id: req.userId,

      source: {
        company,
        company_url,
        role,
        location,
        jd,
        jd_chars: jd.length,
        researched_at: new Date().toISOString(),
        pages_used: [],
      },

      company_brief: {
        summary: "",
        what_they_do: "",
        sources: [],
      },

      role: {
        title: role,
        seniority: "",
        responsibilities: [],
        requirements: [],
      },

      questions: [],

      flashcards: [],

      schedule: {
        days_available,
        days: [],
      },

      coverage: {
        uncovered_requirement_ids: [],
        passes: 0,
      },

      generation: {
        status: "pending",
        progress: 0,
        current_step: "Ready to generate",
        error: null,
      },
    });

    res.status(201).json({
      success: true,
      message: "Interview kit created successfully",
      kit,
    });
  } catch (error) {
    console.error("Create kit error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create interview kit",
    });
  }
};

export const getMyKits = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const kits = await InterviewKit.find({
      user_id: req.userId,
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: kits.length,
      kits,
    });
  } catch (error) {
    console.error("Get kits error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch interview kits",
    });
  }
};

export const getKitById = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const id = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;

    const kit = await InterviewKit.findOne({
      _id: id,
      user_id: req.userId,
    });

    if (!kit) {
      res.status(404).json({
        success: false,
        message: "Interview kit not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      kit,
    });
  } catch (error) {
    console.error("Get kit by ID error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch interview kit",
    });
  }
};

export const updateKit = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const id = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;

    const kit = await InterviewKit.findOne({
      _id: id,
      user_id: req.userId,
    });

    if (!kit) {
      res.status(404).json({
        success: false,
        message: "Interview kit not found",
      });
      return;
    }

    const {
      company_brief,
      role,
      questions,
      flashcards,
      schedule,
      coverage,
    } = req.body;

    if (company_brief !== undefined) {
      kit.company_brief = company_brief;
    }

    if (role !== undefined) {
      kit.role = role;
    }

    if (questions !== undefined) {
      kit.questions = questions;
    }

    if (flashcards !== undefined) {
      kit.flashcards = flashcards;
    }

    if (schedule !== undefined) {
      kit.schedule = schedule;
    }

    if (coverage !== undefined) {
      kit.coverage = coverage;
    }

    await kit.save();

    res.status(200).json({
      success: true,
      message: "Interview kit updated successfully",
      kit,
    });
  } catch (error) {
    console.error("Update kit error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update interview kit",
    });
  }
};

export const deleteKit = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const { id } = req.params;

    const kit = await InterviewKit.findOneAndDelete({
      _id: id,
      user_id: req.userId,
    });

    if (!kit) {
      res.status(404).json({
        success: false,
        message: "Interview kit not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Interview kit deleted successfully",
    });
  } catch (error) {
    console.error("Delete kit error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to delete interview kit",
    });
  }
};

export const startKitGeneration = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const id = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;

    const kit = await InterviewKit.findOne({
      _id: id,
      user_id: req.userId,
    });

    if (!kit) {
      res.status(404).json({
        success: false,
        message: "Interview kit not found",
      });
      return;
    }

    // Prevent duplicate generation
    if (kit.generation.status === "generating") {
      res.status(409).json({
        success: false,
        message: "Kit generation is already in progress",
      });
      return;
    }

    // Reset generation state
    kit.generation = {
      status: "generating",
      progress: 5,
      current_step: "Starting interview kit generation",
      error: null,
    };

    await kit.save();

    // Return immediately so the frontend can start polling.
    res.status(202).json({
      success: true,
      message: "Interview kit generation started",
      kit,
    });

    // Run the real AI generation pipeline in the background.
    // The pipeline itself is responsible for updating progress
    // and marking the kit as completed or failed.
    generateInterviewKit({
      kitId: id,
      userId: req.userId,
    }).catch((error) => {
      console.error("Background generation failed:", error);
    });
  } catch (error) {
    console.error("Start kit generation error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to start interview kit generation",
    });
  }
};