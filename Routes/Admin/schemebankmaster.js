const router = require("./schemecomponent");

router.get("/cas/scheme2bank", async (req, res) => {
    try {
      const directorate_data= await Directorate.find()
      const district_office=await District.find()
      const bank_details=await BankDetails.find()
      const scheme_details=await Scheme.find()
      
     
      res.render("SchemeBank.ejs",{directorate_data,bank_details,scheme_details,district_office});
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });
  
  
  router.post("/cas/scheme2bank", async (req, res) => {
    try {
      console.log(`I am in`)
      const {directorate,office_name,scheme_name,bank_name, scheme_desc}= req.body
      const office_details= await District.findOne({name: office_name})
      const scheme_details= await Scheme.findOne({name: scheme_name})
      const bank_details= await BankDetails.findOne({bank: bank_name})
      
      const schemBankDetails=new SchemeBankMaster({office:office_details._id, directorate:office_details.directorate,scheme:scheme_details._id,bankId:bank_details._id,description:scheme_desc})
      schemBankDetails.save()
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  module.exports =router;