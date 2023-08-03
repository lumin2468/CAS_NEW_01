module.exports = function generateVoucherNumber(directorate, district, scheme, financialYear, counter) {
    const formattedCounter = counter.toString().padStart(5, '0');
    return `${directorate}/${district}/${scheme}/P-${financialYear}/${formattedCounter}`;
  }


  module.exports = function generateRecVoucherNumber(directorate, department, purpose, financialYear, counter) {
    const formattedCounter = counter.toString().padStart(5, '0');
    return `${directorate}/${department}/${purpose}/R-${financialYear}/${formattedCounter}`;
  }

  module.exports = function generateDisRecVoucherNumber(directorate, department, scheme, financialYear, counter) {
    const formattedCounter = counter.toString().padStart(5, '0');
    return `${directorate}/${department}/${scheme}/R-${financialYear}/${formattedCounter}`;
  }

  module.exports = function generateDisPayVoucherNumber( district,benificiary, scheme, component, financialYear, counter) {
    const formattedCounter = counter.toString().padStart(5, '0');
    return `${district}/${benificiary}/${scheme}/${component}/P-${financialYear}/${formattedCounter}`;
  }

  
  module.exports = function generateDisAdvVoucherNumber( district,party, purpose,financialYear, counter) {
    const formattedCounter = counter.toString().padStart(5, '0');
    return `${district}/${party}/${purpose}/Adv-${financialYear}/${formattedCounter}`;
  }


  