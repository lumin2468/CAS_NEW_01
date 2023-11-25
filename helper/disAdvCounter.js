 function generateDisAdvVoucherNumber( office,party, purpose,financialYear, counter) {
    const formattedCounter5 = counter.toString().padStart(5, '0');
    return `${office}/${party}/${purpose}/Adv-${financialYear}/${formattedCounter5}`;
  }

  

  module.exports = generateDisAdvVoucherNumber

  