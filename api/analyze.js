export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed."
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "GEMINI_API_KEY is missing in Vercel."
    });
  }

  try {
    let body = req.body;

    if (typeof body === "string") {
      body = JSON.parse(body);
    }

    const image = body?.image;

    if (!image || typeof image !== "string") {
      return res.status(400).json({
        error: "No image was received."
      });
    }

    const match = image.match(
      /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/
    );

    if (!match) {
      return res.status(400).json({
        error: "Invalid image format."
      });
    }

    const mimeType = match[1];
    const base64Image = match[2];

    const prompt = `
You are Imagify, an AI image-analysis system created as a Class XII
Artificial Intelligence school project.

Analyze the ACTUAL IMAGE supplied with this request.

Identify the main visible subject as accurately as possible.

Return useful, organized information based ONLY on visible evidence.

IMPORTANT RULES:

1. Identify the main object, animal, plant, food, device, scene,
   or other visible subject.
2. Give a confidence score from 0 to 100.
3. Explain the visual evidence supporting the identification.
4. Describe important visible characteristics.
5. Mention readable text if visible.
6. Explain likely purpose or use when reasonably identifiable.
7. If the image contains food, provide approximate nutrition
   information and general benefits.
8. Clearly label nutrition as an estimate.
9. Never claim exact calories, ingredients, freshness,
   contamination, allergens, or food safety from an image alone.
10. If it is not food, food fields must say "Not applicable".
11. If identification is uncertain, say so.
12. Do not invent information.
13. Keep the information concise and organized.
14. Do not produce one giant paragraph.

Return ONLY valid JSON with this exact structure:

{
  "primary_identification": "",
  "category": "",
  "confidence": 0,
  "description": "",
  "visual_evidence": "",
  "visible_characteristics": [],
  "scene_context": "",
  "visible_text": "",
  "uses_or_purpose": "",
  "food": {
    "is_food": false,
    "edibility_status": "",
    "nutrition_estimate": "",
    "benefits": "",
    "safety": ""
  },
  "safety_and_uncertainty": "",
  "alternatives": [],
  "final_summary": ""
}
`;

    /*
      Gemini Interactions API
      Current multimodal model:
      gemini-3.6-flash
    */

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/interactions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
          "Api-Revision": "2026-05-20"
        },
        body: JSON.stringify({
          model: "gemini-3.6-flash",

          input: [
            {
              type: "image",
              mime_type: mimeType,
              data: base64Image
            },
            {
              type: "text",
              text: prompt
            }
          ]
        })
      }
    );

    const raw = await response.text();

    if (!response.ok) {
      console.error(
        "Gemini HTTP error:",
        response.status,
        raw
      );

      let message = raw;

      try {
        const parsed = JSON.parse(raw);

        message =
          parsed?.error?.message ||
          parsed?.message ||
          raw;
      } catch {}

      return res.status(response.status).json({
        error: `Gemini error: ${message}`
      });
    }

    let data;

    try {
      data = JSON.parse(raw);
    } catch {
      return res.status(502).json({
        error: "Gemini returned an invalid response."
      });
    }

    /*
      Interactions API returns model output
      inside interaction steps.
    */

    const outputText =
      data?.steps
        ?.filter(step => step?.type === "model_output")
        ?.flatMap(step => step?.content || [])
        ?.filter(item => item?.type === "text")
        ?.map(item => item.text || "")
        ?.join("")
        ?.trim();

    if (!outputText) {
      console.error(
        "Gemini returned no usable output:",
        JSON.stringify(data)
      );

      return res.status(502).json({
        error: "Gemini returned no image analysis."
      });
    }

    let analysis;

    try {
      analysis = JSON.parse(outputText);
    } catch {
      console.error(
        "Gemini returned non-JSON output:",
        outputText
      );

      return res.status(502).json({
        error: "Gemini returned an invalid analysis format."
      });
    }

    analysis.confidence = Math.max(
      0,
      Math.min(
        100,
        Math.round(Number(analysis.confidence) || 0)
      )
    );

    return res.status(200).json({
      analysis
    });

  } catch (error) {
    console.error("Imagify server error:", error);

    return res.status(500).json({
      error:
        error?.message ||
        "Unexpected error during image analysis."
    });
  }
}
