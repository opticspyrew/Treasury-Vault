import { Router, type IRouter } from "express";
import healthRouter from "./health";
import adminRouter from "./admin";
import publicRouter from "./public";
import authRouter from "./auth";
import replitAuthRouter from "./replit-auth";
import socialAuthRouter from "./social-auth";
import refundsRouter from "./refunds";
import refundsSyncRouter from "./refunds-sync";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/admin", adminRouter);
// Mount the machine-to-machine Manus sync surfaces first so their specific
// /sync/* and /webhooks/* paths are matched before the general refunds router.
router.use("/public/refunds", refundsSyncRouter);
router.use("/public/refunds", refundsRouter);
router.use("/public", publicRouter);
router.use("/auth/replit", replitAuthRouter);
router.use("/auth", socialAuthRouter);
router.use("/auth", authRouter);

export default router;
