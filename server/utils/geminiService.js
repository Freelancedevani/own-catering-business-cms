const { GoogleGenAI, Type } = require('@google/genai');

// Single client. apiVersion: 'v1' pins you to the stable endpoint
// instead of the default v1beta preview endpoint.
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  apiVersion: 'v1',
});

// gemini-2.5-flash is blocked for new API keys as of Aug 2026.
// gemini-3.5-flash / gemini-3.6-flash are the current recommended Flash models.
// Change this one string if Google deprecates the model again later.
const MODEL_NAME = 'gemini-3.5-flash';

/**
 * Build a structured prompt from catering context data
 */
const buildPrompt = ({ eventType, guestCount, menuItems, historicalData, currentMenuPrices }) => {
  const menuList = menuItems
    .map((m) => `- ${m.name} (${m.category}, ₹${m.pricePerUnit}/${m.unit})`)
    .join('\n');

  const historicalSummary = historicalData.length
    ? historicalData
        .map(
          (o) =>
            `  • ${o.eventType} | ${o.guestCount} guests | ₹${o.totalAmount} total | ₹${Math.round(
              o.totalAmount / o.guestCount
            )}/guest | expenses: ₹${o.totalExpenses}`
        )
        .join('\n')
    : '  • No historical data available yet';

  return `You are a catering cost intelligence assistant for an Indian catering business.

TASK: Analyze the event details, menu selection, and historical data to provide cost intelligence that will feed into a pricing calculation engine.

EVENT DETAILS:
- Event Type: ${eventType}
- Guest Count: ${guestCount}

SELECTED MENU ITEMS:
${menuList}

HISTORICAL ORDERS (similar events):
${historicalSummary}

CURRENT MENU PRICES (per unit):
${currentMenuPrices.map((m) => `- ${m.name}: ₹${m.pricePerUnit}/${m.unit}`).join('\n')}

Analyze the cost structure, historical pricing patterns, and risk factors for this event, then populate the response fields accordingly.`;
};

// Enforced JSON schema so Gemini can't drift from the shape your pricing engine expects
const responseSchema = {
  type: Type.OBJECT,
  properties: {
    costBreakdown: {
      type: Type.OBJECT,
      properties: {
        foodCostPerGuest: { type: Type.NUMBER },
        staffCostEstimate: { type: Type.NUMBER },
        overheadEstimate: { type: Type.NUMBER },
        rawMaterialMultiplier: { type: Type.NUMBER },
      },
      propertyOrdering: ['foodCostPerGuest', 'staffCostEstimate', 'overheadEstimate', 'rawMaterialMultiplier'],
    },
    insights: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    riskFactors: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    confidenceScore: { type: Type.NUMBER },
    suggestedPricePerGuest: {
      type: Type.OBJECT,
      properties: {
        min: { type: Type.NUMBER },
        optimal: { type: Type.NUMBER },
        premium: { type: Type.NUMBER },
      },
      propertyOrdering: ['min', 'optimal', 'premium'],
    },
    marginAnalysis: {
      type: Type.OBJECT,
      properties: {
        estimatedCostTotal: { type: Type.NUMBER },
        recommendedRevenueMin: { type: Type.NUMBER },
        recommendedRevenueOptimal: { type: Type.NUMBER },
        expectedMarginPercent: { type: Type.NUMBER },
      },
      propertyOrdering: [
        'estimatedCostTotal',
        'recommendedRevenueMin',
        'recommendedRevenueOptimal',
        'expectedMarginPercent',
      ],
    },
  },
  propertyOrdering: [
    'costBreakdown',
    'insights',
    'riskFactors',
    'confidenceScore',
    'suggestedPricePerGuest',
    'marginAnalysis',
  ],
};

/**
 * Call Gemini and parse the JSON response
 */
exports.getQuotationIntelligence = async (context) => {
  const prompt = buildPrompt(context);

  let result;
  try {
    result = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema,
      },
    });
  } catch (err) {
    // If the model itself is invalid/retired, this makes it obvious in logs
    // rather than surfacing as a generic parse failure downstream.
    console.error(`Gemini API call failed (model: ${MODEL_NAME}):`, err.message);
    throw new Error(`Quotation intelligence generation failed: ${err.message}`);
  }

  // .text is a getter, NOT a function, on @google/genai
  const text = result.text;

  if (!text) {
    throw new Error('Gemini returned an empty response');
  }

  // Safety net in case the schema constraint is ever bypassed (e.g. model fallback)
  const clean = text
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();

  try {
    return JSON.parse(clean);
  } catch (err) {
    console.error('Failed to parse Gemini JSON output:', clean);
    throw new Error('Gemini returned malformed JSON');
  }
};