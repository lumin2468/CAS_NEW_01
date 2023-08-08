
const mongoose = require('mongoose');
const {consolidatedSchema}= require('./models/master');
const {DistrictName}=consolidatedSchema

mongoose.connect('mongodb+srv://Admin:8r2orA6FnbbZZXOS@cluster0.s121j0z.mongodb.net/', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => {
    console.log('Connected to MongoDB');
    seedDistrict();
  })
  .catch((error) => {
    console.error('Error connecting to MongoDB:', error);
  });
  async function seedDistrict() {
    try {
      // Check if the "admin" designation already exists

  
      // Create a new "admin" designation
      const newDistrict = new DistrictName({
        name: 'Puri',
        // Add other fields as needed
      });
        newDistrict.save()
      // Save the "admin" designation to the database
    
  
      // Close the MongoDB connection
      mongoose.connection.close();
    } catch (error) {
      console.error('Error seeding designation:', error);
    }
  }
  