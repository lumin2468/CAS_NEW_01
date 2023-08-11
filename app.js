if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}
const express = require("express");
const mongoSanitize = require("express-mongo-sanitize");
const mongoose = require("mongoose");
const morgan = require("morgan");
const path = require("path");
engine = require("ejs-mate");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { body, validationResult } = require("express-validator");
const { consolidatedSchema } = require("./models/master");
const verifyToken = require("./helper/auth");
const isAuthenticated = require("./helper/authenticated");
const session = require("express-session");
const MongoDBStore = require("connect-mongodb-session")(session);
const generateVoucherNumber = require("./helper/dirPayCounter");
const generateRecVoucherNumber = require("./helper/dirRecCounter");
const generateDisRecVoucherNumber = require("./helper/disRecCounter");
const generateDisPayVoucherNumber = require("./helper/disPayCounter");
const generateDisAdvVoucherNumber = require("./helper/disAdvCounter.js");

// Import the Mongoose models
const {
  Department,
  Directorate,
  District,
  DistrictName,
  FinancialYear,
  Scheme,
  BankDetails,
  SchemeComponentMaster,
  SchemeBankMaster,
  Purpose,
  Advance,
  Vendor,
  DirOpeningBalance,
  DirPayment,
  DisPayCounter,
  DisAdvCounter,
  DirCounter,
  DisPayment,
  DirRecCounter,
  DisRecCounter,
  DirReceipt,
  Beneficiary,
  DisReceipt,
  OpeningBalance,
  User,
  modeofPayment,
  Designation,
} = consolidatedSchema;

// Create the Express app
const app = express();

const pages = [
  "/cas/dashboard/assets",
  "/cas/assets",
  "/cas/directorate/assets",
  "/cas/district/assets",
  "/cas/district/receipt/assets",
];
// app.use(
//   "/cas/assets",
//   express.static((path.join(__dirname,"/public/assets")))
// );
// app.use(
//   "/cas/district/assets",
//   express.static((path.join(__dirname,"/public/assets")))
// );
// app.use(
//   "/cas/directorate/assets",
//   express.static((path.join(__dirname,"/public/assets")))
// );
// app.use(
//   "/cas/dashboard/assets",
//   express.static((path.join(__dirname,"/public/assets")))
// );

app.use(pages, express.static(path.join(__dirname, "/public/assets")));
app.use(morgan("tiny"));

app.use(express.json());
app.use(mongoSanitize());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "/public/")));
app.engine("ejs", engine);
app.set("views", __dirname + "/views");
app.set("view engine", "ejs");

// console.log(process.env.SECRET_KEY)
// -------------------Session Storage --------------------------------
// MongoDB configuration for session store
app.use(
  session({
    secret: process.env.SESSION_KEY,
    resave: false,
    saveUninitialized: true,
  })
);

