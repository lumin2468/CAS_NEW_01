
const { consolidatedSchema } = require("../models/master");
const _ = require("lodash");
const mongoose = require("mongoose");
const {
    District,
    Advance,
    Adjustment,
    DirOpeningBalance,
    DirPayment,
    DisPayment,
    DirReceipt,
    DisReceipt,
    OpeningBalance,
    Scheme

    
  } = consolidatedSchema;

const calculateDirMiddleware = async (req, res, next) => {
    
        const directorObDetails = await DirOpeningBalance.find({
          directorate: req.user.directorate,
        }).populate("bank")
        .populate("scheme")
    
        const dirTotalCash = _.sumBy(directorObDetails, 'cash');
        const dirTotalBankBalance = _.sumBy(directorObDetails, (entry) => entry.bank.balance);
        
    
          console.log(`DIRECTOR OPENING BALANCE`,dirTotalCash, dirTotalBankBalance);
    
          async function calculateDirectorateOpeningBalance(directorateId) {
            const currentDate = new Date();
          let transactionDetails={};
            // Calculate total receipts for the directorate
            const dirTotalReceipts = await DirReceipt.aggregate([
              {
                $match: {
                  directorate: new mongoose.Types.ObjectId(directorateId),
                  date: {
                    $gte: new Date(currentDate.getFullYear(), 3, 1), // Start of the financial year (April 1st)
                    $lte: currentDate,
                  },
                },
              },
              {
                $group: {
                  _id: null,
                  totalReceiptAmount: { $sum: '$amount' },
                },
              },
            ]);
          
            // Calculate total payments for the directorate
            const dirTotalPayments = await DirPayment.aggregate([
              {
                $match: {
                  directorate: new mongoose.Types.ObjectId(directorateId),
                  date: {
                    $gte: new Date(currentDate.getFullYear(), 3, 1), // Start of the financial year (April 1st)
                    $lte: currentDate,
                  },
                },
              },
              {
                $group: {
                  _id: null,
                  totalPaymentAmount: { $sum: '$amount' },
                },
              },
            ]);
          
            // Calculate the current opening balance
           transactionDetails.totalPayment=dirTotalPayments[0].totalPaymentAmount
           transactionDetails.totalReceipt=dirTotalReceipts[0].totalReceiptAmount
          
            return transactionDetails;
          }
      const dirTransactionDetails= await calculateDirectorateOpeningBalance(req.user.directorate)
      console.log(`Transaction Details`,dirTransactionDetails)
    
    
        // --------------------District Details------------------------
    
        const obDetails = await OpeningBalance.find({
          directorate: req.user.directorate,
        }).populate("bank")
        
    
        async function calculateDistrictOpeningBalance(districtId, initialOB) {
          const currentDate = new Date();
        
          const pipeline = [
            {
              $match: {
                office_name: new mongoose.Types.ObjectId(districtId),
                date: {
                  $gte: new Date(currentDate.getFullYear(), 3, 1), // Start of the financial year (April 1st)
                  $lte: currentDate,
                },
              },
            },
            {
              $group: {
                _id: null,
                totalReceiptAmount: { $sum: "$amount" },
              },
            },
          ];
    
          const totalReceiptResult = await DisReceipt.aggregate(pipeline);
    
          const totalReceipt = totalReceiptResult[0]?.totalReceiptAmount || 0;
    
          const paymentPipeline = [
            {
              $match: {
                office_name: new mongoose.Types.ObjectId(districtId),
                date: {
                  $gte: new Date(currentDate.getFullYear(), 3, 1), // Start of the financial year (April 1st)
                  $lte: currentDate,
                },
              },
            },
            {
              $group: {
                _id: null,
                totalPaymentAmount: { $sum: "$amount" },
              },
            },
          ];
    
          const totalPaymentResult = await DisPayment.aggregate(paymentPipeline);
    
          const totalPayment = totalPaymentResult[0]?.totalPaymentAmount || 0;
          // console.log(`Total payment/Total Receipts`, totalPayment, totalReceipt);
          // Get the initial bank balance from initialOB
          const currentOpeningBalance = initialOB + totalReceipt - totalPayment;
    
          return {currentOpeningBalance,totalPayment,totalReceipt} ;
        }
    
        const districtBalances = _.chain(obDetails)
          .groupBy("office")
          .mapValues((districtEntries) => ({
            cashBalance: _.sumBy(districtEntries, "cash"),
            bankBalance: _.sumBy(districtEntries, "bank.balance"),
          }))
          .value();
    
        const districtIds = Object.keys(districtBalances);
        // console.log(`DISTRICT IDS`, districtIds);
        
        
        async function calculateTotalAdvances(districtId) {
          const advances = await Advance.find({ office: districtId });
          
          const totalAdvanceAmount = advances.reduce((total, advance) => total + advance.amount, 0);
          
          return totalAdvanceAmount;
        }
        // Create a function to calculate total adjustments for a district
        async function calculateTotalAdjustments(districtId) {
          const adjustments = await Adjustment.find({ office: districtId });
          
          const totalAdjustmentAmount = adjustments.reduce((total, adj) => total + adj.adjAmount, 0);
          
          return totalAdjustmentAmount;
        }
      
        async function calculateAllDistrictOpeningBalances() {
            try {
                const districtDataArray = [];
        
                for (const districtId of districtIds) {
                    const district = await District.findById(districtId);
                    const initialCashBalance = districtBalances[districtId].cashBalance;
                    const initialBankBalance = districtBalances[districtId].bankBalance;
                    const obData = await calculateDistrictOpeningBalance(
                        districtId,
                        initialBankBalance
                    );
                    const totalAdvances = await calculateTotalAdvances(districtId);
                    const totalAdjustments = await calculateTotalAdjustments(districtId);
        
                    // Add the data to the array
                    districtDataArray.push({
                        districtId: districtId,
                        name: district.name,
                        currentOB: obData.currentOpeningBalance,
                        cash: initialCashBalance,
                        bank: initialBankBalance,
                        totalAdvance: totalAdvances,
                        totalAdjustments: totalAdjustments,
                        totalPayment: obData.totalPayment,
                        totalReceipt: obData.totalReceipt,
                    });
                }
        
                return districtDataArray;
            } catch (error) {
                console.error("Error:", error);
                throw error; // Re-throw the error to be caught by the middleware
            }
        }
        
    const districtDataArray = await calculateAllDistrictOpeningBalances();
    // Assuming districtDataArray is defined and populated in your middleware.
    req.districtDataArray = districtDataArray ;
    req.dirTansacData=dirTransactionDetails;
    req.dirCash= dirTotalCash ;
    req.dirBank=dirTotalBankBalance;
    console.log(req.districtDataArray);
 
 
    // --------------------Scheme Details------------------------
    const schemeDetails = await Scheme.find({directorate:req.user.directorate});
    const today = new Date();

    // Calculate total advances for all schemes
    // const totalPayment = await DirPayment.aggregate([
    //   {
    //     $match: {
    //       // scheme: new mongoose.Types.ObjectId(schemeId),
    //       date: {
    //         $gte: new Date(today.getFullYear(), 3, 1), // Start of the financial year (April 1st)
    //         $lte: today,
    //       },
    //     },
    //   },
    //   {
    //     $group: {
    //       _id: null,
    //       totalAdvanceAmount: { $sum: '$amount' },
    //     },
    //   },
    // ]);

    // // Calculate total adjustments for all schemes
    // const totalReceipt = await DirReceipt.aggregate([
    //   {
    //     $group: {
    //       _id: null,
    //       totalAdjustmentAmount: { $sum: '$adjAmount' },
    //     },
    //   },
    // ]);

    // Add scheme details to the response object
    req.schemeData = {
      schemes: schemeDetails,
      initialOB:directorObDetails
      // totalAdvance: totalAdvanceAmount[0]?.totalAdvanceAmount || 0,
      // totalAdjustments: totalAdjustmentAmount[0]?.totalAdjustmentAmount || 0,
    };

    console.log('Scheme Details', req.schemeData);


    next(); // Move to the next middleware or route
  } 
  
  module.exports = calculateDirMiddleware;