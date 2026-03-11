function requireRoles(...roles) {
  const allowed = new Set(roles);

  return (req, res, next) => {
    const role = req.user?.role;

    if (!role) {
      return res.status(401).json({
        ok: false,
        message: "unauthorized",
      });
    }

    if (!allowed.has(role)) {
      return res.status(403).json({
        ok: false,
        message: "forbidden",
      });
    }

    return next();
  };
}

module.exports = requireRoles;
