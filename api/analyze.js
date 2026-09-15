export default async function handler(req, res) {
  // CORS
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

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "OPENAI_API_KEY is missing from Vercel Environment Variables."
    });
  }

  try {
    let body = req.body;

    // Vercel can provide req.body as either an object or a string.
    if (typeof body === "string") {
      body = JSON.parse(body);
    }

    const image = body?.image;

    if (!image || typeof image !== "string") {
      return res.status(400).json({
        error: "No image was received by the AI server."
      });
    }

    if (!image.startsWith("data:image/")) {
      return res.status(400).json({
        error: "Invalid image format. Please upload a JPG or PNG image."
      });
    }

    if (image.length > 10_000_000) {
      return res.status(413).json({
        error: "Image is too large. Please choose a smaller image."
      });
    }

    const prompt = `
You are the computer-vision AI inside a Class 12 school project called Imagify.

Analyze the ACTUAL IMAGE provided to you.

Identify the main visible subject as accurately as possible.

Return useful information based ONLY on what can reasonably be determined from the image.

The result must be suitable for displaying in an organized school-project interface.

Rules:
- Identify the main object, subject, animal, plant, food, device, scene, etc.
- Give a confidence score from 0 to 100.
- Explain the visible clues supporting the identification.
- Describe important visible characteristics.
- Mention readable text if present.
- Mention likely purpose or use when reasonably identifiable.
- If it is food, give APPROXIMATE nutrition information and general benefits.
- Never claim exact calories, ingredients, freshness, contamination, allergies or food safety from an image alone.
- If something cannot be determined, clearly say that.
- Do not invent information.
- Keep the answer concise but informative.
- Do not return one huge paragraph.

Return ONLY valid JSON.
`;

    const openAIResponse = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "gpt-5.6-luna",
          store: false,
          input: [
            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: prompt
                },
                {
                  type: "input_image",
                  image_url: image,
                  detail: "high"
                }
              ]
            }
          ],
          text: {
            format: {
              type: "json_schema",
              name: "imagify_result",
              strict: true,
              schema: {
                type: "object",
                additionalProperties: false,
                properties: {
                  primary_identification: {
                    type: "string"
                  },
                  category: {
                    type: "string"
                  },
                  confidence: {
                    type: "number"
                  },
                  description: {
                    type: "string"
                  },
                  visual_evidence: {
                    type: "string"
                  },
                  visible_characteristics: {
                    type: "array",
                    items: {
                      type: "string"
                    }
                  },
                  scene_context: {
                    type: "string"
                  },
                  visible_text: {
                    type: "string"
                  },
                  uses_or_purpose: {
                    type: "string"
                  },
                  food: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      is_food: {
                        type: "boolean"
                      },
                      edibility_status: {
                        type: "string"
                      },
                      nutrition_estimate: {
                        type: "string"
                      },
                      benefits: {
                        type: "string"
                      },
                      safety: {
                        type: "string"
                      }
                    },
                    required: [
                      "is_food",
                      "edibility_status",
                      "nutrition_estimate",
                      "benefits",
                      "safety"
                    ]
                  },
                  safety_and_uncertainty: {
                    type: "string"
                  },
                  alternatives: {
                    type: "array",
                    items: {
                      type: "string"
                    }
                  },
                  final_summary: {
                    type: "string"
                  }
                },
                required: [
                  "primary_identification",
                  "category",
                  "confidence",
                  "description",
                  "visual_evidence",
                  "visible_characteristics",
                  "scene_context",
                  "visible_text",
                  "uses_or_purpose",
                  "food",
                  "safety_and_uncertainty",
                  "alternatives",
                  "final_summary"
                ]
              }
            }
          }
        })
      }
    );

    const rawText = await openAIResponse.text();

    if (!openAIResponse.ok) {
      console.error("OpenAI HTTP error:", openAIResponse.status);
      console.error(rawText);

      let errorMessage = rawText;

      try {
        const errorJSON = JSON.parse(rawText);
        errorMessage =
          errorJSON?.error?.message ||
          errorJSON?.message ||
          rawText;
      } catch {}

      return res.status(openAIResponse.status).json({
        error: `OpenAI error: ${errorMessage}`
      });
    }

    let responseData;

    try {
      responseData = JSON.parse(rawText);
    } catch {
      console.error("Invalid OpenAI response:", rawText);

      return res.status(502).json({
        error: "The AI server returned an invalid response."
      });
    }

    const outputText = responseData.output_text;

    if (!outputText) {
      console.error("No output_text:", responseData);

      return res.status(502).json({
        error: "The AI returned no analysis."
      });
    }

    let analysis;

    try {
      analysis = JSON.parse(outputText);
    } catch {
      console.error("AI JSON parsing failed:", outputText);

      return res.status(502).json({
        error: "The AI returned an invalid analysis format."
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
        "Unexpected error while analyzing the image."
    });
  }
}
