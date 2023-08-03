
const router = express.Router();
const isAuthenticated = require("../../helper/authenticated");


router.get("/cas/bank",isAuthenticated, async (req, res) => {
    try {
      const level = ["Directorate", "District"];
      const directorate = await Directorate.find();
      const districts =await  District.find();
      res.render("banks", { directorate, districts, level });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });
  
  router.post("/cas/bank", isAuthenticated, async (req, res) => {
    try {
    const {bankName,Ifsc_code,branchName,accountNo,Balance,directorate,district_office, address}=req.body;
    const direcOfc=await Directorate.findOne({name:directorate});
    let distOfc={}
    console.log(district_office)
    if(!(district_office ==='Select')){
      distOfc=await District.findOne({name:district_office});
      console.log(distOfc)
    }
    
    const bankMaster=new BankDetails({directorate:direcOfc._id, office:distOfc?._id,bank:bankName, accountNumber:accountNo,IFSCNumber:Ifsc_code,balance:Balance,branch:branchName,address:address })
    direcOfc.bank.push(bankMaster._id)
    direcOfc.save()
    if(!(district_office ==='Select')){
      distOfc.bank.push(bankMaster._id)
      distOfc.save()
    }
    bankMaster.save()
    res.status(200).redirect('/cas/bank')
  } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  module.exports =router;