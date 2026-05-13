// Khởi tạo Express app, middleware dùng chung, static assets và các router chính.
require("dotenv").config();
const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const helmet = require("helmet");
const cors = require("cors");
const bodyParser = require("body-parser");
const { optionalAuth } = require("./middleware/auth");
const headerCategories = require("./middleware/headerCategories");
const { storefrontSettings } = require("./middleware/storefrontSettings");
const privacy = require("./utils/privacy");

const FORM_PARAMETER_LIMIT = 20000;
const FORM_BODY_LIMIT = "5mb";

// Tạo ứng dụng Express và gắn middleware/route.
function createApp() {
  const app = express();
  app.set("trust proxy", true);
  const paymentFormActionSources = [
    "'self'",
    "https://sandbox.vnpayment.vn",
    "https://pay.vnpay.vn",
  ];

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
          mediaSrc: ["'self'", "blob:", "https:"],
          connectSrc: ["'self'"],
          formAction: paymentFormActionSources,
        },
      },
    }),
  );

  // CORS
  app.use(cors());

  // Body parser
  app.use(
    bodyParser.urlencoded({
      extended: true,
      parameterLimit: FORM_PARAMETER_LIMIT,
      limit: FORM_BODY_LIMIT,
    }),
  );
  app.use(bodyParser.json({ limit: FORM_BODY_LIMIT }));

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

  // Phục vụ static assets từ thư mục public.
  app.use(express.static(path.join(__dirname, "public")));

  // Nạp user từ JWT nếu có để mọi route/view dùng được trạng thái đăng nhập.
  app.use(optionalAuth);
  app.use(storefrontSettings);
  app.use(headerCategories);

  // Đưa dữ liệu dùng chung vào res.locals cho toàn bộ EJS view.
  app.use((req, res, next) => {
    res.locals.user = req.user || null;
    res.locals.path = req.originalUrl || req.path;
    res.locals.privacy = privacy;
    next();
  });

  // Gắn router tổng để các route con giữ cấu trúc riêng trong thư mục routes.
  const routes = require("./routes");
  app.use("/", routes);

  // Render trang lỗi khi không route nào xử lý request.
  app.use((req, res) => {
    res.status(404).render("error", {
      message: "Page not found",
      user: req.user || null,
    });
  });

  // Handler lỗi cuối chuỗi middleware để tránh lộ stack trace ra view.
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
