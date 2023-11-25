function generateDisRecVoucherNumber(directorate, department, scheme, financialYear, counter) {
    const formattedCounter3 = counter.toString().padStart(5, '0');
    return `${directorate}/${department}/${scheme}/R-${financialYear}/${formattedCounter3}`;
  }

  module.exports = generateDisRecVoucherNumber;