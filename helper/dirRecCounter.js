function generateRecVoucherNumber(directorate, department, scheme, financialYear, counter) {
    const formattedCounter2 = counter.toString().padStart(5, '0');
    return `${directorate}/${department}/${scheme}/R-${financialYear}/${formattedCounter2}`;
  }

  module.exports = generateRecVoucherNumber