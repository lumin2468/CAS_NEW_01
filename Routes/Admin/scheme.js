
const router = express.Router();
const isAuthenticated = require("../../../../../helper/authenticated");

router.get("/cas/scheme", async (req, res) => {
    try {
      const directorates = await Directorate.find();
      const schemes = await Scheme.find().populate("directorate");
      console.log(schemes);
      res.render("scheme", { directorates, schemes });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });
  
  router.post("/cas/scheme",isAuthenticated, async (req, res) => {
    try {
      const { schemeName, startDate, endDate, directorate, schemeDesc } =
        req.body;
        const directorateName = await Directorate.findOne({ name: directorate });
        // console.log(`gghjghghghghg`,directorateName)
      const schemeData = new Scheme({
        name: schemeName,
        startDate: startDate,
        endDate: endDate,
        directorate: directorateName._id,
        description: schemeDesc,
      });
      const newScheme = await schemeData;
      directorateName.schemes.push(newScheme._id)
      directorateName.save()
  
      newScheme.save();
      res.redirect("scheme");
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  module.exports =router;