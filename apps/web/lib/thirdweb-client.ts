import { createThirdwebClient } from "thirdweb";

const clientId = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || "6b709648a496639e20d7ac13275ebc15";

export const thirdwebClient = createThirdwebClient({
  clientId,
});
