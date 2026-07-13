const crypto = require("crypto");
const User = require("../model/User");
const TransactionHistory = require("../model/TransactionHistory");
const { quoteItems, createOrdersForItems } = require("./OrderController");

function credentials() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_API_KEY;
  if (!keyId || !keySecret) { const error = new Error("Razorpay credentials are not configured"); error.status = 503; throw error; }
  return { keyId, keySecret };
}

async function razorpayRequest(path, options = {}) {
  const { keyId, keySecret } = credentials();
  const response = await fetch(`https://api.razorpay.com/v1${path}`, { ...options, headers: { Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`, "Content-Type": "application/json", ...options.headers }, body: options.body && typeof options.body !== "string" ? JSON.stringify(options.body) : options.body });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error(data.error?.description || "Razorpay request failed"); error.status = response.status; throw error; }
  return data;
}

exports.createRazorpayOrder = async (req, res) => {
  try {
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    const quoted = await quoteItems(items);
    if (!quoted.length || quoted.length !== items.length) return res.status(400).json({ success: false, message: "Cart contains an unavailable product" });
    const total = quoted.reduce((sum, item) => sum + item.total, 0);
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    const receipt = `AASH${Date.now()}`.slice(0, 40);
    const razorpayOrder = await razorpayRequest("/orders", { method: "POST", body: { amount: Math.round(total * 100), currency: "INR", receipt, notes: { user_id: String(user.id), item_count: String(items.length) } } });
    const transactionId = crypto.randomBytes(16).toString("hex");
    await TransactionHistory.create({ transaction_id: transactionId, trans_guid: transactionId, user_id: user.id, user_guid: user.guid, user_email_hash: user.email_hash || "unknown", user_name: user.name, amount: total, currency: "INR", status: "pending", provider: "razorpay", provider_order_id: razorpayOrder.id, payment_method: "razorpay", upi_intent: JSON.stringify({ items, deliveryAddress: req.body.deliveryAddress || "" }), created_at: new Date(), updated_at: new Date() });
    const { keyId } = credentials();
    return res.status(201).json({ success: true, data: { keyId, orderId: razorpayOrder.id, amount: razorpayOrder.amount, currency: razorpayOrder.currency, receipt, total } });
  } catch (error) { return res.status(error.status || 500).json({ success: false, message: error.message }); }
};

exports.verify = async (req, res) => {
  try {
    const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body;
    if (!orderId || !paymentId || !signature) return res.status(400).json({ success: false, message: "Complete Razorpay payment response is required" });
    const transaction = await TransactionHistory.findOne({ where: { provider_order_id: orderId, user_id: req.user.id, provider: "razorpay" } });
    if (!transaction) return res.status(404).json({ success: false, message: "Payment transaction not found" });
    if (transaction.status === "success") return res.json({ success: true, message: "Payment already verified", data: { verified: true, orders: [] } });
    const { keySecret } = credentials();
    const expected = crypto.createHmac("sha256", keySecret).update(`${transaction.provider_order_id}|${paymentId}`).digest("hex");
    const validSignature = expected.length === signature.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    if (!validSignature) { await transaction.update({ status: "failed", updated_at: new Date() }); return res.status(400).json({ success: false, message: "Invalid payment signature" }); }
    const payment = await razorpayRequest(`/payments/${encodeURIComponent(paymentId)}`);
    if (payment.order_id !== transaction.provider_order_id || payment.status !== "captured" || Number(payment.amount) !== Math.round(Number(transaction.amount) * 100)) return res.status(400).json({ success: false, message: "Payment is not captured or amount does not match" });
    const cart = JSON.parse(transaction.upi_intent || "{}");
    const orders = await createOrdersForItems({ userId: req.user.id, items: cart.items || [], paymentMethod: "razorpay", deliveryAddress: cart.deliveryAddress || "", paymentReference: orderId });
    await transaction.update({ status: "success", provider_payment_id: paymentId, provider_signature: signature, updated_at: new Date() });
    return res.json({ success: true, message: "Payment verified and order placed", data: { verified: true, orders } });
  } catch (error) { return res.status(error.status || 500).json({ success: false, message: error.message }); }
};

exports.createUpiIntent = (_req, res) => res.status(410).json({ success: false, message: "Use Razorpay Checkout for payments" });
