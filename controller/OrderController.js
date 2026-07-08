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
  };
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

    const created = [];
    for (const item of items) {
      const listing = await Listing.findByPk(item.listingId);
      if (!listing) continue;
      const quantity = Number(item.quantity || 1);
      const total = Number(listing.price || 0) * quantity + 19 + (Number(listing.price || 0) > 10000 ? 0 : 49);
      const status = "placed";
      const row = await Order.create({
        order_code: `ORD${Date.now()}${Math.floor(Math.random() * 1000)}`,
        user_id: req.user.id,
        listing_id: listing.id,
        quantity,
        total,
        status,
        eta: listing.mode && listing.mode.includes("rent") ? "Pickup today by 7:30 PM" : "Arriving in 2-3 days",
        tracking: buildTracking(listing, status),
        created_at: new Date(),
        updated_at: new Date(),
      });
      created.push(await toOrder(row));
    }

    await Notification.create({
      user_id: req.user.id,
      title: "Order placed",
      body: `${created.length} order live tracking ke liye ready hai.`,
      icon: "cube",
      is_read: false,
      created_at: new Date(),
    });

    return res.status(201).json({ success: true, data: { orders: created } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.track = async (req, res) => {
  try {
    const row = await Order.findOne({ where: { order_code: req.params.orderId, user_id: req.user.id } });
    if (!row) return res.status(404).json({ success: false, message: "Order not found" });
    return res.json({ success: true, data: await toOrder(row) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
