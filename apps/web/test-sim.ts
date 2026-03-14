import { createThirdwebClient, getContract, readContract } from "thirdweb";
import { sepolia } from "thirdweb/chains";

const client = createThirdwebClient({ clientId: "6b709648a496639e20d7ac13275ebc15" });
const pusdContract = getContract({ client, chain: sepolia, address: "0xA66983663d72ec5B521aA3082635EfbB52C764AA" });
const escrowContract = getContract({ client, chain: sepolia, address: "0x9fA56Ec0eC3f22A52d9b8ac6Df8Ae7b7A253E41C" });

async function main() {
  try {
    const owner = "0x26f37619c57a5Bac2f43359575C7906684d9dC3D";
    const balance = await readContract({ contract: pusdContract, method: "function balanceOf(address) view returns (uint256)", params: [owner] });
    console.log("PUSD Balance of owner:", balance.toString());
    
    // Check allowance just in case
    const allowance = await readContract({ contract: pusdContract, method: "function allowance(address,address) view returns (uint256)", params: [owner, escrowContract.address] });
    console.log("Allowance for escrow:", allowance.toString());

  } catch (e) {
    console.error("Error reading contracts:", e);
    return;
  }
}
main();
