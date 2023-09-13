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
const multer = require('multer');
const xlsx = require('xlsx'); // Import 'xlsx' library
const upload = multer({ dest: 'uploads/' });
const fs= require('fs');
const { log, Console } = require("console");

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
  Adjustment,
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
  Accountant,
} = consolidatedSchema;

// Create the Express app
const app = express();

const pages = [
  "/cas/dashboard/assets",
  "/cas/assets",
  "/cas/directorate/assets",
  "/cas/district/assets",
  "/cas/district/receipt/assets",
  "/cas/district/paymentDetails/assets",
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
  uri:process.env.DB_URL, // Your MongoDB connection string
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
          officeId: user.officeId,
          designation: user.designation,
          directorate: user.directorateId,
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

  } else if (designation.name === "District") {
    
    res.render("district/dashboard", {
      username:req.user.username,
      designation: req.user.designation.name,
    });
  } else if (designation.name === "ACCOUNTANT") {
    console.log("I am IN")
    res.render(`accounts/district_office`, {
      title: "Dashboard",
      username:req.user.username,
      designation: req.user.designation.name,
    });
  }
  else if (designation.name === "HEAD-CLERK") {
    console.log("I am IN")
    res.render(`head-clerk/district_office`, {
      title: "Dashboard",
      username:req.user.username,
      designation: req.user.designation.name,
    });
  }
  else {
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
app.get("/cas/financialYear", async (req, res) => {
  try {
    const financial_year=await FinancialYear.find()
    res.render("financial-year",{financial_year})
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
app.post("/cas/financialYear", async (req, res) => {
  try {
    const {year, startDate, endDate} =req.body
    const isFinancialYearExist =await FinancialYear.findOne({year:year})
    console.log(isFinancialYearExist)
    if(isFinancialYearExist){
     return res.json("Year Already Exist")
    }
    const newFinancialYear = new FinancialYear({year,startDate,endDate})
    console.log(newFinancialYear)
    newFinancialYear.save()
    res.redirect("/cas/financialYear")
    
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
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
    const paymentDetails = await DirPayment.find({directorate:directorateOfc})
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

    const paymentDate = new Date(date); // Assuming "date" is the payment date
    const paymentYear = paymentDate.getFullYear();

    // Find the financial year that corresponds to the payment date
    const financialYear = await FinancialYear.findOne({
      startDate: { $lte: paymentDate },
      endDate: { $gte: paymentDate },
    });

    if (!financialYear) {
      // Financial year not found, handle the error accordingly
      res.status(400).json({ error: "Financial Year not found" });
      return;
    }

    const directorate_data = await Directorate.findOne({ name: directorate });
    const district_office = await District.findOne({ _id: ofc_name });
    const scheme_details = await Scheme.findOne({ _id: schemeName });
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
        financialYear:financialYear.year,
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
      financialYear.year,
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
      financialYear:financialYear._id,
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
    console.log("componentData",componentData)
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
    } = req.body;


    const paymentDate = new Date(date); // Assuming "date" is the payment date
    const paymentYear = paymentDate.getFullYear();

    // Find the financial year that corresponds to the payment date
    const financialYear = await FinancialYear.findOne({
      startDate: { $lte: paymentDate },
      endDate: { $gte: paymentDate },
    });

    if (!financialYear) {
      // Financial year not found, handle the error accordingly
      res.status(400).json({ error: "Financial Year not found" });
      return;
    }
   
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
        financialYear: financialYear.year,
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
      financialYear.year,
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
      financialYear: financialYear._id,
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



app.get("/cas/directorate/report", isAuthenticated, async (req, res) => {
  try {
    const directorateOfc = req.user.user.directorate;

    const directorate = await Directorate.findOne({ _id: directorateOfc }).populate("schemes");
   

    res.render("directorate/cash-book-register", {
      directorate,
      username: req.user.user.username,
      designation: req.user.user.designation.name,
    });
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
      desc,
    } = req.body;



    const paymentDate = new Date(date); // Assuming "date" is the payment date
    const paymentYear = paymentDate.getFullYear();

    // Find the financial year that corresponds to the payment date
    const financialYear = await FinancialYear.findOne({
      startDate: { $lte: paymentDate },
      endDate: { $gte: paymentDate },
    });

    if (!financialYear) {
      // Financial year not found, handle the error accordingly
      res.status(400).json({ error: "Financial Year not found" });
      return;
    }
    const officeId = req.user.user.officeId;
    const directorate_data = await Directorate.findOne({ name: directorate });
    const district_office = await District.findOne({ _id: officeId });
    const scheme_details = await Scheme.findOne({ _id: scheme });
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
        financialYear: financialYear.year,
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
      financialYear.year,
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
      financial_year: financialYear._id,
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

app.get("/cas/district/receipt/:id",isAuthenticated, async (req, res) => {
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
    const beneficiaries= await Beneficiary.find({office_name:office_Id}).populate("office_name")
    res.render("districtOffice/benificiary", { 
      officeDetails,  
      username: req.user.user.username,
      designation: req.user.user.designation.name, 
      beneficiaries
    });
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
app.post("/cas/district/benificiary/upload", isAuthenticated, upload.single('excelFile'), async (req, res) => {
  try {
    const officeId=req.user.user.officeId
    const { path: filePath, originalname } = req.file;
    officeDetails = await District.findOne({_id: officeId})
    // Check if the uploaded file is an Excel file
    if (!originalname.match(/\.(xlsx|xls)$/i)) {
      fs.unlinkSync(filePath); // Delete the uploaded file
      return res.status(400).json({ error: "Invalid file format. Please upload an Excel file." });
    }

    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    const excelData = xlsx.utils.sheet_to_json(sheet);
console.log(excelData);
    // Validate and sanitize the Excel data
    const beneficiaries = [];
    for (const row of excelData) {
      // Implement validation and sanitation logic here
      // You can use libraries like Joi for validation

      // Example validation: Ensure required fields are present
      if (!row.benificiary_name || !row.office_name || !row.dob || !row.Gender || !row.Aadhar_No || !row.Bnk_Acc_No|| !row.Ifsc_code||!row.branch_details||!row.desc) {
        fs.unlinkSync(filePath); // Delete the uploaded file
        return res.status(400).json({ error: "Invalid data in Excel file. Required fields are missing." });
      }

      // Sanitize data if needed

      beneficiaries.push(row);
    }
console.log(beneficiaries)
//     // Process and create beneficiaries
    for (let beneficiary of beneficiaries) {
//       // Create and save the beneficiary using your existing logic
          beneficiary.office_name=officeId
      const newBeneficiary = new Beneficiary(beneficiary);
      await newBeneficiary.save();
      officeDetails.beneficiary.push(newBeneficiary._id);

    }

    fs.unlinkSync(filePath); // Delete the uploaded file

    res.redirect("/cas/district/benificiary");
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/cas/district/vendor/upload", isAuthenticated, upload.single('excelFile'), async (req, res) => {
  try {
    const officeId=req.user.user.officeId
    const { path: filePath, originalname } = req.file;
    officeDetails = await District.findOne({_id: officeId})
    // Check if the uploaded file is an Excel file
    if (!originalname.match(/\.(xlsx|xls)$/i)) {
      fs.unlinkSync(filePath); // Delete the uploaded file
      return res.status(400).json({ error: "Invalid file format. Please upload an Excel file." });
    }

    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    const excelData = xlsx.utils.sheet_to_json(sheet);
console.log(excelData);
    // Validate and sanitize the Excel data
    const vendors = [];
    for (const row of excelData) {
      // Implement validation and sanitation logic here
      // we can use libraries like Joi for validation

      // Example validation: Ensure required fields are present
      if (!row.name || !row.office_name || !row.Gender || !row.Aadhar_No || !row.Bnk_Acc_No|| !row.Ifsc_code||!row.branch_details||!row.desc||!row.gst) {
        fs.unlinkSync(filePath); // Delete the uploaded file
        return res.status(400).json({ error: "Invalid data in Excel file. Required fields are missing." });
      }

      // Sanitize data if needed

      vendors.push(row);
    }
console.log(vendors)
//     // Process and create beneficiaries
    for (let vendor of vendors) {
//       // Create and save the beneficiary using your existing logic
          vendor.office_name=officeId
      const newVendor = new Vendor(vendor);
      await newVendor.save();
      officeDetails.vendor.push(newVendor._id);

    }

    fs.unlinkSync(filePath); // Delete the uploaded file

    res.redirect("/cas/district/vendor");
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




app.get("/cas/district/user", isAuthenticated, async (req, res) => {
  try {
    const {officeId, directorate} = req.user.user;
    const desig=[{name:"ACCOUNTANT"},{name:"HEAD-CLERK"}]
    const district = await District.findOne({_id: officeId})
    console.log("districtOfcDtls",district)
    const users= await User.find({ officeId:officeId}).populate("officeId").populate("designation")
  
    res.render("districtOffice/user", {
      district,
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

app.post("/cas/district/user", isAuthenticated, async (req, res) => {
  try {
    const {officeId,directorate}=req.user.user;
   const {username, designation,office_name,mobile_no, email, password, confirm_pswd}= req.body;
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
      officeId:officeId,
      password:newPswd,
    });
    console.log("userdetails",newUser);
     newUser.save();
    res.redirect("/cas/district/user")
  }else{
    res.json("USER ALREADY EXIST")
  }
  
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
    const vendorDetails=await Vendor.find({ office_name: office_Id }).populate("office_name")
    res.render("districtOffice/vendor", { officeDetails,  username: req.user.user.username,
      designation: req.user.user.designation.name,vendorDetails });
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
      .populate("financial_year");

    // console.log(`paymentdetails`, paymentDetails);

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
      benificiaryData,
      username: req.user.user.username,
      designation: req.user.user.designation.name,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/cas/district/payments/beneficiary/:selectedBeneficiary",async (req, res) => {
  try {
    const benifData = req.params.selectedBeneficiary;
    const benificiaryData = await Beneficiary.findOne({ _id:benifData});
    res.json(benificiaryData.Bnk_Acc_No);
  } catch (error) {
    console.error("Error fetching data:", error);
    res.status(500).json({ error: "Failed to fetch data from the database." });
  }
});

app.post("/cas/district/payment", isAuthenticated, async (req, res) => {
  try {
    const office_Id = req.user.user.officeId;
    console.log(req.body);

    const {
      date,
      mode_of_payment,
      transaction_Id,
      transaction_date,
      sanction_ord_no,
      scheme,
      beneficiaries, // Array of beneficiary objects with name and amount
      components_name,
      amount, //
      totalAmount,
      bank_Acc, // Array of beneficiary bank account numbers
      desc,
    } = req.body;


    const paymentDate = new Date(date); // Assuming "date" is the payment date

    // Find the financial year that corresponds to the payment date
    const financialYear = await FinancialYear.findOne({
      startDate: { $lte: paymentDate },
      endDate: { $gte: paymentDate },
    });

    if (!financialYear) {
      // Financial year not found, handle the error accordingly
      res.status(400).json({ error: "Financial Year not found" });
      return;
    }
    const districtDetails = await District.findOne({ _id: office_Id });
    const schemeDetails = await Scheme.findOne({ _id: scheme });
    const bankDetails = await SchemeBankMaster.findOne({
      office: districtDetails._id,
      scheme: schemeDetails._id,
    });


    const discounter = await DisPayCounter.findOneAndUpdate(
      {
        district: districtDetails.name,
        scheme: schemeDetails.name,
        component: components_name,
        financialYear:financialYear.year,
      },
      { $inc: { count: 1 } }, // Increment the counter by 1
      { upsert: true, new: true } // Create a new document if it doesn't exist
    );

    const district_abbvr = districtDetails.name.slice(0, 3).toUpperCase();
    const scheme_abbvr = schemeDetails.name.slice(0, 3).toUpperCase();
    const component_abbr = components_name.slice(0, 3).toUpperCase();
    

    const voucherNo = generateDisPayVoucherNumber(
      district_abbvr,
      scheme_abbvr,
      component_abbr,
      financialYear.year,
      discounter.count
    );
  // Create an array to store beneficiary data
  const beneficiaryData = beneficiaries.map((beneficiary, index) => ({
    name: beneficiary,
    amount: parseFloat(amount[index] || 0),
    bankAcc: bank_Acc[index],
  }));
  

  // Create and save the combined payment entry
  const disOfcPayment = new DisPayment({
    date,
    mode_of_payment,
    transaction_Id,
    transaction_date,
    sanction_ord_no,
    scheme: schemeDetails._id,
    beneficiaries: beneficiaryData,
    office_name: districtDetails._id,
    components_name,
    from_bank: bankDetails.bankId,
    autoVoucherNo: voucherNo,
    status: "pending",
    amount: totalAmount,
    financial_year: financialYear._id,
    desc,
  });
console.log(disOfcPayment)
  disOfcPayment.save();
  res.redirect(
    `/cas/district/payment?voucher=${encodeURIComponent(voucherNo)}`
  );
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/cas/district/paymentDetails/:paymentId",isAuthenticated,async (req, res) => {
  try {
      const office_Id = req.user.user.officeId;
      const paymentId=req.params.paymentId;
      

      const paymentDetails = await DisPayment.findOne({_id:paymentId})
        .populate("office_name")
        .populate("scheme")
        .populate("from_bank")
        .populate("financial_year")
        .populate("beneficiaries.name")
    
      res.render("districtOffice/paymentDetails", {
        paymentDetails,
        username: req.user.user.username,
        designation: req.user.user.designation.name,
      });
  } catch (error) {
    console.error("Error fetching data:", error);
    res.status(500).json({ error: "Failed to fetch data from the database." });
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
      desc,
    } = req.body;

    const paymentDate = new Date(date); // Assuming "date" is the payment date
    const paymentYear = paymentDate.getFullYear();

    // Find the financial year that corresponds to the payment date
    const financialYear = await FinancialYear.findOne({
      startDate: { $lte: paymentDate },
      endDate: { $gte: paymentDate },
    });

    if (!financialYear) {
      // Financial year not found, handle the error accordingly
      res.status(400).json({ error: "Financial Year not found" });
      return;
    }
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
        financialYear: financialYear.year,
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
      financialYear.year,
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
      financial_year:financialYear._id,
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

      const adjData=await Adjustment.find({office: office_Id }).populate("advance")

    res.render("districtOffice/adjustment", {
      office_details,
      modeofpmnt,
      financialYear,
      advanceDetails,
      voucherNo,
      username: req.user.user.username,
      designation: req.user.user.designation.name,
      adjData
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post('/cas/district/adjustment', isAuthenticated, async (req, res) => {
  try {
    const office_id = req.user.user.officeId;

    const { autoVoucherNo, adjDate, adjAmount, desc } = req.body;

    // Find the advance based on the advanceId
    const advance = await Advance.findOne({ autoVoucherNo: autoVoucherNo, office: office_id });

    if (!advance) {
      return res.status(404).json({ error: 'Advance not found' });
    }

    if (adjAmount > advance.remaining_amount) {
      return res.status(400).json({ error: 'Adjusted amount exceeds remaining amount' });
    }

    // Calculate remaining amount by subtracting adjustments
    const adjustments = await Adjustment.find({ advance: advance._id });
    const totalAdjustedAmount = adjustments.reduce((total, adj) => total + adj.adjAmount, 0);
    const remainingAmount = advance.total_amount - totalAdjustedAmount;

    if (adjAmount > remainingAmount) {
      return res.status(400).json({ error: 'Adjusted amount exceeds remaining amount' });
    }

    // Create a new adjustment entry
    const newAdjustment = new Adjustment({
      advance: advance._id,
      adjDate,
      adjAmount,
      desc,
      office:office_id
    });

    // Save the adjustment
    await newAdjustment.save();

    res.json({ message: 'Adjustment saved successfully' });
  } catch (error) {
    console.error('Error saving adjustment:', error);
    res.status(500).json({ error: 'Internal Server Error' });
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
    console.log(openingBalData)

    if (!Array.isArray(openingBalData.scheme)) {
      // Handle the case when a single entry is submitted
      openingBalData.scheme = [openingBalData.scheme];
      openingBalData.cash = [openingBalData.cash];
      openingBalData.bank = [openingBalData.bank];
      openingBalData.bank_balance = [openingBalData.bank_balance];
      openingBalData.advance = [openingBalData.advance];
      openingBalData.date = [openingBalData.date]; // Add date field
    }

    const newOpeningBalances = await Promise.all(
      openingBalData.scheme.map(async (scheme, index) => {
        const cash = openingBalData.cash[index];
        const bank = openingBalData.bank[index];
        const bank_balance = openingBalData.bank_balance[index];
        const advance = openingBalData.advance[index];
        const date = openingBalData.date[index]; // Get date from the request body

        // Check if an opening balance already exists for this scheme and office
        const existingOpeningBal = await OpeningBalance.findOne({
          scheme,
          office: office_id,
        });

        if (existingOpeningBal) {
          // If an opening balance already exists, update it instead of creating a new one
          // You can add your update logic here if needed
          res.json("OPENING BALANCE ALREADY EXIST IN DATABASE");
        }

        // Process bank details and update balance
        const bnkDetails = await BankDetails.findOne({ accountNumber: bank });
        if (!bnkDetails) {
          throw new Error("Bank details not found");
        }
        bnkDetails.balance =
          parseInt(bnkDetails.balance) + parseInt(bank_balance);
        await bnkDetails.save();

        // Create and save opening balance entry with date
        const newOpeningBal = new OpeningBalance({
          date: new Date(date), // Convert date string to a Date object
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
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
});



app.get('/cas/district/report', isAuthenticated, async (req, res) => {
  try {
    const office_Id = req.user.user.officeId;
    const financialYear = await FinancialYear.find();
    const districtDetails = await District.findOne({ _id: office_Id }).populate('schemes');

    res.render('districtOffice/cash-book-register', {
      districtDetails,
      financialYear,
      office_Id,
      username: req.user.user.username,
      designation: req.user.user.designation.name,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
app.get("/cas/district/report/data", isAuthenticated, async (req, res) => {
  try {
    const office_Id = req.user.user.officeId;
    const selectedSchemes = req.query.selectedSchemes.split(',').map((id) => new mongoose.Types.ObjectId(id.trim())); // Split selected scheme IDs by comma
    console.log(selectedSchemes)
    const filterType = req.query.filterType;
    let startDate, endDate;
    
    

    if (filterType === 'financialYear') {
      const financialYearId = req.query.financialYear;
      const financialYearData = await FinancialYear.findOne({ _id: financialYearId });
      startDate = financialYearData.startDate;
      endDate = financialYearData.endDate;
    } else if (filterType === 'monthly') {
      const selectedMonth = req.query.month; // Get selected month from query parameter
      const year = new Date().getFullYear(); // Get current year
      startDate = new Date(year, selectedMonth - 1, 1); // Month is 0-indexed
      endDate = new Date(year, selectedMonth, 0);
    } else if (filterType === 'dateRange') {
      startDate = new Date(req.query.startDate); // Get start date from query parameter
      endDate = new Date(req.query.endDate);
    }
    console.log(startDate, endDate)
    const paymentRecords = await DisPayment.find({
      office_name: office_Id,
      scheme: { $in: selectedSchemes },
      date: { $gte: startDate, $lte: endDate },
    });
  
    // Process payment records to calculate total amounts for each beneficiary
    const beneficiaryTotals = new Map(); // Use a map to store beneficiary totals

    // Calculate beneficiary totals asynchronously
    await Promise.all(
      paymentRecords.map(async (paymentRecord) => {
        for (const beneficiary of paymentRecord.beneficiaries) {
          const beneficiaryId = beneficiary.name.toString(); // Convert _id to string
          const amount = beneficiary.amount;
    
          if (beneficiaryTotals.has(beneficiaryId)) {
            // Add to existing total
            beneficiaryTotals.set(beneficiaryId, beneficiaryTotals.get(beneficiaryId) + amount);
          } else {
            // Initialize a new total
            beneficiaryTotals.set(beneficiaryId, amount);
          }
        }
      })
    );
    
    // Fetch beneficiary names using _id values asynchronously
    const beneficiaryIds = Array.from(beneficiaryTotals.keys()).map((key) => new mongoose.Types.ObjectId(key));
    const beneficiaryNames = await Beneficiary.find({ _id: { $in: beneficiaryIds } });
    
    // Construct the final result with beneficiary names and totals
    const result = beneficiaryNames.map((beneficiary) => ({
      _id: beneficiary._id,
      beneficiaryName: beneficiary.benificiary_name,
      totalAmount: beneficiaryTotals.get(beneficiary._id.toString()) || 0, // Set default to 0 if no total found
    }));
    
    console.log(result);
    
  
  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});





app.get("/cas/district/schemewise", isAuthenticated, async (req, res) => {
  try {
      const directorateOfc = req.user.user.directorate;
      const office_Id = req.user.user.officeId;
      const financialYear=await FinancialYear.find()
      const districtDetails = await District.findOne({ _id: office_Id }).populate("schemes")
  
  
      res.render("districtOffice/scheme-wise-report", {
       districtDetails,
       financialYear,
       office_Id,
       username: req.user.user.username,
       designation: req.user.user.designation.name,
      });
  } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal Server Error" });
  }
  });
  
  


  app.get('/cas/district/schemewise/:schemeId/:startDate/:endDate', isAuthenticated, async (req, res) => {
    try {
        const office_Id = req.user.user.officeId;
        const { schemeId, startDate, endDate } = req.params;

        // Convert start and end date strings to Date objects
        const startDateTime = new Date(startDate);
        const endDateTime = new Date(endDate);

        const dateData = [];

        // Loop through each day in the date range
        for (let currentDate = startDateTime; currentDate <= endDateTime; currentDate.setDate(currentDate.getDate() + 1)) {
            const openingBalance = await OpeningBalance.findOne({ scheme: schemeId, office: office_Id, date: currentDate }).populate("bank");

            // Fetch Payments for the current day
            const payments = await DisPayment.aggregate([
                {
                    $match: {
                        scheme: new mongoose.Types.ObjectId(schemeId),
                        date: currentDate,
                        office_name: new mongoose.Types.ObjectId(office_Id)
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalBankPayment: { $sum: '$amount' }
                    }
                }
            ]);

            // Fetch Receipts for the current day
            const receipts = await DisReceipt.aggregate([
                {
                    $match: {
                        scheme: new mongoose.Types.ObjectId(schemeId),
                        date: currentDate,
                        office_name: new mongoose.Types.ObjectId(office_Id)
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalBankReceipt: { $sum: '$amount' }
                    }
                }
            ]);

            dateData.push({
                date: currentDate.toDateString(),
                openingBalance: openingBalance ? openingBalance.balance : 0,
                payments: payments[0] ? payments[0].totalBankPayment : 0,
                receipts: receipts[0] ? receipts[0].totalBankReceipt : 0
            });
        }
        console.log(dateData)
        res.json(dateData);
        
    } catch (error) {
        console.error('Error fetching data:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});


app.get("/cas/district/fy-closing", isAuthenticated, async (req, res) => {
  try {
      const directorateOfc = req.user.user.directorate;
      const office_Id = req.user.user.officeId;
      const financialYear=await FinancialYear.find()
      const districtDetails = await District.findOne({ _id: office_Id }).populate("schemes")
  
  
      res.render("districtOffice/fy-closing-report", {
       districtDetails,
       financialYear,
       office_Id,
       username: req.user.user.username,
       designation: req.user.user.designation.name,
      });
  } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal Server Error" });
  }
  });
  
  app.get('/cas/district/fy-closing/:schemeId', isAuthenticated, async (req, res) => {
    try {
      const office_Id = req.user.user.officeId;
      const schemeId = req.params.schemeId;
      const filterType = req.query.filterType;
      let startDate, endDate;
      const scheme_id= await Scheme.findOne({_id:schemeId})
      const bankSchemeDtls= await BankDetails.findOne({office:office_Id, scheme:schemeId })
       console.log(`bnkdtlsssss`,bankSchemeDtls)
      function getFinancialYearDates(financialYear) {
        const [startYear, endYear] = financialYear.split('-').map(Number);
      
        const startDate = new Date(startYear, 3, 1); // Assuming the financial year starts in April (month 3)
        const endDate = new Date((startYear + 1), 2, 31); // Convert endYear to "2024" and set the month to 2 for March
      
        return { startDate, endDate };
      }
  
      if (filterType === 'financialYear') {
        const financialYear = req.query.financialYear;
        if (financialYear !== 'Select') {
          const financialYearValue = await FinancialYear.findOne({ _id: financialYear });
          startDate = financialYearValue.startDate;
          endDate = financialYearValue.endDate;
          console.log(startDate, endDate);
        }
      } else if (filterType === 'monthly') {
        const selectedMonth = req.query.month; // Get selected month from query parameter
        const year = new Date().getFullYear(); // Get current year
        startDate = new Date(req.query.startDate); // Month is 0-indexed
        endDate = new Date(req.query.endDate);
      } else if (filterType === 'dateRange') {
        startDate = new Date(req.query.startDate); // Get start date from query parameter
        endDate = new Date(req.query.endDate);
      }
  
      // Fetch Opening Balance
      const openingBalance = await OpeningBalance.findOne({ scheme: scheme_id._id, office: office_Id }).populate("bank");
      console.log(`QUERY`,req.query)
  
      // Fetch Payments
      const paymentPipeline = [
        { $match: { scheme: scheme_id._id, date: { $gte: startDate, $lte: endDate } } },
        {
          $group: {
            _id: null,
            totalBankPayment: { $sum: '$amount' },
          },
        },
      ];
      const payments = await DisPayment.aggregate([
        {
          $match: { 
            scheme: scheme_id._id,
            date: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: null,
            totalBankPayment: { $sum: '$amount' }
          }
        }
      ]);
  
      // Fetch Receipts
      const receiptPipeline = [
        { $match: { scheme:scheme_id._id, date: { $gte: startDate, $lte: endDate } } },
        {
          $group: {
            _id: null,
            totalBankReceipt: { $sum: '$amount' },
          },
        },
      ];
      const receipts = await DisReceipt.aggregate([
        { $match: { scheme:scheme_id._id, date: { $gte: startDate, $lte: endDate } } },
        {
          $group: {
            _id: null,
            totalBankReceipt: { $sum: '$amount' },
          },
        },
      ]);
  
      // Fetch Advances
      const advancePipeline = [
        { $match: { scheme:new mongoose.Types.ObjectId(scheme_id._id),office:new mongoose.Types.ObjectId(office_Id), date:{ $gte: startDate, $lte: endDate } } },
        {
          $group: {
            _id: null,
            totalAdvance: { $sum: '$amount' },
          },
        },
      ];
      const advances = await Advance.aggregate([
        { $match: {  from_bank:new mongoose.Types.ObjectId(bankSchemeDtls._id),office:new mongoose.Types.ObjectId(office_Id), date: { $gte: startDate, $lte: endDate } } },
        {
          $group: {
            _id: null,
            totalAdvance: { $sum: '$amount' },
          },
        },
      ]);
  console.log(`paymentsssssssss`,advances)
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

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});

//203.193.144.19:80
