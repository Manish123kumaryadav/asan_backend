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
    postedAt: row.created_at ? new Date(row.created_at).toLocaleString("en-IN") : "Just now",
  };
}

exports.list = async (req, res) => {
  try {
    const rows = await Listing.findAll({
      where: { status: "active" },
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
      seller_id: userId,
      title: body.title,
      category: body.category,
      mode: body.mode,
      condition: body.condition,
      price: body.price,
      rent_unit: body.rentUnit,
      location: body.location,
      available_from: body.availableFrom,
      available_to: body.availableTo,
      delivery_time: body.deliveryTime,
      return_policy: body.returnPolicy,
      return_policy_text: body.returnPolicyText,
      description: body.description,
      seller_name: user.name,
      seller_phone: user.phone || user.mobile,
      seller_rating: 4.5,
      payment_upi_masked: body.paymentUpiMasked || maskUpi(body.upi),
     
      image_path: body.image,
      status: "active",
      created_at: new Date(),
      updated_at: new Date(),
    });

    await user.update({ active_ads: Number(user.active_ads || 0) + 1, updated_at: new Date() });
    return res.status(201).json({ success: true, data: toListing(row) });
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
