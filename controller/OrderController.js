const Listing = require("../model/Listing");
const Order = require("../model/Order");
const Notification = require("../model/Notification");
const { toListing } = require("./ListingController");

const statuses = ["placed", "confirmed", "packed", "shipped", "out-for-delivery", "delivered"];

function buildTracking(listing, status = "placed") {
  const activeIndex = statuses.indexOf(status);
  return statuses.map((key, index) => ({
    key,
    title: {
      placed: "Order placed",
      confirmed: "Seller confirmed",
      packed: listing.mode && listing.mode.includes("rent") ? "Pickup prepared" : "Packed",
      shipped: listing.mode && listing.mode.includes("rent") ? "Pickup partner assigned" : "Shipped",
      "out-for-delivery": "Out for delivery",
      delivered: listing.mode && listing.mode.includes("rent") ? "Handover completed" : "Delivered",
    }[key],
    description: index <= activeIndex ? "Updated by Aashanway order system." : "Waiting for next update.",
    time: index <= activeIndex ? "Updated now" : "Pending",
  }));
}

async function toOrder(row) {
  const listing = await Listing.findByPk(row.listing_id);
  return {
    id: row.order_code || String(row.id),
    listing: listing ? toListing(listing) : null,
    quantity: Number(row.quantity || 1),
    total: Number(row.total || 0),
    status: row.status,
    eta: row.eta,
    createdAt: row.created_at ? new Date(row.created_at).toLocaleString("en-IN") : "Now",
    tracking: row.tracking || (listing ? buildTracking(listing, row.status) : []),
    paymentMethod: row.payment_method || "cod",
    deliveryAddress: row.delivery_address || "",
  };
}

async function quoteItems(items) {
  const quoted = [];
  for (const item of items) {
    const listing = await Listing.findByPk(item.listingId);
    if (!listing || !["active", "approved"].includes(listing.status)) continue;
    const quantity = Math.max(1, Math.min(10, Number(item.quantity || 1)));
    const unitPrice = Number(listing.price || 0);
    const platformFee = 19;
    const deliveryFee = unitPrice > 10000 ? 0 : 49;
    quoted.push({ listing, quantity, unitPrice, platformFee, deliveryFee, total: unitPrice * quantity + platformFee + deliveryFee });
  }
  return quoted;
}

async function createOrdersForItems({ userId, items, paymentMethod = "cod", deliveryAddress = "", paymentReference = "" }) {
  const quoted = await quoteItems(items);
  const created = [];
  const reference = String(paymentReference || Date.now()).replace(/[^a-zA-Z0-9]/g, "").slice(-12).toUpperCase();
  for (let index = 0; index < quoted.length; index += 1) {
    const item = quoted[index];
    const orderCode = `ORD${reference}${index + 1}`;
    let row = await Order.findOne({ where: { order_code: orderCode, user_id: userId } });
    if (!row) row = await Order.create({ order_code: orderCode, user_id: userId, listing_id: item.listing.id, quantity: item.quantity, total: item.total, status: "placed", eta: item.listing.mode && item.listing.mode.includes("rent") ? "Pickup today by 7:30 PM" : "Arriving in 2-3 days", tracking: buildTracking(item.listing, "placed"), payment_method: paymentMethod, fulfillment_mode: "delivery", delivery_address: deliveryAddress, created_at: new Date(), updated_at: new Date() });
    created.push(await toOrder(row));
  }
  if (created.length) await Notification.create({ user_id: userId, title: "Order placed", body: `${created.length} order live tracking ke liye ready hai.`, icon: "cube", is_read: false, created_at: new Date() });
  return created;
}

exports.list = async (req, res) => {
  try {
    const rows = await Order.findAll({ where: { user_id: req.user.id }, order: [["created_at", "DESC"]] });
    const data = await Promise.all(rows.map(toOrder));
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.create = async (req, res) => {
  try {
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    if (!items.length) return res.status(400).json({ success: false, message: "Cart items are required" });

    const created = await createOrdersForItems({ userId: req.user.id, items, paymentMethod: "cod", deliveryAddress: req.body.deliveryAddress || "" });

    return res.status(201).json({ success: true, data: { orders: created } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.quoteItems = quoteItems;
exports.createOrdersForItems = createOrdersForItems;

exports.track = async (req, res) => {
  try {
    const row = await Order.findOne({ where: { order_code: req.params.orderId, user_id: req.user.id } });
    if (!row) return res.status(404).json({ success: false, message: "Order not found" });
    return res.json({ success: true, data: await toOrder(row) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
