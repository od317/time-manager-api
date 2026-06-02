const express = require("express");
const router = express.Router();
const { exec } = require("child_process");

router.post("/migrate", async (req, res) => {
  const { secret } = req.body;

  // Secret key protection
  if (secret !== process.env.SETUP_SECRET) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    exec("npx prisma migrate deploy", (error, stdout, stderr) => {
      if (error) {
        console.error("Migration error:", stderr);
        return res
          .status(500)
          .json({ message: "Migration failed", error: stderr });
      }
      console.log("Migration output:", stdout);
      res.json({ message: "Migrations complete", output: stdout });
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
