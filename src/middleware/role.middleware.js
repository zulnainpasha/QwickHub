const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Only ${roles.join(", ")} can do this.`,
      });
    }
    next();
  };
};

module.exports = { authorize };
