 function generateDisPayVoucherNumber( district,benificiary, scheme, component, financialYear, counter) {
    const formattedCounter4 = counter.toString().padStart(5, '0');
    return `${district}/${benificiary}/${scheme}/${component}/P-${financialYear}/${formattedCounter4}`;
  }

  module.exports=generateDisPayVoucherNumber;