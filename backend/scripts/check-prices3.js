const prices = require('./unis-prices.json');
[108, 110, 111, 125].forEach(id => {
  const key = String(id);
  if (prices[key]) {
    console.log(`${id}: unis-prices.json = ${JSON.stringify(prices[key])}`);
  } else {
    console.log(`${id}: NOT in unis-prices.json`);
  }
});
