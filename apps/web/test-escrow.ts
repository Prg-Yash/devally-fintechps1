import { createThirdwebClient, getContract, readContract } from "thirdweb";
import { sepolia } from "thirdweb/chains";

const client = createThirdwebClient({ clientId: "6b709648a496639e20d7ac13275ebc15" });
const contract = getContract({ client, chain: sepolia, address: "0x9fA56Ec0eC3f22A52d9b8ac6Df8Ae7b7A253E41C" });

async function main() {
  try {
    const token = await readContract({ contract, method: "function pusd() view returns (address)" });
    console.log("Token in Escrow (pusd):", token);
  } catch (e) {
    try {
      const token2 = await readContract({ contract, method: "function PUSD() view returns (address)" });
      console.log("Token in Escrow (PUSD):", token2);
    } catch (e2) {
      console.error("Could not find PUSD token variable on the Escrow contract");
    }
  }
}
main();
