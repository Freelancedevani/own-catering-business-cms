const Order      = require('../models/Order');
const MenuItem   = require('../models/MenuItem');
const catchAsync = require('../utils/catchAsync');
const AppError   = require('../utils/AppError');
const { getQuotationIntelligence } = require('../utils/geminiService');

// ── Calculation Engine ──────────────────────────────────────────
const calculatePriceRange = (guestCount, selectedItems, aiIntelligence) => {
  const { costBreakdown, suggestedPricePerGuest, marginAnalysis } = aiIntelligence;

  // Base food cost from selected menu items × guest count
  const baseFoodCost = selectedItems.reduce((sum, item) => sum + item.pricePerUnit, 0) * guestCount;

  // AI-adjusted cost using raw material multiplier
  const adjustedFoodCost = baseFoodCost * (costBreakdown.rawMaterialMultiplier || 0.4);
  const totalEstimatedCost =
    adjustedFoodCost +
    (costBreakdown.staffCostEstimate  || 0) +
    (costBreakdown.overheadEstimate   || 0);

  // Price range from AI suggestion × guest count
  const priceRange = {
    min:     Math.round(suggestedPricePerGuest.min     * guestCount),
    optimal: Math.round(suggestedPricePerGuest.optimal * guestCount),
    premium: Math.round(suggestedPricePerGuest.premium * guestCount),
  };

  // Per-guest breakdown
  const perGuest = {
    min:     Math.round(priceRange.min     / guestCount),
    optimal: Math.round(priceRange.optimal / guestCount),
    premium: Math.round(priceRange.premium / guestCount),
  };

  // Margin calculations
  const margins = {
    min:     Math.round(((priceRange.min     - totalEstimatedCost) / priceRange.min)     * 100),
    optimal: Math.round(((priceRange.optimal - totalEstimatedCost) / priceRange.optimal) * 100),
    premium: Math.round(((priceRange.premium - totalEstimatedCost) / priceRange.premium) * 100),
  };

  return {
    totalEstimatedCost: Math.round(totalEstimatedCost),
    costBreakdownCalc: {
      foodCost:  Math.round(adjustedFoodCost),
      staffCost: Math.round(costBreakdown.staffCostEstimate || 0),
      overhead:  Math.round(costBreakdown.overheadEstimate  || 0),
    },
    priceRange,
    perGuest,
    margins,
    recommendedPrice: priceRange.optimal,
  };
};

// ── POST /api/quotation/generate ────────────────────────────────
exports.generateQuotation = catchAsync(async (req, res, next) => {
  const { eventType, guestCount, menuItemIds } = req.body;

  if (!eventType || !guestCount || !menuItemIds?.length)
    return next(new AppError('eventType, guestCount and menuItemIds are required', 400));

  // 1. Fetch selected menu items (prefer active items; fall back to any matching items)
  const requestedIds = Array.isArray(menuItemIds) ? menuItemIds.map(String) : [];
  let selectedItems = await MenuItem.find({ _id: { $in: requestedIds }, isActive: true });
  let usedInactiveItems = false;
  if (!selectedItems.length) {
    const fallback = await MenuItem.find({ _id: { $in: requestedIds } });
    if (fallback.length) {
      // Use fallback items (they may be inactive) but mark that we did so
      selectedItems = fallback;
      usedInactiveItems = true;
    } else {
      // No matches at all — return which IDs were requested to aid debugging
      const msg = `No valid menu items found for requested IDs: ${requestedIds.join(', ')}`;
      return next(new AppError(msg, 400));
    }
  }

  // 2. Fetch historical orders of same event type (last 20 completed)
  const historicalOrders = await Order.find({
    eventType,
    status: 'completed',
  })
    .sort({ completedAt: -1 })
    .limit(20)
    .select('eventType guestCount totalAmount expenses items');

  const historicalData = historicalOrders.map((o) => ({
    eventType:     o.eventType,
    guestCount:    o.guestCount,
    totalAmount:   o.totalAmount,
    totalExpenses: o.expenses.reduce((s, e) => s + e.amount, 0),
    itemCount:     o.items.length,
  }));

  // 3. All active menu items for current price context
  const allMenuItems = await MenuItem.find({ isActive: true }).select('name category pricePerUnit unit');

  // 4. Call Gemini
  const aiIntelligence = await getQuotationIntelligence({
    eventType,
    guestCount,
    menuItems:         selectedItems,
    historicalData,
    currentMenuPrices: allMenuItems,
  });

  // 5. Run calculation engine
  const calculation = calculatePriceRange(guestCount, selectedItems, aiIntelligence);

  const matchedIds = selectedItems.map((i) => String(i._id));
  const missingIds = requestedIds.filter((id) => !matchedIds.includes(String(id)));

  const responseData = {
    input: { eventType, guestCount, selectedItems, requestedIds, matchedIds, missingIds },
    aiIntelligence,
    calculation,
    historicalOrdersUsed: historicalData.length,
  };

  if (usedInactiveItems) responseData.warning = 'Some requested menu items are inactive; using matching items for quotation.';

  res.status(200).json({ success: true, data: responseData });
});
