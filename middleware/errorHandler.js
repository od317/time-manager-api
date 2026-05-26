const errorHandler = (err, req, res, next) => {
  console.error(err.stack);

  if (err.code === "P2002") {
    return res.status(400).json({ message: "Duplicate field value" });
  }

  if (err.code === "P2025") {
    return res.status(404).json({ message: "Record not found" });
  }

  res.status(err.statusCode || 500).json({
    message: err.message || "Internal Server Error",
  });
};

module.exports = errorHandler;
