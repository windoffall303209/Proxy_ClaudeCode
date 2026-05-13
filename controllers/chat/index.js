// Gộp controller chat phía khách hàng và admin để route chỉ import một module duy nhất.
module.exports = {
    ...require('./customerController'),
    ...require('./adminController')
};
