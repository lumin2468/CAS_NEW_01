
const router = express.Router();
const isAuthenticated = require("../../helper/authenticated");



router.get("/cas/departments",isAuthenticated, async (req, res) => {
    try {
      const departments = await Department.find();
      res.render("departments", { departments });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });
  
  router.post("/cas/departments",isAuthenticated, async (req, res) => {
    try {
      console.log(req.body);
      const { name } = req.body;
      const departments = new Department({ name });
      departments.save();
      res.redirect("departments");
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });
  
  
  
  
  
  
  
  // ... Define more routes for other resources ...
  
  
  module.exports =router;
  