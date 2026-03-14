import { createThirdwebClient, getContract, readContract, prepareContractCall } from "thirdweb";
import { sepolia } from "thirdweb/chains";

const client = createThirdwebClient({ clientId: "6b709648a496639e20d7ac13275ebc15" });
const contract = getContract({ client, chain: sepolia, address: "0xA66983663d72ec5B521aA3082635EfbB52C764AA" });

async function main() {
  try {
    const domain = await readContract({ contract, method: "function eip712Domain() view returns (bytes1 fields, string name, string version, uint256 chainId, address verifyingContract, bytes32 salt, uint256[] extensions)" });
    console.log("Domain:", domain);
  } catch (e) {
    console.error("Domain error", e);
  }
}
main();
