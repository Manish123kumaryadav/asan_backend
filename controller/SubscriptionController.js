const SubscriptionPlan = require("../model/SubscriptionPlan");
const User = require("../model/User");
const { ensureUserIdentity, normalizeEmail, emailHash } = require("../utils/userIdentity");
const { Op } = require("sequelize");

function toPlan(row) {
  return {
    id: row.id,
    name: row.name,
    price: Number(row.price || 0),
    ads: Number(row.ads || 0),
    highlightDays: Number(row.highlight_days || 0),
    support: row.support || "",
  };
}

exports.plans = async (req, res) => {
  try {
    const rows = await SubscriptionPlan.findAll({ where: { is_active: true }, order: [["price", "ASC"]] });
    return res.json({ success: true, data: rows.map(toPlan) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.activate = async (req, res) => {
  try {
    const { planId } = req.body;
    const plan = await SubscriptionPlan.findByPk(planId);
    if (!plan) return res.status(404).json({ success: false, message: "Plan not found" });
    await User.update({ plan: plan.id, updated_at: new Date() }, { where: { id: req.user.id } });
    return res.json({ success: true, data: toPlan(plan) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.dashboard = async (req, res) => {
  try {
    const emailInput = req.query.email || req.body?.email;
    let user = null;

    if (emailInput) {
      const normalized = normalizeEmail(emailInput);
      const hash = emailHash(normalized);
      user = await User.findOne({
        where: {
          [Op.or]: [
            { email: normalized },
            { email: emailInput },
            { email_hash: hash }
          ]
        }
      });
    }

    if (!user && req.user?.id) {
      user = await User.findByPk(req.user.id);
    }

    if (!user && req.user?.guid) {
      user = await User.findOne({ where: { guid: req.user.guid } });
    }

    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    await ensureUserIdentity(user);
    const plan = user.plan
      ? await SubscriptionPlan.findByPk(user.plan)
      : null;

    return res.json({
      success: true,
      data: {
        id: user.id,
        guid: user.guid,
        name: user.name,
        email: user.email,
        email_hash: user.email_hash,
        mobile: user.mobile || user.phone,
        phone: user.phone || user.mobile,
        plan: user.plan || "free",
        plan_detail: plan ? toPlan(plan) : null,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
