const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const adminRouter = require("./routes/admin.routes");
const authRouter = require("./routes/auth.routes");
const projectRouter = require("./routes/project.routes");

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

//Routes
app.use("/api/admin", adminRouter);
app.use("/api/auth", authRouter);
app.use("/api/projects", projectRouter);

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "API is running",
  });
});

module.exports = app;
