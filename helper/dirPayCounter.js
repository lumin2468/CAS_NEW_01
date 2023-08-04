function generateVoucherNumber(directorate, district, scheme, financialYear, counter) {
    const formattedCounter1 = counter.toString().padStart(5, '0');
    return `${directorate}/${district}/${scheme}/P-${financialYear}/${formattedCounter1}`;
  }


module.exports =generateVoucherNumber