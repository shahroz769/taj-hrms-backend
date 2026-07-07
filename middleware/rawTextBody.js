/**
 * Parse request body as raw text (text/plain).
 * Required for ZKTeco ADMS device POST payloads — must run before express.json().
 */
export const rawTextBody = (req, res, next) => {
  if (req.method !== "POST" && req.method !== "PUT" && req.method !== "PATCH") {
    return next();
  }

  const contentType = req.headers["content-type"] || "";
  if (
    contentType.includes("application/json") ||
    contentType.includes("multipart/form-data")
  ) {
    return next();
  }

  const chunks = [];

  req.on("data", (chunk) => {
    chunks.push(chunk);
  });

  req.on("end", () => {
    const raw = Buffer.concat(chunks).toString("utf8");
    req.rawBody = raw;
    req.body = raw;
    next();
  });

  req.on("error", (err) => {
    next(err);
  });
};
