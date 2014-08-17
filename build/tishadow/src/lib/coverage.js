function getCoverage() {
    return typeof __coverage__ !== "undefined" ? JSON.stringify(__coverage__) : null;
}

module.exports = {
    getCoverage: getCoverage
};