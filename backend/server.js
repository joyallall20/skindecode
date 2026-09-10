import "./src/config/env.js";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import connectDB from "./src/config/db.js";

import skinProfileRoutes from "./src/routes/skinProfileRoutes.js";
import recommendationRoutes from "./src/routes/recommendationRoutes.js";
import productRoutes from "./src/routes/productRoutes.js";
import productOfferRoutes from "./src/routes/productOfferRoutes.js";
import productClickRoutes from "./src/routes/productClickRoutes.js";

import ingredientRoutes from "./src/routes/ingredientRoutes.js";
import brandRoutes from "./src/routes/brandRoutes.js";
import categoryRoutes from "./src/routes/categoryRoutes.js";
import retailerRoutes from "./src/routes/retailerRoutes.js";

import chatRoutes from "./src/routes/chatRoutes.js";
import productImportRoutes from "./src/routes/productImportRoutes.js";
import sellerDiscoveryRoutes from "./src/routes/sellerDiscoveryRoutes.js";
import adminRoutes from "./src/routes/adminRoutes.js";
import researchRoutes from "./src/routes/researchRoutes.js";

import anonymousAnalysisRoutes from "./src/routes/anonymousAnalysisRoutes.js";
import authRoutes from "./src/routes/authRoutes.js";

import { startProductIntelligenceWorker } from "./src/workers/productIntelligenceWorker.js";
import {
  startAnonymousAnalysisWorker,
} from "./src/workers/anonymousAnalysisWorker.js";

const app = express();

/* =========================================================
   DATABASE
========================================================= */

connectDB().then(() => {
  startProductIntelligenceWorker();
  startAnonymousAnalysisWorker();
});

/* =========================================================
   CORS
========================================================= */

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
    ],
  })
);

/* =========================================================
   BODY PARSERS
========================================================= */

app.use(express.json({ limit: "10mb" }));
app.use(
  express.urlencoded({
    extended: true,
    limit: "10mb",
  })
);

/* =========================================================
   COOKIES
========================================================= */

app.use(cookieParser());

/* =========================================================
   DEVELOPMENT REQUEST LOGGER
========================================================= */

if (process.env.NODE_ENV === "development") {
  app.use((req, res, next) => {
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`
    );

    next();
  });
}

/* =========================================================
   HEALTH CHECK
========================================================= */

/* =========================================================
   HEALTH CHECK
========================================================= */

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    service: "skinDecode API",
    status: "OK",
  });
});

app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    status: "OK",
    message: "Skincare Platform Backend API is running smoothly",
    timestamp: new Date(),
  });
});

/* =========================================================
   ROUTES
========================================================= */

/* Anonymous recommendation flow */
app.use(
  "/api/anonymous-analysis",
  anonymousAnalysisRoutes
);

/* Authentication */
app.use("/api/auth", authRoutes);

/* Skin profile */
app.use("/api/skin-profile", skinProfileRoutes);

/* Recommendations */
app.use(
  "/api/recommendations",
  recommendationRoutes
);

/* Products */
app.use(
  "/api/products/:productId/offers",
  productOfferRoutes
);

app.use("/api/products", productRoutes);

/* Product clicks */
app.use(
  "/api/product-clicks",
  productClickRoutes
);

/* Ingredients */
app.use(
  "/api/ingredients",
  ingredientRoutes
);

/* Brands */
app.use("/api/brands", brandRoutes);

/* Categories */
app.use(
  "/api/categories",
  categoryRoutes
);

/* Retailers */
app.use(
  "/api/retailers",
  retailerRoutes
);

/* Chat */
app.use("/api/chat", chatRoutes);

/* Product imports */
app.use(
  "/api/product-imports",
  productImportRoutes
);

/* Seller discovery */
app.use(
  "/api/seller-discovery",
  sellerDiscoveryRoutes
);

/* Research */
app.use(
  "/api/research",
  researchRoutes
);

/* Admin */
app.use("/api/admin", adminRoutes);

/* =========================================================
   404 HANDLER
========================================================= */

app.use((req, res, next) => {
  const error = new Error(
    `Route Not Found - ${req.originalUrl}`
  );

  res.status(404);
  next(error);
});

/* =========================================================
   GLOBAL ERROR HANDLER
========================================================= */

app.use((err, req, res, next) => {
  const statusCode =
    err.name === "CastError"
      ? 400
      : res.statusCode === 200
        ? err.statusCode || 500
        : res.statusCode;

  console.error(
    `❌ Error [${statusCode}]: ${err.message}`
  );

  if (process.env.NODE_ENV !== "production") {
    console.error(err.stack);
  }

  res.status(statusCode).json({
    success: false,
    message:
      err.name === "CastError"
        ? `Invalid ${
            err.model?.modelName ||
            err.path ||
            "document"
          } reference: ${err.value}`
        : err.message || "Internal Server Error",

    stack:
      process.env.NODE_ENV === "production"
        ? null
        : err.stack,
  });
});

/* =========================================================
   SERVER
========================================================= */

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(
    `🚀 Server listening in [${
      process.env.NODE_ENV || "development"
    }] mode on port ${PORT}`
  );

  console.log(
    `🌐 API: http://localhost:${PORT}`
  );

  console.log(
    `❤️ Health: http://localhost:${PORT}/health`
  );
});

/* =========================================================
   PROCESS ERROR HANDLERS
========================================================= */

process.on("unhandledRejection", (err) => {
  console.error(
    `💥 Unhandled Rejection: ${err.message}`
  );

  server.close(() => {
    process.exit(1);
  });
});

process.on("uncaughtException", (err) => {
  console.error(
    `💥 Uncaught Exception: ${err.message}`
  );

  process.exit(1);
});