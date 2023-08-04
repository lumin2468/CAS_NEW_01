function generateRecVoucherNumber(directorate, department, purpose, financialYear, counter) {
    const formattedCounter2 = counter.toString().padStart(5, '0');
    return `${directorate}/${department}/${purpose}/R-${financialYear}/${formattedCounter2}`;
  }

  module.exports = generateRecVoucherNumber