const fs = require("fs");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;
const totalGenerated = 3;
const maximumAmount = 2;

// Generate a random Ethereum address
function generateRandomAddress() {
  let address = "0x";
  const characters = "0123456789abcdef";
  for (let i = 0; i < 40; i++) {
    address += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return address;
}

// Generate a random amount between 1 and 100
function generateRandomAmount() {
  return (Math.random() * maximumAmount - 1 + 1).toFixed(0);
}

const records = [];

for (let i = 0; i < totalGenerated; i++) {
  records.push({
    address: generateRandomAddress(),
    amount: generateRandomAmount(),
    txid: "",
    gas: "",
    completed: "0",
  });
}

const csvWriter = createCsvWriter({
  path: "./data/transactions.csv",
  header: [
    { id: "address", title: "address" },
    { id: "amount", title: "amount" },
    { id: "txid", title: "txid" },
    { id: "gas", title: "gas" },
    { id: "completed", title: "completed" },
  ],
});

csvWriter.writeRecords(records).then(() => {
  console.log(`testdata was generated with ${totalGenerated} records`);
});
