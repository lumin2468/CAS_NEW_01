const mongoose = require('mongoose');
const { Designation } = require('./models/schema');

mongoose.connect('mongodb+srv://Admin:8r2orA6FnbbZZXOS@cluster0.s121j0z.mongodb.net/', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => {
    console.log('Connected to MongoDB');
    seedDesignation();
  })
  .catch((error) => {
    console.error('Error connecting to MongoDB:', error);
  });
  async function seedDesignation() {
    try {
      // Check if the "admin" designation already exists
      const existingDesignation = await Designation.findOne({ name: 'admin' });
      if (existingDesignation) {
        console.error('Designation "admin" already exists');
        return;
      }
  
      // Create a new "admin" designation
      const adminDesignation = new Designation({
        name: 'admin',
        // Add other fields as needed
      });
  
      // Save the "admin" designation to the database
      const savedDesignation = await adminDesignation.save();
      console.log('Admin designation created:', savedDesignation);
  
      // Close the MongoDB connection
      mongoose.connection.close();
    } catch (error) {
      console.error('Error seeding designation:', error);
    }
  }
  