const { consolidatedSchema } = require("../../../models/master")

const {User,Designation,DistrictName,FinancialYear, modeofPayment}= consolidatedSchema
const mongoose = require('mongoose');

// Increase the default timeout value (in milliseconds)

mongoose.connect('mongodb+srv://Admin:8r2orA6FnbbZZXOS@cluster0.s121j0z.mongodb.net/', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  socketTimeoutMS: 30000, // 30 seconds timeout
});
// director123
//dfo123
// const seed=async()=>{
//     const dfo= new User({name:'DFO', email: 'dfo@example.com', password: '$2a$12$1Kqa5P2G6BQKtxFffV4ixOdb3RpFwp5xZKc42vzIvX1hNlIWH1oTm'
//     , mobile: '9783267998', designation:'64c18b38b82d864ecf8eefbb', directorateId:'64c18f2c7690204365a3e915',officeId:'64c4ddd09845283bb46cd17d'})
   
//     console.log(dfo)
//     dfo.save()
// }

// const seed=async () =>{
//   const newFinanceYear=new FinancialYear({year:'2023-24'})
//   newFinanceYear.save()
// }
const seed=async () =>{
    const modeofpmnt=new modeofPayment({name:'Cash'})
    console.log(modeofpmnt)
    modeofpmnt.save()
  }

// const seed=async()=>{
//     const district= new DistrictName({name:'Cuttack'})
//     const newDis=await district
//     console.log(newDis)
//     newDis.save()
// }
seed()

// const seed=async()=>{
//     const designation= new Designation({name:'CDVO'})
//     const newDesg=await designation
//     newDesg.save()
// }


