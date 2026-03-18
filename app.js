require("dotenv").config();
const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const helmet = require("helmet");
const cors = require("cors");
const bodyParser = require("body-parser");
const { optionalAuth } = require("./middleware/auth");

function createApp() {
  const app = express();

  // Security middleware
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: [
            "'self'",
            "'unsafe-inline'",
            "https://fonts.googleapis.com",
          ],
          scriptSrc: ["'self'"],
          scriptSrcAttr: ["'none'"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:", "blob:", "https:"],
          connectSrc: ["'self'"],
        },
      },
    }),
  );

  // CORS
  app.use(cors());

  // Body parser
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(bodyParser.json());

  // Cookie parser
  app.use(cookieParser());

  // Session - shared across all tabs in same browser
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "your-secret-key",
      resave: false,
      saveUninitialized: true,
      name: "sessionId",
      cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      },
    }),
  );

  // View engine setup
  app.set("view engine", "ejs");
  app.set("views", path.join(__dirname, "views"));

  const faviconPath = path.join(__dirname, "public", "favicon.png");

  app.get("/favicon.ico", (req, res) => {
    res.type("image/png");
    res.sendFile(faviconPath);
  });

  // Static files
  app.use(express.static(path.join(__dirname, "public")));

  // Global auth check - populate req.user from JWT token for all requests
  app.use(optionalAuth);

  // Make user available to all views
  app.use((req, res, next) => {
    res.locals.user = req.user || null;
    res.locals.path = req.originalUrl || req.path;
    next();
  });

  // Import routes
  const routes = require("./routes");
  app.use("/", routes);

  // 404 handler
  app.use((req, res) => {
    res.status(404).render("error", {
      message: "Page not found",
      user: req.user || null,
    });
  });

  // Error handler
  app.use((err, req, res, next) => {
    console.error("Error:", err);

    res.status(err.status || 500).render("error", {
      message: err.message || "Something went wrong",
      user: req.user || null,
    });
  });

  return app;
}

const app = createApp();

module.exports = app;
module.exports.createApp = createApp;
