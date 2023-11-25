
const router = express.Router();
const isAuthenticated = require("../../helper/authenticated");


router.get("/cas/district", async (req, res) => {
    try {
      const directorates = await Directorate.find();
      const districtName = await DistrictName.find();
      const district = await District.find()
        .populate("directorate")
        .populate("district");
      console.log(district);
      res.render("districtLevelOffice", { directorates, district, districtName });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });
  
  router.post("/cas/district", async (req, res) => {
    try {
      const { directorate, districtName, office_name, office_address } = req.body;
      const directorateName = await Directorate.findOne({ name: directorate });
      const districtRef = await DistrictName.findOne({ name: districtName });
      const districtOffice = new District({
        name: office_name,
        directorate: directorateName._id,
        district: districtRef._id,
        address: office_address,
      }); 
      
      
      directorateName.districts.push(districtOffice._id);
      directorateName.save()
      await districtOffice.save();
      
      res.redirect("district");
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  module.exports = router;