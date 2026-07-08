const SubscriptionPlan = require("../model/SubscriptionPlan");
const User = require("../model/User");

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
