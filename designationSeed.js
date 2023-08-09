
const mongoose = require('mongoose');
const {consolidatedSchema}= require('./models/master');
const {User}=consolidatedSchema

mongoose.connect('mongodb+srv://Admin:8r2orA6FnbbZZXOS@cluster0.s121j0z.mongodb.net/', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => {
    console.log('Connected to MongoDB');
    seedUser();
  })
  .catch((error) => {
    console.error('Error connecting to MongoDB:', error);
  });
  async function seedUser() {
    try {
      // Check if the "admin" designation already exists

  
      // Create a new "admin" designation
      const newUser = new User({
        
name:"Director Animal Husbandry",
email:"director2@example.com",
password:"$2a$12$XLAzgzb./jRXxAFnK01FmuXYKmE5SGxSQVfXDwD0q8joZZsMnHmMi",
designation:"64c18b20f266f19d9a36be72",
mobile:8766787878,
directorateId:'64d084d1cfded27354578704'

        // Add other fields as needed
      });
        newUser.save()
      // Save the "admin" designation to the database
    
  
      // Close the MongoDB connection
      mongoose.connection.close();
    } catch (error) {
      console.error('Error seeding designation:', error);
    }
  }
