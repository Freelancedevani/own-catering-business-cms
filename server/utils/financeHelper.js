const Transaction = require('../models/Transaction');

/**
 * Auto-create a finance transaction linked to an order.
 * Silent/non-blocking — order ops must not fail due to finance errors.
 */
exports.autoCreateOrderTransaction = async ({
  flowType,
  category,
  amount,
  description,
  paymentMethod     = 'bank_transfer',
  paymentReference  = '',
  relatedOrder      = null,
  relatedClient     = null,
  relatedStaff      = null,
  relatedWithdrawal = null,
  createdBy,
  gstApplicable     = false,
  gstRate           = 0,
  tags              = [],
  status            = 'completed',
}) => {
  try {
    if (!amount || amount <= 0) {
      console.warn('[AutoFinance] Skipped — amount is 0 or missing');
      return null;
    }

    if (!createdBy) {
      console.error('[AutoFinance] Skipped — createdBy is missing (check req.user.id)');
      return null;
    }

    if (!flowType || !['income', 'expense'].includes(flowType)) {
      console.error('[AutoFinance] Skipped — invalid flowType:', flowType);
      return null;
    }

    const transaction = await Transaction.create({
      flowType,
      category,
      amount,
      description,
      paymentMethod,
      paymentReference,
      transactionDate:  new Date(),
      relatedOrder,
      relatedClient,
      relatedStaff,
      relatedWithdrawal,
      status,
      gstApplicable,
      gstRate,
      tags,
      createdBy,
    });

    return transaction;
  } catch (err) {
    console.error('[AutoFinance] Failed to create transaction:', err.message);
    return null;
  }
};
