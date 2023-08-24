 function generateDisPayVoucherNumber( district, scheme, component, financialYear, counter) {
    const formattedCounter4 = counter.toString().padStart(5, '0');
    return `${district}/${scheme}/${component}/P-${financialYear}/${formattedCounter4}`;
  }

  module.exports=generateDisPayVoucherNumber;