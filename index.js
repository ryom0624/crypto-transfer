/*
  ether.jsを利用して暗号資産を送付するコマンドラインを作成します。
  送付先ウォレットアドレスと送付額が記載されたcsvを読み取ります。
  リストに存在するウォレットアドレスに対して、
  1つずつターミナルに送付アドレスと送付額の表示とconfirmを設けてOKであればyを受け付けて送付を行います。
  Noの場合はnを入れて次のウォレットに移ります。
  リストにあるウォレットを1行ずつ繰り返しを行い消化します。
  送付が終わったら、完了したリストをcsvのリストに追記していきます。
  追記する項目は、完了したか否かのフラグと、送付したトランザクションID、使用したガス代を追記します。
  完了したフラグが1の場合は、送付済みとして処理をスキップします。
  完了したフラグが0の場合は、送付を行い冪等性を担保します。
  送付元のウォレットアドレスに関しては .envファイルから秘密鍵を読み込みます。


  To implement the command-line interface for sending cryptocurrency using ether.js, you will need to:

  Read the CSV file containing the destination wallet addresses and amounts to send.
  Iterate through the list of wallet addresses one by one.
  For each wallet address, display the address and amount to be sent in the terminal and prompt the user to confirm the transaction by entering 'y' or 'n'.
  If the user enters 'y', send the transaction and record the transaction ID and gas fee used in a separate CSV file.
  If the user enters 'n', move on to the next wallet address.
  After all transactions have been processed, append the completed transactions to the original CSV file with a flag indicating whether the transaction was successful or not.
  If the flag is set to 1, skip the transaction and move on to the next one.
  If the flag is set to 0, send the transaction again to ensure idempotency.
  Load the private key for the sending wallet address from the .env file.

*/

const fs = require("fs");
const parse = require("csv-parser");
const prompt = require("prompt");
const { ethers, BigNumber } = require("ethers");
// const { ethers } = require("hardhat");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;

const csvFile = "./data/transactions.csv";

const CurrecySymbol = "SBY";

// replace Date().toISOString() to yyyymmddhhmmss
const date = new Date().toISOString().replace(/[-:.]/g, "").replace("T", "").replace("Z", "").split(".")[0];

require("dotenv").config();
const privateKey = process.env.PRIVATE_KEY ?? "";
const wallet = new ethers.Wallet(privateKey);
const rpcUrl = process.env.RPC_URL ?? "";
const provider = new ethers.providers.JsonRpcProvider(rpcUrl);

// const provider = new ethers.providers.JsonRpcProvider("http://127.0.0.1:8545");
// const provider = new ethers.providers.getDefaultProvider("homestead");
// const provider = new ethers.providers.getDefaultProvider();
// const provider = ethers.providers.getDefaultProvider();

provider.getNetwork().then((network) => {
  console.log(`Network: ${network.name} (${network.chainId})`);
  return;
});

const walletConnected = wallet.connect(provider);
const defaultGasLimit = 21000;

