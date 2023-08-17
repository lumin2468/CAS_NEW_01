app.get('/api/report', async (req, res) => {
    try {
      const schemeId = req.query.schemeId;
  
      // Fetch Opening Balance
      const openingBalance = await OpeningBalance.findOne({ scheme: schemeId });
  
      // Fetch Payments
      const paymentPipeline = [
        { $match: { scheme: mongoose.Types.ObjectId(schemeId) } },
        // ... (other match criteria or stages if needed)
        {
          $group: {
            _id: null,
            totalCashPayment: { $sum: '$cashPaymentField' },
            totalBankPayment: { $sum: '$bankPaymentField' },
          },
        },
      ];
      const payments = await Payment.aggregate(paymentPipeline);
  
      // Fetch Receipts
      const receiptPipeline = [
        { $match: { scheme: mongoose.Types.ObjectId(schemeId) } },
        // ... (other match criteria or stages if needed)
        {
          $group: {
            _id: null,
            totalCashReceipt: { $sum: '$cashReceiptField' },
            totalBankReceipt: { $sum: '$bankReceiptField' },
          },
        },
      ];
      const receipts = await Receipt.aggregate(receiptPipeline);
  
      // Fetch Advances
      const advancePipeline = [
        { $match: { scheme: mongoose.Types.ObjectId(schemeId) } },
        // ... (other match criteria or stages if needed)
        {
          $group: {
            _id: null,
            totalAdvance: { $sum: '$advanceField' },
          },
        },
      ];
      const advances = await Advance.aggregate(advancePipeline);
  
      res.json({
        openingBalance,
        payments: payments[0] || {},
        receipts: receipts[0] || {},
        advances: advances[0] || {},
      });
    } catch (error) {
      console.error('Error fetching data:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });
  