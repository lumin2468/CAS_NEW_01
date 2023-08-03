
const router = express.Router();
const isAuthenticated = require("../../../../../helper/authenticated");
  
  router.get("/cas/scheme2component", async (req, res) => {
    try {
      const scheme_details=await Scheme.find()
      
     
      res.render("schemeComponent.ejs",{scheme_details});
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });
  router.post("/cas/scheme2component", async (req, res) => {
    try {
      // const directorate_data= await Directorate.find()
      // const district_office=await District.find()
      // const bank_details=await BankDetails.find()
      // const scheme_details=await Scheme.find()
      console.log(req.body)
     
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });
 
  module.exports =router;
