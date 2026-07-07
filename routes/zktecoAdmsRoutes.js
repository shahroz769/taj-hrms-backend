import express from "express";
import { rawTextBody } from "../middleware/rawTextBody.js";
import {
  getCdataHandshake,
  postCdataAttlog,
  getDeviceRequest,
  postDeviceCmd,
  pingDevice,
} from "../controllers/zktecoAdmsController.js";

const router = express.Router();

router.get("/ping", pingDevice);
router.get("/cdata", getCdataHandshake);
router.post("/cdata", rawTextBody, postCdataAttlog);
router.get("/getrequest", getDeviceRequest);
router.post("/devicecmd", rawTextBody, postDeviceCmd);

export default router;
