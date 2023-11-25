
const router = express.Router();
const isAuthenticated = require("../../helper/authenticated");

router.get("/cas/directorate",isAuthenticated, async (req, res) => {
    try {
      const directorate = await Directorate.find().populate("department");
      const departments = await Department.find();
    
      res.render("directorate", { departments, directorate });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });
  
  router.post("/cas/directorate", async (req, res) => {
    try {
     
      const { department, directorate } = req.body;
      const dep = await Department.findOne({ name: department });
      const dir = new Directorate({ name: directorate, department: dep._id });
      dep.directorate.push(dir?._id)
      dep.save();
      dir.save();
      res.redirect("directorate");
     
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });
  
  module.exports =router;