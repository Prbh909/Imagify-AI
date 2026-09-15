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
You are the computer vision AI inside a Class 12 school project called "Imagify".

Analyze the ACTUAL IMAGE provided.

Identify the main visible subject as accurately as possible.

Give concise but useful information suitable for a school project.

IMPORTANT:
- Base your answer only on visible evidence.
- Do not invent details.
- If uncertain, clearly say so.
- Give confidence from 0 to 100.
- Explain the visual clues.
- Describe important visible characteristics.
- Mention readable text if visible.
- Explain likely purpose/use when reasonably identifiable.
- If it is food, provide approximate nutrition information.
- Nutrition must be clearly labelled as an estimate.
- Do not claim exact calories, ingredients, freshness, contamination, allergens, or safety from pixels alone.
- If it is not food, food information should say "Not applicable".
- Keep everything organized.
- Do not write one giant paragraph.

Return ONLY JSON using exactly this structure:

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

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" +
        encodeURIComponent(apiKey),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt
                },
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: base64Image
                  }
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json"
          }
        })
      }
    );

    const raw = await response.text();

    if (!response.ok) {
      console.error("Gemini error:", response.status, raw);

      let message = raw;

      try {
        const parsed = JSON.parse(raw);
        message =
          parsed?.error?.message ||
          parsed?.error?.status ||
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
        error: "Gemini returned an invalid server response."
      });
    }

    const output =
      data?.candidates?.[0]?.content?.parts
        ?.map(part => part.text || "")
        .join("")
        .trim();

    if (!output) {
      return res.status(502).json({
        error: "Gemini returned no image analysis."
      });
    }

    let analysis;

    try {
      analysis = JSON.parse(output);
    } catch {
      console.error("Gemini JSON:", output);

      return res.status(502).json({
        error: "Gemini returned an invalid analysis."
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
    console.error("Imagify error:", error);

    return res.status(500).json({
      error: error?.message || "Image analysis failed."
    });
  }
}