async function sendTransactions() {
  console.log(
    `==================================\nOwner Address: ${wallet.address}\nBalance: ${ethers.utils.formatEther(
      await walletConnected.getBalance()
    )}\n==================================\n`
  );

  try {
    const results = [];
    const stream = fs.createReadStream(csvFile).pipe(parse());
    let totalAmount = 0;
    let totalAddresses = 0;
    let skipped = 0;
    let skippedAmount = 0;
    // let actualTotalGasCost = BigNumber.from(0);
    // let actualPaymentAmount = BigNumber.from(0);

    for await (const result of stream) {
      if (result.completed === "1") {
        console.log(`Skipping completed to send address: ${result.address} amount: ${result.amount}`);
        results.push(result);
        skipped++;
        skippedAmount += parseFloat(result.amount);
        continue;
      }
      results.push(result);
      totalAmount += parseFloat(result.amount);
      // console.log(totalAmount);
      totalAddresses++;
    }

    console.log("");

    const estimatedGasPrice = await provider.getGasPrice();
    const estimatedTotalGasCost = estimatedGasPrice.mul(defaultGasLimit).mul(totalAddresses);

    const balance = await walletConnected.getBalance();
    const totalCost = ethers.utils.parseEther(totalAmount.toString()).add(estimatedTotalGasCost);

    console.log(`==================================`);
    console.log(`Total Addresses Skipped: ${skipped}`);
    console.log(`Total Amount Skipped: ${skippedAmount} ${CurrecySymbol}`);
    console.log(`Total Addresses: ${totalAddresses}`);
    console.log(`Total Amount to Send: ${totalAmount} ${CurrecySymbol}`);
    console.log("");
    console.log(
      `Estimated Total Gas Cost: ${ethers.utils.formatEther(estimatedTotalGasCost)} ${CurrecySymbol}\n(${ethers.utils.formatEther(
        estimatedGasPrice
      )}${CurrecySymbol} * Gas Limit ${defaultGasLimit} = ${ethers.utils.formatEther(
        estimatedGasPrice.mul(defaultGasLimit)
      )} ${CurrecySymbol} * ${totalAddresses} addresses)`
    );
    console.log("");
    console.log("");
    console.log(`Current Balance: ${ethers.utils.formatEther(balance)} ${CurrecySymbol}`);
    console.log(`Total Estimated Payment: ${ethers.utils.formatEther(totalCost)} ${CurrecySymbol}`);
    console.log(`Estimate Left After Sending: ${ethers.utils.formatEther(balance.sub(totalCost))} ${CurrecySymbol}`);
    console.log(`==================================`);
    console.log("");

    if (balance.lt(totalCost)) {
      console.log("Insufficient funds. Exiting...");
      return;
    }
    if (results.length === skipped) {
      console.log("No transactions to send. Exiting...");
    }

    for (const result of results) {
      if (result.completed === "1") {
        continue;
      }

      const estimatedGasPrice = await provider.getGasPrice();
      const estimatedGasCost = estimatedGasPrice.mul(defaultGasLimit);
      const formattedEstimatedGasCost = ethers.utils.formatEther(estimatedGasCost);
      console.log(`Sending ${result.amount} ${CurrecySymbol} to ${result.address}？\n(Gas Estimate: ${formattedEstimatedGasCost} ${CurrecySymbol})`);
      // const confirm = "y";
      const { confirm } = await prompt.get({
        properties: {
          confirm: {
            description: "Confirm transaction (y/N/quit)",
            pattern: /^(y|N|quit)$/,
            message: 'Please enter "Y", "n", or "quit"',
            required: true,
          },
        },
      });

      if (confirm === "quit") {
        console.log("Exiting...\n");
        break;
      }

      if (confirm === "y") {
        const tx = await walletConnected.sendTransaction({
          to: result.address,
          value: ethers.utils.parseEther(result.amount),
        });
        console.log("Sending...");

        // write to log file to yyyymmddhhmmss-sendtransaction.log
        const logFile = `./logs/${date}-sendtransaction.log`;
        fs.appendFileSync(logFile, `${JSON.stringify(tx)}\n`);

        const receipt = await tx.wait();
        console.log(`Transaction is accepted: ${receipt.transactionHash}\nNext..\n-----------------------------------------`);

        // write to log file to yyyymmddhhmmss-receipt-transaction.log
        const receiptLogFile = `./logs/${date}-receipt-transaction.log`;
        fs.appendFileSync(receiptLogFile, `${JSON.stringify(receipt)}\n`);

        result.txid = receipt.transactionHash;
        result.gas = receipt.gasUsed.toString();
        result.completed = "1";

        // calculate actual payment amount and total gas cost
        // result.amount is string, e.g. "100" ether
        // actualPaymentAmount = actualPaymentAmount.add(BigNumber.from(result.amount));
        // actualTotalGasCost += parseFloat(receipt.gasUsed.mul(estimatedGasPrice));
      } else {
        console.log(`Transaction skipped: ${result.address}`);
      }
    }

    const csvWriter = createCsvWriter({
      path: csvFile,
      header: [
        { id: "address", title: "address" },
        { id: "amount", title: "amount" },
        { id: "txid", title: "txid" },
        { id: "gas", title: "gas" },
        { id: "completed", title: "completed" },
      ],
    });

    const balanceAfter = await walletConnected.getBalance();

    console.log("");
    console.log(`==================================`);
    console.log(`Balance After: ${ethers.utils.formatEther(balanceAfter)} ${CurrecySymbol}`);
    console.log("");
    // console.log(`Total Actual Amount: ${actualPaymentAmount} ETH`);
    // console.log(`Total Actual Gas Cost: ${actualTotalGasCost} ETH`);
    // console.log(`Total Actual Paid Amount: ${parseFloat(actualPaymentAmount) + actualTotalGasCost} ETH`);
    // console.log(
    //   `Difference of gas cost: ${actualTotalGasCost - parseFloat(estimatedTotalGasCost)} ETH ${
    //     actualTotalGasCost > parseFloat(estimatedTotalGasCost) ? "actual > estimated" : "actual < estimated"
    //   }`
    // );
    console.log(`==================================`);

    await csvWriter.writeRecords(results);
  } catch (error) {
    console.error(error);
  }
}

sendTransactions();
