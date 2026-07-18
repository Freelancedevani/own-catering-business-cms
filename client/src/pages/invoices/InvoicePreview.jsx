import React, { useRef, useCallback } from 'react';
import { useReactToPrint } from 'react-to-print';
import dayjs from 'dayjs';
import { FiPrinter, FiShare2, FiRefreshCw } from 'react-icons/fi';
import Badge from '../../components/ui/Badge';
import Logo from '../../assets/logo.png';

const STATUS_COLORS = {
  paid: 'green',
  partial: 'yellow',
  unpaid: 'red',
  refunded: 'gray',
};

const formatINR = (value = 0) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);

export default function InvoicePreview({ invoice, onSync, onClose }) {
  const printRef = useRef(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Invoice-${invoice?.invoiceNumber || 'Preview'}`,
    suppressErrors: false,
    onPrintError: (location, error) => {
      console.error('Print error:', location, error);
    },
  });

  const handleShare = async () => {
    const text = `Invoice ${invoice.invoiceNumber}
Client: ${invoice.client?.name || '-'}
Amount: ${formatINR(invoice.totalAmount)}
Balance: ${formatINR(invoice.balanceAmount)}
Due: ${dayjs(invoice.dueDate).format('DD MMM YYYY')}`;

    if (navigator.share) {
      await navigator.share({ title: `Invoice ${invoice.invoiceNumber}`, text });
    } else {
      await navigator.clipboard.writeText(text);
      alert('Invoice details copied to clipboard!');
    }
  };

  const c = invoice.client || {};
  const co = invoice.companyInfo || {};

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center overflow-y-auto py-6 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-800">Invoice Preview</h2>
          <div className="flex gap-2">
            {onSync && (
              <button onClick={onSync} className="btn-secondary flex items-center gap-1 text-sm">
                <FiRefreshCw size={14} /> Sync
              </button>
            )}
            <button onClick={handleShare} className="btn-secondary flex items-center gap-1 text-sm">
              <FiShare2 size={14} /> Share
            </button>
            <button onClick={handlePrint} className="btn-primary flex items-center gap-1 text-sm">
              <FiPrinter size={14} /> Print / PDF
            </button>
            {onClose && (
              <button onClick={onClose} className="btn-danger text-sm px-3">✕</button>
            )}
          </div>
        </div>

        <div ref={printRef} className="p-8 text-gray-800 print:p-6 print:bg-white">
          <div className="flex justify-between items-start mb-8">
            <div>
              <img src={Logo} alt="Logo" className="w-32 h-32 object-contain" />
              {co.address && <p className="text-sm text-gray-500">{co.address}</p>}
              {co.phone && <p className="text-sm text-gray-500">📞 {co.phone}</p>}
              {co.email && <p className="text-sm text-gray-500">✉ {co.email}</p>}
              {co.gstin && <p className="text-sm text-gray-500">GSTIN: {co.gstin}</p>}
            </div>

            <div className="text-right">
              <p className="text-3xl font-extrabold text-indigo-600">INVOICE</p>
              <p className="text-sm font-semibold mt-1"># {invoice.invoiceNumber}</p>
              <p className="text-xs text-gray-500">
                Date: {dayjs(invoice.createdAt).format('DD MMM YYYY')}
              </p>
              <p className="text-xs text-gray-500">
                Due: {dayjs(invoice.dueDate).format('DD MMM YYYY')}
              </p>
              <div className="mt-2">
                <Badge
                  color={STATUS_COLORS[invoice.paymentStatus] || 'gray'}
                  label={(invoice.paymentStatus || 'unknown').toUpperCase()}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-8">
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Bill To</p>
              <p className="font-semibold">{c.name || '-'}</p>
              {c.phone && <p className="text-sm text-gray-600">{c.phone}</p>}
              {c.email && <p className="text-sm text-gray-600">{c.email}</p>}
              {c.address && <p className="text-sm text-gray-600">{c.address}</p>}
            </div>

            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Event Details</p>
              <p className="text-sm capitalize">
                <span className="font-medium">Type:</span> {invoice.eventType || '-'}
              </p>
              <p className="text-sm">
                <span className="font-medium">Date:</span>{' '}
                {invoice.eventDate ? dayjs(invoice.eventDate).format('DD MMM YYYY') : '-'}
              </p>
              {invoice.venue?.name && (
                <p className="text-sm">
                  <span className="font-medium">Venue:</span> {invoice.venue.name}
                </p>
              )}
              {invoice.venue?.city && <p className="text-sm">{invoice.venue.city}</p>}
              <p className="text-sm">
                <span className="font-medium">Guests:</span> {invoice.guestCount || '-'}
              </p>
            </div>
          </div>

          <table className="w-full text-sm mb-6 border-collapse">
            <thead>
              <tr className="bg-indigo-600 text-white">
                <th className="text-left px-4 py-2 rounded-tl-lg">Item</th>
                <th className="text-center px-4 py-2">Qty</th>
                <th className="text-center px-4 py-2">Unit</th>
                <th className="text-right px-4 py-2">Unit Price</th>
                <th className="text-right px-4 py-2 rounded-tr-lg">Total</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items?.map((item, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-4 py-2">
                    <p className="font-medium">{item.name}</p>
                    {item.description && (
                      <p className="text-xs text-gray-400">{item.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-2 text-center">{item.quantity}</td>
                  <td className="px-4 py-2 text-center">{item.unit}</td>
                  <td className="px-4 py-2 text-right">
                    {formatINR(item.unitPrice || item.price || 0)}
                  </td>
                  <td className="px-4 py-2 text-right font-medium">
                    {formatINR(item.total || item.totalPrice || 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end mb-6">
            <div className="w-72 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Subtotal</span>
                <span>{formatINR(invoice.subtotal)}</span>
              </div>

              {Number(invoice.discountAmount || 0) > 0 && (
                <div className="flex justify-between text-red-500">
                  <span>
                    Discount (
                    {invoice.discountType === 'percentage'
                      ? `${invoice.discountValue}%`
                      : 'Fixed'}
                    )
                  </span>
                  <span>- {formatINR(invoice.discountAmount)}</span>
                </div>
              )}

              {Number(invoice.taxAmount || 0) > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Tax ({invoice.taxRate}%)</span>
                  <span>{formatINR(invoice.taxAmount)}</span>
                </div>
              )}

              {Number(invoice.deliveryCharge || 0) > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Delivery</span>
                  <span>{formatINR(invoice.deliveryCharge)}</span>
                </div>
              )}

              <div className="flex justify-between font-bold text-base border-t pt-2 mt-2">
                <span>Total Amount</span>
                <span>{formatINR(invoice.totalAmount)}</span>
              </div>

              <div className="flex justify-between text-green-600">
                <span>Amount Paid</span>
                <span>{formatINR(invoice.paidAmount)}</span>
              </div>

              <div className="flex justify-between font-bold text-red-600 text-base">
                <span>Balance Due</span>
                <span>{formatINR(invoice.balanceAmount)}</span>
              </div>
            </div>
          </div>

          {invoice.payments?.length > 0 && (
            <div className="mb-6">
              <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Payment History</p>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-100 text-gray-600">
                    <th className="text-left px-3 py-2">Date</th>
                    <th className="text-left px-3 py-2">Method</th>
                    <th className="text-left px-3 py-2">Reference</th>
                    <th className="text-right px-3 py-2">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.payments.map((p, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-3 py-1">{dayjs(p.paidAt).format('DD MMM YYYY')}</td>
                      <td className="px-3 py-1 capitalize">
                        {p.paymentMethod?.replace(/_/g, ' ')}
                      </td>
                      <td className="px-3 py-1 text-gray-500">{p.paymentReference || '—'}</td>
                      <td className="px-3 py-1 text-right font-medium text-green-600">
                        {formatINR(p.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {invoice.notes && (
            <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600">
              <p className="font-semibold text-gray-700 mb-1">Notes</p>
              <p>{invoice.notes}</p>
            </div>
          )}

          <p className="text-center text-xs text-gray-400 mt-8">
            Thank you for your business! — {co.name || 'Suborno Event Organizer'}
          </p>
        </div>
      </div>
    </div>
  );
}