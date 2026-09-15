import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const MODEL =
  process.env.IMAGIFY_MODEL || "gpt-5.6-luna";

export default async function handler(req, res) {

  /*
   * Allow browser preflight requests.
   */
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  /*
   * Only POST is allowed.
   */
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed. Use POST."
    });
  }

  /*
   * Check API key.
   */
  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({
      error:
        "OPENAI_API_KEY is missing in Vercel. Add it in Project Settings → Environment Variables, then redeploy."
    });
  }

  try {

    const body = req.body || {};
    const image = body.image;

    /*
     * Validate image.
     */
    if (
      typeof image !== "string" ||
      !image.startsWith("data:image/")
    ) {
      return res.status(400).json({
        error:
          "Invalid image data. Please upload or capture an image again."
      });
    }

    /*
     * Prevent extremely large requests.
     */
    if (image.length > 9_000_000) {
      return res.status(413).json({
        error:
          "Image is too large. Please use a smaller image."
      });
    }

    /*
     * Ask the vision model for structured information.
     */
    const response = await client.responses.create({

      model: MODEL,

      store: false,

      input: [
        {
          role: "user",

          content: [

            {
              type: "input_text",

              text: `
You are the AI vision engine for a Class XII Artificial Intelligence
school project called Imagify.

Analyze the supplied image carefully.

Your job is to identify what is visibly present and provide useful,
accurate and concise information.

IMPORTANT RULES:

1. Base conclusions on visible evidence.
2. Do not invent hidden information.
3. If identification is uncertain, say so.
4. Give a confidence score from 0 to 100.
5. Explain the visual clues supporting the identification.
6. Mention important visible characteristics.
7. Mention other clearly visible objects when useful.
8. Transcribe readable visible text if present.
9. Explain likely purpose or use when reasonably identifiable.
10. If the image contains food, provide approximate nutrition information.
11. Nutrition values must be clearly described as estimates.
12. Do not claim exact calories, ingredients, freshness, contamination,
    allergen status or food safety from pixels alone.
13. Distinguish "appears to be food" from "guaranteed safe to eat".
14. If it is not food, food-related fields should clearly say that they
    are not applicable.
15. Keep the final answer organized and useful for a student.
16. Do not produce one huge paragraph.
17. Never pretend certainty when the image does not support it.

For food nutrition, use approximate values per 100 g only when a reasonable
estimate is possible. If the image does not provide enough information,
say that an accurate estimate cannot be determined from the image.

Return ONLY the requested structured JSON.
              `
            },

            {
              type: "input_image",

              image_url: image,

              detail: "low"
            }

          ]
        }
      ],

      text: {

        format: {

          type: "json_schema",

          name: "imagify_analysis",

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
    });


    /*
     * Responses API gives the generated text here.
     */
    const outputText =
      response.output_text;


    if (!outputText) {
      console.error(
        "Empty OpenAI response:",
        response
      );

      return res.status(502).json({
        error:
          "The AI returned an empty response. Please try again."
      });
    }


    /*
     * Parse structured JSON.
     */
    let analysis;

    try {

      analysis =
        JSON.parse(outputText);

    } catch (parseError) {

      console.error(
        "JSON parsing error:",
        parseError
      );

      console.error(
        "Raw AI output:",
        outputText
      );

      return res.status(502).json({
        error:
          "The AI returned an invalid analysis format. Please try again."
      });
    }


    /*
     * Basic confidence cleanup.
     */
    if (
      typeof analysis.confidence !== "number"
    ) {
      analysis.confidence = 0;
    }

    analysis.confidence =
      Math.max(
        0,
        Math.min(
          100,
          Math.round(
            analysis.confidence
          )
        )
      );


    return res.status(200).json({
      analysis
    });


  } catch (error) {

    console.error(
      "Imagify API error:",
      error
    );


    /*
     * Give useful errors instead of simply
     * saying "Analysis failed".
     */

    if (
      error?.status === 401 ||
      error?.code === "invalid_api_key"
    ) {

      return res.status(500).json({
        error:
          "OpenAI API key is invalid. Check OPENAI_API_KEY in Vercel."
      });
    }


    if (
      error?.status === 429
    ) {

      return res.status(429).json({
        error:
          "AI request was rejected because of rate limits or API credits. Check your OpenAI API billing/usage."
      });
    }


    if (
      error?.status === 400
    ) {

      return res.status(400).json({
        error:
          error?.message ||
          "The AI rejected the image request. Try a clear JPG or PNG image."
      });
    }


    return res.status(500).json({
      error:
        error?.message ||
        "Imagify's AI server encountered an unexpected error."
    });
  }
}