// Connect to MongoDB
mongoose
  .connect(process.env.DB_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((error) => {
    console.error("Error connecting to MongoDB:", error);
  });
const store = new MongoDBStore({
  uri: process.env.DB_URL, // Your MongoDB connection string
  collection: "sessions",
  // Additional options if needed
});

// Catch errors
store.on("error", function (error) {
  console.error("MongoDB Session Store Error:", error);
});

app.use((req, res, next) => {
  if (!req.session.isAuthenticated && req.path !== "/login") {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }
  next();
});
// Define routes
app.get("/cas", async (req, res) => {
  const designation = await Designation.find();
  res.render("index", { designation });
});

app.post(
  "/cas/login",
  [
    body("email").isEmail(),
    body("password").notEmpty(),
    body("userType").notEmpty(),
  ],
  async (req, res) => {
    try {
      // Validate request body
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password, userType } = req.body;
      console.log(req.body);

      // Find the designation by name
      const designation = await Designation.findOne({ name: userType });
      if (!designation) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Find the user by email and designation
      const user = await User.findOne({
        email,
        designation: designation._id,
      }).populate("designation");
      console.log(user);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Verify the password
      const passwordMatch = await bcrypt.compare(password, user.password);
      if (!passwordMatch) {
        return res
          .status(401)
          .json({ message: "Invalid credentials password" });
      }

      // Create JWT token
      const payload = {
        user: {
          username: user.name,
          id: user._id,
          designation: user.designation,
          directorate: user.directorateId,
          officeId: user.officeId,
        },
      };

      jwt.sign(
        payload,
        process.env.SECRET_KEY,
        { expiresIn: "1h" },
        (err, token) => {
          if (err) {
            console.error("Error during token generation:", err);
            return res
              .status(500)
              .redirect("/cas", { message: "Token generation failed" });
          }
          req.session.token = token;
          res.redirect(`/cas/dashboard/`);
        }
      );
    } catch (error) {
      console.error("Error during login:", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  }
);

app.get("/cas/dashboard", verifyToken, (req, res) => {
  const { designation, id } = req.user;
  console.log(`gffgfghf`, req.user);

  // Render the dashboard EJS template based on the user's designation
  if (designation.name === "Admin") {
    res.render("dashboard", {
      username: req.user.username,
      designation: req.user.designation.name,
    });
  } else if (designation.name === "Director") {
    
    res.render("directorate/dashboard", {
      username:req.user.username,
      designation: req.user.designation.name,
    });
  } else if (designation.name === "DFO" || designation.name === "CDVO") {
    
    res.render(`districtOffice/district_office`, {
      title: "Dashboard",
      username:req.user.username,
      designation: req.user.designation.name,
    });
  } else {
    // Handle other designations or unknown designation
    res.status(403).json({ message: "Forbidden" });
  }
});

app.get("/cas/logout", async (req, res) => {
  const designation = await Designation.find();
  req.session.destroy((err) => {
    if (err) {
      console.error("Error destroying session:", err);
      res.status(500).send("Error logging out");
    } else {
      res.render("index", { designation });
    }
  });
});

// // Example route to get all departments
app.get("/cas/departments", async (req, res) => {
  try {
    const departments = await Department.find();
    res.render("departments", { departments });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/cas/departments", async (req, res) => {
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

app.get("/cas/directorate", isAuthenticated, async (req, res) => {
  try {
    const directorate = await Directorate.find().populate("department");
    const departments = await Department.find();

    res.render("directorate", { departments, directorate,  username: req.user.user.username,
      designation: req.user.user.designation.name, });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/cas/directorate", async (req, res) => {
  try {
    const { department, directorate } = req.body;
    const dep = await Department.findOne({ name: department });
    const dir = new Directorate({ name: directorate, department: dep._id });
    dep.directorate.push(dir?._id);
    dep.save();
    dir.save();
    res.redirect("directorate");
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/cas/directorate/user", isAuthenticated, async (req, res) => {
  try {
    const directorateOfc = req.user.user.directorate;
    const desig=[{name:"DFO"},{name:"CDVO"}]
    const directorate = await Directorate.findOne({
      _id: directorateOfc,
    }).populate("districts");
    const users= await User.find({directorateId:directorateOfc, officeId:{$ne: null}}).populate("officeId").populate("designation")
    res.render("directorate/user", {
      directorate,
      desig,
      username: req.user.user.username,
      designation: req.user.user.designation.name,
      users
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/cas/directorate/user", isAuthenticated, async (req, res) => {
  try {
    const {directorate}=req.user.user;
   const {username, designation,office_name,mobile_no, email, password, confirm_pswd,active}= req.body;
   let user_pswd
   console.log(password)
   if(password===confirm_pswd){
    user_pswd=password
   }else{
    console.error("Password do not match")
   }
  if(!user_pswd){
    res.json("Password do not match")
    return
  }

  const newPswd=await bcrypt.hash(user_pswd,10)
  const desig= await Designation.findOne({name:designation})
  const isUserExist= await User.findOne({
    officeId:office_name,
    designation:desig._id
  })
  if(!isUserExist){
    const newUser= new User({
      name:username,
      designation:desig._id,
      email:email,
      mobile:mobile_no,
      directorateId:directorate,
      officeId:office_name,
      password:newPswd,
    });
    newUser.save();
    res.redirect("/cas/directorate/user")
  }else{
    res.json("USER ALREADY EXIST")
  }
  
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/cas/district", async (req, res) => {
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

app.post("/cas/district", async (req, res) => {
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
    directorateName.save();
    await districtOffice.save();

    res.redirect("district");
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});





app.get("/cas/directorate/scheme", isAuthenticated, async (req, res) => {
  try {
    const directorateOfc = req.user.user.directorate;
    const directorates = await Directorate.findOne({ _id: directorateOfc });
    const schemes = await Scheme.find({ directorate: directorateOfc }).populate(
      "directorate"
    );
    console.log(schemes);
    res.render("directorate/scheme", { directorates, schemes,  username: req.user.user.username,
      designation: req.user.user.designation.name, });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/cas/directorate/scheme", async (req, res) => {
  try {
    const { schemeName, startDate, endDate, directorate, schemeDesc } =
      req.body;
    const directorateName = await Directorate.findOne({ name: directorate });
    console.log(`gghjghghghghg`, directorateName);
    const schemeData = new Scheme({
      name: schemeName,
      startDate: startDate,
      endDate: endDate,
      directorate: directorateName._id,
      description: schemeDesc,
    });
    const newScheme = await schemeData;
    directorateName.schemes.push(newScheme._id);
    directorateName.save();

    newScheme.save();
    res.redirect("scheme");
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
// ... Define more routes for other resources ...

app.get("/cas/directorate/bank", isAuthenticated, async (req, res) => {
  try {
    const directorateOfc = req.user.user.directorate;
    const directorate = await Directorate.findOne({ _id: directorateOfc });
    const districts = await District.find({ directorate: directorateOfc });
    const bankDetails = await BankDetails.find({
      directorate: directorateOfc,
    }).populate("office");

    res.render("directorate/bank", { directorate, districts, bankDetails,username: req.user.user.username,
      designation: req.user.user.designation.name, });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/cas/directorate/bank", isAuthenticated, async (req, res) => {
  try {
    const directorateOfc = req.user.user.directorate;
    const {
      bankName,
      Ifsc_code,
      branchName,
      accountNo,
      directorate,
      district_office,
      address,
    } = req.body;
    const direcOfc = await Directorate.findOne({ _id: directorateOfc });
    let distOfc = {};
    console.log(district_office);
    if (!(district_office === "Select")) {
      distOfc = await District.findOne({ name: district_office });
      console.log(distOfc);
    }

    const bankMaster = new BankDetails({
      directorate: direcOfc?._id,
      office: distOfc?._id,
      bank: bankName,
      accountNumber: accountNo,
      IFSCNumber: Ifsc_code,
      balance: 0,
      branch: branchName,
      address: address,
    });
    if (!(district_office === "Select")) {
      distOfc.bank.push(bankMaster._id);
      distOfc.save();
    }
    bankMaster.save();
    res.status(200).redirect("/cas/directorate/bank");
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/cas/directorate/scheme2bank", isAuthenticated, async (req, res) => {
  try {
    const direcOfc = req.user.user.directorate;
    const directorate_data = await Directorate.findOne({ _id: direcOfc });
    const district_office = await District.find({ directorate: direcOfc });
    const bank_details = await BankDetails.find({ directorate: direcOfc });
    const scheme_details = await Scheme.find({ directorate: direcOfc });
    const schemeBankDetails = await SchemeBankMaster.find({
      directorate: direcOfc,
    })
      .populate("directorate")
      .populate("bankId")
      .populate("office")
      .populate("scheme");

    res.render("directorate/schemeBank.ejs", {
      directorate_data,
      bank_details,
      scheme_details,
      district_office,
      schemeBankDetails,
      username: req.user.user.username,
      designation: req.user.user.designation.name,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/cas/directorate/scheme2bank/:id", async (req, res) => {
  try {
    const distId = req.params.id;
    const bank_details = await BankDetails.find({
      office: distId,
      scheme: null,
    });
    res.json(bank_details);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/cas/directorate/scheme2bank", async (req, res) => {
  try {
    console.log(`I am in`);
    const { directorate, office_name, scheme_name, bank_name, scheme_desc } =
      req.body;
    const office_details = await District.findOne({ _id: office_name });
    const scheme_details = await Scheme.findOne({ name: scheme_name });
    const bank_details = await BankDetails.findOne({
      accountNumber: bank_name,
    });

    const schemeBankDetails = new SchemeBankMaster({
      office: office_details._id,
      directorate: office_details.directorate,
      scheme: scheme_details._id,
      bankId: bank_details._id,
      description: scheme_desc,
    });
    scheme_details.bank = schemeBankDetails.bankId;
    scheme_details.save();
    schemeBankDetails.save();
    bank_details.scheme = schemeBankDetails._id;
    bank_details.save();
    office_details.schemes.push(scheme_details._id);
    office_details.save();
    res.redirect("/cas/directorate/scheme2bank");
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/cas/scheme2component", async (req, res) => {
  try {
    const scheme_details = await Scheme.find();

    res.render("schemeComponent.ejs", { scheme_details });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
app.post("/cas/scheme2component", async (req, res) => {
  try {
    const { component_name, scheme_name, code, compo_desc } = req.body;
    // const directorate_data= await Directorate.find()
    // const district_office=await District.find()
    // const bank_details=await BankDetails.find()
    const scheme_value = await Scheme.findOne({ name: scheme_name });
    const new_Component = new SchemeComponentMaster({
      name: component_name,
      code: code,
      scheme: scheme_value._id,
      desc: compo_desc,
    });
    new_Component.save();
    scheme_value.components.push(new_Component._id);
    scheme_value.save();
    res.redirect("/cas/scheme2component");
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get(
  "/cas/directorate/scheme2component",
  isAuthenticated,
  async (req, res) => {
    try {
      const direcOfc = req.user.user.directorate;
      const scheme_details = await Scheme.find({ directorate: direcOfc });
      const schemeComponents = await SchemeComponentMaster.find({
        directorate: direcOfc,
      }).populate("scheme");

      res.render("directorate/schemeComponent.ejs", {
        scheme_details,
        schemeComponents,
        username: req.user.user.username,
        designation: req.user.user.designation.name,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

app.post(
  "/cas/directorate/scheme2component",
  isAuthenticated,
  async (req, res) => {
    try {
      const { component_name, scheme_name, code, compo_desc } = req.body;
      const direcOfc = req.user.user.directorate;
      // const directorate_data= await Directorate.find()
      // const district_office=await District.find()
      // const bank_details=await BankDetails.find()
      const scheme_value = await Scheme.findOne({ _id: scheme_name });
      const new_Component = new SchemeComponentMaster({
        directorate: direcOfc,
        name: component_name,
        code: code,
        scheme: scheme_value._id,
        desc: compo_desc,
      });
      new_Component.save();
      scheme_value.components.push(new_Component._id);
      scheme_value.save();
      res.redirect("/cas/directorate/scheme2component");
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

app.get("/cas/directorate/payment", isAuthenticated, async (req, res) => {
  try {
    const directorateOfc = req.user.user.directorate;
    let voucherNo = "";

    if (req.query.voucher) {
      voucherNo = req.query.voucher;
    }

    const financialYear = await FinancialYear.find();
    const modeofpmnt = await modeofPayment.find();
    const directorate_data = await Directorate.findOne({ _id: directorateOfc })
      .populate("districts")
      .populate("bank");
    const schemes = await Scheme.find({
      directorate: directorate_data._id,
    }).populate("components");
    const paymentDetails = await DirPayment.find()
      .populate("distOfcName")
      .populate("scheme")
      .populate("receiverBank")
      .populate("financialYear");

    res.render("directorate/payment-voucher", {
      directorate_data,
      schemes,
      financialYear,
      modeofpmnt,
      voucherNo,
      paymentDetails,
      username: req.user.user.username,
      designation: req.user.user.designation.name,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/cas/directorate/payment", async (req, res) => {
  try {
    const {
      date,
      modeof_payment,
      transaction_Id,
      transaction_date,
      sanction_ord_no,
      ref_voucher_no,
      schemeName,
      directorate,
      ofc_name,
      directorate_bank,
      receiver_bank,
      p_amount,
      financial_year,
      desc,
    } = req.body;
    const directorate_data = await Directorate.findOne({ name: directorate });
    const district_office = await District.findOne({ _id: ofc_name });
    const scheme_details = await Scheme.findOne({ _id: schemeName });
    const finacialYearDetails = await FinancialYear.findOne({
      year: financial_year,
    });
    const bnkDetails = await SchemeBankMaster.findOne({
      office: ofc_name,
      scheme: scheme_details._id,
    }).populate("bankId");
    console.log(`BANK MAPPING`, bnkDetails);

    //counter implementation for generating aucto-voucher
    const counter = await DirCounter.findOneAndUpdate(
      {
        directorate,
        district: district_office.name,
        scheme: scheme_details.name,
        financialYear: financial_year,
      },
      { $inc: { count: 1 } }, // Increment the counter by 1
      { upsert: true, new: true } // Create a new document if it doesn't exist
    );
    const directorate_abbvr = directorate_data.name.slice(0, 3).toUpperCase();
    const district_abbvr = district_office.name.slice(0, 3).toUpperCase();
    const scheme_abbvr = scheme_details.name.slice(0, 3).toUpperCase();

    const voucherNo = generateVoucherNumber(
      directorate_abbvr,
      district_abbvr,
      scheme_abbvr,
      financial_year,
      counter.count
    );
    const payment = new DirPayment({
      date,
      modeofPayment: modeof_payment,
      modeofPaymentId: transaction_Id,
      modeofPaymentDate: transaction_date,
      directorate: directorate_data._id,
      distOfcName: district_office._id,
      sanctionOrdNo: sanction_ord_no,
      refVoucherNo: ref_voucher_no,
      scheme: scheme_details._id,
      senderBank: directorate_data.bank,
      receiverBank: bnkDetails.bankId._id,
      amount: p_amount,
      financialYear: finacialYearDetails._id,
      autoVoucherNo: voucherNo,
      narration: desc,
      status: "pending",
    });

    payment.save();

    res.redirect(
      `/cas/directorate/payment?voucher=${encodeURIComponent(voucherNo)}`
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// /cas/directorate/payments/
app.get("/cas/directorate/payments/:schemeName", async (req, res) => {
  try {
    const schemeName = req.params.schemeName;
    const componentData = await Scheme.findOne({ _id: schemeName }).populate(
      "components"
    );
    res.json(componentData);
  } catch (error) {
    console.error("Error fetching data:", error);
    res.status(500).json({ error: "Failed to fetch data from the database." });
  }
});

app.get(
  "/cas/directorate/payments/bank/:officeName/:schemeName",
  async (req, res) => {
    try {
      const { officeName, schemeName } = req.params;
      console.log(officeName, schemeName);
      const ofcId = await District.findOne({ _id: officeName });
      const schmId = await Scheme.findOne({ _id: schemeName });

      const bnkDetails = await SchemeBankMaster.findOne({
        scheme: schmId,
        office: ofcId,
      }).populate("bankId");
      console.log(`schemeeeee`, bnkDetails);
      res.json(bnkDetails);
      //  const componentData = await Scheme.findOne({ name: schemeName }).populate('components');
      //  res.json(componentData)
    } catch (error) {
      console.error("Error fetching data:", error);
      res
        .status(500)
        .json({ error: "Failed to fetch data from the database." });
    }
  }
);

app.get("/cas/directorate/receipt", isAuthenticated, async (req, res) => {
  try {
    let voucherNo = "";

    if (req.query.voucher) {
      voucherNo = req.query.voucher;
    }

    const directorateOfc = req.user.user.directorate;
    const receiptDetails = await DirReceipt.find({
      directorate: directorateOfc,
    });
    const financialYear = await FinancialYear.find();
    const directorateData = await Directorate.findOne({ _id: directorateOfc })
      .populate("bank")
      .populate("department");
    console.log(directorateData);
    const modeofpmnt = await modeofPayment.find();
    res.render("directorate/receipt-voucher", {
      directorateData,
      modeofpmnt,
      financialYear,
      voucherNo,
      receiptDetails,
      username: req.user.user.username,
      designation: req.user.user.designation.name,
    });
  } catch (error) {
    console.error("Error fetching data:", error);
    res.status(500).json({ error: "Failed to fetch data from the database." });
  }
});

app.post("/cas/directorate/receipt", isAuthenticated, async (req, res) => {
  try {
    const {
      date,
      modeof_payment,
      transaction_id,
      transaction_date,
      sanction_no,
      ref_voucher_no,
      purpose,
      source,
      directorate,
      source_bank,
      receiver_bank,
      amount,
      desc,
      financialYear,
    } = req.body;

    const financialYearDetails = await FinancialYear.findOne({
      year: financialYear,
    });
    const purposeAbbr = purpose.substring(0, 3).toUpperCase();
    const directorateData = await Directorate.findOne({
      name: directorate,
    }).populate("department");

    const receiverBankDetails = await BankDetails.findOne({
      directorate: directorateData._id,
      accountNumber: receiver_bank,
    });

    const recCounter = await DirRecCounter.findOneAndUpdate(
      {
        directorate,
        source: source,
        purpose: purpose,
        financialYear: financialYear,
      },
      { $inc: { count: 1 } }, // Increment the counter by 1
      { upsert: true, new: true } // Create a new document if it doesn't exist
    );
    const directorate_abbvr = directorateData.name.slice(0, 3).toUpperCase();
    const source_abbvr = source.slice(0, 3).toUpperCase();

    const voucherNo = generateRecVoucherNumber(
      directorate_abbvr,
      source_abbvr,
      purposeAbbr,
      financialYear,
      recCounter.count
    );

    const receiptDetails = new DirReceipt({
      date,
      modeof_payment,
      transaction_id,
      transaction_date,
      sanction_no,
      ref_voucher_no,
      purpose,
      source,
      directorate: directorateData._id,
      source_bank,
      receiver_bank: receiverBankDetails._id,
      amount,
      desc,
      autoVoucherNo: voucherNo,
      financialYear: financialYearDetails._id,
    });
    console.log(receiptDetails);
    receiptDetails.save();
    res.redirect(
      `/cas/directorate/receipt?voucher=${encodeURIComponent(voucherNo)}`
    );
  } catch (error) {
    console.error("Error fetching data:", error);
    res.status(500).json({ error: "Failed to fetch data from the database." });
  }
});

app.get(
  "/cas/directorate/openingBalance",
  isAuthenticated,
  async (req, res) => {
    try {
      const financialYear = await FinancialYear.find();
      const directorateOfc = req.user.user.directorate;
      const opngBalance = await DirOpeningBalance.find({
        directorate: directorateOfc,
      }).populate("bank");

      console.log(`hasdhhasdgagdahda`, opngBalance.bank);
      const dirOfcDetails = await Directorate.findOne({ _id: directorateOfc });
      const bnkDetails = await BankDetails.find({
        directorate: directorateOfc,
      });
      console.log(dirOfcDetails.bank);
      res.render("directorate/opening-balance", {
        dirOfcDetails,
        financialYear,
        bnkDetails,
        opngBalance,
        username: req.user.user.username,
        designation: req.user.user.designation.name,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);
app.post(
  "/cas/directorate/openingBalance",
  isAuthenticated,
  async (req, res) => {
    try {
      const { date, cash, bank_details, bank_balance, advance } = req.body;
      const directorate = req.user.user.directorate;
      const dirDetails = await Directorate.findOne({ _id: directorate });

      const bnkDetails = await BankDetails.findOne({
        accountNumber: bank_details,
        directorate: directorate,
      });
      console.log(bnkDetails.balance);
      bnkDetails.balance =
        parseInt(bnkDetails.balance) + parseInt(bank_balance);
      bnkDetails.save();
      const newOpeningbal = new DirOpeningBalance({
        date,
        cash: parseInt(cash),
        directorate: directorate,
        bank: bnkDetails._id,
        advance: parseInt(advance),
      });
      newOpeningbal.save();
      dirDetails.openingBalance.push(newOpeningbal._id);
      dirDetails.save();
      res.redirect("/cas/directorate/openingBalance");
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

app.get("/cas/directorate/district", isAuthenticated, async (req, res) => {
  try {
    const directorateOfc = req.user.user.directorate;

    const directorates = await Directorate.findOne({ _id: directorateOfc });
    const districtName = await DistrictName.find();
    const district = await District.find({ directorate: directorateOfc })
      .populate("directorate")
      .populate("district");

    res.render("directorate/districtMaster", {
      directorates,
      district,
      districtName,
      username: req.user.user.username,
      designation: req.user.user.designation.name,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/cas/directorate/district", isAuthenticated, async (req, res) => {
  try {
    const directorateOfc = req.user.user.directorate;
    const { directorate, districtName, office_name, office_address } = req.body;
    const directorateName = await Directorate.findOne({ _id: directorateOfc });
   
    const districtOffice = new District({
      name: office_name,
      directorate: directorateOfc,
      district: districtName,
      address: office_address,
    });

    directorateName.districts.push(districtOffice._id);
    directorateName.save();
    await districtOffice.save();

    res.redirect("/cas/directorate/district");
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
//  ---------------DistOfc-------------------

app.get("/cas/district/acknmnt", isAuthenticated, async (req, res) => {
  try {
    const office_Id = req.user.user.officeId;

    const paymentDetails = await DirPayment.find({ distOfcName: office_Id })
      .populate("distOfcName")
      .populate("scheme")
      .populate("receiverBank")
      .populate("financialYear");
    res.render("districtOffice/payment_acknowledge", { paymentDetails,  username: req.user.user.username,
      designation: req.user.user.designation.name, });
  } catch (error) {
    console.error("Error fetching data:", error);
    res.status(500).json({ error: "Failed to fetch data from the database." });
  }
});
app.post("/cas/district/payment/:paymentId", async (req, res) => {
  const paymentId = req.params.paymentId;
  const newStatus = req.body.status;

  try {
    // Update the payment status in the database based on the paymentId
    await DirPayment.findByIdAndUpdate(paymentId, { status: newStatus });
    res.redirect("/cas/district/acknmnt");
  } catch (error) {
    console.error("Error updating payment status:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/cas/district/receipt", isAuthenticated, async (req, res) => {
  try {
    const directorateOfc = req.user.user.directorate;
    const distOfc = req.user.user.officeId;
    const distOfcRecData = await DisReceipt.find({ office_name: distOfc })
      .populate("directorate")
      .populate("office_name")
      .populate("scheme")
      .populate("receiver_bank");
    let voucherNo = "";

    if (req.query.voucher) {
      voucherNo = req.query.voucher;
    }
    let receiptDetails = null;
    const modeofpmnt = await modeofPayment.find();
    const financialYear = await FinancialYear.find();
    const distOfcId = req.user.user.officeId;
    const distOfcDetails = await District.findOne({ _id: distOfcId })
      .populate("directorate")
      .populate("schemes");

    res.render("districtOffice/receipt-voucher", {
      receiptDetails,
      modeofpmnt,
      distOfcDetails,
      financialYear,
      voucherNo,
      distOfcRecData,
      username: req.user.user.username,
      designation: req.user.user.designation.name,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/cas/district/receipt", isAuthenticated, async (req, res) => {
  try {
    const {
      date,
      modeof_payment,
      transaction_Id,
      transaction_date,
      sanction_ord_no,
      ref_voucher_no,
      scheme,
      directorate,
      office_name,
      source_bank_details,
      bankDetails,
      amount,
      financial_year,
      desc,
    } = req.body;

    const officeId = req.user.user.officeId;
    const directorate_data = await Directorate.findOne({ name: directorate });
    const district_office = await District.findOne({ _id: officeId });
    const scheme_details = await Scheme.findOne({ _id: scheme });
    const finacialYearDetails = await FinancialYear.findOne({
      year: financial_year,
    });
    console.log(scheme_details);
    const bnkDetails = await SchemeBankMaster.findOne({
      office: district_office._id,
      scheme: scheme_details._id,
    }).populate("bankId");
    console.log(`BANK MAPPING`, bnkDetails);

    //counter implementation for generating aucto-voucher
    const counter = await DisRecCounter.findOneAndUpdate(
      {
        directorate,
        district: district_office.name,
        scheme: scheme_details.name,
        financialYear: financial_year,
      },
      { $inc: { count: 1 } }, // Increment the counter by 1
      { upsert: true, new: true } // Create a new document if it doesn't exist
    );
    const directorate_abbvr = directorate_data.name.slice(0, 3).toUpperCase();
    const district_abbvr = district_office.name.slice(0, 3).toUpperCase();
    const scheme_abbvr = scheme_details.name.slice(0, 3).toUpperCase();
    const voucherNo = generateDisRecVoucherNumber(
      directorate_abbvr,
      district_abbvr,
      scheme_abbvr,
      financial_year,
      counter.count
    );

    const districtReceiptData = await new DisReceipt({
      date,
      modeof_payment,
      transaction_Id,
      transaction_date,
      sanction_ord_no,
      ref_voucher_no,
      scheme: scheme_details._id,
      directorate: directorate_data._id,
      office_name: district_office._id,
      source_bank_details,
      receiver_bank: bnkDetails.bankId._id,
      amount,
      financial_year: finacialYearDetails._id,
      desc,
      autoVoucherNo: voucherNo,
    });
    counter.save();
    districtReceiptData.save();
    res.redirect(
      `/cas/district/receipt?voucher=${encodeURIComponent(voucherNo)}`
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/cas/district/receipt/:id", async (req, res) => {
  try {
    let voucherNo = "";
    const id = req.params.id;
    const distOfcRecData = [];
    const financialYear = await FinancialYear.find();
    const receiptDetails = await DirPayment.findOne({ _id: id })
      .populate("directorate")
      .populate("distOfcName")
      .populate("scheme")
      .populate("receiverBank")
      .populate("senderBank")
      .populate("financialYear");

    res.render("districtOffice/receipt-voucher", {
      receiptDetails,
      distOfcRecData,
      financialYear,
      voucherNo,
      username: req.user.user.username,
      designation: req.user.user.designation.name,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/cas/district/benificiary", isAuthenticated, async (req, res) => {
  try {
    const office_Id = req.user.user.officeId;
    const officeDetails = await District.findOne({ _id: office_Id }).populate(
      "schemes"
    );
    res.render("districtOffice/benificiary", { officeDetails,  username: req.user.user.username,
      designation: req.user.user.designation.name, });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/cas/district/benificiary", isAuthenticated, async (req, res) => {
  try {
    const {
      benificiary_name,
      office_name,
      dob,
      scheme,
      Gender,
      Aadhar_No,
      Bnk_Acc_No,
      Ifsc_code,
      branch_details,
      desc,
    } = req.body;
    const office_Id = req.user.user.officeId;
    const office_details = await District.findOne({ _id: office_Id });
    const schemeDetails = await Scheme.findOne({});
    const newBenificiary = new Beneficiary({
      benificiary_name,
      office_name: office_details._id,
      dob,
      scheme: schemeDetails._id,
      Gender,
      Aadhar_No,
      Bnk_Acc_No,
      Ifsc_code,
      branch_details,
      desc,
    });
    office_details.beneficiary.push(newBenificiary);
    office_details.save();
    newBenificiary.save();

    res.redirect("/cas/district/benificiary");
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/cas/district/payment-approval", isAuthenticated, async (req, res) => {
  try {
    const office_Id = req.user.user.officeId;

    const paymentDetails = await DisPayment.find({ office_name: office_Id })
      .populate("office_name")
      .populate("scheme")
      .populate("beneficiary");
    res.render("districtOffice/paymentApproval", { paymentDetails,  username: req.user.user.username,
      designation: req.user.user.designation.name, });
  } catch (error) {
    console.error("Error fetching data:", error);
    res.status(500).json({ error: "Failed to fetch data from the database." });
  }
});

app.post("/cas/district/payment-approval/:paymentId", async (req, res) => {
  const paymentId = req.params.paymentId;
  const newStatus = req.body.status;

  try {
    // Update the payment status in the database based on the paymentId
    await DisPayment.findByIdAndUpdate(paymentId, { status: newStatus });
    res.redirect(req.get("referer"));
  } catch (error) {
    console.error("Error updating payment status:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/cas/district/purpose", isAuthenticated, async (req, res) => {
  try {
    const office_Id = req.user.user.officeId;
    const officeDetails = await District.findOne({ _id: office_Id }).populate(
      "schemes"
    );
    res.render("districtOffice/purpose", { officeDetails,  username: req.user.user.username,
      designation: req.user.user.designation.name, });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/cas/district/purpose", isAuthenticated, async (req, res) => {
  try {
    const { name, start_date, end_date, abbvr, desc } = req.body;
    const office_Id = req.user.user.officeId;
    const officeDetails = await District.findOne({ _id: office_Id }).populate(
      "schemes"
    );
    const newPurpose = new Purpose({
      name,
      office: office_Id,
      start_date,
      end_date,
      abbvr,
      desc,
    });
    newPurpose.save();
    officeDetails.purpose.push(newPurpose._id);
    officeDetails.save();
    res.redirect("/cas/district/purpose");
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/cas/district/vendor", isAuthenticated, async (req, res) => {
  try {
    const office_Id = req.user.user.officeId;
    const officeDetails = await District.findOne({ _id: office_Id }).populate(
      "schemes"
    );
    res.render("districtOffice/vendor", { officeDetails,  username: req.user.user.username,
      designation: req.user.user.designation.name, });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/cas/district/vendor", isAuthenticated, async (req, res) => {
  try {
    const office_Id = req.user.user.officeId;
    const officeDetails = await District.findOne({ _id: office_Id }).populate(
      "schemes"
    );

    const {
      name,
      office_name,
      dob,
      gst,
      Gender,
      Aadhar_No,
      Bnk_Acc_No,
      Ifsc_code,
      branch_details,
      desc,
    } = req.body;

    const newParty = new Vendor({
      name,
      office_name: office_Id,
      dob,
      gst,
      Gender,
      Aadhar_No,
      Bnk_Acc_No,
      Ifsc_code,
      branch_details,
      desc,
    });
    newParty.save();
    officeDetails.vendor.push(newParty._id);
    officeDetails.save();

    res.redirect("/cas/district/vendor");
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/cas/district/payment", isAuthenticated, async (req, res) => {
  try {
    const office_Id = req.user.user.officeId;
    let voucherNo = "";

    if (req.query.voucher) {
      voucherNo = req.query.voucher;
    }
    const paymentDetails = await DisPayment.find({ office_name: office_Id })
      .populate("office_name")
      .populate("scheme")
      .populate("beneficiary")
      .populate("financial_year");

    console.log(`paymentdetails`, paymentDetails);

    const office_details = await District.findOne({ _id: office_Id })
      .populate("bank")
      .populate("schemes")
      .populate("beneficiary");
    const modeofpmnt = await modeofPayment.find();
    const benificiaryData = await Beneficiary.find({ office_name: office_Id });
    const financialYear = await FinancialYear.find();

    res.render("districtOffice/payment-voucher", {
      office_details,
      modeofpmnt,
      financialYear,
      voucherNo,
      paymentDetails,
      username: req.user.user.username,
      designation: req.user.user.designation.name,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/cas/district/payment", isAuthenticated, async (req, res) => {
  try {
    const office_Id = req.user.user.officeId;

    const {
      date,
      mode_of_payment,
      transaction_Id,
      transaction_date,
      sanction_ord_no,
      scheme,
      beneficiary,
      office_name,
      components_name,
      from_bank,
      benifBank,
      amount,
      financial_year,
      desc,
    } = req.body;

    const districtDetails = await District.findOne({ _id: office_Id });
    const schemeDetails = await Scheme.findOne({ _id: scheme });
    const bankDetails = await SchemeBankMaster.findOne({
      office: districtDetails._id,
      scheme: schemeDetails._id,
    });

    const financialYear = await FinancialYear.findOne({ year: financial_year });

    const counter = await DisPayCounter.findOneAndUpdate(
      {
        district: districtDetails.name,
        scheme: schemeDetails.name,
        component: components_name,
        beneficiary: beneficiary,
        financialYear: financialYear.year,
      },
      { $inc: { count: 1 } }, // Increment the counter by 1
      { upsert: true, new: true } // Create a new document if it doesn't exist
    );

    const district_abbvr = districtDetails.name.slice(0, 3).toUpperCase();
    const scheme_abbvr = scheme.slice(0, 3).toUpperCase();
    const component_abbr = components_name.slice(0, 3).toUpperCase();
    const benificiary = beneficiary.slice(0, 4).toUpperCase();

    const voucherNo = generateDisPayVoucherNumber(
      district_abbvr,
      benificiary,
      scheme_abbvr,
      component_abbr,
      financial_year,
      counter.count
    );
    const benifData = await Beneficiary.findOne({
      benificiary_name: beneficiary,
    });
    const disOfcPayment = new DisPayment({
      date,
      mode_of_payment,
      transaction_Id,
      transaction_date,
      sanction_ord_no,
      scheme: schemeDetails._id,
      beneficiary: benifData._id,
      office_name: districtDetails._id,
      components_name,
      from_bank: bankDetails.bankId,
      benifBank,
      autoVoucherNo: voucherNo,
      status: "pending",
      amount,
      financial_year: financialYear._id,
      desc,
    });

    disOfcPayment.save();
    res.redirect(
      `/cas/district/payment?voucher=${encodeURIComponent(voucherNo)}`
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/cas/district/advance", isAuthenticated, async (req, res) => {
  try {
    const office_Id = req.user.user.officeId;

    let voucherNo = "";

    if (req.query.voucher) {
      voucherNo = req.query.voucher;
    }
    const office_details = await District.findOne({ _id: office_Id })
      .populate("bank")
      .populate("purpose")
      .populate("vendor");
    const modeofpmnt = await modeofPayment.find();
    const benificiaryData = await Beneficiary.find({ office_name: office_Id });
    const financialYear = await FinancialYear.find();
    const advanceDetails = await Advance.find({ office: office_Id })
      .populate("office")
      .populate("party")
      .populate("purpose");

    res.render("districtOffice/advance", {
      office_details,
      modeofpmnt,
      financialYear,
      voucherNo,
      advanceDetails,
      username: req.user.user.username,
      designation: req.user.user.designation.name,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/cas/district/advance", isAuthenticated, async (req, res) => {
  try {
    const office_Id = req.user.user.officeId;

    const {
      date,
      mode_of_payment,
      transaction_id,
      transaction_date,
      sanction_no,
      purpose,
      party,
      office_name,
      from_bank,
      partyBank,
      amount,
      financial_year,
      desc,
    } = req.body;

    const office_details = await District.findOne({ _id: office_Id })
      .populate("bank")
      .populate("purpose")
      .populate("vendor");
    const bank = await BankDetails.findOne({
      accountNumber: from_bank,
      office: office_Id,
    });
    const purposeId = await Purpose.findOne({
      name: purpose,
      office: office_Id,
    });
    const vendorId = await Vendor.findOne({
      name: party,
      office_name: office_Id,
    });

    const advCounter = await DisAdvCounter.findOneAndUpdate(
      {
        district: office_name,
        party: party,
        purpose: purpose,
        financialYear: financial_year,
      },
      { $inc: { count: 1 } }, // Increment the counter by 1
      { upsert: true, new: true } // Create a new document if it doesn't exist
    );

    console.log(`counterr`, advCounter.count);
    const office_abbvr = office_details.name.slice(0, 3).toUpperCase();

    const voucherNo = generateDisAdvVoucherNumber(
      office_abbvr,
      party,
      purposeId.abbvr,
      financial_year,
      advCounter.count
    );

    const newAdvanceVoucher = new Advance({
      date,
      mode_of_payment,
      transaction_id: transaction_id,
      transaction_date,
      sanction_no,
      purpose: purposeId._id,
      party: vendorId._id,
      office: office_details._id,
      from_bank: bank._id,
      partyBank,
      amount,
      financial_year,
      autoVoucherNo: voucherNo,
      status: "pending",
      desc,
    });

    newAdvanceVoucher.save();
    res.redirect(
      `/cas/district/advance?voucher=${encodeURIComponent(voucherNo)}`
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/cas/district/adjustment", isAuthenticated, async (req, res) => {
  try {
    const office_Id = req.user.user.officeId;

    let voucherNo = "";

    // if (req.query.voucher) {
    //   voucherNo = req.query.voucher;
    // }
    const office_details = await District.findOne({ _id: office_Id })
      .populate("bank")
      .populate("purpose")
      .populate("vendor");
    const modeofpmnt = await modeofPayment.find();
    const financialYear = await FinancialYear.find();
    const advanceDetails = await Advance.find({ office: office_Id })
      .populate("office")
      .populate("party")
      .populate("purpose");

    res.render("districtOffice/adjustment", {
      office_details,
      modeofpmnt,
      financialYear,
      advanceDetails,
      voucherNo,
      username: req.user.user.username,
      designation: req.user.user.designation.name,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get(
  "/cas/district/adjustment/:voucherDetails",
  isAuthenticated,
  async (req, res) => {
    const voucherDetails = req.params.voucherDetails;
    const office_Id = req.user.user.officeId;
    const advanceData = await Advance.findOne({
      office: office_Id,
      autoVoucherNo: voucherDetails,
    })
      .populate("purpose")
      .populate("party")
      .populate("from_bank");

    // Now you can use the voucherDetails parameter value to fetch data from your database or perform any other actions.
    // For now, let's just send a simple response with the voucherDetails value.
    console.log(advanceData);
    res.json(advanceData);
  }
);

app.get(
  "/cas/district/opening-balance/:schemeId",
  isAuthenticated,
  async (req, res) => {
    try {
      const officeDetails = req.user.user.officeId;
      const { schemeId } = req.params;
      const bankDetails = await SchemeBankMaster.findOne({
        office: officeDetails,
        scheme: schemeId,
      }).populate("bankId");
      res.json(bankDetails);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);
app.get("/cas/district/bank", isAuthenticated, async (req, res) => {
  try {
    const directorateOfc = req.user.user.directorate;
    const officeId = req.user.user.officeId;
    const directorate = await Directorate.findOne({ _id: directorateOfc });
    const districts = await District.find({ _id: officeId });
    const bankDetails = await BankDetails.find({
      office: officeId,
    }).populate("office");

    res.render("districtOffice/bank", { directorate, districts, bankDetails,  username: req.user.user.username,
      designation: req.user.user.designation.name, });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/cas/district/bank", isAuthenticated, async (req, res) => {
  try {
    const directorateOfc = req.user.user.directorate;
    const districtOfc = req.user.user.officeId;
    const {
      bankName,
      Ifsc_code,
      branchName,
      accountNo,
      directorate,
      district_office,
      address,
    } = req.body;
    const direcOfc = await Directorate.findOne({ _id: directorateOfc });

    distOfc = await District.findOne({ _id: districtOfc });

    const bankMaster = new BankDetails({
      directorate: direcOfc?._id,
      office: districtOfc,
      bank: bankName,
      accountNumber: accountNo,
      IFSCNumber: Ifsc_code,
      balance: 0,
      branch: branchName,
      address: address,
    });
    distOfc.bank.push(bankMaster._id);
    distOfc.save();

    bankMaster.save();
    res.status(200).redirect("/cas/directorate/bank");
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/cas/district/scheme2bank", isAuthenticated, async (req, res) => {
  try {
    const direcOfc = req.user.user.directorate;
    const distOfc = req.user.user.officeId;
    const directorate_data = await Directorate.findOne({ _id: direcOfc });
    const district_office = await District.findOne({ _id: distOfc });
    const bank_details = await BankDetails.find({ office: distOfc });
    const scheme_details = await Scheme.find({ directorate: direcOfc });
    const schemeBankDetails = await SchemeBankMaster.find({
      office: distOfc,
    })
      .populate("directorate")
      .populate("bankId")
      .populate("office")
      .populate("scheme");

    res.render("districtOffice/schemeBank.ejs", {
      directorate_data,
      bank_details,
      scheme_details,
      district_office,
      schemeBankDetails,
      username: req.user.user.username,
      designation: req.user.user.designation.name,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/cas/district/scheme2bank", isAuthenticated, async (req, res) => {
  try {
    const direcOfc = req.user.user.directorate;
    const distOfc = req.user.user.officeId;
    const { directorate, office_name, scheme_name, bank_name, scheme_desc } =
      req.body;
    const office_details = await District.findOne({ _id: distOfc });
    const scheme_details = await Scheme.findOne({ name: scheme_name });
    const bank_details = await BankDetails.findOne({
      accountNumber: bank_name,
    });

    const schemeBankDetails = new SchemeBankMaster({
      office: distOfc,
      directorate: direcOfc,
      scheme: scheme_details._id,
      bankId: bank_details._id,
      description: scheme_desc,
    });
    scheme_details.bank = schemeBankDetails.bankId;
    scheme_details.save();
    schemeBankDetails.save();
    bank_details.scheme = schemeBankDetails._id;
    bank_details.save();
    office_details.schemes.push(scheme_details._id);
    office_details.save();
    res.redirect("/cas/district/scheme2bank");
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/cas/district/opening-balance", isAuthenticated, async (req, res) => {
  try {
    const office_Id = req.user.user.officeId;
    const openingBal = await OpeningBalance.find({ office: office_Id })
      .populate("bank")
      .populate("scheme");
    const ofcDetails = await District.findOne({ _id: office_Id })
      .populate("bank")
      .populate("schemes");
    console.log(ofcDetails);
    const bnkdetails = await BankDetails.findOne({ _id: openingBal.bank });

    res.render("districtOffice/opening-balance", {
      ofcDetails,
      openingBal,
      bnkdetails,
      username: req.user.user.username,
      designation: req.user.user.designation.name,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/cas/district/opening-balance", isAuthenticated, async (req, res) => {
  try {
    const office_id = req.user.user.officeId;
    const openingBalData = req.body;

    const newOpeningBalances = await Promise.all(
      openingBalData.scheme.map(async (scheme, index) => {
        const cash = openingBalData.cash[index];
        const bank = openingBalData.bank[index];
        const bank_balance = openingBalData.bank_balance[index];
        const advance = openingBalData.advance[index];

        // Process bank details and update balance
        const bnkDetails = await BankDetails.findOne({ accountNumber: bank });
        bnkDetails.balance =
          parseInt(bnkDetails.balance) + parseInt(bank_balance);
        await bnkDetails.save();

        // Create and save opening balance entry
        const newOpeningBal = new OpeningBalance({
          date: Date.now(),
          scheme,
          cash: parseInt(cash),
          office: office_id,
          bank: bnkDetails._id,
          advance: parseInt(advance),
        });
        await newOpeningBal.save();

        return newOpeningBal;
      })
    );

    // Update office details with new opening balance IDs
    const ofcDetails = await District.findOne({ _id: office_id });
    ofcDetails.openingBalance.push(
      ...newOpeningBalances.map((entry) => entry._id)
    );
    await ofcDetails.save();

    res.redirect("/cas/district/opening-balance");
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});

//203.193.144.19:80
