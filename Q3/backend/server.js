require("dotenv").config();
const express = require("express");
const multer = require("multer");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Store uploads in memory temporarily
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are accepted"), false);
    }
  },
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.post("/api/validate", upload.single("permit"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded or file is not a PDF." });
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const pdfBase64 = req.file.buffer.toString("base64");

    const prompt = `You are an expert document verification specialist for work permits and employment authorization documents.

Analyze this document carefully and determine:
1. Whether this is a valid work permit / employment authorization document
2. The expiry/validity date
3. Your confidence percentage

A work permit can include:
- EU Blue Card (Blaue Karte EU)
- German work permit (Arbeitserlaubnis / Aufenthaltserlaubnis zur Erwerbstätigkeit)
- Niederlassungserlaubnis (settlement permit with work rights)
- ICT permits
- Seasonal worker permits
- Any other official government-issued document authorizing employment in any country

Look for these indicators of a valid work permit:
- Official government letterhead, stamps, or seals
- Document number / permit number
- Holder's personal information (name, date of birth)
- Issuing authority (immigration office, embassy, government agency)
- Type of permit or visa category
- Validity dates (issued date AND expiry date)
- Official signatures or digital signatures
- Security features descriptions
- Employment restrictions or permissions stated

Invalid document indicators:
- Missing official seals or stamps
- No issuing authority
- No validity dates
- Clearly a different document type (invoice, contract, certificate of employment, etc.)
- Expired documents still count as work permits, just note they are expired

Respond ONLY with a valid JSON object in this exact format, no markdown, no code blocks, just raw JSON:
{
  "isWorkPermit": true or false,
  "confidence": number between 0 and 100,
  "validUntil": "DD.MM.YYYY" or null if not found or not applicable,
  "isExpired": true or false or null,
  "permitType": "string describing the type of permit" or null,
  "issuingCountry": "country name" or null,
  "holderName": "name from document" or null,
  "documentNumber": "permit/document number" or null,
  "summary": "2-3 sentence explanation of your determination",
  "keyFindings": ["finding 1", "finding 2", "finding 3"]
}`;

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: "application/pdf",
          data: pdfBase64,
        },
      },
      prompt,
    ]);

    const responseText = result.response.text().trim();

    // Clean up response in case model adds markdown
    const cleanedResponse = responseText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    let parsedResult;
    try {
      parsedResult = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error("Failed to parse Gemini response:", responseText);
      return res.status(500).json({
        error: "Failed to parse AI response. Please try again.",
        raw: responseText,
      });
    }

    // Check expiry if we have a date
    if (parsedResult.validUntil && !parsedResult.isExpired !== null) {
      try {
        const parts = parsedResult.validUntil.split(".");
        if (parts.length === 3) {
          const expiryDate = new Date(
            parseInt(parts[2]),
            parseInt(parts[1]) - 1,
            parseInt(parts[0])
          );
          parsedResult.isExpired = expiryDate < new Date();
        }
      } catch (e) {
        // Keep whatever the model said
      }
    }

    return res.json({
      success: true,
      filename: req.file.originalname,
      fileSize: req.file.size,
      result: parsedResult,
    });
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    return res.status(500).json({
      error: "AI processing failed: " + (error.message || "Unknown error"),
    });
  }
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", model: "gemini-2.0-flash-lite" });
});

app.listen(PORT, () => {
  console.log(`Work Permit Validator backend running on http://localhost:${PORT}`);
});
