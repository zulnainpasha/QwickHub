const router = require("express").Router();
const Project = require("../models/Project.model");
const { protect } = require("../middleware/auth.middleware");
const { authorize } = require("../middleware/role.middleware");

// POST /api/projects — Create a project (Admin, Manager only)
router.post("/", protect, authorize("admin", "manager"), async (req, res) => {
  try {
    const { name, description, startDate, deadline, priority } = req.body;

    const project = new Project({
      name,
      description,
      startDate,
      deadline,
      priority,
      createdBy: req.user._id,
      members: [req.user._id], // creator is automatically a member
    });

    await project.save();

    res.status(201).json({
      success: true,
      message: "Project created successfully.",
      data: project,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/projects — Get all projects (filtered by role)
router.get("/", protect, async (req, res) => {
  try {
    // Sorting logic
    const sortOptions = {
      priority: { priority: -1 },
      progress: { progress: -1 },
      date: { createdAt: -1 },
    };
    const sort = sortOptions[req.query.sortBy] || { createdAt: -1 };

    let projects;

    if (req.user.role === "admin" || req.user.role === "manager") {
      projects = await Project.find()
        .populate("createdBy", "name email")
        .populate("members", "name email role")
        .sort(sort);
    } else {
      projects = await Project.find({ members: req.user._id })
        .populate("createdBy", "name email")
        .populate("members", "name email role")
        .sort(sort);
    }

    res.status(200).json({
      success: true,
      data: projects,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/projects/:id — Get single project
router.get("/:id", protect, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate("createdBy", "name email")
      .populate("members", "name email role");

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found.",
      });
    }

    // Developer and Viewer — only if they are a member
    if (req.user.role === "developer" || req.user.role === "viewer") {
      const isMember = project.members.some(
        (m) => m._id.toString() === req.user._id.toString(),
      );
      if (!isMember) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You are not a member of this project.",
        });
      }
    }

    res.status(200).json({
      success: true,
      data: project,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/projects/:id — Update project (Admin, Manager only)
router.put("/:id", protect, authorize("admin", "manager"), async (req, res) => {
  try {
    const project = await Project.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Project updated.",
      data: project,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/projects/:id — Delete project (Admin only)
router.delete("/:id", protect, authorize("admin"), async (req, res) => {
  try {
    const project = await Project.findByIdAndDelete(req.params.id);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Project deleted successfully.",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/projects/:id/members — Add member (Admin, Manager only)
router.post(
  "/:id/members",
  protect,
  authorize("admin", "manager"),
  async (req, res) => {
    try {
      const { userId } = req.body;

      const project = await Project.findById(req.params.id);
      if (!project) {
        return res.status(404).json({
          success: false,
          message: "Project not found.",
        });
      }

      // Check if already a member
      if (project.members.includes(userId)) {
        return res.status(400).json({
          success: false,
          message: "User is already a member of this project.",
        });
      }

      project.members.push(userId);
      await project.save();

      res.status(200).json({
        success: true,
        message: "Member added successfully.",
        data: project,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },
);

// DELETE /api/projects/:id/members/:userId — Remove member (Admin, Manager only)
router.delete(
  "/:id/members/:userId",
  protect,
  authorize("admin", "manager"),
  async (req, res) => {
    try {
      const project = await Project.findById(req.params.id);
      if (!project) {
        return res.status(404).json({
          success: false,
          message: "Project not found.",
        });
      }

      // Check if user is actually a member
      const isMember = project.members.includes(req.params.userId);
      if (!isMember) {
        return res.status(400).json({
          success: false,
          message: "User is not a member of this project.",
        });
      }

      project.members = project.members.filter(
        (m) => m.toString() !== req.params.userId,
      );

      await project.save();

      res.status(200).json({
        success: true,
        message: "Member removed successfully.",
        data: project,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },
);

// GET /api/projects/:id/summary — Full project overview
router.get("/:id/summary", protect, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate("createdBy", "name email")
      .populate("members", "name email role specialization");

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found.",
      });
    }

    // Access check for developer and viewer
    if (req.user.role === "developer" || req.user.role === "viewer") {
      const isMember = project.members.some(
        (m) => m._id.toString() === req.user._id.toString(),
      );
      if (!isMember) {
        return res.status(403).json({
          success: false,
          message: "Access denied.",
        });
      }
    }

    // Days remaining
    const today = new Date();
    const daysLeft = Math.ceil(
      (new Date(project.deadline) - today) / (1000 * 60 * 60 * 24),
    );

    // Tracking status — will improve after Task model is ready
    let trackingStatus;
    if (project.status === "completed" || project.progress === 100) {
      trackingStatus = "completed";
    } else if (project.status === "on-hold") {
      trackingStatus = "on-hold";
    } else if (daysLeft < 0) {
      trackingStatus = "at-risk"; // deadline passed = at risk
    } else {
      trackingStatus = "on-track";
    }

    res.status(200).json({
      success: true,
      data: {
        _id: project._id,
        name: project.name,
        description: project.description,
        startDate: project.startDate,
        deadline: project.deadline,
        status: project.status,
        trackingStatus, // ← on-track / at-risk / completed / on-hold
        priority: project.priority,
        progress: project.progress,
        daysLeft: daysLeft > 0 ? daysLeft : 0,
        isOverdue: daysLeft < 0,
        createdBy: project.createdBy,
        members: project.members, // ← now includes specialization
        totalMembers: project.members.length,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
module.exports = router;
