import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { FiZap, FiRefreshCw, FiCheckSquare, FiSquare } from 'react-icons/fi';
import { fetchMenuItems } from '../../features/menu/menuSlice';
import { generateQuotation, clearQuotation } from '../../features/quotation/quotationSlice';
import Loader from '../../components/ui/Loader';

const EVENT_TYPES = [
  'wedding','reception','engagement','birthday','anniversary',
  'riceceremony','corporate','conference','product_launch',
  'social_gathering','baby_shower','griho_prabesh','puja','funeral','other',
];

const CATEGORY_COLORS = {
  starter:    'bg-yellow-50 border-yellow-200 text-yellow-700',
  maincourse: 'bg-red-50 border-red-200 text-red-700',
  dessert:    'bg-pink-50 border-pink-200 text-pink-700',
};

const fmt = (n) => Number(n || 0).toLocaleString('en-IN');

export default function QuotationPage() {
  const dispatch = useDispatch();
  const { items: menuItems, loading: menuLoading } = useSelector((s) => s.menu);
  const { result, loading, error } = useSelector((s) => s.quotation);

  const [eventType,    setEventType]    = useState('wedding');
  const [guestCount,   setGuestCount]   = useState(100);
  const [selectedIds,  setSelectedIds]  = useState([]);

  useEffect(() => { dispatch(fetchMenuItems()); }, [dispatch]);

  const toggleItem = (id) =>
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const handleGenerate = () => {
    if (!selectedIds.length) return;
    dispatch(generateQuotation({ eventType, guestCount: Number(guestCount), menuItemIds: selectedIds }));
  };

  const handleReset = () => { dispatch(clearQuotation()); setSelectedIds([]); };

  // Group menu items by category
  const grouped = menuItems.reduce((acc, item) => {
    const cat = item.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <FiZap className="text-brand" size={20} /> AI Quotation Generator
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Gemini analyses your menu, guest count & historical data to generate a realistic price range
          </p>
        </div>
        {result && (
          <button onClick={handleReset} className="btn-secondary flex items-center gap-2 self-start">
            <FiRefreshCw size={14} /> New Quotation
          </button>
        )}
      </div>

      {!result ? (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

          {/* ── Left: Inputs ── */}
          <div className="xl:col-span-1 space-y-4">

            {/* Event Type */}
            <div className="card space-y-3">
              <h2 className="text-sm font-semibold text-gray-700">Event Details</h2>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Event Type</label>
                <select value={eventType} onChange={(e) => setEventType(e.target.value)}
                  className="input-field w-full capitalize">
                  {EVENT_TYPES.map((e) => (
                    <option key={e} value={e}>{e.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Guest Count</label>
                <input type="number" min="1" value={guestCount}
                  onChange={(e) => setGuestCount(e.target.value)}
                  className="input-field w-full" placeholder="e.g. 200" />
              </div>
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={loading || !selectedIds.length}
              className="btn-primary w-full flex items-center justify-center gap-2 py-3">
              {loading ? (
                <><span className="animate-spin">⚙️</span> Analysing with Gemini...</>
              ) : (
                <><FiZap size={16} /> Generate Quotation ({selectedIds.length} items)</>
              )}
            </button>

            {!selectedIds.length && (
              <p className="text-xs text-center text-gray-400">Select at least one menu item →</p>
            )}
          </div>

          {/* ── Right: Menu Selection ── */}
          <div className="xl:col-span-2 card space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700">Select Menu Items</h2>
              <span className="text-xs text-gray-400">{selectedIds.length} selected</span>
            </div>

            {menuLoading ? <Loader /> : (
              <div className="space-y-4">
                {Object.entries(grouped).map(([cat, items]) => (
                  <div key={cat}>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 capitalize">
                      {cat}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {items.map((item) => {
                        const selected = selectedIds.includes(item._id);
                        return (
                          <button key={item._id} type="button"
                            onClick={() => toggleItem(item._id)}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all
                              ${selected
                                ? 'border-brand bg-brand/5 text-brand'
                                : `border ${CATEGORY_COLORS[cat] || 'border-gray-100 bg-gray-50 text-gray-700'} hover:border-brand/40`
                              }`}>
                            {selected ? <FiCheckSquare size={15} /> : <FiSquare size={15} className="text-gray-300" />}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{item.name}</p>
                              <p className="text-xs text-gray-400">₹{fmt(item.pricePerUnit)}/{item.unit}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (

        /* ── RESULT ── */
        <div className="space-y-5">

          {/* Input Summary */}
          <div className="card bg-brand/5 border border-brand/20 flex flex-wrap gap-4 items-center">
            <div className="text-sm">
              <span className="text-gray-500">Event:</span>{' '}
              <span className="font-semibold capitalize text-gray-800">{result.input.eventType.replace(/_/g, ' ')}</span>
            </div>
            <div className="text-sm">
              <span className="text-gray-500">Guests:</span>{' '}
              <span className="font-semibold text-gray-800">{fmt(result.input.guestCount)}</span>
            </div>
            <div className="text-sm">
              <span className="text-gray-500">Menu Items:</span>{' '}
              <span className="font-semibold text-gray-800">{result.input.selectedItems.length}</span>
            </div>
            <div className="text-sm">
              <span className="text-gray-500">Historical Orders Used:</span>{' '}
              <span className="font-semibold text-gray-800">{result.historicalOrdersUsed}</span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-gray-400">AI Confidence:</span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                result.aiIntelligence.confidenceScore >= 70 ? 'bg-green-100 text-green-700' :
                result.aiIntelligence.confidenceScore >= 40 ? 'bg-yellow-100 text-yellow-700' :
                'bg-red-100 text-red-700'
              }`}>
                {result.aiIntelligence.confidenceScore}%
              </span>
            </div>
          </div>

          {/* Price Range — Hero */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Minimum',  key: 'min',     color: 'border-gray-200 bg-gray-50',          text: 'text-gray-700',  badge: 'bg-gray-100 text-gray-600'   },
              { label: 'Optimal',  key: 'optimal', color: 'border-brand/30 bg-brand/5 shadow-sm', text: 'text-brand',     badge: 'bg-brand/10 text-brand'      },
              { label: 'Premium',  key: 'premium', color: 'border-purple-200 bg-purple-50',       text: 'text-purple-700',badge: 'bg-purple-100 text-purple-700'},
            ].map(({ label, key, color, text, badge }) => (
              <div key={key} className={`card border-2 ${color} text-center space-y-1`}>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badge}`}>{label}</span>
                <p className={`text-3xl font-bold ${text}`}>₹{fmt(result.calculation.priceRange[key])}</p>
                <p className="text-xs text-gray-400">₹{fmt(result.calculation.perGuest[key])}/guest</p>
                <p className="text-xs font-medium text-green-600">{result.calculation.margins[key]}% margin</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

            {/* Cost Breakdown */}
            <div className="card space-y-3">
              <h2 className="text-sm font-semibold text-gray-700">💰 Estimated Cost Breakdown</h2>
              {[
                { label: 'Food Cost',       value: result.calculation.costBreakdownCalc.foodCost,  color: 'bg-orange-400' },
                { label: 'Staff Cost',      value: result.calculation.costBreakdownCalc.staffCost, color: 'bg-blue-400'   },
                { label: 'Overhead',        value: result.calculation.costBreakdownCalc.overhead,  color: 'bg-gray-400'   },
              ].map(({ label, value, color }) => {
                const pct = result.calculation.totalEstimatedCost > 0
                  ? Math.round((value / result.calculation.totalEstimatedCost) * 100) : 0;
                return (
                  <div key={label}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">{label}</span>
                      <span className="font-semibold text-gray-800">₹{fmt(value)} <span className="text-xs text-gray-400">({pct}%)</span></span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full">
                      <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
              <div className="border-t border-gray-100 pt-2 flex justify-between text-sm font-bold">
                <span className="text-gray-700">Total Estimated Cost</span>
                <span className="text-red-600">₹{fmt(result.calculation.totalEstimatedCost)}</span>
              </div>
            </div>

            {/* AI Insights */}
            <div className="card space-y-3">
              <h2 className="text-sm font-semibold text-gray-700">🤖 Gemini Insights</h2>
              <div className="space-y-2">
                {result.aiIntelligence.insights.map((insight, i) => (
                  <div key={i} className="flex gap-2 text-sm text-gray-600">
                    <span className="text-brand mt-0.5 shrink-0">✦</span>
                    <p>{insight}</p>
                  </div>
                ))}
              </div>
              {result.aiIntelligence.riskFactors?.length > 0 && (
                <div className="border-t border-gray-100 pt-3 space-y-2">
                  <p className="text-xs font-semibold text-orange-600">⚠️ Risk Factors</p>
                  {result.aiIntelligence.riskFactors.map((r, i) => (
                    <div key={i} className="flex gap-2 text-xs text-gray-500">
                      <span className="text-orange-400 shrink-0">•</span>
                      <p>{r}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Margin Analysis */}
          <div className="card">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">📊 Margin Analysis</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Est. Total Cost',     value: `₹${fmt(result.aiIntelligence.marginAnalysis.estimatedCostTotal)}`,      color: 'text-red-600'   },
                { label: 'Min Revenue',         value: `₹${fmt(result.aiIntelligence.marginAnalysis.recommendedRevenueMin)}`,    color: 'text-gray-700'  },
                { label: 'Optimal Revenue',     value: `₹${fmt(result.aiIntelligence.marginAnalysis.recommendedRevenueOptimal)}`,color: 'text-brand'     },
                { label: 'Expected Margin',     value: `${result.aiIntelligence.marginAnalysis.expectedMarginPercent}%`,         color: 'text-green-600' },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-400 mb-1">{label}</p>
                  <p className={`text-lg font-bold ${color}`}>{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Selected Menu */}
          <div className="card">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">🍽️ Selected Menu Items</h2>
            <div className="flex flex-wrap gap-2">
              {result.input.selectedItems.map((item) => (
                <span key={item._id}
                  className="text-xs bg-gray-100 text-gray-700 px-3 py-1.5 rounded-full font-medium">
                  {item.name} — ₹{fmt(item.pricePerUnit)}/{item.unit}
                </span>
              ))}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
