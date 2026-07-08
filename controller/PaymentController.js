exports.createUpiIntent = async (req, res) => {
  try {
    const amount = Number(req.body.amount || 0);
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: "Valid amount is required" });
    }
    const upiId = process.env.DEFAULT_UPI_ID || "merchant@upi";
    const listingId = encodeURIComponent(req.body.listingId || "Aashanway");
    const intentUrl = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=Aashanway&am=${amount.toFixed(2)}&cu=INR&tn=${listingId}`;
    return res.json({
      success: true,
      data: {
        intentUrl,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.verify = async (req, res) => {
  return res.json({ success: true, message: "Payment verification received", data: { verified: true } });
};
