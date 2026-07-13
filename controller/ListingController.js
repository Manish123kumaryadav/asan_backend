const Listing = require("../model/Listing");
const User = require("../model/User");
const ContactView = require("../model/ContactView");
const { Op } = require("sequelize");

const CONTACT_LIMITS = {
  free: 0,
  basic: 10,
  starter: 10,
  growth: 60,
  business: 120,
};

function maskUpi(upi) {
  if (!upi) return "hidden";
  const value = String(upi);
  const at = value.indexOf("@");
  return at > 1 ? `${value.slice(0, 2)}***${value.slice(at)}` : `${value.slice(0, 2)}***`;
}

function toListing(row) {
  return {
    id: String(row.id),
    title: row.title,
    category: row.category,
    mode: row.mode,
    condition: row.condition,
    price: Number(row.price || 0),
    rentUnit: row.rent_unit || undefined,
    location: row.location,
    availableFrom: row.available_from,
    availableTo: row.available_to || undefined,
    deliveryTime: row.delivery_time,
    returnPolicy: row.return_policy || "not-available",
    returnPolicyText: row.return_policy_text || "",
    description: row.description || "",
    sellerName: row.seller_name || "Aashanway seller",
    sellerRating: Number(row.seller_rating || 4.5),
    paymentUpiMasked: row.payment_upi_masked || "hidden",
    image: row.image_path || "",
    status: row.status === "active" ? "approved" : row.status,
    sellerId: String(row.seller_id),
    postedAt: row.created_at ? new Date(row.created_at).toLocaleString("en-IN") : "Just now",
  };
}

function listingPayload(body) {
  return {
    title: body.title,
    category: body.category,
    mode: body.mode || body.type || "old",
    condition: body.condition || "Good",
    price: body.price || body.rentalRate || 0,
    rent_unit: body.rentUnit || (body.mode === "rental" || body.type === "rental" ? "day" : null),
    location: body.location || "Not specified",
    available_from: body.availableFrom,
    available_to: body.availableTo,
    delivery_time: body.deliveryTime,
    return_policy: body.returnPolicy || "not-available",
    return_policy_text: body.returnPolicyText,
    description: body.description,
    payment_upi_masked: body.paymentUpiMasked || maskUpi(body.upi),
    payment_upi: body.upi || null,
    image_path: body.image,
    updated_at: new Date(),
  };
}

function canManage(req, listing) {
  return Number(req.user?.role_id) === 1 || String(listing.seller_id) === String(req.user?.id);
}

exports.list = async (req, res) => {
  try {
    const rows = await Listing.findAll({
      where: { status: { [Op.in]: ["active", "approved"] } },
      order: [["created_at", "DESC"]],
      limit: Number(req.query.limit || 100),
    });
    return res.json({ success: true, data: rows.map(toListing) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.create = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Login required" });

    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const body = req.body;
    if (!body.title || !body.category || !body.price || !body.image) {
      return res.status(400).json({ success: false, message: "Title, category, price and image are required" });
    }

    const row = await Listing.create({
      ...listingPayload(body),
      seller_id: userId,
      seller_name: user.name,
      seller_phone: user.phone || user.mobile,
      seller_rating: 4.5,
      status: "pending",
      created_at: new Date(),
    });

    await user.update({ active_ads: Number(user.active_ads || 0) + 1, updated_at: new Date() });
    return res.status(201).json({ success: true, data: toListing(row) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.manage = async (req, res) => {
  try {
    const where = Number(req.user?.role_id) === 1 ? {} : { seller_id: req.user.id };
    const rows = await Listing.findAll({ where, order: [["created_at", "DESC"]] });
    return res.json({ success: true, data: rows.map(toListing) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getById = async (req, res) => {
  try {
    const row = await Listing.findByPk(req.params.listingId);
    if (!row) return res.status(404).json({ success: false, message: "Listing not found" });
    return res.json({ success: true, data: toListing(row) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.update = async (req, res) => {
  try {
    const row = await Listing.findByPk(req.params.listingId);
    if (!row) return res.status(404).json({ success: false, message: "Listing not found" });
    if (!canManage(req, row)) return res.status(403).json({ success: false, message: "You cannot update this product" });
    const payload = listingPayload(req.body);
    Object.keys(payload).forEach((key) => payload[key] === undefined && delete payload[key]);
    if (Number(req.user.role_id) !== 1) payload.status = "pending";
    await row.update(payload);
    return res.json({ success: true, message: "Product updated successfully", data: toListing(row) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const row = await Listing.findByPk(req.params.listingId);
    if (!row) return res.status(404).json({ success: false, message: "Listing not found" });
    if (!canManage(req, row)) return res.status(403).json({ success: false, message: "You cannot delete this product" });
    await row.destroy();
    const user = await User.findByPk(row.seller_id);
    if (user) await user.update({ active_ads: Math.max(0, Number(user.active_ads || 0) - 1), updated_at: new Date() });
    return res.json({ success: true, message: "Product deleted successfully" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.review = async (req, res) => {
  try {
    if (Number(req.user?.role_id) !== 1) return res.status(403).json({ success: false, message: "Admin access required" });
    const status = req.body.status === "approved" ? "active" : req.body.status;
    if (!["active", "pending", "rejected"].includes(status)) return res.status(400).json({ success: false, message: "Invalid status" });
    const row = await Listing.findByPk(req.params.listingId);
    if (!row) return res.status(404).json({ success: false, message: "Listing not found" });
    await row.update({ status, updated_at: new Date() });
    return res.json({ success: true, message: `Product ${req.body.status}`, data: toListing(row) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.contact = async (req, res) => {
  try {
    const listing = await Listing.findByPk(req.params.listingId);
    if (!listing) return res.status(404).json({ success: false, message: "Listing not found" });

    const viewer = await User.findByPk(req.user.id);
    if (!viewer) return res.status(404).json({ success: false, message: "User not found" });

    const seller = await User.findByPk(listing.seller_id);
    const plan = viewer.plan || "free";
    const monthlyLimit = CONTACT_LIMITS[plan] ?? CONTACT_LIMITS.free;
    if (monthlyLimit <= 0) {
      return res.status(402).json({
        success: false,
        message: "Subscription required to view contact number or call seller",
      });
    }

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const existing = await ContactView.findOne({
      where: {
        viewer_id: req.user.id,
        listing_id: listing.id,
        created_at: { [Op.gte]: monthStart },
      },
    });
    const used = await ContactView.count({
      where: {
        viewer_id: req.user.id,
        created_at: { [Op.gte]: monthStart },
      },
    });

    if (!existing && used >= monthlyLimit) {
      return res.status(403).json({
        success: false,
        message: `Your ${plan} plan contact limit is finished for this month`,
      });
    }

    if (!existing) {
      await ContactView.create({
        viewer_id: req.user.id,
        seller_id: listing.seller_id,
        listing_id: listing.id,
        action: req.body?.action || "view",
        created_at: new Date(),
      });
    }

    const phone = listing.seller_phone || seller?.phone || seller?.mobile || "";
    return res.json({
      success: true,
      data: {
        phone,
        canCall: Boolean(phone && seller?.allow_calls !== false),
        remaining: Math.max(0, monthlyLimit - (existing ? used : used + 1)),
        monthlyLimit,
        plan,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.toListing = toListing;
