 function generateDisAdvVoucherNumber( district,benificiary, scheme, component, financialYear, counter) {
    const formattedCounter5 = counter.toString().padStart(5, '0');
    return `${district}/${benificiary}/${scheme}/${component}/P-${financialYear}/${formattedCounter5}`;
  }

  

  module.exports = generateDisAdvVoucherNumber