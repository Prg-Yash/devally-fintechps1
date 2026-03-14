import { createThirdwebClient, getContract, readContract } from "thirdweb";
import { sepolia } from "thirdweb/chains";

const client = createThirdwebClient({ clientId: "6b709648a496639e20d7ac13275ebc15" });
const contract = getContract({ client, chain: sepolia, address: "0xA66983663d72ec5B521aA3082635EfbB52C764AA" });

async function main() {
  try {
    const name = await readContract({ contract, method: "function name() view returns (string)" });
    console.log("Token Name:", name);
  } catch (e) {
    console.error("Name error", e);
  }
}
main();
